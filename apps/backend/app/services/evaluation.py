"""Service layer for resume evaluation generation and retrieval."""

import hashlib
import json
import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import ValidationError

from app.database import Database
from app.llm import complete_json, get_llm_config, get_model_name, get_safe_max_tokens
from app.prompts.evaluation import (
    PROMPT_VERSION,
    build_evaluation_prompt,
)
from app.schemas.evaluation import (
    EvaluationDimensionScores,
    EvaluationEvidenceItem,
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)

logger = logging.getLogger(__name__)

LOCAL_PROVIDERS_WITHOUT_KEYS = {"ollama", "openai_compatible"}


class EvaluationError(Exception):
    """Base error for evaluation operations."""


class EvaluationConfigError(EvaluationError):
    """Raised when evaluation cannot run because LLM config is incomplete."""


class EvaluationProviderError(EvaluationError):
    """Raised when the LLM provider fails or returns unusable output."""


def _stable_json(value: Any) -> str:
    """Serialize data deterministically for hashing."""
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )


def _resume_payload(resume_record: dict[str, Any]) -> Any:
    """Return the canonical resume payload used by hashing and prompts."""
    processed_data = resume_record.get("processed_data")
    if processed_data:
        return deepcopy(processed_data)

    content = resume_record.get("content")
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"content": content}

    return {"content": content or ""}


def _resume_text(resume_payload: Any) -> str:
    """Render a resume payload as stable prompt text."""
    if isinstance(resume_payload, str):
        return resume_payload
    return json.dumps(
        resume_payload,
        sort_keys=True,
        indent=2,
        ensure_ascii=False,
        default=str,
    )


def build_evaluation_source_hash(
    *,
    phase: EvaluationPhase,
    resume_payload: Any,
    job_content: str | None,
    baseline_resume_payload: Any | None,
    prompt_version: str = PROMPT_VERSION,
) -> str:
    """Build a stable source hash for evaluation caching and stale checks."""
    source = {
        "phase": phase,
        "resume_payload": resume_payload,
        "job_content": job_content or "",
        "baseline_resume_payload": baseline_resume_payload,
        "prompt_version": prompt_version,
    }
    return hashlib.sha256(_stable_json(source).encode("utf-8")).hexdigest()


def _job_content(database: Database, job_id: str | None) -> str | None:
    """Return job content for an optional job id."""
    if not job_id:
        return None
    job = database.get_job(job_id)
    if not job:
        return None
    content = job.get("content")
    return content if isinstance(content, str) else None


def _current_source_hash_for_record(
    *,
    database: Database,
    record: dict[str, Any],
) -> str | None:
    """Recompute a stored evaluation hash from current source records."""
    resume = database.get_resume(str(record.get("resume_id", "")))
    if not resume:
        return None

    baseline_payload = None
    baseline_resume_id = record.get("baseline_resume_id")
    if baseline_resume_id:
        baseline = database.get_resume(str(baseline_resume_id))
        if not baseline:
            return None
        baseline_payload = _resume_payload(baseline)

    return build_evaluation_source_hash(
        phase=record.get("phase", "readiness"),
        resume_payload=_resume_payload(resume),
        job_content=_job_content(database, record.get("job_id")),
        baseline_resume_payload=baseline_payload,
        prompt_version=PROMPT_VERSION,
    )


def _response_with_stale_flag(
    *,
    database: Database,
    record: dict[str, Any] | None,
) -> ResumeEvaluationResponse | None:
    """Convert a stored record to a response with a current stale flag."""
    if not record:
        return None

    payload = dict(record)
    current_hash = _current_source_hash_for_record(database=database, record=record)
    payload["stale"] = current_hash is None or current_hash != record.get("source_hash")
    return ResumeEvaluationResponse.model_validate(payload)


def _clean_items(items: Any) -> tuple[list[dict[str, Any]], int]:
    """Validate evaluation evidence items, dropping malformed entries."""
    if items is None:
        return [], 0
    if not isinstance(items, list):
        return [], 1

    cleaned: list[dict[str, Any]] = []
    dropped = 0
    for item in items:
        if not isinstance(item, dict):
            dropped += 1
            continue
        try:
            cleaned.append(EvaluationEvidenceItem.model_validate(item).model_dump())
        except ValidationError:
            dropped += 1
    return cleaned, dropped


def clean_evaluation_result(
    raw_result: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    """Clean and validate untrusted evaluation JSON from the LLM."""
    if not isinstance(raw_result, dict):
        raise EvaluationProviderError("Evaluation provider returned invalid JSON.")

    cleaned: dict[str, Any] = {
        "overall_score": raw_result.get("overall_score", 0),
        "confidence": raw_result.get("confidence", 0),
        "dimensions": EvaluationDimensionScores.model_validate(
            raw_result.get("dimensions") or {}
        ).model_dump(),
    }

    dropped_total = 0
    for key in ("strengths", "gaps", "next_actions"):
        cleaned_items, dropped = _clean_items(raw_result.get(key, []))
        cleaned[key] = cleaned_items
        dropped_total += dropped

    warnings: list[str] = []
    if dropped_total:
        warnings.append(f"Dropped {dropped_total} malformed evaluation item(s).")

    return cleaned, warnings


def list_resume_evaluations(
    *,
    database: Database,
    resume_id: str,
    job_id: str | None = None,
) -> ResumeEvaluationListResponse:
    """List evaluations directly attached to a resume or anchored baseline."""
    records_by_id: dict[str, dict[str, Any]] = {}
    for record in database.list_evaluations(resume_id=resume_id, job_id=job_id):
        records_by_id[str(record["evaluation_id"])] = record
    for record in database.list_evaluations_for_baseline(
        baseline_resume_id=resume_id,
        job_id=job_id,
    ):
        records_by_id[str(record["evaluation_id"])] = record

    records = sorted(
        records_by_id.values(),
        key=lambda item: item.get("created_at", ""),
        reverse=True,
    )
    evaluations = [
        response
        for record in records
        if (
            response := _response_with_stale_flag(
                database=database,
                record=record,
            )
        )
        is not None
    ]
    return ResumeEvaluationListResponse(evaluations=evaluations)


def get_latest_resume_evaluations(
    *,
    database: Database,
    resume_id: str,
    job_id: str | None = None,
) -> LatestResumeEvaluationsResponse:
    """Return latest readiness, pre-tailor, and post-tailor evaluations."""
    readiness = database.get_latest_evaluation(
        resume_id=resume_id,
        phase="readiness",
    )

    if job_id:
        paired_job_id = job_id
        post_tailor = (
            database.get_latest_evaluation_for_baseline(
                baseline_resume_id=resume_id,
                phase="post_tailor",
                job_id=job_id,
            )
            or database.get_latest_evaluation(
                resume_id=resume_id,
                phase="post_tailor",
                job_id=job_id,
            )
        )
    else:
        post_tailor = (
            database.get_latest_evaluation_for_baseline(
                baseline_resume_id=resume_id,
                phase="post_tailor",
            )
            or database.get_latest_evaluation(
                resume_id=resume_id,
                phase="post_tailor",
            )
        )
        paired_job_id = post_tailor.get("job_id") if post_tailor else None

    pre_tailor = database.get_latest_evaluation(
        resume_id=resume_id,
        phase="pre_tailor",
        job_id=paired_job_id,
    )

    return LatestResumeEvaluationsResponse(
        readiness=_response_with_stale_flag(database=database, record=readiness),
        pre_tailor=_response_with_stale_flag(database=database, record=pre_tailor),
        post_tailor=_response_with_stale_flag(database=database, record=post_tailor),
    )


def _require_llm_config(config: Any) -> None:
    """Validate that the provider has enough config to call the LLM."""
    provider = getattr(config, "provider", "")
    api_key = getattr(config, "api_key", "")
    if not api_key and provider not in LOCAL_PROVIDERS_WITHOUT_KEYS:
        raise EvaluationConfigError(
            "LLM configuration is missing an API key for resume evaluation."
        )


def _load_sources(
    *,
    database: Database,
    resume_id: str,
    request: ResumeEvaluationRequest,
) -> tuple[dict[str, Any], Any, str | None, str | None, Any | None]:
    """Load resume, job, and optional baseline source data."""
    resume = database.get_resume(resume_id)
    if not resume:
        raise EvaluationError(f"Resume not found: {resume_id}")

    job_content = None
    if request.job_id:
        job = database.get_job(request.job_id)
        if not job:
            raise EvaluationError(f"Job not found: {request.job_id}")
        job_content = str(job.get("content") or "")

    baseline_resume_id = request.baseline_resume_id
    if request.phase == "post_tailor" and not baseline_resume_id:
        parent_id = resume.get("parent_id")
        baseline_resume_id = str(parent_id) if parent_id else None

    baseline_payload = None
    if baseline_resume_id:
        baseline = database.get_resume(baseline_resume_id)
        if not baseline:
            raise EvaluationError(f"Baseline resume not found: {baseline_resume_id}")
        baseline_payload = _resume_payload(baseline)

    return (
        resume,
        _resume_payload(resume),
        job_content,
        baseline_resume_id,
        baseline_payload,
    )


async def create_resume_evaluation(
    *,
    database: Database,
    resume_id: str,
    request: ResumeEvaluationRequest,
) -> ResumeEvaluationResponse:
    """Create or return a cached resume evaluation."""
    (
        resume,
        resume_payload,
        job_content,
        baseline_resume_id,
        baseline_payload,
    ) = _load_sources(database=database, resume_id=resume_id, request=request)

    source_hash = build_evaluation_source_hash(
        phase=request.phase,
        resume_payload=resume_payload,
        job_content=job_content,
        baseline_resume_payload=baseline_payload,
        prompt_version=PROMPT_VERSION,
    )
    if not request.force_refresh:
        cached = database.get_evaluation_by_source_hash(source_hash)
        if cached:
            return ResumeEvaluationResponse.model_validate({**cached, "stale": False})

    config = get_llm_config()
    _require_llm_config(config)
    model_name = get_model_name(config)
    max_tokens = get_safe_max_tokens(model_name, 4096)

    prompt = build_evaluation_prompt(
        phase=request.phase,
        resume_text=_resume_text(resume_payload),
        job_content=job_content,
        baseline_resume_text=_resume_text(baseline_payload)
        if baseline_payload is not None
        else None,
    )

    try:
        result = await complete_json(
            prompt,
            config=config,
            max_tokens=max_tokens,
            schema_type="keywords",
        )
    except Exception as exc:
        logger.warning("Resume evaluation LLM call failed: %s", exc)
        raise EvaluationProviderError("Resume evaluation provider failed.") from exc

    cleaned, warnings = clean_evaluation_result(result)
    payload = {
        **cleaned,
        "evaluation_id": str(uuid4()),
        "resume_id": resume["resume_id"],
        "baseline_resume_id": baseline_resume_id,
        "job_id": request.job_id,
        "phase": request.phase,
        "model": model_name,
        "provider": getattr(config, "provider", ""),
        "prompt_version": PROMPT_VERSION,
        "source_hash": source_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "stale": False,
        "warnings": warnings,
    }
    return ResumeEvaluationResponse.model_validate(database.create_evaluation(payload))
