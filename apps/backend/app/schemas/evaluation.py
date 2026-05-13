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
