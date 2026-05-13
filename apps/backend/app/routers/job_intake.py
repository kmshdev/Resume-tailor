"""Job-description intake automation endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from app.database import db
from app.schemas.job_intake import (
    JobIntakeConfirmRequest,
    JobIntakeConfirmResponse,
    JobIntakeExtractRequest,
    JobIntakeExtractResponse,
)
from app.services.job_intake import (
    JobIntakeError,
    body_looks_like_pdf,
    extract_job_intake,
    extract_pdf_upload,
    redact_url_for_metadata,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs/intake", tags=["Job Intake"])

PDF_TYPES = {"application/pdf"}
MAX_PDF_SIZE = 4 * 1024 * 1024


def _metadata_payload(request: JobIntakeConfirmRequest) -> dict[str, Any] | None:
    """Return serializable intake metadata."""
    if request.intake_metadata is None:
        return None
    payload = request.intake_metadata.model_dump()
    payload["source_url"] = redact_url_for_metadata(request.intake_metadata.source_url)
    return payload


def _request_with_resume_evidence(request: JobIntakeExtractRequest) -> JobIntakeExtractRequest:
    """Attach resume content evidence when only resume_id was provided."""
    if request.resume_text or not request.resume_id:
        return request

    resume = db.get_resume(request.resume_id)
    if not resume:
        logger.warning("JD intake resume evidence not found for %s", request.resume_id)
        return request

    content = resume.get("content")
    if isinstance(content, str) and content.strip():
        return request.model_copy(update={"resume_text": content})
    return request


def _resume_text_for_id(resume_id: str | None) -> str | None:
    """Return resume content used as answer evidence."""
    if not resume_id:
        return None
    resume = db.get_resume(resume_id)
    if not resume:
        logger.warning("JD intake resume evidence not found for %s", resume_id)
        return None
    content = resume.get("content")
    return content if isinstance(content, str) and content.strip() else None


@router.post("/extract", response_model=JobIntakeExtractResponse)
async def extract_job_description(
    request: JobIntakeExtractRequest,
) -> JobIntakeExtractResponse:
    """Extract reviewable JD text and metadata from text or URL input."""
    try:
        return await extract_job_intake(_request_with_resume_evidence(request))
    except JobIntakeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValidationError as exc:
        logger.warning("JD intake validation failed: %s", exc)
        raise HTTPException(status_code=422, detail="Invalid intake request.")
    except Exception as exc:
        logger.error("JD intake extraction failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to extract the job description. Please paste it manually.",
        )


@router.post("/pdf-upload", response_model=JobIntakeExtractResponse)
async def upload_job_pdf(
    file: UploadFile = File(...),
    resume_id: str | None = Form(default=None),
) -> JobIntakeExtractResponse:
    """Extract reviewable JD text from an uploaded PDF."""
    if file.content_type not in PDF_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")
    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="Uploaded PDF is too large.")
    if not body_looks_like_pdf(content):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")

    try:
        return await extract_pdf_upload(
            content,
            file.filename or "job.pdf",
            resume_text=_resume_text_for_id(resume_id),
        )
    except JobIntakeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("JD PDF intake failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Failed to extract text from the PDF. Please paste the job description manually.",
        )


@router.post("/confirm", response_model=JobIntakeConfirmResponse)
async def confirm_job_intake(
    request: JobIntakeConfirmRequest,
) -> JobIntakeConfirmResponse:
    """Persist reviewed JD content as the canonical job record."""
    try:
        job = db.create_job(
            content=request.job_description,
            resume_id=request.resume_id,
            intake_metadata=_metadata_payload(request),
        )
    except Exception as exc:
        logger.error("Failed to persist JD intake job: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save job description.")

    return JobIntakeConfirmResponse(
        message="job intake saved",
        job_id=job["job_id"],
        request={
            "resume_id": request.resume_id,
            "intake_metadata": _metadata_payload(request),
        },
    )
