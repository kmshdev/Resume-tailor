"""Unit tests for resume evaluation schemas and storage helpers."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.database import Database
from app.schemas.evaluation import (
    EvaluationDimensionScores,
    EvaluationEvidenceItem,
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)
from app.services.evaluation import (
    EvaluationConfigError,
    PROMPT_VERSION,
    build_evaluation_source_hash,
    clean_evaluation_result,
    create_resume_evaluation,
    get_latest_resume_evaluations,
)


def test_evaluation_scores_are_clamped() -> None:
    response = ResumeEvaluationResponse(
        evaluation_id="eval-1",
        resume_id="resume-1",
        baseline_resume_id=None,
        job_id=None,
        phase="readiness",
        overall_score=140,
        confidence=2,
        dimensions={
            "clarity": -5,
            "impact": 101,
            "ats_readability": 88,
            "keyword_alignment": 50,
            "role_fit": 50,
            "evidence_strength": 50,
        },
        strengths=[],
        gaps=[],
        next_actions=[],
        model="test-model",
        provider="openai",
        prompt_version="resume_evaluation_v1",
        source_hash="hash",
        created_at="2026-05-13T00:00:00+00:00",
        stale=False,
        warnings=[],
    )

    assert response.overall_score == 100
    assert response.confidence == 1
    assert response.dimensions.clarity == 0
    assert response.dimensions.impact == 100


def test_pre_tailor_requires_job_id() -> None:
    with pytest.raises(ValueError, match="job_id"):
        ResumeEvaluationRequest(phase="pre_tailor")


def test_post_tailor_accepts_baseline_resume_id() -> None:
    request = ResumeEvaluationRequest(
        phase="post_tailor",
        job_id="job-1",
        baseline_resume_id="resume-master",
    )

    assert request.phase == "post_tailor"
    assert request.job_id == "job-1"
    assert request.baseline_resume_id == "resume-master"


def test_evidence_item_requires_source_or_absence() -> None:
    with pytest.raises(ValueError, match="evidence_source"):
        EvaluationEvidenceItem(
            title="Strong backend impact",
            detail="Mentions scalable APIs.",
            evidence_source=None,
            evidence_snippet="Built APIs.",
            recommendation=None,
            severity="medium",
        )


def test_database_evaluation_round_trip(tmp_path: Path) -> None:
    database = Database(tmp_path / "db.json")
    payload = {
        "evaluation_id": "eval-1",
        "resume_id": "resume-1",
        "baseline_resume_id": None,
        "job_id": None,
        "phase": "readiness",
        "overall_score": 82,
        "confidence": 0.72,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": "resume_evaluation_v1",
        "source_hash": "hash-1",
        "created_at": "2026-05-13T00:00:00+00:00",
        "stale": False,
        "warnings": [],
    }

    created = database.create_evaluation(payload)

    assert created["evaluation_id"] == "eval-1"
    assert database.get_evaluation_by_source_hash("hash-1")["evaluation_id"] == "eval-1"
    assert database.get_latest_evaluation("resume-1", phase="readiness")["evaluation_id"] == "eval-1"
    assert len(database.list_evaluations("resume-1")) == 1


def test_database_finds_post_tailor_by_baseline_resume(tmp_path: Path) -> None:
    database = Database(tmp_path / "db.json")
    payload = {
        "evaluation_id": "eval-post",
        "resume_id": "tailored-resume-1",
        "baseline_resume_id": "master-resume-1",
        "job_id": "job-1",
        "phase": "post_tailor",
        "overall_score": 90,
        "confidence": 0.8,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": "resume_evaluation_v1",
        "source_hash": "hash-post",
        "created_at": "2026-05-13T00:00:00+00:00",
        "stale": False,
        "warnings": [],
    }

    database.create_evaluation(payload)

    latest = database.get_latest_evaluation_for_baseline(
        baseline_resume_id="master-resume-1",
        phase="post_tailor",
        job_id="job-1",
    )

    assert latest["evaluation_id"] == "eval-post"


def test_source_hash_changes_with_prompt_version(
    sample_resume: dict,
    sample_job_description: str,
) -> None:
    first = build_evaluation_source_hash(
        phase="pre_tailor",
        resume_payload=sample_resume,
        job_content=sample_job_description,
        baseline_resume_payload=None,
        prompt_version="v1",
    )
    second = build_evaluation_source_hash(
        phase="pre_tailor",
        resume_payload=sample_resume,
        job_content=sample_job_description,
        baseline_resume_payload=None,
        prompt_version="v2",
    )
    assert first != second


def test_clean_evaluation_result_drops_untrusted_items() -> None:
    cleaned, warnings = clean_evaluation_result(
        {
            "overall_score": 92,
            "confidence": 0.8,
            "dimensions": {"clarity": 91},
            "strengths": [
                {
                    "title": "Grounded",
                    "detail": "Resume includes FastAPI work.",
                    "evidence_source": "resume",
                    "evidence_snippet": "Built APIs with FastAPI.",
                    "severity": "low",
                },
                {"title": "Bad", "detail": "Missing source"},
            ],
            "gaps": [],
            "next_actions": [],
        }
    )
    assert cleaned["overall_score"] == 92
    assert len(cleaned["strengths"]) == 1
    assert warnings == ["Dropped 1 malformed evaluation item(s)."]


@pytest.mark.asyncio
async def test_create_resume_evaluation_uses_cache(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    with (
        patch("app.services.evaluation.get_llm_config") as mock_config,
        patch("app.services.evaluation.get_model_name") as mock_model_name,
        patch("app.services.evaluation.get_safe_max_tokens") as mock_max_tokens,
        patch(
            "app.services.evaluation.complete_json",
            new_callable=AsyncMock,
        ) as mock_complete,
    ):
        mock_config.return_value = type(
            "Config",
            (),
            {"provider": "openai", "api_key": "sk-test"},
        )()
        mock_model_name.return_value = "test-model"
        mock_max_tokens.return_value = 4096
        mock_complete.return_value = {
            "overall_score": 84,
            "confidence": 0.7,
            "dimensions": {},
            "strengths": [],
            "gaps": [],
            "next_actions": [],
        }
        first = await create_resume_evaluation(
            database=database,
            resume_id=resume["resume_id"],
            request=ResumeEvaluationRequest(phase="readiness"),
        )
        second = await create_resume_evaluation(
            database=database,
            resume_id=resume["resume_id"],
            request=ResumeEvaluationRequest(phase="readiness"),
        )
    assert first.evaluation_id == second.evaluation_id
    assert mock_complete.await_count == 1
    assert first.prompt_version == PROMPT_VERSION


@pytest.mark.asyncio
async def test_create_resume_evaluation_force_refresh_bypasses_cache(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    with (
        patch("app.services.evaluation.get_llm_config") as mock_config,
        patch("app.services.evaluation.get_model_name") as mock_model_name,
        patch("app.services.evaluation.get_safe_max_tokens") as mock_max_tokens,
        patch(
            "app.services.evaluation.complete_json",
            new_callable=AsyncMock,
        ) as mock_complete,
    ):
        mock_config.return_value = type(
            "Config",
            (),
            {"provider": "openai", "api_key": "sk-test"},
        )()
        mock_model_name.return_value = "test-model"
        mock_max_tokens.return_value = 4096
        mock_complete.return_value = {
            "overall_score": 84,
            "confidence": 0.7,
            "dimensions": {},
            "strengths": [],
            "gaps": [],
            "next_actions": [],
        }
        await create_resume_evaluation(
            database=database,
            resume_id=resume["resume_id"],
            request=ResumeEvaluationRequest(phase="readiness"),
        )
        await create_resume_evaluation(
            database=database,
            resume_id=resume["resume_id"],
            request=ResumeEvaluationRequest(phase="readiness", force_refresh=True),
        )
    assert mock_complete.await_count == 2


@pytest.mark.asyncio
async def test_create_resume_evaluation_passes_config_and_model_token_limit(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    with (
        patch("app.services.evaluation.get_llm_config") as mock_config,
        patch("app.services.evaluation.get_model_name") as mock_model_name,
        patch("app.services.evaluation.get_safe_max_tokens") as mock_max_tokens,
        patch(
            "app.services.evaluation.complete_json",
            new_callable=AsyncMock,
        ) as mock_complete,
    ):
        config = type("Config", (), {"provider": "openai", "api_key": "sk-test"})()
        mock_config.return_value = config
        mock_model_name.return_value = "gpt-test"
        mock_max_tokens.return_value = 2048
        mock_complete.return_value = {
            "overall_score": 84,
            "confidence": 0.7,
            "dimensions": {},
            "strengths": [],
            "gaps": [],
            "next_actions": [],
        }
        await create_resume_evaluation(
            database=database,
            resume_id=resume["resume_id"],
            request=ResumeEvaluationRequest(phase="readiness"),
        )
    mock_max_tokens.assert_called_once_with("gpt-test", 4096)
    assert mock_complete.await_args.kwargs["config"] is config
    assert mock_complete.await_args.kwargs["max_tokens"] == 2048


@pytest.mark.asyncio
async def test_create_resume_evaluation_rejects_missing_llm_api_key(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    with patch("app.services.evaluation.get_llm_config") as mock_config:
        mock_config.return_value = type(
            "Config",
            (),
            {"provider": "openai", "api_key": ""},
        )()
        with pytest.raises(EvaluationConfigError, match="LLM configuration"):
            await create_resume_evaluation(
                database=database,
                resume_id=resume["resume_id"],
                request=ResumeEvaluationRequest(phase="readiness"),
            )


def test_latest_evaluations_pair_post_tailor_by_baseline(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    master = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    base_payload = {
        "baseline_resume_id": None,
        "confidence": 0.7,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": PROMPT_VERSION,
        "stale": False,
        "warnings": [],
    }
    database.create_evaluation(
        {
            **base_payload,
            "evaluation_id": "eval-pre",
            "resume_id": master["resume_id"],
            "job_id": "job-1",
            "phase": "pre_tailor",
            "overall_score": 70,
            "source_hash": "hash-pre",
            "created_at": "2026-05-13T00:00:00+00:00",
        }
    )
    database.create_evaluation(
        {
            **base_payload,
            "evaluation_id": "eval-post",
            "resume_id": "tailored-resume-1",
            "baseline_resume_id": master["resume_id"],
            "job_id": "job-1",
            "phase": "post_tailor",
            "overall_score": 88,
            "source_hash": "hash-post",
            "created_at": "2026-05-13T00:01:00+00:00",
        }
    )
    latest = get_latest_resume_evaluations(
        database=database,
        resume_id=master["resume_id"],
        job_id="job-1",
    )
    assert latest.pre_tailor.evaluation_id == "eval-pre"
    assert latest.post_tailor.evaluation_id == "eval-post"


def test_latest_evaluations_without_job_id_pairs_to_latest_post_job(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    master = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    base_payload = {
        "baseline_resume_id": None,
        "confidence": 0.7,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": PROMPT_VERSION,
        "stale": False,
        "warnings": [],
    }
    for job_id, score, created_at in (
        ("job-old", 60, "2026-05-13T00:00:00+00:00"),
        ("job-new", 75, "2026-05-13T00:02:00+00:00"),
    ):
        database.create_evaluation(
            {
                **base_payload,
                "evaluation_id": f"pre-{job_id}",
                "resume_id": master["resume_id"],
                "job_id": job_id,
                "phase": "pre_tailor",
                "overall_score": score,
                "source_hash": f"hash-pre-{job_id}",
                "created_at": created_at,
            }
        )
    database.create_evaluation(
        {
            **base_payload,
            "evaluation_id": "post-job-old",
            "resume_id": "tailored-old",
            "baseline_resume_id": master["resume_id"],
            "job_id": "job-old",
            "phase": "post_tailor",
            "overall_score": 90,
            "source_hash": "hash-post-old",
            "created_at": "2026-05-13T00:03:00+00:00",
        }
    )
    latest = get_latest_resume_evaluations(
        database=database,
        resume_id=master["resume_id"],
    )
    assert latest.post_tailor.evaluation_id == "post-job-old"
    assert latest.pre_tailor.evaluation_id == "pre-job-old"


def test_latest_evaluations_mark_changed_sources_stale(
    tmp_path: Path,
    sample_resume: dict,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )
    database.create_evaluation(
        {
            "evaluation_id": "eval-old",
            "resume_id": resume["resume_id"],
            "baseline_resume_id": None,
            "job_id": None,
            "phase": "readiness",
            "overall_score": 70,
            "confidence": 0.7,
            "dimensions": EvaluationDimensionScores().model_dump(),
            "strengths": [],
            "gaps": [],
            "next_actions": [],
            "model": "test-model",
            "provider": "openai",
            "prompt_version": PROMPT_VERSION,
            "source_hash": "old-hash",
            "created_at": "2026-05-13T00:00:00+00:00",
            "stale": False,
            "warnings": [],
        }
    )
    latest = get_latest_resume_evaluations(
        database=database,
        resume_id=resume["resume_id"],
    )
    assert latest.readiness.stale is True
