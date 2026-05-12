"""Job-description intake extraction service."""

import asyncio
from collections.abc import Iterable
import ipaddress
import logging
import re
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
import httpcore
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from app.llm import complete_json, get_llm_config, get_model_name, get_safe_max_tokens
from app.prompts.job_intake import JOB_INTAKE_EXTRACTION_PROMPT
from app.schemas.job_intake import (
    DetectedJobLink,
    DraftAnswer,
    ExtractionMethod,
    JobIntakeExtractRequest,
    JobIntakeExtractResponse,
    JobSourceType,
    ScreeningQuestion,
)
from app.services.parser import parse_document

logger = logging.getLogger(__name__)

MAX_FETCH_BYTES = 4 * 1024 * 1024
MAX_SOURCE_TEXT_CHARS = 60_000
MIN_REVIEWABLE_JD_CHARS = 50
PLAYWRIGHT_MIN_TEXT_CHARS = 500
REQUEST_TIMEOUT_SECONDS = 12.0
PLAYWRIGHT_TIMEOUT_MS = 15_000
LOCAL_HOSTNAMES = {"localhost", "localhost.localdomain"}
MAX_REDIRECTS = 5
REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
SAFE_FETCH_LIMITS = httpx.Limits(max_connections=10, max_keepalive_connections=0)

_URL_RE = re.compile(r"https?://[^\s<>'\")\]]+", re.IGNORECASE)
_QUESTION_PREFIX_RE = re.compile(
    r"^(?:are|can|could|did|do|does|have|would|will|what|when|where|why|how|is)\b",
    re.IGNORECASE,
)
_QUESTION_CLAUSE_RE = re.compile(
    r"\b(?:are|can|could|did|do|does|have|would|will|what|when|where|why|how|is)\b[^?]*\?",
    re.IGNORECASE,
)
_STOPWORDS = {
    "a",
    "about",
    "and",
    "are",
    "can",
    "could",
    "did",
    "do",
    "does",
    "experience",
    "have",
    "how",
    "is",
    "of",
    "on",
    "open",
    "or",
    "the",
    "to",
    "with",
    "work",
    "you",
    "your",
}
_USER_INPUT_TERMS = {
    "authorization",
    "available",
    "availability",
    "compensation",
    "hybrid",
    "location",
    "notice",
    "onsite",
    "relocation",
    "remote",
    "salary",
    "sponsor",
    "sponsorship",
    "start",
    "visa",
    "w2",
}


class JobIntakeError(Exception):
    """User-safe intake extraction error."""


@dataclass(frozen=True)
class FetchedContent:
    """Raw content fetched from a remote source."""

    url: str
    content_type: str
    body: bytes


def _is_blocked_ip(ip_value: str) -> bool:
    """Return whether an IP address is unsafe for server-side fetching."""
    ip = ipaddress.ip_address(ip_value)
    return not ip.is_global or any(
        [
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
            ip.is_unspecified,
        ]
    )


async def _resolve_public_addresses(hostname: str, port: int | None) -> list[str]:
    """Resolve a hostname and return only public addresses for connection use."""
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise JobIntakeError("Could not resolve the URL hostname.") from exc

    addresses: list[str] = []
    seen: set[str] = set()
    for info in infos:
        address = info[4][0]
        try:
            if _is_blocked_ip(address):
                raise JobIntakeError("Only public URLs are supported.")
        except ValueError:
            continue
        if address not in seen:
            seen.add(address)
            addresses.append(address)

    if not addresses:
        raise JobIntakeError("Only public URLs are supported.")
    return addresses


class SafeAsyncNetworkBackend(httpcore.AsyncNetworkBackend):
    """HTTP network backend that connects only to validated public IPs."""

    def __init__(self) -> None:
        self._backend = httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        addresses = await _resolve_public_addresses(host, port)
        last_error: Exception | None = None
        for address in addresses:
            try:
                return await self._backend.connect_tcp(
                    address,
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except (httpcore.ConnectError, httpcore.ConnectTimeout) as exc:
                last_error = exc
        if last_error:
            raise last_error
        raise httpcore.ConnectError("Could not connect to a public URL address.")

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        return await self._backend.connect_unix_socket(
            path,
            timeout=timeout,
            socket_options=socket_options,
        )

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class SafeAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """HTTPX transport wired to the safe connection-time resolver."""

    def __init__(self) -> None:
        super().__init__(
            trust_env=False,
            limits=SAFE_FETCH_LIMITS,
            retries=0,
        )
        self._pool = httpcore.AsyncConnectionPool(
            network_backend=SafeAsyncNetworkBackend(),
            max_connections=SAFE_FETCH_LIMITS.max_connections,
            max_keepalive_connections=0,
            keepalive_expiry=0,
            http1=True,
            http2=False,
            retries=0,
        )


async def validate_public_url(url: str) -> str:
    """Validate that a URL is safe for public server-side fetching."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise JobIntakeError("Only public http and https URLs are supported.")
    if parsed.username or parsed.password:
        raise JobIntakeError("URLs with embedded credentials are not supported.")
    if not parsed.hostname:
        raise JobIntakeError("A public URL hostname is required.")

    hostname = parsed.hostname.lower()
    if hostname in LOCAL_HOSTNAMES or hostname.endswith(".localhost"):
        raise JobIntakeError("Only public URLs are supported.")

    try:
        if _is_blocked_ip(hostname):
            raise JobIntakeError("Only public URLs are supported.")
    except ValueError:
        pass

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    await _resolve_public_addresses(hostname, port)

    return parsed.geturl()


def extract_links_from_text(text: str) -> list[DetectedJobLink]:
    """Extract unique HTTP(S) links from text."""
    links: list[DetectedJobLink] = []
    seen: set[str] = set()
    for match in _URL_RE.finditer(text):
        url = match.group(0).rstrip(".,;:!?")
        if url in seen:
            continue
        seen.add(url)
        hostname = urlparse(url).hostname or url
        links.append(DetectedJobLink(url=url, label=hostname))
    return links


def extract_questions_from_text(text: str) -> list[ScreeningQuestion]:
    """Extract recruiter screening questions without mixing them into the JD."""
    questions: list[ScreeningQuestion] = []
    for line in text.splitlines():
        candidate = line.strip().strip("-*• ")
        if "?" not in candidate:
            continue
        question_match = _QUESTION_CLAUSE_RE.search(candidate)
        if not question_match:
            continue
        candidate = question_match.group(0).strip()
        if len(candidate) < 8 or not _QUESTION_PREFIX_RE.search(candidate):
            continue
        if candidate not in [question.question for question in questions]:
            questions.append(
                ScreeningQuestion(
                    id=f"q{len(questions) + 1}",
                    question=candidate,
                )
            )
    return questions


def _extract_relevant_terms(question: str) -> list[str]:
    """Extract searchable evidence terms from a recruiter question."""
    terms = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,}", question)
    return [
        term
        for term in terms
        if term.lower() not in _STOPWORDS and term.lower() not in _USER_INPUT_TERMS
    ]


def _question_needs_personal_input(question: str) -> bool:
    """Return whether a question needs user-specific preference input."""
    lowered = question.lower()
    return any(term in lowered for term in _USER_INPUT_TERMS)


def _term_in_text(term: str, text: str) -> bool:
    """Return whether a term appears as a standalone evidence token."""
    return re.search(
        rf"(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])",
        text,
        re.IGNORECASE,
    ) is not None


def _find_evidence_lines(terms: list[str], evidence_text: str) -> list[str]:
    """Find evidence lines containing extracted terms."""
    if not terms:
        return []
    lines = [line.strip(" -*•") for line in evidence_text.splitlines() if line.strip()]
    if not lines and evidence_text.strip():
        lines = [evidence_text.strip()]

    evidence: list[str] = []
    for line in lines:
        matches = [term for term in terms if _term_in_text(term, line)]
        if matches:
            evidence.append(line[:240])
        if len(evidence) >= 3:
            break
    return evidence


def _missing_evidence_terms(terms: list[str], evidence_lines: list[str]) -> list[str]:
    """Return terms not directly supported by evidence lines."""
    evidence_text = "\n".join(evidence_lines)
    return [term for term in terms if not _term_in_text(term, evidence_text)]


def build_evidence_only_answer(question: str, evidence_text: str) -> DraftAnswer:
    """Draft an answer only when source evidence supports it."""
    terms = _extract_relevant_terms(question)
    evidence = _find_evidence_lines(terms, evidence_text)
    question_id = "q1"
    missing_terms = _missing_evidence_terms(terms, evidence)

    if _question_needs_personal_input(question) or not evidence or missing_terms:
        prompt = (
            f"Add your answer for: {question}"
            if not terms
            else f"Confirm details for {', '.join(missing_terms or terms)} before answering: {question}"
        )
        return DraftAnswer(
            question_id=question_id,
            answer="",
            evidence=[],
            needs_user_input=True,
            prompt=prompt,
        )

    term_label = " and ".join(terms[:3])
    return DraftAnswer(
        question_id=question_id,
        answer=f"Yes, I have experience with {term_label}.",
        evidence=evidence,
        needs_user_input=False,
        prompt="",
    )


def _draft_answers(
    questions: list[ScreeningQuestion],
    evidence_text: str,
) -> list[DraftAnswer]:
    """Build evidence-only answers for extracted screening questions."""
    answers: list[DraftAnswer] = []
    for question in questions:
        answer = build_evidence_only_answer(question.question, evidence_text)
        answers.append(answer.model_copy(update={"question_id": question.id}))
    return answers


def _clean_text(text: str) -> str:
    """Normalize whitespace while preserving paragraph breaks."""
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_non_jd_lines(text: str, questions: list[ScreeningQuestion]) -> str:
    """Remove recruiter chatter, URLs, and questions from JD text."""
    question_values = {question.question for question in questions}
    kept: list[str] = []
    for line in text.splitlines():
        candidate = line.strip()
        lowered = candidate.lower()
        if not candidate:
            kept.append("")
            continue
        if candidate in question_values or candidate.endswith("?"):
            continue
        if _URL_RE.search(candidate):
            continue
        if lowered.startswith(("hi ", "hello ", "hey ", "thanks", "thank you", "best,")):
            continue
        kept.append(candidate)
    return _clean_text("\n".join(kept))


def _safe_error_for_http_failure(exc: httpx.HTTPError) -> JobIntakeError:
    """Map expected remote fetch failures to user-safe intake errors."""
    if isinstance(exc, httpx.TimeoutException):
        return JobIntakeError("Timed out while fetching the remote URL.")
    if isinstance(exc, httpx.HTTPStatusError):
        return JobIntakeError("Remote URL returned an error status.")
    return JobIntakeError("Could not fetch the remote URL.")


def _html_to_text(html: str) -> tuple[str, str | None]:
    """Convert HTML into visible text and a best-effort title."""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    for node in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
        node.decompose()
    return _clean_text(soup.get_text("\n")), title


async def _fetch_url(url: str) -> FetchedContent:
    """Fetch URL content with timeout and size cap."""
    current_url = await validate_public_url(url)
    timeout = httpx.Timeout(REQUEST_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            headers={"User-Agent": "ResumeMatcher-JDIntake/1.0"},
            transport=SafeAsyncHTTPTransport(),
            trust_env=False,
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                async with client.stream("GET", current_url) as response:
                    if response.status_code in REDIRECT_STATUS_CODES:
                        location = response.headers.get("location")
                        if not location:
                            raise JobIntakeError("Remote URL returned an invalid redirect.")
                        current_url = await validate_public_url(
                            urljoin(str(response.url), location)
                        )
                        continue

                    response.raise_for_status()
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > MAX_FETCH_BYTES:
                            raise JobIntakeError("Remote content is too large to process.")
                        chunks.append(chunk)
                    return FetchedContent(
                        url=str(response.url),
                        content_type=response.headers.get("content-type", ""),
                        body=b"".join(chunks),
                    )
    except JobIntakeError:
        raise
    except httpx.HTTPError as exc:
        raise _safe_error_for_http_failure(exc) from exc

    raise JobIntakeError("Remote URL redirected too many times.")


async def _fulfill_with_safe_fetch(route: Any) -> None:
    """Fulfill browser requests through the guarded HTTP fetch path."""
    request = route.request
    if request.method.upper() != "GET":
        await route.abort()
        return

    try:
        fetched = await _fetch_url(request.url)
    except JobIntakeError:
        logger.warning("Blocked unsafe browser request during JD intake: %s", request.url)
        await route.abort()
        return

    headers = {"content-type": fetched.content_type} if fetched.content_type else {}
    await route.fulfill(status=200, headers=headers, body=fetched.body)


async def _fetch_with_playwright(url: str) -> tuple[str, str | None]:
    """Fetch JS-rendered page text with a stateless browser context."""
    validated_url = await validate_public_url(url)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            context = await browser.new_context(
                user_agent="ResumeMatcher-JDIntake/1.0",
                java_script_enabled=True,
            )
            try:
                await context.route("**/*", _fulfill_with_safe_fetch)
                page = await context.new_page()
                response = await page.goto(
                    validated_url,
                    wait_until="domcontentloaded",
                    timeout=PLAYWRIGHT_TIMEOUT_MS,
                )
                if response is not None:
                    await validate_public_url(response.url)
                content = await page.content()
                title = await page.title()
                text, html_title = _html_to_text(content)
                return text, title or html_title
            finally:
                await context.close()
        finally:
            await browser.close()


def body_looks_like_pdf(body: bytes) -> bool:
    """Return whether response bytes look like a PDF document."""
    return body[:1024].lstrip().startswith(b"%PDF")


def _content_looks_like_pdf(content_type: str, body: bytes) -> bool:
    """Return whether fetched content should be parsed as PDF."""
    return "application/pdf" in content_type.lower() or body_looks_like_pdf(body)


def _pdf_filename_from_url(url: str) -> str:
    """Return a safe PDF filename for parser suffix detection."""
    filename = Path(urlparse(url).path).name
    if filename.lower().endswith(".pdf"):
        return filename
    return "job.pdf"


async def _maybe_refine_with_llm(raw_text: str) -> dict[str, Any] | None:
    """Best-effort LLM cleanup for large noisy source text."""
    if len(raw_text) < 800:
        return None

    config = get_llm_config()
    if not config.api_key and config.provider not in {"ollama", "openai_compatible"}:
        return None

    try:
        model_name = get_model_name(config)
        return await complete_json(
            prompt=JOB_INTAKE_EXTRACTION_PROMPT.format(
                source_text=raw_text[:MAX_SOURCE_TEXT_CHARS],
            ),
            system_prompt="You extract job descriptions into compact JSON.",
            max_tokens=min(get_safe_max_tokens(model_name), 4096),
            retries=1,
            schema_type="keywords",
        )
    except Exception as exc:
        logger.warning("JD intake LLM cleanup failed: %s", exc)
        return None


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
    cleaned_raw = _clean_text(raw_text)
    links = extract_links_from_text(source_text)
    questions = extract_questions_from_text(source_text)
    job_description = _strip_non_jd_lines(cleaned_raw, questions)

    if len(job_description) < MIN_REVIEWABLE_JD_CHARS:
        warning_list = list(warnings or [])
        warning_list.append("Extracted job description is short; please review before tailoring.")
    else:
        warning_list = list(warnings or [])

    evidence_text = resume_text or ""
    return JobIntakeExtractResponse(
        source_type=source_type,
        job_description=job_description,
        source_url=source_url,
        source_title=source_title,
        links=links,
        screening_questions=questions,
        draft_answers=_draft_answers(questions, evidence_text),
        raw_text=cleaned_raw,
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
    if _content_looks_like_pdf(fetched.content_type, fetched.body):
        raw_text = await parse_document(fetched.body, _pdf_filename_from_url(fetched.url))
        method: ExtractionMethod = "pdf"
    elif request.source_type == "pdf_url":
        raise JobIntakeError("The provided PDF URL did not return PDF content.")
    else:
        html = fetched.body.decode("utf-8", errors="replace")
        raw_text, source_title = _html_to_text(html)
        method = "http"
        if len(raw_text) < PLAYWRIGHT_MIN_TEXT_CHARS:
            try:
                raw_text, playwright_title = await _fetch_with_playwright(fetched.url)
                source_title = playwright_title or source_title
                method = "playwright"
            except Exception as exc:
                logger.warning("Playwright JD fallback failed for %s: %s", fetched.url, exc)
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
