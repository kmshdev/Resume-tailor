"""Unit tests for JD intake extraction helpers."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.job_intake import JobIntakeExtractRequest
from app.services.job_intake import (
    FetchedContent,
    JobIntakeError,
    _extract_remote_url,
    _fetch_url,
    _maybe_refine_with_llm,
    _resolve_public_addresses,
    build_evidence_only_answer,
    extract_job_intake,
    extract_pdf_upload,
    extract_links_from_text,
    extract_questions_from_text,
    validate_public_url,
)


@pytest.mark.asyncio
async def test_validate_public_url_rejects_localhost() -> None:
    with pytest.raises(JobIntakeError, match="public"):
        await validate_public_url("http://127.0.0.1:8000/internal")


@pytest.mark.asyncio
async def test_validate_public_url_rejects_shared_address_space() -> None:
    with pytest.raises(JobIntakeError, match="public"):
        await validate_public_url("http://100.64.0.1/jobs/1")


@pytest.mark.asyncio
async def test_validate_public_url_rejects_userinfo() -> None:
    with pytest.raises(JobIntakeError, match="credentials"):
        await validate_public_url("https://user:pass@example.com/jobs/123")


@pytest.mark.asyncio
async def test_connection_resolution_rejects_private_rebinding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_getaddrinfo(host, port, *args, **kwargs):
        return [(None, None, None, "", ("127.0.0.1", port))]

    monkeypatch.setattr("app.services.job_intake.socket.getaddrinfo", fake_getaddrinfo)

    with pytest.raises(JobIntakeError, match="public"):
        await _resolve_public_addresses("jobs.example.com", 443)


def test_extract_links_from_text_returns_unique_http_links() -> None:
    text = (
        "Role: https://jobs.example.com/senior-backend?ref=dm\n"
        "Duplicate https://jobs.example.com/senior-backend?ref=dm and "
        "PDF https://cdn.example.com/jd.pdf."
    )

    links = extract_links_from_text(text)

    assert [link.url for link in links] == [
        "https://jobs.example.com/senior-backend?ref=dm",
        "https://cdn.example.com/jd.pdf",
    ]


def test_extract_questions_from_text_detects_screening_questions() -> None:
    text = (
        "Hi Jane, here is the role.\n"
        "Are you open to relocation?\n"
        "Do you have Python and FastAPI experience?\n"
        "Thanks!"
    )

    questions = extract_questions_from_text(text)

    assert [question.question for question in questions] == [
        "Are you open to relocation?",
        "Do you have Python and FastAPI experience?",
    ]


def test_extract_questions_from_text_detects_labeled_questions() -> None:
    text = "Screening: Do you have Python experience?"

    questions = extract_questions_from_text(text)

    assert [question.question for question in questions] == [
        "Do you have Python experience?"
    ]


def test_build_evidence_only_answer_uses_matching_resume_evidence() -> None:
    answer = build_evidence_only_answer(
        "Do you have Python and FastAPI experience?",
        "Built REST APIs serving 50K requests/day using Python and FastAPI.",
    )

    assert answer.needs_user_input is False
    assert "Python" in answer.answer
    assert answer.evidence


def test_build_evidence_only_answer_marks_missing_input() -> None:
    answer = build_evidence_only_answer(
        "Do you require visa sponsorship?",
        "Built REST APIs serving 50K requests/day using Python and FastAPI.",
    )

    assert answer.needs_user_input is True
    assert answer.answer == ""
    assert "sponsorship" in answer.prompt.lower()


def test_build_evidence_only_answer_requires_all_question_terms() -> None:
    answer = build_evidence_only_answer(
        "Do you have Python and FastAPI experience?",
        "Built REST APIs serving 50K requests/day using Python.",
    )

    assert answer.needs_user_input is True
    assert answer.answer == ""
    assert "FastAPI" in answer.prompt


def test_build_evidence_only_answer_rejects_substring_collisions() -> None:
    answer = build_evidence_only_answer(
        "Do you have AI experience?",
        "Built paid analytics workflows for ongoing reporting.",
    )

    assert answer.needs_user_input is True
    assert answer.answer == ""
    assert answer.evidence == []


@pytest.mark.asyncio
async def test_llm_refinement_formats_prompt_with_json_shape() -> None:
    source_text = "Senior Backend Engineer using Python, FastAPI, and AWS. " * 20
    with (
        patch("app.services.job_intake.get_llm_config") as mock_config,
        patch("app.services.job_intake.get_model_name") as mock_model_name,
        patch("app.services.job_intake.get_safe_max_tokens") as mock_max_tokens,
        patch("app.services.job_intake.complete_json", new_callable=AsyncMock) as mock_complete,
    ):
        mock_config.return_value = SimpleNamespace(api_key="test-key", provider="openai")
        mock_model_name.return_value = "gpt-4o-mini"
        mock_max_tokens.return_value = 4096
        mock_complete.return_value = {
            "job_description": "Senior Backend Engineer using Python and FastAPI.",
            "warnings": [],
        }

        result = await _maybe_refine_with_llm(source_text)

    assert result == {
        "job_description": "Senior Backend Engineer using Python and FastAPI.",
        "warnings": [],
    }
    mock_complete.assert_awaited_once()
    prompt = mock_complete.await_args.kwargs["prompt"]
    assert '"job_description"' in prompt
    assert source_text.strip() in prompt


@pytest.mark.asyncio
async def test_recruiter_message_does_not_draft_answer_from_jd_terms_only() -> None:
    response = await extract_job_intake(
        JobIntakeExtractRequest(
            source_type="recruiter_message",
            source_text=(
                "Senior Backend Engineer using Python and FastAPI.\n"
                "Do you have Python and FastAPI experience?"
            ),
        )
    )

    answer = response.draft_answers[0]
    assert answer.needs_user_input is True
    assert answer.answer == ""
    assert answer.evidence == []


@pytest.mark.asyncio
async def test_manual_text_strips_questions_from_canonical_jd() -> None:
    response = await extract_job_intake(
        JobIntakeExtractRequest(
            source_type="manual_text",
            source_text=(
                "Senior Backend Engineer using Python and FastAPI.\n"
                "Do you have Python experience?"
            ),
        )
    )

    assert "Do you have Python experience?" not in response.job_description
    assert [question.question for question in response.screening_questions] == [
        "Do you have Python experience?"
    ]


@pytest.mark.asyncio
async def test_manual_text_preserves_labeled_questions_in_metadata() -> None:
    response = await extract_job_intake(
        JobIntakeExtractRequest(
            source_type="manual_text",
            source_text=(
                "Senior Backend Engineer using Python and FastAPI.\n"
                "Screening: Do you have Python experience?"
            ),
        )
    )

    assert "Screening:" not in response.job_description
    assert [question.question for question in response.screening_questions] == [
        "Do you have Python experience?"
    ]


@pytest.mark.asyncio
async def test_fetch_url_revalidates_redirect_targets(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_validate(url: str) -> str:
        if "127.0.0.1" in url:
            raise JobIntakeError("Only public URLs are supported.")
        return url

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "jobs.example.com":
            return httpx.Response(
                302,
                headers={"Location": "http://127.0.0.1/internal"},
                request=request,
            )
        return httpx.Response(200, content=b"internal", request=request)

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def client_factory(**kwargs):
        return real_async_client(
            transport=transport,
            follow_redirects=kwargs.get("follow_redirects", False),
            headers=kwargs.get("headers"),
            timeout=kwargs.get("timeout"),
        )

    monkeypatch.setattr("app.services.job_intake.validate_public_url", fake_validate)
    monkeypatch.setattr("app.services.job_intake.httpx.AsyncClient", client_factory)

    with pytest.raises(JobIntakeError, match="public"):
        await _fetch_url("https://jobs.example.com/redirect")


@pytest.mark.asyncio
async def test_remote_llm_refinement_keeps_original_link_and_question_metadata() -> None:
    html = (
        "<html><body>Senior Backend Engineer using Python and FastAPI.\n"
        "Apply at https://jobs.example.com/apply\n"
        "Do you have Python experience?</body></html>"
    )
    fetched = FetchedContent(
        url="https://jobs.example.com/role",
        content_type="text/html",
        body=html.encode(),
    )
    with (
        patch("app.services.job_intake._fetch_url", new_callable=AsyncMock) as mock_fetch,
        patch("app.services.job_intake._maybe_refine_with_llm", new_callable=AsyncMock) as mock_refine,
    ):
        mock_fetch.return_value = fetched
        mock_refine.return_value = {
            "job_description": "Senior Backend Engineer using Python and FastAPI.",
            "warnings": [],
        }

        response = await _extract_remote_url(
            JobIntakeExtractRequest(
                source_type="job_url",
                url="https://jobs.example.com/role",
            )
        )

    assert [link.url for link in response.links] == ["https://jobs.example.com/apply"]
    assert [question.question for question in response.screening_questions] == [
        "Do you have Python experience?"
    ]
    assert "Do you have Python experience?" not in response.job_description


@pytest.mark.asyncio
async def test_pdf_url_uses_pdf_suffix_for_download_urls() -> None:
    fetched = FetchedContent(
        url="https://cdn.example.com/download?id=123",
        content_type="application/pdf",
        body=b"%PDF-1.4",
    )
    with (
        patch("app.services.job_intake._fetch_url", new_callable=AsyncMock) as mock_fetch,
        patch("app.services.job_intake.parse_document", new_callable=AsyncMock) as mock_parse,
    ):
        mock_fetch.return_value = fetched
        mock_parse.return_value = "Senior Backend Engineer using Python, FastAPI, and AWS."

        await _extract_remote_url(
            JobIntakeExtractRequest(
                source_type="pdf_url",
                url="https://cdn.example.com/download?id=123",
            )
        )

    mock_parse.assert_awaited_once_with(b"%PDF-1.4", "job.pdf")


@pytest.mark.asyncio
async def test_pdf_url_rejects_non_pdf_content() -> None:
    html = "<html><body>" + ("Senior Backend Engineer " * 40) + "</body></html>"
    fetched = FetchedContent(
        url="https://jobs.example.com/role",
        content_type="text/html",
        body=html.encode(),
    )
    with patch("app.services.job_intake._fetch_url", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = fetched

        with pytest.raises(JobIntakeError, match="PDF"):
            await _extract_remote_url(
                JobIntakeExtractRequest(
                    source_type="pdf_url",
                    url="https://jobs.example.com/role",
                )
            )


@pytest.mark.asyncio
async def test_pdf_url_rejects_html_even_when_path_ends_pdf() -> None:
    html = "<html><body>" + ("Senior Backend Engineer " * 40) + "</body></html>"
    fetched = FetchedContent(
        url="https://jobs.example.com/role.pdf",
        content_type="text/html",
        body=html.encode(),
    )
    with (
        patch("app.services.job_intake._fetch_url", new_callable=AsyncMock) as mock_fetch,
        patch("app.services.job_intake.parse_document", new_callable=AsyncMock) as mock_parse,
    ):
        mock_fetch.return_value = fetched

        with pytest.raises(JobIntakeError, match="PDF"):
            await _extract_remote_url(
                JobIntakeExtractRequest(
                    source_type="pdf_url",
                    url="https://jobs.example.com/role.pdf",
                )
            )

    mock_parse.assert_not_awaited()


@pytest.mark.asyncio
async def test_pdf_upload_uses_safe_parser_filename() -> None:
    with patch("app.services.job_intake.parse_document", new_callable=AsyncMock) as mock_parse:
        mock_parse.return_value = "Senior Backend Engineer using Python and FastAPI."

        response = await extract_pdf_upload(b"%PDF-1.4", "job.docx")

    mock_parse.assert_awaited_once_with(b"%PDF-1.4", "job.pdf")
    assert response.source_title == "job.docx"
