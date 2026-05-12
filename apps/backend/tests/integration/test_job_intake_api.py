"""Integration tests for JD intake endpoints."""

from unittest.mock import AsyncMock, patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


class TestJobIntakeExtract:
    """POST /api/v1/jobs/intake/extract"""

    async def test_extract_manual_text_requires_reviewable_jd(self, client):
        jd = (
            "Senior Backend Engineer\n\n"
            "We need a Python and FastAPI engineer to build APIs. "
            "Requirements include Docker, AWS, and strong communication."
        )

        resp = await client.post(
            "/api/v1/jobs/intake/extract",
            json={"source_type": "manual_text", "source_text": jd},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["source_type"] == "manual_text"
        assert data["job_description"] == jd
        assert data["extraction_method"] == "manual"
        assert data["requires_review"] is True

    async def test_extract_recruiter_message_keeps_questions_separate(self, client):
        message = (
            "Hi Jane, role link: https://jobs.example.com/backend\n"
            "Senior Backend Engineer using Python and FastAPI. "
            "You'll build APIs and work with AWS.\n"
            "Are you open to relocation?\n"
            "Do you have Python experience?"
        )

        resp = await client.post(
            "/api/v1/jobs/intake/extract",
            json={
                "source_type": "recruiter_message",
                "source_text": message,
                "resume_text": "Jane built APIs using Python and FastAPI.",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["source_type"] == "recruiter_message"
        assert data["links"][0]["url"] == "https://jobs.example.com/backend"
        assert [q["question"] for q in data["screening_questions"]] == [
            "Are you open to relocation?",
            "Do you have Python experience?",
        ]
        assert data["draft_answers"][0]["needs_user_input"] is True
        assert data["draft_answers"][1]["needs_user_input"] is False
        assert "Are you open to relocation?" not in data["job_description"]

    @patch("app.routers.job_intake.db")
    async def test_extract_uses_resume_id_for_answer_evidence(self, mock_db, client):
        mock_db.get_resume.return_value = {
            "resume_id": "resume-123",
            "content": "Built APIs using Python and FastAPI for production systems.",
        }
        message = (
            "Senior Backend Engineer using Python and FastAPI.\n"
            "Do you have Python and FastAPI experience?"
        )

        resp = await client.post(
            "/api/v1/jobs/intake/extract",
            json={
                "source_type": "recruiter_message",
                "source_text": message,
                "resume_id": "resume-123",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["draft_answers"][0]["needs_user_input"] is False
        assert data["draft_answers"][0]["evidence"]
        mock_db.get_resume.assert_called_once_with("resume-123")

    async def test_extract_blocks_private_url(self, client):
        resp = await client.post(
            "/api/v1/jobs/intake/extract",
            json={"source_type": "job_url", "url": "http://127.0.0.1/jobs/1"},
        )

        assert resp.status_code == 400
        assert "public" in resp.json()["detail"].lower()

    @patch("app.routers.job_intake.extract_pdf_upload", new_callable=AsyncMock)
    async def test_pdf_upload_uses_multipart_file(self, mock_extract, client):
        mock_extract.return_value = {
            "source_type": "pdf_upload",
            "job_description": "Senior Backend Engineer using Python and FastAPI.",
            "source_url": None,
            "source_title": "job.pdf",
            "links": [],
            "screening_questions": [],
            "draft_answers": [],
            "raw_text": "Senior Backend Engineer using Python and FastAPI.",
            "extraction_method": "pdf",
            "warnings": [],
            "confidence": 0.9,
            "requires_review": True,
        }

        resp = await client.post(
            "/api/v1/jobs/intake/pdf-upload",
            files={"file": ("job.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )

        assert resp.status_code == 200
        assert resp.json()["source_type"] == "pdf_upload"
        mock_extract.assert_awaited_once()

    @patch("app.routers.job_intake.extract_pdf_upload", new_callable=AsyncMock)
    async def test_pdf_upload_rejects_non_pdf_bytes(self, mock_extract, client):
        resp = await client.post(
            "/api/v1/jobs/intake/pdf-upload",
            files={"file": ("job.pdf", b"not a pdf", "application/pdf")},
        )

        assert resp.status_code == 400
        assert "PDF" in resp.json()["detail"]
        mock_extract.assert_not_awaited()


class TestJobIntakeConfirm:
    """POST /api/v1/jobs/intake/confirm"""

    @patch("app.routers.job_intake.db")
    async def test_confirm_persists_reviewed_jd_with_metadata(self, mock_db, client):
        mock_db.create_job.return_value = {
            "job_id": "job-123",
            "content": "Senior Backend Engineer using Python, FastAPI, and AWS.",
            "created_at": "2026-01-01T00:00:00Z",
        }

        resp = await client.post(
            "/api/v1/jobs/intake/confirm",
            json={
                "job_description": "Senior Backend Engineer using Python, FastAPI, and AWS.",
                "resume_id": "resume-123",
                "intake_metadata": {
                    "source_type": "recruiter_message",
                    "source_url": "https://jobs.example.com/backend",
                    "source_title": "Backend role",
                    "links": [
                        {
                            "url": "https://jobs.example.com/backend",
                            "label": "jobs.example.com",
                        }
                    ],
                    "screening_questions": [
                        {"id": "q1", "question": "Do you have Python experience?"}
                    ],
                    "draft_answers": [
                        {
                            "question_id": "q1",
                            "answer": "Yes, I have Python experience.",
                            "evidence": ["Python"],
                            "needs_user_input": False,
                            "prompt": "",
                        }
                    ],
                    "extraction_method": "deterministic",
                    "warnings": [],
                    "confidence": 0.8,
                },
            },
        )

        assert resp.status_code == 200
        assert resp.json()["job_id"] == "job-123"
        mock_db.create_job.assert_called_once()
        _, kwargs = mock_db.create_job.call_args
        assert kwargs["content"] == "Senior Backend Engineer using Python, FastAPI, and AWS."
        assert kwargs["resume_id"] == "resume-123"
        assert kwargs["intake_metadata"]["source_type"] == "recruiter_message"
