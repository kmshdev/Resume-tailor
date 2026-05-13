"""Deterministic text extraction helpers for JD intake."""

import re
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from app.schemas.job_intake import DetectedJobLink, DraftAnswer, ScreeningQuestion
from app.services.job_intake.constants import (
    QUESTION_CLAUSE_RE,
    QUESTION_PREFIX_RE,
    STOPWORDS,
    URL_RE,
    USER_INPUT_TERMS,
)
from app.services.job_intake.url_safety import redact_url_for_metadata


def extract_links_from_text(text: str) -> list[DetectedJobLink]:
    """Extract unique HTTP(S) links from text."""
    links: list[DetectedJobLink] = []
    seen: set[str] = set()
    for match in URL_RE.finditer(text):
        url = match.group(0).rstrip(".,;:!?")
        safe_url = redact_url_for_metadata(url) or url
        if safe_url in seen:
            continue
        seen.add(safe_url)
        hostname = urlparse(safe_url).hostname or safe_url
        links.append(DetectedJobLink(url=safe_url, label=hostname))
    return links


def extract_questions_from_text(text: str) -> list[ScreeningQuestion]:
    """Extract recruiter screening questions without mixing them into the JD."""
    questions: list[ScreeningQuestion] = []
    seen: set[str] = set()
    for line in text.splitlines():
        candidate = line.strip().strip("-*• ")
        if "?" not in candidate:
            continue
        for question_match in QUESTION_CLAUSE_RE.finditer(candidate):
            question = question_match.group(0).strip()
            if len(question) < 8 or not QUESTION_PREFIX_RE.search(question):
                continue
            if question in seen:
                continue
            seen.add(question)
            questions.append(
                ScreeningQuestion(
                    id=f"q{len(questions) + 1}",
                    question=question,
                )
            )
    return questions


def _extract_relevant_terms(question: str) -> list[str]:
    """Extract searchable evidence terms from a recruiter question."""
    terms = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,}", question)
    return [
        term
        for term in terms
        if term.lower() not in STOPWORDS and term.lower() not in USER_INPUT_TERMS
    ]


def _question_needs_personal_input(question: str) -> bool:
    """Return whether a question needs user-specific preference input."""
    lowered = question.lower()
    return any(
        re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", lowered)
        for term in USER_INPUT_TERMS
    )


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


def draft_answers(
    questions: list[ScreeningQuestion],
    evidence_text: str,
) -> list[DraftAnswer]:
    """Build evidence-only answers for extracted screening questions."""
    answers: list[DraftAnswer] = []
    for question in questions:
        answer = build_evidence_only_answer(question.question, evidence_text)
        answers.append(answer.model_copy(update={"question_id": question.id}))
    return answers


def clean_text(text: str) -> str:
    """Normalize whitespace while preserving paragraph breaks."""
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_non_jd_lines(text: str, questions: list[ScreeningQuestion]) -> str:
    """Remove recruiter chatter, URLs, and questions from JD text."""
    question_values = {question.question for question in questions}
    kept: list[str] = []
    for line in text.splitlines():
        candidate = line.strip()
        lowered = candidate.lower()
        if not candidate:
            kept.append("")
            continue
        if (
            candidate in question_values
            or any(question in candidate for question in question_values)
            or QUESTION_CLAUSE_RE.search(candidate)
        ):
            continue
        if URL_RE.search(candidate):
            continue
        if lowered.startswith(("hi ", "hello ", "hey ", "thanks", "thank you", "best,")):
            continue
        kept.append(candidate)
    return clean_text("\n".join(kept))


def html_to_text(html: str) -> tuple[str, str | None]:
    """Convert HTML into visible text and a best-effort title."""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    for node in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
        node.decompose()
    return clean_text(soup.get_text("\n")), title


def body_looks_like_pdf(body: bytes) -> bool:
    """Return whether response bytes look like a PDF document."""
    return body[:1024].lstrip().startswith(b"%PDF")


def content_looks_like_pdf(content_type: str, body: bytes) -> bool:
    """Return whether fetched content should be parsed as PDF."""
    return "application/pdf" in content_type.lower() or body_looks_like_pdf(body)


def content_looks_like_html(content_type: str) -> bool:
    """Return whether fetched content should be parsed as HTML."""
    normalized = content_type.split(";", 1)[0].strip().lower()
    return normalized in {"text/html", "application/xhtml+xml"}


def pdf_filename_from_url(url: str) -> str:
    """Return a safe PDF filename for parser suffix detection."""
    filename = Path(urlparse(url).path).name
    if filename.lower().endswith(".pdf"):
        return filename
    return "job.pdf"


def filename_looks_like_pdf(filename: str) -> bool:
    """Return whether an upload filename has a PDF extension."""
    return Path(filename).suffix.lower() == ".pdf"
