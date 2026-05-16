# Full App Shell Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved full app shell redesign with real backend LLM resume evaluations, stored readiness/pre-tailor/post-tailor scores, a dashboard command center, and a guided card-stack tailoring flow.

**Architecture:** Add a backend `evaluations` domain that owns schema validation, prompt assembly, LiteLLM structured output, source-hash caching, and TinyDB persistence. Add frontend evaluation API helpers, then introduce shared shell primitives and wire dashboard/tailor to stored evaluation states without breaking existing JD intake, preview diff, confirm, builder, print, or settings behavior.

**Tech Stack:** FastAPI, Python 3.13, TinyDB, Pydantic v2, LiteLLM `complete_json()`, Next.js 16 App Router, React 19, Tailwind CSS v4, Vitest, Testing Library, pytest, httpx ASGITransport.

---

## Preflight

The current branch is `feat/jd-automation`. There are existing uncommitted frontend polish changes. Treat them as user-owned baseline work: do not revert them, and when committing implementation tasks, stage only the files touched for that task.

Read before implementation:

- `AGENTS.md`
- `docs/agent/architecture/backend-guide.md`
- `docs/agent/apis/front-end-apis.md`
- `docs/agent/architecture/frontend-workflow.md`
- `docs/portable/swiss-design-system/README.md`
- `docs/portable/swiss-design-system/tokens.md`
- `docs/portable/swiss-design-system/components.md`
- `docs/portable/swiss-design-system/anti-patterns.md`
- `docs/portable/nextjs-performance/README.md`
- `docs/superpowers/specs/2026-05-13-full-app-shell-evaluation-design.md`

Use `rg`/`rg --files` for search. Use `apply_patch` for manual edits. For frontend verification, use Browser/IAB first, then Playwright only if Browser is unavailable or unreliable.

## File Structure

Backend files:

- Create `apps/backend/app/schemas/evaluation.py`: Pydantic request/response/storage models, score clamping validators, and supported phase/dimension types.
- Create `apps/backend/app/prompts/evaluation.py`: prompt version constant and prompt builder for readiness/pre-tailor/post-tailor evaluation.
- Create `apps/backend/app/services/evaluation.py`: source loading, hash calculation, cached lookup, LLM call, output validation, and persistence.
- Create `apps/backend/app/routers/evaluations.py`: FastAPI endpoints for create/list/latest.
- Modify `apps/backend/app/database.py`: add `evaluations` table and CRUD helpers.
- Modify `apps/backend/app/main.py`: register evaluations router.
- Modify `apps/backend/app/routers/__init__.py`: export evaluations router.
- Modify `apps/backend/app/schemas/__init__.py`: export cross-module evaluation schemas.
- Create `apps/backend/tests/unit/test_evaluation.py`: schema, validation, hashing, and service unit tests.
- Create `apps/backend/tests/integration/test_evaluations_api.py`: API endpoint behavior.

Frontend files:

- Create `apps/frontend/lib/api/evaluation.ts`: evaluation types and API helpers.
- Modify `apps/frontend/lib/api/index.ts`: export evaluation helpers if this barrel is used.
- Create `apps/frontend/components/shell/app-shell.tsx`: shared product shell with breadcrumbs, route tabs, status, settings modal, and disclosures.
- Create `apps/frontend/components/shell/breadcrumbs.tsx`: semantic breadcrumb nav.
- Create `apps/frontend/components/shell/route-tabs.tsx`: dashboard/tailor/builder/settings tabs.
- Create `apps/frontend/components/shell/model-status-popover.tsx`: model/config status popover.
- Create `apps/frontend/components/shell/compact-settings-modal.tsx`: compact provider/status/settings modal.
- Create `apps/frontend/components/ui/disclosure.tsx`: accessible disclosure primitive.
- Create `apps/frontend/components/ui/popover.tsx`: accessible hover/focus/click popover primitive.
- Create `apps/frontend/components/evaluation/evaluation-card.tsx`: metric card with score/missing/stale/loading/error states.
- Create `apps/frontend/components/evaluation/evaluation-popover.tsx`: score breakdown and evidence details.
- Create `apps/frontend/components/dashboard/command-center.tsx`: bounded dark dashboard shell/grid.
- Create `apps/frontend/components/dashboard/tailor-card-stack.tsx`: overlapping dashboard card stack.
- Create `apps/frontend/components/tailor/tailor-session-cards.tsx`: step-based card workflow shell.
- Modify `apps/frontend/app/(default)/layout.tsx`: wrap routes in `AppShell`.
- Modify `apps/frontend/app/(default)/dashboard/page.tsx`: use command center and evaluation state.
- Modify `apps/frontend/app/(default)/tailor/page.tsx`: trigger pre/post evaluations and render card session.
- Audit `apps/frontend/app/(default)/builder/page.tsx`, `apps/frontend/app/(default)/settings/page.tsx`, and `apps/frontend/app/(default)/resumes/[id]/page.tsx` in Task 8 for duplicate shell chrome. If a page has its own full-screen app frame or top-level navigation that conflicts with `AppShell`, remove that duplicated wrapper while preserving the page content.
- Modify all message files in `apps/frontend/messages/`: add shell/evaluation/card/disclosure copy.
- Create `apps/frontend/tests/evaluation-api.test.ts`.
- Create `apps/frontend/tests/app-shell.test.tsx`.
- Create `apps/frontend/tests/dashboard-command-center.test.tsx`.
- Create `apps/frontend/tests/tailor-session-cards.test.tsx`.

## Task 1: Backend Evaluation Schemas And TinyDB Storage

**Files:**

- Create: `apps/backend/app/schemas/evaluation.py`
- Modify: `apps/backend/app/schemas/__init__.py`
- Modify: `apps/backend/app/database.py`
- Test: `apps/backend/tests/unit/test_evaluation.py`

- [ ] **Step 1: Write failing schema/storage tests**

Add `apps/backend/tests/unit/test_evaluation.py` with these tests first:

```python
"""Unit tests for resume evaluation schemas and storage helpers."""

from pathlib import Path

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
```

- [ ] **Step 2: Run the failing unit tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py -q
```

Expected: fail with `ModuleNotFoundError: No module named 'app.schemas.evaluation'`.

- [ ] **Step 3: Add evaluation schemas**

Create `apps/backend/app/schemas/evaluation.py`:

```python
"""Pydantic models for resume evaluation scores."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EvaluationPhase = Literal["readiness", "pre_tailor", "post_tailor"]
EvaluationEvidenceSource = Literal["resume", "job_description", "absence"]
EvaluationSeverity = Literal["low", "medium", "high"]


def _clamp_score(value: int | float) -> int:
    """Clamp a model-provided score to the public 0-100 scale."""
    return max(0, min(100, int(round(value))))


def _clamp_confidence(value: int | float) -> float:
    """Clamp model confidence to 0.0-1.0."""
    return max(0.0, min(1.0, float(value)))


class EvaluationDimensionScores(BaseModel):
    """Dimension-level resume evaluation scores."""

    clarity: int = 0
    impact: int = 0
    ats_readability: int = 0
    keyword_alignment: int = 0
    role_fit: int = 0
    evidence_strength: int = 0

    @field_validator("*", mode="before")
    @classmethod
    def clamp_dimension_score(cls, value: int | float | None) -> int:
        return _clamp_score(value or 0)


class EvaluationEvidenceItem(BaseModel):
    """A strength, gap, or recommendation grounded in supplied evidence."""

    title: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=500)
    evidence_source: EvaluationEvidenceSource | None = None
    evidence_snippet: str | None = Field(default=None, max_length=500)
    recommendation: str | None = Field(default=None, max_length=500)
    severity: EvaluationSeverity = "medium"

    @model_validator(mode="after")
    def require_evidence_or_absence(self) -> "EvaluationEvidenceItem":
        if not self.evidence_source:
            raise ValueError("evidence_source is required")
        if self.evidence_source != "absence" and not (self.evidence_snippet or "").strip():
            raise ValueError("evidence_snippet is required for resume or job_description evidence")
        return self


class ResumeEvaluationRequest(BaseModel):
    """Request to create or fetch a resume evaluation."""

    phase: EvaluationPhase = "readiness"
    job_id: str | None = None
    baseline_resume_id: str | None = None
    force_refresh: bool = False

    @model_validator(mode="after")
    def validate_phase_requirements(self) -> "ResumeEvaluationRequest":
        if self.phase in {"pre_tailor", "post_tailor"} and not self.job_id:
            raise ValueError("job_id is required for pre_tailor and post_tailor evaluations")
        return self


class ResumeEvaluationResponse(BaseModel):
    """Stored resume evaluation returned to the frontend."""

    model_config = ConfigDict(extra="ignore")

    evaluation_id: str
    resume_id: str
    baseline_resume_id: str | None = None
    job_id: str | None = None
    phase: EvaluationPhase
    overall_score: int
    confidence: float
    dimensions: EvaluationDimensionScores = Field(default_factory=EvaluationDimensionScores)
    strengths: list[EvaluationEvidenceItem] = Field(default_factory=list)
    gaps: list[EvaluationEvidenceItem] = Field(default_factory=list)
    next_actions: list[EvaluationEvidenceItem] = Field(default_factory=list)
    model: str
    provider: str
    prompt_version: str
    source_hash: str
    created_at: str
    stale: bool = False
    warnings: list[str] = Field(default_factory=list)

    @field_validator("overall_score", mode="before")
    @classmethod
    def clamp_overall_score(cls, value: int | float | None) -> int:
        return _clamp_score(value or 0)

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, value: int | float | None) -> float:
        return _clamp_confidence(value or 0)


class ResumeEvaluationListResponse(BaseModel):
    """List response for resume evaluations."""

    evaluations: list[ResumeEvaluationResponse]


class LatestResumeEvaluationsResponse(BaseModel):
    """Latest evaluation records grouped by phase."""

    readiness: ResumeEvaluationResponse | None = None
    pre_tailor: ResumeEvaluationResponse | None = None
    post_tailor: ResumeEvaluationResponse | None = None
```

- [ ] **Step 4: Export cross-module schemas**

Modify `apps/backend/app/schemas/__init__.py` to import and export:

```python
from app.schemas.evaluation import (
    EvaluationDimensionScores,
    EvaluationEvidenceItem,
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)
```

Add these names to `__all__`:

```python
    "EvaluationDimensionScores",
    "EvaluationEvidenceItem",
    "EvaluationPhase",
    "LatestResumeEvaluationsResponse",
    "ResumeEvaluationListResponse",
    "ResumeEvaluationRequest",
    "ResumeEvaluationResponse",
```

- [ ] **Step 5: Add TinyDB evaluation helpers**

Modify `apps/backend/app/database.py`:

```python
    @property
    def evaluations(self) -> Table:
        """Resume evaluation table."""
        return self.db.table("evaluations")
```

Add methods after improvement operations:

```python
    # Evaluation operations
    def create_evaluation(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a resume evaluation entry."""
        self.evaluations.insert(payload)
        return payload

    def get_evaluation_by_source_hash(self, source_hash: str) -> dict[str, Any] | None:
        """Return an evaluation with a matching source hash."""
        Evaluation = Query()
        result = self.evaluations.search(Evaluation.source_hash == source_hash)
        return result[0] if result else None

    def list_evaluations(
        self,
        resume_id: str,
        phase: str | None = None,
        job_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """List evaluations for a resume, optionally filtered."""
        Evaluation = Query()
        query = Evaluation.resume_id == resume_id
        if phase:
            query = query & (Evaluation.phase == phase)
        if job_id:
            query = query & (Evaluation.job_id == job_id)
        return sorted(
            self.evaluations.search(query),
            key=lambda item: item.get("created_at", ""),
            reverse=True,
        )

    def get_latest_evaluation(
        self,
        resume_id: str,
        phase: str | None = None,
        job_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Return the newest evaluation for a resume/filter combination."""
        results = self.list_evaluations(resume_id=resume_id, phase=phase, job_id=job_id)
        return results[0] if results else None

    def list_evaluations_for_baseline(
        self,
        baseline_resume_id: str,
        phase: str | None = None,
        job_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """List evaluations whose baseline/master resume matches the supplied id."""
        Evaluation = Query()
        query = Evaluation.baseline_resume_id == baseline_resume_id
        if phase:
            query = query & (Evaluation.phase == phase)
        if job_id:
            query = query & (Evaluation.job_id == job_id)
        return sorted(
            self.evaluations.search(query),
            key=lambda item: item.get("created_at", ""),
            reverse=True,
        )

    def get_latest_evaluation_for_baseline(
        self,
        baseline_resume_id: str,
        phase: str | None = None,
        job_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Return the newest evaluation for a baseline/master resume."""
        results = self.list_evaluations_for_baseline(
            baseline_resume_id=baseline_resume_id,
            phase=phase,
            job_id=job_id,
        )
        return results[0] if results else None
```

- [ ] **Step 6: Run unit tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit backend schema/storage slice**

Run:

```bash
git add apps/backend/app/schemas/evaluation.py apps/backend/app/schemas/__init__.py apps/backend/app/database.py apps/backend/tests/unit/test_evaluation.py
git commit -m "feat: add resume evaluation schemas"
```

## Task 2: Evaluation Prompt, Service, Hashing, And LLM Validation

**Files:**

- Create: `apps/backend/app/prompts/evaluation.py`
- Create: `apps/backend/app/services/evaluation.py`
- Modify: `apps/backend/tests/unit/test_evaluation.py`

- [ ] **Step 1: Add failing service tests**

Append to `apps/backend/tests/unit/test_evaluation.py`:

```python
import json
from unittest.mock import AsyncMock, patch

from app.services.evaluation import (
    EvaluationConfigError,
    EvaluationProviderError,
    PROMPT_VERSION,
    build_evaluation_source_hash,
    clean_evaluation_result,
    create_resume_evaluation,
    get_latest_resume_evaluations,
)


def test_source_hash_changes_with_prompt_version(sample_resume, sample_job_description) -> None:
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
async def test_create_resume_evaluation_uses_cache(tmp_path, sample_resume) -> None:
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
        patch("app.services.evaluation.complete_json", new_callable=AsyncMock) as mock_complete,
    ):
        mock_config.return_value = type("Config", (), {"provider": "openai", "api_key": "sk-test"})()
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
    tmp_path,
    sample_resume,
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
        patch("app.services.evaluation.complete_json", new_callable=AsyncMock) as mock_complete,
    ):
        mock_config.return_value = type("Config", (), {"provider": "openai", "api_key": "sk-test"})()
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
    tmp_path,
    sample_resume,
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
        patch("app.services.evaluation.complete_json", new_callable=AsyncMock) as mock_complete,
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
    tmp_path,
    sample_resume,
) -> None:
    database = Database(tmp_path / "db.json")
    resume = database.create_resume(
        content=json.dumps(sample_resume),
        content_type="json",
        processed_data=sample_resume,
        processing_status="ready",
    )

    with patch("app.services.evaluation.get_llm_config") as mock_config:
        mock_config.return_value = type("Config", (), {"provider": "openai", "api_key": ""})()

        with pytest.raises(EvaluationConfigError, match="LLM configuration"):
            await create_resume_evaluation(
                database=database,
                resume_id=resume["resume_id"],
                request=ResumeEvaluationRequest(phase="readiness"),
            )


def test_latest_evaluations_pair_post_tailor_by_baseline(tmp_path, sample_resume) -> None:
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


def test_latest_evaluations_without_job_id_pairs_to_latest_post_job(tmp_path, sample_resume) -> None:
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

    latest = get_latest_resume_evaluations(database=database, resume_id=master["resume_id"])

    assert latest.post_tailor.evaluation_id == "post-job-old"
    assert latest.pre_tailor.evaluation_id == "pre-job-old"


def test_latest_evaluations_mark_changed_sources_stale(tmp_path, sample_resume) -> None:
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

    latest = get_latest_resume_evaluations(database=database, resume_id=resume["resume_id"])

    assert latest.readiness.stale is True
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py -q
```

Expected: fail with `ModuleNotFoundError: No module named 'app.services.evaluation'`.

- [ ] **Step 3: Add prompt builder**

Create `apps/backend/app/prompts/evaluation.py`:

```python
"""Prompt templates for resume evaluation."""

from app.schemas.evaluation import EvaluationPhase

PROMPT_VERSION = "resume_evaluation_v1"


def build_evaluation_prompt(
    *,
    phase: EvaluationPhase,
    resume_text: str,
    job_text: str | None,
    baseline_text: str | None,
) -> str:
    """Build an evidence-only structured evaluation prompt."""
    phase_instruction = {
        "readiness": "Evaluate the resume's general readiness for job applications.",
        "pre_tailor": "Evaluate how well the resume fits the supplied job description before tailoring.",
        "post_tailor": "Evaluate the tailored resume against the job description and compare to the baseline when supplied.",
    }[phase]

    return f"""
You are evaluating a resume. {phase_instruction}

Rules:
- Use only the supplied resume, optional baseline resume, and optional job description.
- Do not invent employers, titles, dates, skills, credentials, metrics, or responsibilities.
- If evidence is missing, use evidence_source "absence".
- Keep evidence_snippet under 40 words.
- Return ONLY the JSON object.

JSON schema:
{{
  "overall_score": 0,
  "confidence": 0.0,
  "dimensions": {{
    "clarity": 0,
    "impact": 0,
    "ats_readability": 0,
    "keyword_alignment": 0,
    "role_fit": 0,
    "evidence_strength": 0
  }},
  "strengths": [
    {{
      "title": "Specific strength",
      "detail": "Why it matters",
      "evidence_source": "resume",
      "evidence_snippet": "Short exact or near-exact evidence",
      "recommendation": null,
      "severity": "low"
    }}
  ],
  "gaps": [
    {{
      "title": "Specific gap",
      "detail": "Why it matters",
      "evidence_source": "absence",
      "evidence_snippet": null,
      "recommendation": "Safe improvement that does not fabricate experience",
      "severity": "medium"
    }}
  ],
  "next_actions": []
}}

Resume:
{resume_text}

Baseline resume:
{baseline_text or "Not supplied."}

Job description:
{job_text or "Not supplied."}
"""
```

- [ ] **Step 4: Add evaluation service**

Create `apps/backend/app/services/evaluation.py`:

```python
"""Resume evaluation service."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.database import Database
from app.llm import complete_json, get_llm_config, get_model_name, get_safe_max_tokens
from app.prompts.evaluation import PROMPT_VERSION, build_evaluation_prompt
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


class EvaluationError(Exception):
    """Raised when a resume evaluation cannot be created."""


class EvaluationConfigError(EvaluationError):
    """Raised when evaluation cannot run because LLM configuration is missing."""


class EvaluationProviderError(EvaluationError):
    """Raised when the configured LLM provider fails during evaluation."""


def _stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _resume_payload(resume: dict[str, Any]) -> Any:
    processed_data = resume.get("processed_data")
    if processed_data:
        return processed_data
    content = resume.get("content")
    return content if isinstance(content, str) else ""


def _resume_text(resume: dict[str, Any]) -> str:
    payload = _resume_payload(resume)
    if isinstance(payload, str):
        return payload
    return _stable_json(payload)


def build_evaluation_source_hash(
    *,
    phase: EvaluationPhase,
    resume_payload: Any,
    job_content: str | None,
    baseline_resume_payload: Any | None,
    prompt_version: str,
) -> str:
    """Hash all inputs that affect an evaluation result."""
    source = {
        "phase": phase,
        "resume_payload": resume_payload,
        "job_content": job_content or "",
        "baseline_resume_payload": baseline_resume_payload or "",
        "prompt_version": prompt_version,
    }
    return hashlib.sha256(_stable_json(source).encode("utf-8")).hexdigest()


def _current_source_hash_for_record(database: Database, record: dict[str, Any]) -> str | None:
    """Rebuild the source hash for a stored record using current resume/job data."""
    resume = database.get_resume(record.get("resume_id", ""))
    if not resume:
        return None
    job = database.get_job(record["job_id"]) if record.get("job_id") else None
    baseline_resume = database.get_resume(record["baseline_resume_id"]) if record.get("baseline_resume_id") else None
    return build_evaluation_source_hash(
        phase=record["phase"],
        resume_payload=_resume_payload(resume),
        job_content=job.get("content") if job else None,
        baseline_resume_payload=_resume_payload(baseline_resume) if baseline_resume else None,
        prompt_version=PROMPT_VERSION,
    )


def _response_with_stale_flag(database: Database, record: dict[str, Any] | None) -> ResumeEvaluationResponse | None:
    """Convert a stored record and mark it stale when its source inputs changed."""
    if not record:
        return None
    current_hash = _current_source_hash_for_record(database, record)
    stale = current_hash is None or current_hash != record.get("source_hash")
    return ResumeEvaluationResponse.model_validate({**record, "stale": stale})


def _clean_items(items: Any) -> tuple[list[dict[str, Any]], int]:
    cleaned: list[dict[str, Any]] = []
    dropped = 0
    if not isinstance(items, list):
        return cleaned, 0
    for item in items:
        try:
            cleaned.append(EvaluationEvidenceItem.model_validate(item).model_dump())
        except Exception:
            dropped += 1
    return cleaned, dropped


def clean_evaluation_result(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Normalize and validate model output before storage."""
    warnings: list[str] = []
    strengths, dropped_strengths = _clean_items(raw.get("strengths"))
    gaps, dropped_gaps = _clean_items(raw.get("gaps"))
    next_actions, dropped_actions = _clean_items(raw.get("next_actions"))
    dropped = dropped_strengths + dropped_gaps + dropped_actions
    if dropped:
        warnings.append(f"Dropped {dropped} malformed evaluation item(s).")

    dimensions = EvaluationDimensionScores.model_validate(
        raw.get("dimensions") if isinstance(raw.get("dimensions"), dict) else {}
    )

    return (
        {
            "overall_score": raw.get("overall_score", 0),
            "confidence": raw.get("confidence", 0),
            "dimensions": dimensions.model_dump(),
            "strengths": strengths,
            "gaps": gaps,
            "next_actions": next_actions,
        },
        warnings,
    )


def list_resume_evaluations(
    *,
    database: Database,
    resume_id: str,
    phase: EvaluationPhase | None = None,
    job_id: str | None = None,
) -> ResumeEvaluationListResponse:
    """List evaluations and mark stale records without mutating history."""
    records = database.list_evaluations(resume_id=resume_id, phase=phase, job_id=job_id)
    return ResumeEvaluationListResponse(
        evaluations=[
            evaluation
            for record in records
            if (evaluation := _response_with_stale_flag(database, record)) is not None
        ]
    )


def get_latest_resume_evaluations(
    *,
    database: Database,
    resume_id: str,
    job_id: str | None = None,
) -> LatestResumeEvaluationsResponse:
    """Return latest master-readiness, pre-tailor, and paired post-tailor evaluations."""
    readiness = database.get_latest_evaluation(resume_id, phase="readiness")
    post_tailor = database.get_latest_evaluation_for_baseline(
        baseline_resume_id=resume_id,
        phase="post_tailor",
        job_id=job_id,
    )
    paired_job_id = job_id or (post_tailor.get("job_id") if post_tailor else None)
    pre_tailor = database.get_latest_evaluation(
        resume_id,
        phase="pre_tailor",
        job_id=paired_job_id,
    )
    return LatestResumeEvaluationsResponse(
        readiness=_response_with_stale_flag(database, readiness),
        pre_tailor=_response_with_stale_flag(database, pre_tailor),
        post_tailor=_response_with_stale_flag(database, post_tailor),
    )


async def create_resume_evaluation(
    *,
    database: Database,
    resume_id: str,
    request: ResumeEvaluationRequest,
) -> ResumeEvaluationResponse:
    """Create or return a cached resume evaluation."""
    resume = database.get_resume(resume_id)
    if not resume:
        raise EvaluationError("Resume not found")

    job: dict[str, Any] | None = None
    if request.job_id:
        job = database.get_job(request.job_id)
        if not job:
            raise EvaluationError("Job description not found")

    baseline_resume: dict[str, Any] | None = None
    if request.baseline_resume_id:
        baseline_resume = database.get_resume(request.baseline_resume_id)

    source_hash = build_evaluation_source_hash(
        phase=request.phase,
        resume_payload=_resume_payload(resume),
        job_content=job.get("content") if job else None,
        baseline_resume_payload=_resume_payload(baseline_resume) if baseline_resume else None,
        prompt_version=PROMPT_VERSION,
    )
    if not request.force_refresh:
        cached = database.get_evaluation_by_source_hash(source_hash)
        if cached:
            return ResumeEvaluationResponse.model_validate({**cached, "stale": False})

    config = get_llm_config()
    if config.provider not in {"ollama", "openai_compatible"} and not (config.api_key or "").strip():
        raise EvaluationConfigError("LLM configuration is required before evaluation")
    model_name = get_model_name(config)
    prompt = build_evaluation_prompt(
        phase=request.phase,
        resume_text=_resume_text(resume),
        job_text=job.get("content") if job else None,
        baseline_text=_resume_text(baseline_resume) if baseline_resume else None,
    )
    try:
        raw = await complete_json(
            prompt,
            config=config,
            max_tokens=get_safe_max_tokens(model_name, 4096),
            schema_type="keywords",
        )
    except Exception as exc:
        logger.error("Resume evaluation LLM call failed: %s", exc)
        raise EvaluationProviderError("Failed to evaluate resume") from exc

    cleaned, warnings = clean_evaluation_result(raw if isinstance(raw, dict) else {})
    payload = {
        "evaluation_id": str(uuid4()),
        "resume_id": resume_id,
        "baseline_resume_id": request.baseline_resume_id,
        "job_id": request.job_id,
        "phase": request.phase,
        "model": model_name,
        "provider": config.provider,
        "prompt_version": PROMPT_VERSION,
        "source_hash": source_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "stale": False,
        "warnings": warnings,
        **cleaned,
    }
    stored = database.create_evaluation(payload)
    return ResumeEvaluationResponse.model_validate(stored)
```

- [ ] **Step 5: Run service tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit evaluation service slice**

Run:

```bash
git add apps/backend/app/prompts/evaluation.py apps/backend/app/services/evaluation.py apps/backend/tests/unit/test_evaluation.py
git commit -m "feat: add resume evaluation service"
```

## Task 3: Evaluation API Router And Integration Tests

**Files:**

- Create: `apps/backend/app/routers/evaluations.py`
- Modify: `apps/backend/app/routers/__init__.py`
- Modify: `apps/backend/app/main.py`
- Create: `apps/backend/tests/integration/test_evaluations_api.py`

- [ ] **Step 1: Write failing API tests**

Create `apps/backend/tests/integration/test_evaluations_api.py`:

```python
"""Integration tests for resume evaluation endpoints."""

from unittest.mock import AsyncMock, patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.evaluation import EvaluationConfigError, EvaluationProviderError


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


class TestResumeEvaluationsApi:
    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_create_readiness_evaluation(self, mock_create, client):
        mock_create.return_value = {
            "evaluation_id": "eval-1",
            "resume_id": "resume-1",
            "baseline_resume_id": None,
            "job_id": None,
            "phase": "readiness",
            "overall_score": 80,
            "confidence": 0.8,
            "dimensions": {},
            "strengths": [],
            "gaps": [],
            "next_actions": [],
            "model": "test-model",
            "provider": "openai",
            "prompt_version": "resume_evaluation_v1",
            "source_hash": "hash",
            "created_at": "2026-05-13T00:00:00+00:00",
            "stale": False,
            "warnings": [],
        }

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 200
        assert resp.json()["overall_score"] == 80
        mock_create.assert_awaited_once()

    async def test_pre_tailor_requires_job_id(self, client):
        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "pre_tailor"},
        )

        assert resp.status_code == 422

    @patch("app.routers.evaluations.list_resume_evaluations")
    async def test_list_evaluations(self, mock_list, client):
        mock_list.return_value = {
            "evaluations": [
                {
                    "evaluation_id": "eval-1",
                    "resume_id": "resume-1",
                    "baseline_resume_id": None,
                    "job_id": None,
                    "phase": "readiness",
                    "overall_score": 80,
                    "confidence": 0.8,
                    "dimensions": {},
                    "strengths": [],
                    "gaps": [],
                    "next_actions": [],
                    "model": "test-model",
                    "provider": "openai",
                    "prompt_version": "resume_evaluation_v1",
                    "source_hash": "hash",
                    "created_at": "2026-05-13T00:00:00+00:00",
                    "stale": False,
                    "warnings": [],
                }
            ]
        }

        resp = await client.get("/api/v1/resumes/resume-1/evaluations?phase=readiness")

        assert resp.status_code == 200
        assert len(resp.json()["evaluations"]) == 1
        mock_list.assert_called_once()

    @patch("app.routers.evaluations.get_latest_resume_evaluations")
    async def test_latest_evaluations(self, mock_latest, client):
        mock_latest.return_value = {
            "readiness": None,
            "pre_tailor": None,
            "post_tailor": {
                "evaluation_id": "eval-1",
                "resume_id": "tailored-resume-1",
                "baseline_resume_id": "resume-1",
                "job_id": "job-1",
                "phase": "post_tailor",
                "overall_score": 88,
                "confidence": 0.8,
                "dimensions": {},
                "strengths": [],
                "gaps": [],
                "next_actions": [],
                "model": "test-model",
                "provider": "openai",
                "prompt_version": "resume_evaluation_v1",
                "source_hash": "hash",
                "created_at": "2026-05-13T00:00:00+00:00",
                "stale": False,
                "warnings": [],
            }
        }

        resp = await client.get("/api/v1/resumes/resume-1/evaluations/latest")

        assert resp.status_code == 200
        assert resp.json()["post_tailor"]["baseline_resume_id"] == "resume-1"
        mock_latest.assert_called_once()

    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_missing_llm_config_returns_400(self, mock_create, client):
        mock_create.side_effect = EvaluationConfigError("LLM configuration is required")

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 400

    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_provider_failure_returns_503(self, mock_create, client):
        mock_create.side_effect = EvaluationProviderError("Failed to evaluate resume")

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 503
```

- [ ] **Step 2: Run failing API tests**

Run:

```bash
cd apps/backend && uv run pytest tests/integration/test_evaluations_api.py -q
```

Expected: fail because `app.routers.evaluations` does not exist.

- [ ] **Step 3: Add evaluations router**

Create `apps/backend/app/routers/evaluations.py`:

```python
"""Resume evaluation endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from app.database import db
from app.schemas.evaluation import (
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)
from app.services.evaluation import (
    EvaluationConfigError,
    EvaluationError,
    EvaluationProviderError,
    create_resume_evaluation,
    get_latest_resume_evaluations,
    list_resume_evaluations,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["Evaluations"])


@router.post("/{resume_id}/evaluations", response_model=ResumeEvaluationResponse)
async def create_evaluation(
    resume_id: str,
    request: ResumeEvaluationRequest,
) -> ResumeEvaluationResponse:
    """Create or fetch a cached resume evaluation."""
    try:
        return await create_resume_evaluation(
            database=db,
            resume_id=resume_id,
            request=request,
        )
    except EvaluationError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail)
        if isinstance(exc, EvaluationConfigError):
            raise HTTPException(status_code=400, detail="Configure an LLM provider before evaluation.")
        if isinstance(exc, EvaluationProviderError):
            raise HTTPException(status_code=503, detail="Failed to evaluate resume. Please retry.")
        raise HTTPException(status_code=400, detail=detail)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Invalid evaluation response.")
    except Exception as exc:
        logger.error("Unexpected evaluation failure: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to evaluate resume.")


@router.get("/{resume_id}/evaluations", response_model=ResumeEvaluationListResponse)
async def list_evaluations(
    resume_id: str,
    phase: EvaluationPhase | None = Query(default=None),
    job_id: str | None = Query(default=None),
) -> ResumeEvaluationListResponse:
    """List stored evaluations for a resume."""
    return list_resume_evaluations(database=db, resume_id=resume_id, phase=phase, job_id=job_id)


@router.get("/{resume_id}/evaluations/latest", response_model=LatestResumeEvaluationsResponse)
async def latest_evaluations(
    resume_id: str,
    job_id: str | None = Query(default=None),
) -> LatestResumeEvaluationsResponse:
    """Return latest stored evaluations grouped by phase."""
    return get_latest_resume_evaluations(database=db, resume_id=resume_id, job_id=job_id)
```

- [ ] **Step 4: Export and register router**

Modify `apps/backend/app/routers/__init__.py`:

```python
from app.routers.evaluations import router as evaluations_router
```

Add `evaluations_router` to `__all__`.

Modify `apps/backend/app/main.py` imports:

```python
    evaluations_router,
```

Add include before enrichment:

```python
app.include_router(evaluations_router, prefix="/api/v1")
```

- [ ] **Step 5: Run backend API tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py tests/integration/test_evaluations_api.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit evaluation API slice**

Run:

```bash
git add apps/backend/app/routers/evaluations.py apps/backend/app/routers/__init__.py apps/backend/app/main.py apps/backend/tests/integration/test_evaluations_api.py
git commit -m "feat: expose resume evaluation endpoints"
```

## Task 4: Frontend Evaluation API Helpers

**Files:**

- Create: `apps/frontend/lib/api/evaluation.ts`
- Modify: `apps/frontend/lib/api/index.ts`
- Test: `apps/frontend/tests/evaluation-api.test.ts`

- [ ] **Step 1: Write failing frontend API tests**

Create `apps/frontend/tests/evaluation-api.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createResumeEvaluation,
  fetchLatestResumeEvaluations,
  fetchResumeEvaluations,
} from '@/lib/api/evaluation';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('evaluation api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('creates an evaluation', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          evaluation_id: 'eval-1',
          resume_id: 'resume-1',
          baseline_resume_id: null,
          job_id: null,
          phase: 'readiness',
          overall_score: 80,
          confidence: 0.8,
          dimensions: {
            clarity: 80,
            impact: 80,
            ats_readability: 80,
            keyword_alignment: 80,
            role_fit: 80,
            evidence_strength: 80,
          },
          strengths: [],
          gaps: [],
          next_actions: [],
          model: 'test-model',
          provider: 'openai',
          prompt_version: 'resume_evaluation_v1',
          source_hash: 'hash',
          created_at: '2026-05-13T00:00:00+00:00',
          stale: false,
          warnings: [],
        }),
        { status: 200 }
      )
    );

    const result = await createResumeEvaluation('resume-1', { phase: 'readiness' });

    expect(result.overall_score).toBe(80);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phase: 'readiness' }),
      })
    );
  });

  it('fetches latest evaluations with a job id query', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ readiness: null }), { status: 200 }));

    await fetchLatestResumeEvaluations('resume-1', { jobId: 'job-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations/latest?job_id=job-1'),
      expect.any(Object)
    );
  });

  it('fetches a filtered evaluation list', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ evaluations: [] }), { status: 200 }));

    const result = await fetchResumeEvaluations('resume-1', {
      phase: 'pre_tailor',
      jobId: 'job-1',
    });

    expect(result.evaluations).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations?phase=pre_tailor&job_id=job-1'),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run failing frontend API tests**

Run:

```bash
cd apps/frontend && npm run test -- evaluation-api.test.ts
```

Expected: fail because `@/lib/api/evaluation` does not exist.

- [ ] **Step 3: Add evaluation API helper**

Create `apps/frontend/lib/api/evaluation.ts`:

```typescript
import { apiFetch } from './client';

export type EvaluationPhase = 'readiness' | 'pre_tailor' | 'post_tailor';
export type EvaluationEvidenceSource = 'resume' | 'job_description' | 'absence';
export type EvaluationSeverity = 'low' | 'medium' | 'high';

export interface EvaluationDimensionScores {
  clarity: number;
  impact: number;
  ats_readability: number;
  keyword_alignment: number;
  role_fit: number;
  evidence_strength: number;
}

export interface EvaluationEvidenceItem {
  title: string;
  detail: string;
  evidence_source: EvaluationEvidenceSource;
  evidence_snippet: string | null;
  recommendation: string | null;
  severity: EvaluationSeverity;
}

export interface ResumeEvaluationRequest {
  phase: EvaluationPhase;
  job_id?: string | null;
  baseline_resume_id?: string | null;
  force_refresh?: boolean;
}

export interface ResumeEvaluationResponse {
  evaluation_id: string;
  resume_id: string;
  baseline_resume_id: string | null;
  job_id: string | null;
  phase: EvaluationPhase;
  overall_score: number;
  confidence: number;
  dimensions: EvaluationDimensionScores;
  strengths: EvaluationEvidenceItem[];
  gaps: EvaluationEvidenceItem[];
  next_actions: EvaluationEvidenceItem[];
  model: string;
  provider: string;
  prompt_version: string;
  source_hash: string;
  created_at: string;
  stale: boolean;
  warnings: string[];
}

export interface ResumeEvaluationListResponse {
  evaluations: ResumeEvaluationResponse[];
}

export interface LatestResumeEvaluationsResponse {
  readiness: ResumeEvaluationResponse | null;
  pre_tailor: ResumeEvaluationResponse | null;
  post_tailor: ResumeEvaluationResponse | null;
}

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `${fallback} (status ${res.status}).`);
  }
  return res.json();
}

export async function createResumeEvaluation(
  resumeId: string,
  request: ResumeEvaluationRequest
): Promise<ResumeEvaluationResponse> {
  const res = await apiFetch(`/resumes/${resumeId}/evaluations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });
  return parseOrThrow<ResumeEvaluationResponse>(res, 'Failed to evaluate resume');
}

export async function fetchResumeEvaluations(
  resumeId: string,
  filters: { phase?: EvaluationPhase; jobId?: string } = {}
): Promise<ResumeEvaluationListResponse> {
  const query = toQuery({ phase: filters.phase, job_id: filters.jobId });
  const res = await apiFetch(`/resumes/${resumeId}/evaluations${query}`, {
    credentials: 'include',
  });
  return parseOrThrow<ResumeEvaluationListResponse>(res, 'Failed to load resume evaluations');
}

export async function fetchLatestResumeEvaluations(
  resumeId: string,
  filters: { jobId?: string } = {}
): Promise<LatestResumeEvaluationsResponse> {
  const query = toQuery({ job_id: filters.jobId });
  const res = await apiFetch(`/resumes/${resumeId}/evaluations/latest${query}`, {
    credentials: 'include',
  });
  return parseOrThrow<LatestResumeEvaluationsResponse>(res, 'Failed to load latest evaluations');
}
```

- [ ] **Step 4: Export helper from API barrel**

Modify `apps/frontend/lib/api/index.ts`:

```typescript
export * from './evaluation';
```

- [ ] **Step 5: Run frontend API tests**

Run:

```bash
cd apps/frontend && npm run test -- evaluation-api.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit frontend API slice**

Run:

```bash
git add apps/frontend/lib/api/evaluation.ts apps/frontend/lib/api/index.ts apps/frontend/tests/evaluation-api.test.ts
git commit -m "feat: add frontend evaluation api"
```

## Task 5: Shared Shell, Popover, Disclosure, And Settings Modal

**Files:**

- Create: `apps/frontend/components/ui/popover.tsx`
- Create: `apps/frontend/components/ui/disclosure.tsx`
- Create: `apps/frontend/components/shell/breadcrumbs.tsx`
- Create: `apps/frontend/components/shell/route-tabs.tsx`
- Create: `apps/frontend/components/shell/model-status-popover.tsx`
- Create: `apps/frontend/components/shell/compact-settings-modal.tsx`
- Create: `apps/frontend/components/shell/app-shell.tsx`
- Modify: `apps/frontend/app/(default)/layout.tsx`
- Modify: `apps/frontend/messages/en.json`
- Test: `apps/frontend/tests/app-shell.test.tsx`

- [ ] **Step 1: Write failing shell tests**

Create `apps/frontend/tests/app-shell.test.tsx`:

```typescript
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/components/shell/app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: {
      llm_configured: true,
      llm_healthy: true,
      database_stats: {
        total_resumes: 1,
        total_jobs: 1,
        total_improvements: 1,
        has_master_resume: true,
      },
    },
    isLoading: false,
    error: null,
    lastFetched: new Date('2026-05-13T00:00:00Z'),
    refreshStatus: vi.fn(),
  }),
}));

vi.mock('@/lib/api/config', () => ({
  fetchLlmConfig: vi.fn(async () => ({ provider: 'openai', model: 'gpt-test', api_key: '***' })),
}));

describe('AppShell', () => {
  it('renders breadcrumbs, route tabs, and settings modal trigger', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    expect(screen.getByText('shell.breadcrumbs.home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'shell.tabs.dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('button', { name: 'shell.settings.open' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('opens compact settings modal', async () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.settings.open' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('shell.settings.title')).toBeInTheDocument();
    expect(await screen.findByText('openai')).toBeInTheDocument();
  });

  it('renders score/privacy disclosure topics', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.help.open' }));

    expect(screen.getByText('shell.help.topics.score.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.data.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.recommendation.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.tailor.title')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing shell tests**

Run:

```bash
cd apps/frontend && npm run test -- app-shell.test.tsx
```

Expected: fail because shell components do not exist.

- [ ] **Step 3: Add popover primitive**

Create `apps/frontend/components/ui/popover.tsx`:

```tsx
'use client';

import React, { useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Popover({ trigger, children, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className="inline-flex"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          className={cn(
            'absolute right-0 top-full z-40 mt-2 w-80 border border-black bg-[#10131A] p-4 text-white shadow-sw-lg',
            'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95',
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add disclosure primitive**

Create `apps/frontend/components/ui/disclosure.tsx`:

```tsx
'use client';

import React, { useId, useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ title, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-t border-white/15">
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-left font-mono text-xs font-bold uppercase text-white"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      <div id={id} hidden={!open} className="pb-4 text-sm leading-6 text-white/70">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add shell components**

Create `apps/frontend/components/shell/breadcrumbs.tsx`:

```tsx
'use client';

import Link from 'next/link';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { useTranslations } from '@/lib/i18n';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useTranslations();
  return (
    <nav aria-label={t('shell.breadcrumbs.label')} className="font-mono text-xs uppercase">
      <ol className="flex flex-wrap items-center gap-2 text-white/60">
        <li>
          <Link className="hover:text-white" href="/dashboard">
            {t('shell.breadcrumbs.home')}
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            {item.href ? (
              <Link className="hover:text-white" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span className="text-white">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Create `apps/frontend/components/shell/route-tabs.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/tailor', key: 'tailor' },
  { href: '/builder', key: 'builder' },
  { href: '/settings', key: 'settings' },
] as const;

export function RouteTabs() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <nav aria-label={t('shell.tabs.label')} className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border border-white/20 px-3 py-2 font-mono text-xs font-bold uppercase text-white/65 transition-colors',
              active && 'border-white bg-white text-black',
              !active && 'hover:border-white hover:text-white'
            )}
          >
            {t(`shell.tabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `apps/frontend/components/shell/model-status-popover.tsx`:

```tsx
'use client';

import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { Popover } from '@/components/ui/popover';
import { useTranslations } from '@/lib/i18n';
import { useStatusCache } from '@/lib/context/status-cache';

export function ModelStatusPopover() {
  const { t } = useTranslations();
  const { status, isLoading, error, lastFetched, refreshStatus } = useStatusCache();
  const configured = Boolean(status?.llm_configured);
  const healthy = Boolean(status?.llm_healthy);

  const label = isLoading
    ? t('shell.status.checking')
    : configured && healthy
      ? t('shell.status.ready')
      : t('shell.status.setupRequired');

  const icon = isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : configured && healthy ? (
    <CheckCircle2 className="h-4 w-4 text-green-300" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-orange-300" />
  );

  return (
    <Popover
      trigger={
        <span className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 font-mono text-xs font-bold uppercase text-white">
          {icon}
          {label}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="font-mono text-xs font-bold uppercase">{t('shell.status.title')}</p>
        <p className="text-sm text-white/75">
          {error || (configured && healthy ? t('shell.status.readyDetail') : t('shell.status.setupDetail'))}
        </p>
        {lastFetched && (
          <p className="font-mono text-[11px] uppercase text-white/50">
            {t('shell.status.lastChecked')}: {lastFetched.toLocaleString()}
          </p>
        )}
        <button
          type="button"
          className="border border-white/30 px-3 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-white hover:text-black"
          onClick={() => void refreshStatus()}
        >
          {t('shell.status.refresh')}
        </button>
      </div>
    </Popover>
  );
}
```

Create `apps/frontend/components/shell/compact-settings-modal.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Settings from 'lucide-react/dist/esm/icons/settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { fetchLlmConfig, type LLMConfig } from '@/lib/api/config';
import { useStatusCache } from '@/lib/context/status-cache';

interface CompactSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompactSettingsModal({ open, onOpenChange }: CompactSettingsModalProps) {
  const { t } = useTranslations();
  const { status, isLoading, refreshStatus } = useStatusCache();
  const [config, setConfig] = useState<LLMConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchLlmConfig()
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => {
        if (active) setConfig(null);
      });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/20 bg-[#10131A] text-white">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-white">{t('shell.settings.title')}</DialogTitle>
          <DialogDescription className="text-white/65">
            {t('shell.settings.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="border border-white/15 p-4">
            <p className="font-mono text-xs font-bold uppercase text-white/50">
              {t('shell.settings.modelStatus')}
            </p>
            <p className="mt-2 font-serif text-2xl text-white">
              {isLoading
                ? t('shell.status.checking')
                : status?.llm_configured && status?.llm_healthy
                  ? t('shell.status.ready')
                  : t('shell.status.setupRequired')}
            </p>
            <dl className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[10px] uppercase text-white/45">
                  {t('shell.settings.provider')}
                </dt>
                <dd>{config?.provider || t('common.unknown')}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-white/45">
                  {t('shell.settings.model')}
                </dt>
                <dd>{config?.model || t('common.unknown')}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void refreshStatus()}>
              {t('shell.status.refresh')}
            </Button>
            <Link href="/settings" onClick={() => onOpenChange(false)}>
              <Button>
                <Settings className="h-4 w-4" />
                {t('shell.settings.fullSettings')}
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Create `apps/frontend/components/shell/app-shell.tsx`:

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';
import Settings from 'lucide-react/dist/esm/icons/settings';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { CompactSettingsModal } from '@/components/shell/compact-settings-modal';
import { ModelStatusPopover } from '@/components/shell/model-status-popover';
import { RouteTabs } from '@/components/shell/route-tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { useTranslations } from '@/lib/i18n';

function pageKey(pathname: string): string {
  if (pathname.startsWith('/tailor')) return 'tailor';
  if (pathname.startsWith('/builder')) return 'builder';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/resumes')) return 'resumes';
  return 'dashboard';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const key = pageKey(pathname);
  const breadcrumbs = useMemo(() => [{ label: t(`shell.pages.${key}`) }], [key, t]);

  return (
    <div className="min-h-screen bg-[#05070B] text-white">
      <header className="border-b border-white/15 bg-[#080B12]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Breadcrumbs items={breadcrumbs} />
            <div className="flex flex-wrap items-center gap-3">
              <ModelStatusPopover />
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white hover:text-black"
                onClick={() => setHelpOpen(true)}
                aria-label={t('shell.help.open')}
              >
                <HelpCircle className="h-4 w-4" />
                {t('shell.help.open')}
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white hover:text-black"
                onClick={() => setSettingsOpen(true)}
                aria-label={t('shell.settings.open')}
              >
                <Settings className="h-4 w-4" />
                {t('shell.settings.open')}
              </Button>
            </div>
          </div>
          <RouteTabs />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">{children}</main>
      <CompactSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-white/20 bg-[#10131A] text-white">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-white">{t('shell.help.title')}</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {(['score', 'data', 'recommendation', 'tailor'] as const).map((topic) => (
              <Disclosure key={topic} title={t(`shell.help.topics.${topic}.title`)}>
                {t(`shell.help.topics.${topic}.body`)}
              </Disclosure>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Wrap default routes in the shell**

Modify `apps/frontend/app/(default)/layout.tsx`:

```tsx
import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { LanguageProvider } from '@/lib/context/language-context';
import { LocalizedErrorBoundary } from '@/components/common/error-boundary';
import { AppShell } from '@/components/shell/app-shell';

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <StatusCacheProvider>
      <LanguageProvider>
        <ResumePreviewProvider>
          <LocalizedErrorBoundary>
            <AppShell>{children}</AppShell>
          </LocalizedErrorBoundary>
        </ResumePreviewProvider>
      </LanguageProvider>
    </StatusCacheProvider>
  );
}
```

- [ ] **Step 7: Add English shell copy**

Modify `apps/frontend/messages/en.json` and add these keys under the root object:

```json
"shell": {
  "breadcrumbs": {
    "label": "Breadcrumbs",
    "home": "Home"
  },
  "tabs": {
    "label": "Product sections",
    "dashboard": "Dashboard",
    "tailor": "Tailor",
    "builder": "Builder",
    "settings": "Settings"
  },
  "pages": {
    "dashboard": "Dashboard",
    "tailor": "Tailor",
    "builder": "Builder",
    "settings": "Settings",
    "resumes": "Resume"
  },
  "status": {
    "title": "Model status",
    "checking": "Checking",
    "ready": "Ready",
    "setupRequired": "Setup required",
    "readyDetail": "Your configured model is ready for tailoring and evaluation.",
    "setupDetail": "Configure or test your model before running AI actions.",
    "lastChecked": "Last checked",
    "refresh": "Refresh"
  },
  "settings": {
    "open": "Settings",
    "title": "Model and app settings",
    "description": "Check model health and jump to the full settings page.",
    "modelStatus": "Model status",
    "provider": "Provider",
    "model": "Model",
    "fullSettings": "Full settings"
  },
  "help": {
    "open": "Help",
    "title": "How Resume Matcher uses your data",
    "topics": {
      "score": {
        "title": "How scores are calculated",
        "body": "Scores are generated from the reviewed resume, job description, and configured model response. They are guidance, not guarantees."
      },
      "data": {
        "title": "What data is used",
        "body": "Evaluation uses the resume text, reviewed job description, optional baseline resume, model/provider metadata, and bounded evidence snippets."
      },
      "recommendation": {
        "title": "Why this recommendation appeared",
        "body": "Recommendations must point to resume evidence, job-description evidence, or an explicit absence of evidence."
      },
      "tailor": {
        "title": "What happens when I tailor",
        "body": "The app previews changes first, asks for confirmation, stores the tailored resume, and then records a post-tailor score when evaluation succeeds."
      }
    }
  }
}
```

If JSON placement conflicts with existing keys, keep the same nested structure and run Prettier.

- [ ] **Step 8: Run shell tests**

Run:

```bash
cd apps/frontend && npm run test -- app-shell.test.tsx
```

Expected: all tests pass.

- [ ] **Step 9: Commit shell slice**

Run:

```bash
git add apps/frontend/components/ui/popover.tsx apps/frontend/components/ui/disclosure.tsx apps/frontend/components/shell apps/frontend/app/'(default)'/layout.tsx apps/frontend/messages/en.json apps/frontend/tests/app-shell.test.tsx
git commit -m "feat: add app shell"
```

## Task 6: Dashboard Evaluation State And Metric Cards

**Files:**

- Create: `apps/frontend/components/evaluation/evaluation-card.tsx`
- Create: `apps/frontend/components/evaluation/evaluation-popover.tsx`
- Create: `apps/frontend/components/dashboard/command-center.tsx`
- Create: `apps/frontend/components/dashboard/tailor-card-stack.tsx`
- Modify: `apps/frontend/app/(default)/css/globals.css`
- Modify: `apps/frontend/app/(default)/dashboard/page.tsx`
- Modify: `apps/frontend/messages/en.json`
- Test: `apps/frontend/tests/dashboard-command-center.test.tsx`

- [ ] **Step 1: Write failing dashboard component tests**

Create `apps/frontend/tests/dashboard-command-center.test.tsx`:

```typescript
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EvaluationCard } from '@/components/evaluation/evaluation-card';
import { CommandCenter } from '@/components/dashboard/command-center';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('EvaluationCard', () => {
  it('shows missing score state without fake numbers', () => {
    render(<EvaluationCard phase="readiness" evaluation={null} loading={false} error={null} />);

    expect(screen.getByText('evaluation.state.notChecked')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows stored score and confidence', () => {
    render(
      <EvaluationCard
        phase="pre_tailor"
        loading={false}
        error={null}
        evaluation={{
          evaluation_id: 'eval-1',
          resume_id: 'resume-1',
          baseline_resume_id: null,
          job_id: 'job-1',
          phase: 'pre_tailor',
          overall_score: 82,
          confidence: 0.7,
          dimensions: {
            clarity: 80,
            impact: 80,
            ats_readability: 80,
            keyword_alignment: 80,
            role_fit: 80,
            evidence_strength: 80,
          },
          strengths: [],
          gaps: [],
          next_actions: [],
          model: 'test-model',
          provider: 'openai',
          prompt_version: 'resume_evaluation_v1',
          source_hash: 'hash',
          created_at: '2026-05-13T00:00:00+00:00',
          stale: false,
          warnings: [],
        }}
      />
    );

    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows stale score state with refresh action', () => {
    const onEvaluate = vi.fn();
    render(
      <EvaluationCard
        phase="readiness"
        loading={false}
        error={null}
        onEvaluate={onEvaluate}
        evaluation={{
          evaluation_id: 'eval-1',
          resume_id: 'resume-1',
          baseline_resume_id: null,
          job_id: null,
          phase: 'readiness',
          overall_score: 82,
          confidence: 0.7,
          dimensions: {
            clarity: 80,
            impact: 80,
            ats_readability: 80,
            keyword_alignment: 80,
            role_fit: 80,
            evidence_strength: 80,
          },
          strengths: [],
          gaps: [],
          next_actions: [],
          model: 'test-model',
          provider: 'openai',
          prompt_version: 'resume_evaluation_v1',
          source_hash: 'hash',
          created_at: '2026-05-13T00:00:00+00:00',
          stale: true,
          warnings: [],
        }}
      />
    );

    expect(screen.getByText('evaluation.state.stale')).toBeInTheDocument();
    fireEvent.click(screen.getByText('evaluation.action.refresh'));
    expect(onEvaluate).toHaveBeenCalledOnce();
  });

  it('supports stale refresh on pre-tailor and post-tailor metric phases', () => {
    const baseEvaluation = {
      evaluation_id: 'eval-1',
      resume_id: 'resume-1',
      baseline_resume_id: 'master-1',
      job_id: 'job-1',
      overall_score: 82,
      confidence: 0.7,
      dimensions: {
        clarity: 80,
        impact: 80,
        ats_readability: 80,
        keyword_alignment: 80,
        role_fit: 80,
        evidence_strength: 80,
      },
      strengths: [],
      gaps: [],
      next_actions: [],
      model: 'test-model',
      provider: 'openai',
      prompt_version: 'resume_evaluation_v1',
      source_hash: 'hash',
      created_at: '2026-05-13T00:00:00+00:00',
      stale: true,
      warnings: [],
    };
    const preRefresh = vi.fn();
    const postRefresh = vi.fn();

    render(
      <>
        <EvaluationCard
          phase="pre_tailor"
          loading={false}
          error={null}
          onEvaluate={preRefresh}
          evaluation={{ ...baseEvaluation, phase: 'pre_tailor' }}
        />
        <EvaluationCard
          phase="post_tailor"
          loading={false}
          error={null}
          onEvaluate={postRefresh}
          evaluation={{ ...baseEvaluation, phase: 'post_tailor', resume_id: 'tailored-1' }}
        />
      </>
    );

    const refreshButtons = screen.getAllByText('evaluation.action.refresh');
    fireEvent.click(refreshButtons[0]);
    fireEvent.click(refreshButtons[1]);

    expect(preRefresh).toHaveBeenCalledOnce();
    expect(postRefresh).toHaveBeenCalledOnce();
  });
});

describe('CommandCenter', () => {
  it('renders the three reference zones', () => {
    render(
      <CommandCenter
        metrics={<div>Metrics</div>}
        resumeContext={<div>Resume context</div>}
        workflow={<div>Workflow</div>}
        activity={<div>Activity</div>}
      />
    );

    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Resume context')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing dashboard tests**

Run:

```bash
cd apps/frontend && npm run test -- dashboard-command-center.test.tsx
```

Expected: fail because evaluation/dashboard components do not exist.

- [ ] **Step 3: Add evaluation popover and card**

Create `apps/frontend/components/evaluation/evaluation-popover.tsx`:

```tsx
'use client';

import { Popover } from '@/components/ui/popover';
import type { ResumeEvaluationResponse } from '@/lib/api/evaluation';
import { useTranslations } from '@/lib/i18n';

export function EvaluationPopover({ evaluation }: { evaluation: ResumeEvaluationResponse }) {
  const { t } = useTranslations();
  return (
    <Popover trigger={<span className="font-mono text-xs underline">{t('evaluation.details')}</span>}>
      <div className="space-y-3">
        <p className="font-mono text-xs font-bold uppercase">{t('evaluation.details')}</p>
        <dl className="grid grid-cols-2 gap-2 text-sm text-white/75">
          {Object.entries(evaluation.dimensions).map(([key, value]) => (
            <div key={key} className="border border-white/10 p-2">
              <dt className="font-mono text-[10px] uppercase text-white/45">{key}</dt>
              <dd className="text-lg text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="font-mono text-[11px] uppercase text-white/50">
          {evaluation.provider} / {evaluation.model}
        </p>
      </div>
    </Popover>
  );
}
```

Create `apps/frontend/components/evaluation/evaluation-card.tsx`:

```tsx
'use client';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import { Button } from '@/components/ui/button';
import { EvaluationPopover } from '@/components/evaluation/evaluation-popover';
import type { EvaluationPhase, ResumeEvaluationResponse } from '@/lib/api/evaluation';
import { useTranslations } from '@/lib/i18n';

interface EvaluationCardProps {
  phase: EvaluationPhase;
  evaluation: ResumeEvaluationResponse | null;
  loading: boolean;
  error: string | null;
  delta?: number | null;
  onEvaluate?: () => void;
}

export function EvaluationCard({
  phase,
  evaluation,
  loading,
  error,
  delta,
  onEvaluate,
}: EvaluationCardProps) {
  const { t } = useTranslations();
  const confidence = evaluation ? `${Math.round(evaluation.confidence * 100)}%` : null;

  return (
    <section className="min-h-[168px] border-r border-white/15 p-5 last:border-r-0">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs font-bold uppercase text-white/45">
          {t(`evaluation.phase.${phase}`)}
        </p>
        {typeof delta === 'number' && (
          <p className={delta >= 0 ? 'font-mono text-sm text-green-300' : 'font-mono text-sm text-red-300'}>
            {delta >= 0 ? '+' : ''}
            {delta}
          </p>
        )}
      </div>
      <div className="mt-6">
        {loading && (
          <p className="flex items-center gap-2 font-mono text-sm uppercase text-white/65">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('evaluation.state.checking')}
          </p>
        )}
        {!loading && evaluation && (
          <>
            <p className="font-serif text-5xl leading-none text-white">{evaluation.overall_score}</p>
            {evaluation.stale && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-orange-300/40 p-2">
                <p className="font-mono text-[11px] uppercase text-orange-200">
                  {t('evaluation.state.stale')}
                </p>
                {onEvaluate && (
                  <button
                    type="button"
                    className="font-mono text-[11px] font-bold uppercase text-orange-100 underline"
                    onClick={onEvaluate}
                  >
                    {t('evaluation.action.refresh')}
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase text-white/55">
                {t('evaluation.confidence')}: {confidence}
              </p>
              <EvaluationPopover evaluation={evaluation} />
            </div>
          </>
        )}
        {!loading && !evaluation && (
          <div className="space-y-4">
            <p className="font-serif text-2xl text-white">{t('evaluation.state.notChecked')}</p>
            {onEvaluate && (
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white hover:text-black"
                onClick={onEvaluate}
              >
                <RefreshCw className="h-4 w-4" />
                {t('evaluation.action.check')}
              </Button>
            )}
          </div>
        )}
        {error && <p className="mt-3 font-mono text-xs uppercase text-red-300">{error}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add tokenized card-stack colors**

Modify the `@theme inline` block in `apps/frontend/app/(default)/css/globals.css`:

```css
  --color-card-stack-coral: #eb3b10;
  --color-card-stack-paper: #f3e7cf;
  --color-card-stack-blue: #1484cf;
  --color-card-stack-green: #3def7a;
```

- [ ] **Step 5: Add command center and dashboard card stack**

Create `apps/frontend/components/dashboard/command-center.tsx`:

```tsx
'use client';

import React from 'react';

interface CommandCenterProps {
  metrics: React.ReactNode;
  resumeContext: React.ReactNode;
  workflow: React.ReactNode;
  activity: React.ReactNode;
}

export function CommandCenter({ metrics, resumeContext, workflow, activity }: CommandCenterProps) {
  return (
    <div className="overflow-hidden border border-white/20 bg-[#0B0E16] text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="grid border-b border-white/15 lg:grid-cols-3">{metrics}</div>
      <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid border-white/15 lg:grid-rows-[240px_minmax(380px,1fr)] lg:border-r">
          <section className="border-b border-white/15 p-6">{resumeContext}</section>
          <section className="p-6">{workflow}</section>
        </div>
        <aside className="p-6">{activity}</aside>
      </div>
    </div>
  );
}
```

Create `apps/frontend/components/dashboard/tailor-card-stack.tsx`:

```tsx
'use client';

import Link from 'next/link';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import { useTranslations } from '@/lib/i18n';

const cards = [
  { key: 'job', color: 'bg-card-stack-coral', rotate: '-rotate-6', offset: 'left-0 top-8' },
  { key: 'review', color: 'bg-card-stack-paper', rotate: 'rotate-3', offset: 'left-[18%] top-16' },
  { key: 'score', color: 'bg-card-stack-blue', rotate: '-rotate-2', offset: 'left-[36%] top-4' },
  { key: 'tailor', color: 'bg-card-stack-green', rotate: 'rotate-1', offset: 'left-[56%] top-20' },
] as const;

export function TailorCardStack({ disabled }: { disabled: boolean }) {
  const { t } = useTranslations();
  return (
    <div className="relative min-h-[340px] overflow-hidden">
      {cards.map((card, index) => (
        <div
          key={card.key}
          className={`absolute h-56 w-44 border border-black p-5 shadow-[0_18px_40px_rgba(0,0,0,0.3)] motion-safe:transition-transform motion-safe:hover:-translate-y-2 ${card.color} ${card.rotate} ${card.offset}`}
          style={{ zIndex: index + 1 }}
        >
          <p className="font-serif text-3xl leading-[0.95] text-black">
            {t(`dashboard.cardStack.${card.key}`)}
          </p>
        </div>
      ))}
      <Link
        href={disabled ? '/settings' : '/tailor'}
        className="absolute bottom-0 left-0 inline-flex items-center gap-2 border border-white/25 px-4 py-3 font-mono text-xs font-bold uppercase text-white hover:bg-white hover:text-black"
      >
        {disabled ? t('dashboard.cardStack.setup') : t('dashboard.cardStack.start')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Wire dashboard page to latest evaluations**

In `apps/frontend/app/(default)/dashboard/page.tsx`:

- Import `CommandCenter`, `EvaluationCard`, `TailorCardStack`, `createResumeEvaluation`, `fetchLatestResumeEvaluations`, and `type LatestResumeEvaluationsResponse`.
- Add state:

```tsx
const [latestEvaluations, setLatestEvaluations] = useState<LatestResumeEvaluationsResponse>({
  readiness: null,
  pre_tailor: null,
  post_tailor: null,
});
const [evaluationLoading, setEvaluationLoading] = useState(false);
const [evaluationError, setEvaluationError] = useState<string | null>(null);
```

- Add loader:

```tsx
const loadEvaluations = useCallback(async (resumeId: string) => {
  setEvaluationError(null);
  try {
    const result = await fetchLatestResumeEvaluations(resumeId);
    setLatestEvaluations(result);
  } catch (err) {
    setEvaluationError(err instanceof Error ? err.message : t('evaluation.errors.loadFailed'));
  }
}, [t]);
```

- Call `loadEvaluations(resolvedMasterId)` after resolving master resume.
- Add readiness action:

```tsx
const handleReadinessEvaluation = async () => {
  if (!masterResumeId) return;
  setEvaluationLoading(true);
  setEvaluationError(null);
  try {
    const readiness = await createResumeEvaluation(masterResumeId, {
      phase: 'readiness',
      force_refresh: Boolean(latestEvaluations.readiness?.stale),
    });
    setLatestEvaluations((prev) => ({ ...prev, readiness }));
  } catch (err) {
    setEvaluationError(err instanceof Error ? err.message : t('evaluation.errors.checkFailed'));
  } finally {
    setEvaluationLoading(false);
  }
};
```

- Add stale refresh actions for paired pre/post cards:

```tsx
const handlePreTailorRefresh = async () => {
  const current = latestEvaluations.pre_tailor;
  if (!masterResumeId || !current?.job_id) return;
  setEvaluationLoading(true);
  setEvaluationError(null);
  try {
    const preTailor = await createResumeEvaluation(masterResumeId, {
      phase: 'pre_tailor',
      job_id: current.job_id,
      force_refresh: true,
    });
    setLatestEvaluations((prev) => ({ ...prev, pre_tailor: preTailor }));
  } catch (err) {
    setEvaluationError(err instanceof Error ? err.message : t('evaluation.errors.checkFailed'));
  } finally {
    setEvaluationLoading(false);
  }
};

const handlePostTailorRefresh = async () => {
  const current = latestEvaluations.post_tailor;
  const baselineId = current?.baseline_resume_id || masterResumeId;
  if (!current?.resume_id || !current.job_id || !baselineId) return;
  setEvaluationLoading(true);
  setEvaluationError(null);
  try {
    const postTailor = await createResumeEvaluation(current.resume_id, {
      phase: 'post_tailor',
      job_id: current.job_id,
      baseline_resume_id: baselineId,
      force_refresh: true,
    });
    setLatestEvaluations((prev) => ({ ...prev, post_tailor: postTailor }));
  } catch (err) {
    setEvaluationError(err instanceof Error ? err.message : t('evaluation.errors.checkFailed'));
  } finally {
    setEvaluationLoading(false);
  }
};
```

- Replace the `<SwissGrid intro={guideIntro}>...</SwissGrid>` body with `CommandCenter`. Move the exact JSX blocks currently marked `/* 1. Master Resume Logic */`, `/* 2. Tailored Resumes */`, and `/* 3. Create Tailored Resume */` into local `resumeContextSlot` and `activitySlot` constants before `return`; do not change their handlers or button disabled rules. Keep `ConfirmDialog` mounted after `CommandCenter`.

Use this structure for the replacement so the reference layout is explicit:

```tsx
<CommandCenter
  metrics={
    <>
      <EvaluationCard
        phase="readiness"
        evaluation={latestEvaluations.readiness}
        loading={evaluationLoading}
        error={evaluationError}
        onEvaluate={handleReadinessEvaluation}
      />
      <EvaluationCard
        phase="pre_tailor"
        evaluation={latestEvaluations.pre_tailor}
        loading={false}
        error={null}
        onEvaluate={latestEvaluations.pre_tailor?.stale ? handlePreTailorRefresh : undefined}
      />
      <EvaluationCard
        phase="post_tailor"
        evaluation={latestEvaluations.post_tailor}
        loading={false}
        error={null}
        delta={
          latestEvaluations.pre_tailor?.job_id &&
          latestEvaluations.post_tailor?.job_id &&
          latestEvaluations.pre_tailor.job_id === latestEvaluations.post_tailor.job_id
            ? latestEvaluations.post_tailor.overall_score - latestEvaluations.pre_tailor.overall_score
            : null
        }
        onEvaluate={latestEvaluations.post_tailor?.stale ? handlePostTailorRefresh : undefined}
      />
    </>
  }
  resumeContext={
    <div className="space-y-4">
      <p className="font-mono text-xs font-bold uppercase text-white/50">
        {t('dashboard.masterResume')}
      </p>
      {resumeContextSlot}
    </div>
  }
  workflow={<TailorCardStack disabled={!systemStatus?.llm_configured || !masterResumeId} />}
  activity={
    <div className="space-y-4">
      <p className="font-mono text-xs font-bold uppercase text-white/50">
        {t('dashboard.tailoredResume')}
      </p>
      {activitySlot}
    </div>
  }
/>
```

`resumeContextSlot` contains the current master resume upload/setup/existing-card branch. `activitySlot` contains the current tailored resume map and create-tailored-resume card. Remove `SwissGrid` and `guideIntro` after the slots compile so the page has one shell hierarchy.

- [ ] **Step 7: Add dashboard/evaluation English copy**

Add to `apps/frontend/messages/en.json`:

```json
"evaluation": {
  "details": "Details",
  "confidence": "Confidence",
  "phase": {
    "readiness": "Resume readiness",
    "pre_tailor": "Pre-tailor match",
    "post_tailor": "Post-tailor lift"
  },
  "state": {
    "checking": "Checking",
    "notChecked": "Not checked yet",
    "stale": "Needs refresh"
  },
  "action": {
    "check": "Check my resume",
    "refresh": "Refresh score"
  },
  "errors": {
    "loadFailed": "Could not load evaluation scores.",
    "checkFailed": "Could not evaluate this resume."
  }
},
"dashboard": {
  "cardStack": {
    "job": "Add job",
    "review": "Review JD",
    "score": "Check fit",
    "tailor": "Tailor",
    "start": "Match this job",
    "setup": "Set up model"
  }
}
```

Merge with existing `dashboard` keys rather than replacing them.

- [ ] **Step 8: Run dashboard tests**

Run:

```bash
cd apps/frontend && npm run test -- dashboard-command-center.test.tsx
```

Expected: all tests pass.

- [ ] **Step 9: Commit dashboard slice**

Run:

```bash
git add apps/frontend/components/evaluation apps/frontend/components/dashboard/command-center.tsx apps/frontend/components/dashboard/tailor-card-stack.tsx apps/frontend/app/'(default)'/css/globals.css apps/frontend/app/'(default)'/dashboard/page.tsx apps/frontend/messages/en.json apps/frontend/tests/dashboard-command-center.test.tsx
git commit -m "feat: add dashboard evaluation command center"
```

## Task 7: Tailor Card Session And Pre/Post Evaluations

**Files:**

- Create: `apps/frontend/components/tailor/tailor-session-cards.tsx`
- Modify: `apps/frontend/app/(default)/tailor/page.tsx`
- Modify: `apps/frontend/messages/en.json`
- Test: `apps/frontend/tests/tailor-session-cards.test.tsx`

- [ ] **Step 1: Write failing tailor card tests**

Create `apps/frontend/tests/tailor-session-cards.test.tsx`:

```typescript
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TailorSessionCards } from '@/components/tailor/tailor-session-cards';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('TailorSessionCards', () => {
  it('renders a functional stacked deck with active and completed states', () => {
    render(<TailorSessionCards activeStep="review_jd" completedSteps={['add_job']} />);

    expect(screen.getByRole('list', { name: 'tailor.session.deckLabel' })).toHaveAttribute(
      'data-layout',
      'stacked-deck'
    );
    expect(screen.getByText('tailor.session.steps.add_job')).toBeInTheDocument();
    expect(screen.getByText('tailor.session.steps.review_jd')).toBeInTheDocument();
    expect(screen.getByText('tailor.session.steps.post_score')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'tailor.session.steps.review_jd' })).toHaveAttribute(
      'aria-current',
      'step'
    );
    expect(screen.getByRole('listitem', { name: 'tailor.session.steps.add_job' })).toHaveAttribute(
      'data-state',
      'complete'
    );
  });
});
```

- [ ] **Step 2: Run failing tailor tests**

Run:

```bash
cd apps/frontend && npm run test -- tailor-session-cards.test.tsx
```

Expected: fail because `tailor-session-cards` does not exist.

- [ ] **Step 3: Add tailor session card component**

Create `apps/frontend/components/tailor/tailor-session-cards.tsx`:

```tsx
'use client';

import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export type TailorSessionStep =
  | 'add_job'
  | 'review_jd'
  | 'pre_score'
  | 'tailor'
  | 'review_changes'
  | 'post_score';

const steps: TailorSessionStep[] = [
  'add_job',
  'review_jd',
  'pre_score',
  'tailor',
  'review_changes',
  'post_score',
];

const stepTheme: Record<TailorSessionStep, { color: string; text: string; rotate: string }> = {
  add_job: { color: 'bg-card-stack-coral', text: 'text-black', rotate: '-rotate-3' },
  review_jd: { color: 'bg-card-stack-paper', text: 'text-black', rotate: 'rotate-2' },
  pre_score: { color: 'bg-card-stack-blue', text: 'text-white', rotate: '-rotate-1' },
  tailor: { color: 'bg-card-stack-green', text: 'text-black', rotate: 'rotate-1' },
  review_changes: { color: 'bg-ink', text: 'text-white', rotate: '-rotate-2' },
  post_score: { color: 'bg-warning', text: 'text-black', rotate: 'rotate-3' },
};

function deckPosition(index: number, activeIndex: number): string {
  const distance = index - activeIndex;
  if (distance === 0) return 'z-40 translate-x-0 translate-y-0 scale-100 opacity-100';
  if (distance === -1) return 'z-30 -translate-x-10 translate-y-6 scale-[0.92] opacity-85';
  if (distance < -1) return 'z-20 -translate-x-16 translate-y-12 scale-[0.84] opacity-45';
  if (distance === 1) return 'z-30 translate-x-12 translate-y-8 scale-[0.92] opacity-90';
  return 'z-10 translate-x-20 translate-y-16 scale-[0.84] opacity-55';
}

interface TailorSessionCardsProps {
  activeStep: TailorSessionStep;
  completedSteps: TailorSessionStep[];
}

export function TailorSessionCards({ activeStep, completedSteps }: TailorSessionCardsProps) {
  const { t } = useTranslations();
  const activeIndex = steps.indexOf(activeStep);

  return (
    <div
      role="list"
      aria-label={t('tailor.session.deckLabel')}
      data-layout="stacked-deck"
      className="relative h-[360px] overflow-hidden md:h-[420px]"
    >
      {steps.map((step, index) => {
        const active = activeStep === step;
        const complete = completedSteps.includes(step);
        const theme = stepTheme[step];
        return (
          <section
            key={step}
            role="listitem"
            aria-label={t(`tailor.session.steps.${step}`)}
            aria-current={active ? 'step' : undefined}
            data-state={active ? 'active' : complete ? 'complete' : 'upcoming'}
            className={cn(
              'absolute left-4 top-4 h-72 w-[min(78vw,360px)] border border-black p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]',
              'motion-safe:transition-[transform,opacity] motion-safe:duration-300',
              'motion-reduce:transition-none md:left-16 md:top-8',
              theme.color,
              theme.text,
              theme.rotate,
              deckPosition(index, activeIndex),
              complete && !active && 'ring-2 ring-success'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[11px] font-bold uppercase opacity-65">
                {String(index + 1).padStart(2, '0')}
              </p>
              {complete && <CheckCircle2 className="h-4 w-4" />}
            </div>
            <h2 className="mt-20 font-serif text-4xl leading-none">{t(`tailor.session.steps.${step}`)}</h2>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Trigger pre-tailor evaluation after JD confirm**

Modify `apps/frontend/app/(default)/tailor/page.tsx`:

- Import:

```tsx
import {
  createResumeEvaluation,
  type ResumeEvaluationResponse,
} from '@/lib/api/evaluation';
import {
  TailorSessionCards,
  type TailorSessionStep,
} from '@/components/tailor/tailor-session-cards';
```

- Add state:

```tsx
const [activeSessionStep, setActiveSessionStep] = useState<TailorSessionStep>('add_job');
const [completedSessionSteps, setCompletedSessionSteps] = useState<TailorSessionStep[]>([]);
const [preTailorEvaluation, setPreTailorEvaluation] = useState<ResumeEvaluationResponse | null>(null);
const [postTailorEvaluation, setPostTailorEvaluation] = useState<ResumeEvaluationResponse | null>(null);
const [evaluationWarning, setEvaluationWarning] = useState<string | null>(null);
```

- Add helper:

```tsx
const markSessionComplete = (step: TailorSessionStep) => {
  setCompletedSessionSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
};
```

- In `handleJobConfirmed`, after `incrementJobs()` and before `runPreviewForJob(...)`:

```tsx
markSessionComplete('add_job');
markSessionComplete('review_jd');
setActiveSessionStep('pre_score');
try {
  const evaluation = await createResumeEvaluation(resumeId, {
    phase: 'pre_tailor',
    job_id: jobId,
  });
  setPreTailorEvaluation(evaluation);
  markSessionComplete('pre_score');
} catch (err) {
  setEvaluationWarning(err instanceof Error ? err.message : t('evaluation.errors.checkFailed'));
}
setActiveSessionStep('tailor');
```

- [ ] **Step 5: Trigger post-tailor evaluation after confirm**

Modify `confirmAndNavigate` in `apps/frontend/app/(default)/tailor/page.tsx`:

```tsx
const confirmAndNavigate = async (result: ImprovedResult) => {
  const confirmed = await confirmImproveResume(buildConfirmPayload(result));
  incrementImprovements();
  incrementResumes();
  setImprovedData(confirmed);
  markSessionComplete('review_changes');

  const newResumeId = confirmed?.data?.resume_id;
  if (newResumeId && masterResumeId) {
    setActiveSessionStep('post_score');
    try {
      const evaluation = await createResumeEvaluation(newResumeId, {
        phase: 'post_tailor',
        job_id: confirmed.data.job_id,
        baseline_resume_id: masterResumeId,
      });
      setPostTailorEvaluation(evaluation);
      markSessionComplete('post_score');
    } catch (err) {
      setEvaluationWarning(err instanceof Error ? err.message : t('evaluation.errors.checkFailed'));
    }
    router.push(`/resumes/${newResumeId}`);
  } else {
    router.push('/builder');
  }
};
```

- Add `<TailorSessionCards activeStep={activeSessionStep} completedSteps={completedSessionSteps} />` near the top of the tailor content.
- Show `evaluationWarning` and the latest pre/post scores in the existing warning/error region without blocking the saved resume:

```tsx
{evaluationWarning && (
  <div className="border border-orange-500 bg-orange-50 p-3 font-mono text-xs uppercase text-orange-800">
    {evaluationWarning}
  </div>
)}
{(preTailorEvaluation || postTailorEvaluation) && (
  <div className="grid gap-3 md:grid-cols-2">
    {preTailorEvaluation && (
      <div className="border border-black bg-white p-3">
        <p className="font-mono text-[11px] uppercase">{t('evaluation.phase.pre_tailor')}</p>
        <p className="font-serif text-3xl">{preTailorEvaluation.overall_score}</p>
      </div>
    )}
    {postTailorEvaluation && (
      <div className="border border-black bg-white p-3">
        <p className="font-mono text-[11px] uppercase">{t('evaluation.phase.post_tailor')}</p>
        <p className="font-serif text-3xl">{postTailorEvaluation.overall_score}</p>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Add tailor session copy**

Add to `apps/frontend/messages/en.json` under existing `tailor`:

```json
"session": {
  "deckLabel": "Tailoring progress",
  "steps": {
    "add_job": "Add job",
    "review_jd": "Review JD",
    "pre_score": "Check fit",
    "tailor": "Tailor resume",
    "review_changes": "Review changes",
    "post_score": "Post-score"
  }
}
```

- [ ] **Step 7: Run tailor card tests**

Run:

```bash
cd apps/frontend && npm run test -- tailor-session-cards.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Commit tailor evaluation flow**

Run:

```bash
git add apps/frontend/components/tailor/tailor-session-cards.tsx apps/frontend/app/'(default)'/tailor/page.tsx apps/frontend/messages/en.json apps/frontend/tests/tailor-session-cards.test.tsx
git commit -m "feat: add tailor evaluation card flow"
```

## Task 8: Remaining i18n, Builder/Settings Shell Cleanup, And Frontend Tests

**Files:**

- Modify: `apps/frontend/messages/es.json`
- Modify: `apps/frontend/messages/ja.json`
- Modify: `apps/frontend/messages/pt-BR.json`
- Modify: `apps/frontend/messages/zh.json`
- Modify: `apps/frontend/app/(default)/builder/page.tsx` if it renders duplicate top-level page chrome; preserve builder content and let `app/(default)/layout.tsx` provide breadcrumbs/tabs/settings.
- Modify: `apps/frontend/app/(default)/settings/page.tsx` if it renders duplicate top-level page chrome; preserve settings forms and let `app/(default)/layout.tsx` provide breadcrumbs/tabs/settings.
- Modify: `apps/frontend/app/(default)/resumes/[id]/page.tsx` if it renders duplicate top-level page chrome; preserve resume viewer content and let `app/(default)/layout.tsx` provide breadcrumbs/tabs/settings.

- [ ] **Step 1: Add non-English message keys**

For `es`, `ja`, `pt-BR`, and `zh`, add the same nested keys introduced in Tasks 5-7. Use clear English fallback values if translation quality would be uncertain; do not leave keys missing.

Required top-level groups:

```json
"shell": {
  "breadcrumbs": { "label": "Breadcrumbs", "home": "Home" },
  "tabs": { "label": "Product sections", "dashboard": "Dashboard", "tailor": "Tailor", "builder": "Builder", "settings": "Settings" },
  "pages": { "dashboard": "Dashboard", "tailor": "Tailor", "builder": "Builder", "settings": "Settings", "resumes": "Resume" },
  "status": { "title": "Model status", "checking": "Checking", "ready": "Ready", "setupRequired": "Setup required", "readyDetail": "Your configured model is ready for tailoring and evaluation.", "setupDetail": "Configure or test your model before running AI actions.", "lastChecked": "Last checked", "refresh": "Refresh" },
  "settings": { "open": "Settings", "title": "Model and app settings", "description": "Check model health and jump to the full settings page.", "modelStatus": "Model status", "provider": "Provider", "model": "Model", "fullSettings": "Full settings" },
  "help": {
    "open": "Help",
    "title": "How Resume Matcher uses your data",
    "topics": {
      "score": { "title": "How scores are calculated", "body": "Scores are generated from reviewed inputs and the configured model." },
      "data": { "title": "What data is used", "body": "Evaluation uses resume text, reviewed job descriptions, optional baseline resume, and evidence snippets." },
      "recommendation": { "title": "Why this recommendation appeared", "body": "Recommendations must point to resume evidence, job evidence, or missing evidence." },
      "tailor": { "title": "What happens when I tailor", "body": "The app previews changes, asks for confirmation, stores the tailored resume, and records a post-tailor score when evaluation succeeds." }
    }
  }
},
"evaluation": {
  "details": "Details",
  "confidence": "Confidence",
  "phase": { "readiness": "Resume readiness", "pre_tailor": "Pre-tailor match", "post_tailor": "Post-tailor lift" },
  "state": { "checking": "Checking", "notChecked": "Not checked yet", "stale": "Needs refresh" },
  "action": { "check": "Check my resume", "refresh": "Refresh score" },
  "errors": { "loadFailed": "Could not load evaluation scores.", "checkFailed": "Could not evaluate this resume." }
}
```

Also add `tailor.session.deckLabel`, `tailor.session.steps`, and `dashboard.cardStack` keys matching the English structure.

- [ ] **Step 2: Run all frontend tests**

Run:

```bash
cd apps/frontend && npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run frontend format and lint**

Run:

```bash
cd apps/frontend && npm run format
cd apps/frontend && npm run lint
```

Expected: both complete with no errors.

- [ ] **Step 4: Commit i18n and shell cleanup**

Run:

```bash
git add apps/frontend/messages apps/frontend/app/'(default)'/builder/page.tsx apps/frontend/app/'(default)'/settings/page.tsx apps/frontend/app/'(default)'/resumes/'[id]'/page.tsx
git commit -m "feat: complete shell i18n and page cleanup"
```

If a listed page file was not modified, omit it from `git add`.

## Task 9: Full Backend, Frontend, Browser, And Railway Verification

**Files:**

- No required source files.
- Capture screenshots to temporary files only; delete temporary QA artifacts before final handoff unless the user asks to keep them.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd apps/backend && uv run pytest tests/unit/test_evaluation.py tests/integration/test_evaluations_api.py tests/integration/test_job_intake_api.py tests/integration/test_jobs_api.py -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run frontend tests and build**

Run:

```bash
cd apps/frontend && npm run test
cd apps/frontend && npm run lint
cd apps/frontend && npm run build
```

Expected: all pass. Build should include `/dashboard`, `/tailor`, `/builder`, `/settings`, and resume routes without TypeScript errors.

- [ ] **Step 3: Run repository diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Start local backend and frontend**

Terminal 1:

```bash
cd apps/backend && uv run uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```bash
cd apps/frontend && npm run dev
```

Expected:

- Backend available at `http://localhost:8000/api/v1/health`.
- Frontend available at `http://localhost:3000/dashboard`.

- [ ] **Step 5: Browser QA with in-app Browser**

Open `http://localhost:3000/dashboard` in Browser/IAB and verify:

- Screenshot 1 fidelity: bounded dark shell, top chrome, internal dividers, stacked left panels, tall right rail, and intentional empty-state placeholders.
- Screenshot 2 fidelity: full-width metric band, oversized values, muted labels, separators, and no fake deltas.
- Screenshot 3 fidelity: overlapping tilted cards with bounded rotation and varied tokenized colors.
- Settings modal opens, traps focus, closes with Escape, and links to `/settings`.
- Metric popovers open and show model/provider/confidence when scores exist.
- Missing scores say `Not checked yet`.
- Mobile viewport does not overflow or overlap text.

Then open `http://localhost:3000/tailor` and verify:

- Card session steps render.
- JD intake still supports manual paste.
- Textareas still stop Enter propagation.
- Preview/diff/confirm flow still works when backend/model configuration is available.
- Evaluation failures do not block saved resume navigation.

Stop both local server sessions after Browser QA is complete.

- [ ] **Step 6: Deploy after implementation**

Only after all checks pass, deploy to the linked Railway service:

```bash
railway up --service resume-matcher --environment production --detach -m "Deploy app shell evaluation feature"
```

Then poll:

```bash
railway deployment list --service resume-matcher --limit 1 --json
railway service status --service resume-matcher --json
```

Expected: latest deployment reaches `SUCCESS`.

- [ ] **Step 7: Smoke test deployed Railway app**

Run:

```bash
curl -I -L --max-time 20 https://resume-matcher-production-67e3.up.railway.app/dashboard
curl -sS -L --max-time 20 https://resume-matcher-production-67e3.up.railway.app/api/v1/health
curl -sS -L --max-time 20 https://resume-matcher-production-67e3.up.railway.app/api/v1/status
```

Expected:

- Dashboard returns HTTP `200`.
- Health returns `{"status":"healthy"}`.
- Status returns JSON with `llm_configured`, `llm_healthy`, and `database_stats`.

- [ ] **Step 8: Final commit for verification fixes**

If verification required source fixes, return to the task that owns the changed files and use that task's `git add` pattern and commit message. If verification did not require source fixes, do not create a commit.

Expected: final `git status --short` shows only unrelated pre-existing changes or the clean committed implementation state.
