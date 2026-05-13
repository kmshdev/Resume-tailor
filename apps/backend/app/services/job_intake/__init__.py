"""Public service API for job-description intake automation."""

from app.services.job_intake.errors import JobIntakeError
from app.services.job_intake.extraction import (
    body_looks_like_pdf,
    build_evidence_only_answer,
    content_looks_like_html as _content_looks_like_html,
    content_looks_like_pdf as _content_looks_like_pdf,
    draft_answers as _draft_answers,
    extract_links_from_text,
    extract_questions_from_text,
    filename_looks_like_pdf as _filename_looks_like_pdf,
    html_to_text as _html_to_text,
    pdf_filename_from_url as _pdf_filename_from_url,
)
from app.services.job_intake.fetchers import (
    SafeAsyncHTTPTransport,
    SafeAsyncNetworkBackend,
    fetch_url as _fetch_url,
    fetch_with_playwright as _fetch_with_playwright,
    fulfill_with_safe_fetch as _fulfill_with_safe_fetch,
)
from app.services.job_intake.llm_cleanup import maybe_refine_with_llm as _maybe_refine_with_llm
from app.services.job_intake.models import FetchedContent
from app.services.job_intake.service import (
    _build_response,
    _clean_text,
    _extract_remote_url,
    _strip_non_jd_lines,
    extract_job_intake,
    extract_pdf_upload,
)
from app.services.job_intake.url_safety import (
    _is_blocked_ip,
    _redact_url_for_logging,
    _resolve_public_addresses,
    redact_url_for_metadata,
    validate_public_url,
)

__all__ = [
    "FetchedContent",
    "JobIntakeError",
    "SafeAsyncHTTPTransport",
    "SafeAsyncNetworkBackend",
    "_build_response",
    "_clean_text",
    "_content_looks_like_html",
    "_content_looks_like_pdf",
    "_draft_answers",
    "_extract_remote_url",
    "_fetch_url",
    "_fetch_with_playwright",
    "_filename_looks_like_pdf",
    "_fulfill_with_safe_fetch",
    "_html_to_text",
    "_is_blocked_ip",
    "_maybe_refine_with_llm",
    "_pdf_filename_from_url",
    "_redact_url_for_logging",
    "_resolve_public_addresses",
    "_strip_non_jd_lines",
    "body_looks_like_pdf",
    "build_evidence_only_answer",
    "extract_job_intake",
    "extract_links_from_text",
    "extract_pdf_upload",
    "extract_questions_from_text",
    "redact_url_for_metadata",
    "validate_public_url",
]
