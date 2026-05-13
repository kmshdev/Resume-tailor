"""Job-description intake orchestration service."""

import logging
from typing import Any

from app.schemas.job_intake import (
    ExtractionMethod,
    JobIntakeExtractRequest,
    JobIntakeExtractResponse,
    JobSourceType,
    ScreeningQuestion,
)
from app.services.job_intake.constants import MIN_REVIEWABLE_JD_CHARS, PLAYWRIGHT_MIN_TEXT_CHARS
from app.services.job_intake.errors import JobIntakeError
from app.services.job_intake.extraction import (
    body_looks_like_pdf,
    clean_text,
    content_looks_like_html,
    content_looks_like_pdf,
    draft_answers,
    extract_links_from_text,
    extract_questions_from_text,
    filename_looks_like_pdf,
    html_to_text,
    pdf_filename_from_url,
    strip_non_jd_lines,
)
from app.services.job_intake.fetchers import (
    fetch_url as _fetch_url,
    fetch_with_playwright as _fetch_with_playwright,
)
from app.services.job_intake.llm_cleanup import maybe_refine_with_llm as _maybe_refine_with_llm
from app.services.job_intake.url_safety import _redact_url_for_logging, redact_url_for_metadata
from app.services.parser import parse_document

logger = logging.getLogger(__name__)


def _build_response(
    *,
    source_type: JobSourceType,
    source_text: str,
    raw_text: str,
    source_url: str | None = None,
    source_title: str | None = None,
    extraction_method: ExtractionMethod,
    resume_text: str | None = None,
    warnings: list[str] | None = None,
    confidence: float = 0.8,
) -> JobIntakeExtractResponse:
    """Build a review response from raw/extracted text."""
    cleaned_raw = clean_text(raw_text)
    links = extract_links_from_text(source_text)
    questions = extract_questions_from_text(source_text)
    job_description = strip_non_jd_lines(cleaned_raw, questions)

    if len(job_description) < MIN_REVIEWABLE_JD_CHARS:
        warning_list = list(warnings or [])
        warning_list.append("Extracted job description is short; please review before tailoring.")
    else:
        warning_list = list(warnings or [])

    evidence_text = resume_text or ""
    return JobIntakeExtractResponse(
        source_type=source_type,
        job_description=job_description,
        source_url=redact_url_for_metadata(source_url),
        source_title=source_title,
        links=links,
        screening_questions=questions,
        draft_answers=draft_answers(questions, evidence_text),
        extraction_method=extraction_method,
        warnings=warning_list,
        confidence=max(0.0, min(confidence, 1.0)),
        requires_review=True,
    )


async def extract_pdf_upload(
    content: bytes,
    filename: str,
    resume_text: str | None = None,
) -> JobIntakeExtractResponse:
    """Extract JD text from uploaded PDF bytes."""
    if not filename_looks_like_pdf(filename) or not body_looks_like_pdf(content):
        raise JobIntakeError("Uploaded file is not a valid PDF.")

    markdown = await parse_document(content, "job.pdf")
    if not markdown.strip():
        raise JobIntakeError("Could not extract text from the uploaded PDF.")
    return _build_response(
        source_type="pdf_upload",
        source_text=markdown,
        raw_text=markdown,
        source_title=filename,
        extraction_method="pdf",
        resume_text=resume_text,
        confidence=0.9,
    )


async def _extract_remote_url(
    request: JobIntakeExtractRequest,
) -> JobIntakeExtractResponse:
    """Extract JD text from a public URL."""
    if not request.url:
        raise JobIntakeError("URL is required.")

    fetched = await _fetch_url(request.url)
    source_title: str | None = None
    warnings: list[str] = []
    if content_looks_like_pdf(fetched.content_type, fetched.body):
        raw_text = await parse_document(fetched.body, pdf_filename_from_url(fetched.url))
        method: ExtractionMethod = "pdf"
    elif request.source_type == "pdf_url":
        raise JobIntakeError("The provided PDF URL did not return PDF content.")
    elif not content_looks_like_html(fetched.content_type):
        raise JobIntakeError(
            "Remote URL returned an unsupported content type. Please paste the job description manually."
        )
    else:
        html = fetched.body.decode("utf-8", errors="replace")
        raw_text, source_title = html_to_text(html)
        method = "http"
        if len(raw_text) < PLAYWRIGHT_MIN_TEXT_CHARS:
            try:
                raw_text, playwright_title = await _fetch_with_playwright(fetched.url)
                source_title = playwright_title or source_title
                method = "playwright"
            except Exception as exc:
                logger.warning(
                    "Playwright JD fallback failed for %s: %s",
                    _redact_url_for_logging(fetched.url),
                    exc,
                )
                warnings.append("Browser fallback failed; please review extracted text.")

    metadata_source_text = raw_text
    refined = await _maybe_refine_with_llm(raw_text)
    if refined and isinstance(refined.get("job_description"), str):
        raw_text = refined["job_description"]
        method = "llm"
        warnings.extend(
            warning for warning in refined.get("warnings", []) if isinstance(warning, str)
        )

    return _build_response(
        source_type=request.source_type,
        source_text=metadata_source_text,
        raw_text=raw_text,
        source_url=fetched.url,
        source_title=source_title,
        extraction_method=method,
        resume_text=request.resume_text,
        warnings=warnings,
        confidence=0.85,
    )


async def extract_job_intake(
    request: JobIntakeExtractRequest,
) -> JobIntakeExtractResponse:
    """Extract reviewable job-description intake data."""
    if request.source_type == "manual_text":
        source_text = (request.source_text or "").strip()
        return _build_response(
            source_type="manual_text",
            source_text=source_text,
            raw_text=source_text,
            extraction_method="manual",
            resume_text=request.resume_text,
            confidence=1.0,
        )

    if request.source_type == "recruiter_message":
        source_text = (request.source_text or "").strip()
        refined = await _maybe_refine_with_llm(source_text)
        raw_text = (
            refined["job_description"]
            if refined and isinstance(refined.get("job_description"), str)
            else source_text
        )
        warnings = [
            warning for warning in (refined or {}).get("warnings", []) if isinstance(warning, str)
        ]
        return _build_response(
            source_type="recruiter_message",
            source_text=source_text,
            raw_text=raw_text,
            extraction_method="llm" if refined else "deterministic",
            resume_text=request.resume_text,
            warnings=warnings,
            confidence=0.8 if refined else 0.65,
        )

    return await _extract_remote_url(request)


_draft_answers = draft_answers
_clean_text = clean_text
_strip_non_jd_lines = strip_non_jd_lines
