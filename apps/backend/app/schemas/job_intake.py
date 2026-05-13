"""Schemas for job-description intake automation."""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

JobSourceType = Literal[
    "manual_text",
    "job_url",
    "pdf_url",
    "pdf_upload",
    "recruiter_message",
]

ExtractionMethod = Literal[
    "manual",
    "deterministic",
    "http",
    "playwright",
    "pdf",
    "llm",
]


class DetectedJobLink(BaseModel):
    """Link detected during job intake."""

    url: str
    label: str | None = None


class ScreeningQuestion(BaseModel):
    """Recruiter screening question extracted separately from the JD."""

    id: str
    question: str


class DraftAnswer(BaseModel):
    """Evidence-only draft answer for a screening question."""

    question_id: str
    answer: str = ""
    evidence: list[str] = Field(default_factory=list)
    needs_user_input: bool = True
    prompt: str = ""


class JobIntakeMetadata(BaseModel):
    """Reviewed intake metadata persisted with the job record."""

    source_type: JobSourceType
    source_url: str | None = None
    source_title: str | None = None
    links: list[DetectedJobLink] = Field(default_factory=list)
    screening_questions: list[ScreeningQuestion] = Field(default_factory=list)
    draft_answers: list[DraftAnswer] = Field(default_factory=list)
    extraction_method: ExtractionMethod = "deterministic"
    warnings: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class JobIntakeExtractRequest(BaseModel):
    """Request to extract a JD from text or URL input."""

    source_type: Literal["manual_text", "job_url", "pdf_url", "recruiter_message"]
    source_text: str | None = None
    url: str | None = None
    resume_id: str | None = None
    resume_text: str | None = None

    @field_validator("source_text", "url", "resume_id", "resume_text", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _validate_source_payload(self) -> "JobIntakeExtractRequest":
        if self.source_type in ("manual_text", "recruiter_message") and not self.source_text:
            raise ValueError("source_text is required for this source type")
        if self.source_type in ("job_url", "pdf_url") and not self.url:
            raise ValueError("url is required for this source type")
        return self


class JobIntakeExtractResponse(BaseModel):
    """Extraction response shown in the review step."""

    source_type: JobSourceType
    job_description: str
    source_url: str | None = None
    source_title: str | None = None
    links: list[DetectedJobLink] = Field(default_factory=list)
    screening_questions: list[ScreeningQuestion] = Field(default_factory=list)
    draft_answers: list[DraftAnswer] = Field(default_factory=list)
    extraction_method: ExtractionMethod
    warnings: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    requires_review: bool = True


class JobIntakeConfirmRequest(BaseModel):
    """Persist a user-reviewed JD and optional intake metadata."""

    job_description: str
    resume_id: str | None = None
    intake_metadata: JobIntakeMetadata | None = None

    @field_validator("job_description")
    @classmethod
    def _validate_job_description(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 50:
            raise ValueError("Job description is too short")
        return normalized


class JobIntakeConfirmResponse(BaseModel):
    """Response after reviewed intake is stored as a job."""

    message: str
    job_id: str
    request: dict[str, Any]
