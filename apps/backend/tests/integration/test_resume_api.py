"""Integration tests for resume CRUD endpoints."""

import copy
from types import SimpleNamespace
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.models import ImproveDiffResult


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def mock_resume_record(sample_resume):
    """A resume DB record with all fields."""
    return {
        "resume_id": "res-123",
        "content": "# Jane Doe\nSenior Backend Engineer",
        "content_type": "md",
        "filename": "resume.pdf",
        "is_master": True,
        "parent_id": None,
        "processed_data": sample_resume,
        "processing_status": "ready",
        "cover_letter": None,
        "outreach_message": None,
        "title": None,
        "original_markdown": "# Jane Doe\nSenior Backend Engineer",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }


class TestGetResume:
    """GET /api/v1/resumes?resume_id=..."""

    @patch("app.routers.resumes.db")
    async def test_fetch_existing_resume(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        async with client:
            resp = await client.get("/api/v1/resumes", params={"resume_id": "res-123"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["resume_id"] == "res-123"
        assert data["processed_resume"] is not None
        assert data["processed_resume"]["summary"] != ""

    @patch("app.routers.resumes.db")
    async def test_fetch_nonexistent_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None
        async with client:
            resp = await client.get("/api/v1/resumes", params={"resume_id": "nonexistent"})
        assert resp.status_code == 404


class TestListResumes:
    """GET /api/v1/resumes/list"""

    @patch("app.routers.resumes.db")
    async def test_list_excludes_master_by_default(self, mock_db, client):
        mock_db.list_resumes.return_value = [
            {"resume_id": "master", "is_master": True, "created_at": "2026-01-01", "updated_at": "2026-01-01"},
            {"resume_id": "tailored-1", "is_master": False, "created_at": "2026-01-02", "updated_at": "2026-01-02"},
        ]
        async with client:
            resp = await client.get("/api/v1/resumes/list")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["resume_id"] == "tailored-1"

    @patch("app.routers.resumes.db")
    async def test_list_includes_master_when_requested(self, mock_db, client):
        mock_db.list_resumes.return_value = [
            {"resume_id": "master", "is_master": True, "created_at": "2026-01-01", "updated_at": "2026-01-01"},
            {"resume_id": "tailored-1", "is_master": False, "created_at": "2026-01-02", "updated_at": "2026-01-02"},
        ]
        async with client:
            resp = await client.get("/api/v1/resumes/list", params={"include_master": True})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 2


class TestDeleteResume:
    """DELETE /api/v1/resumes/{resume_id}"""

    @patch("app.routers.resumes.db")
    async def test_delete_existing_resume(self, mock_db, client):
        mock_db.delete_resume.return_value = True
        async with client:
            resp = await client.delete("/api/v1/resumes/res-123")
        assert resp.status_code == 200

    @patch("app.routers.resumes.db")
    async def test_delete_nonexistent_returns_404(self, mock_db, client):
        mock_db.delete_resume.return_value = False
        async with client:
            resp = await client.delete("/api/v1/resumes/nonexistent")
        assert resp.status_code == 404


class TestUpdateTitle:
    """PATCH /api/v1/resumes/{resume_id}/title"""

    @patch("app.routers.resumes.db")
    async def test_update_title(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "title": "New Title"}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/title", json={"title": "New Title"})
        assert resp.status_code == 200

    @patch("app.routers.resumes.db")
    async def test_update_title_nonexistent_returns_404(self, mock_db, client):
        mock_db.get_resume.return_value = None
        async with client:
            resp = await client.patch("/api/v1/resumes/nonexistent/title", json={"title": "X"})
        assert resp.status_code == 404


class TestUpdateCoverLetter:
    """PATCH /api/v1/resumes/{resume_id}/cover-letter"""

    @patch("app.routers.resumes.db")
    async def test_update_cover_letter(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "cover_letter": "Dear hiring manager..."}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/cover-letter", json={"content": "Dear hiring manager..."})
        assert resp.status_code == 200


class TestUpdateOutreachMessage:
    """PATCH /api/v1/resumes/{resume_id}/outreach-message"""

    @patch("app.routers.resumes.db")
    async def test_update_outreach(self, mock_db, client, mock_resume_record):
        mock_db.get_resume.return_value = mock_resume_record
        mock_db.update_resume.return_value = {**mock_resume_record, "outreach_message": "Hi, I saw your posting..."}
        async with client:
            resp = await client.patch("/api/v1/resumes/res-123/outreach-message", json={"content": "Hi, I saw your posting..."})
        assert resp.status_code == 200


class TestRetryProcessing:
    """POST /api/v1/resumes/{resume_id}/retry-processing"""

    @patch("app.routers.resumes.parse_resume_to_json", new_callable=AsyncMock)
    @patch("app.routers.resumes.db")
    async def test_retry_successful(self, mock_db, mock_parse, client, mock_resume_record, sample_resume):
        failed_record = {**mock_resume_record, "processing_status": "failed"}
        mock_db.get_resume.return_value = failed_record
        mock_parse.return_value = sample_resume
        mock_db.update_resume.return_value = {**failed_record, "processing_status": "ready", "processed_data": sample_resume}
        async with client:
            resp = await client.post("/api/v1/resumes/res-123/retry-processing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["processing_status"] == "ready"

    @patch("app.routers.resumes.db")
    async def test_retry_not_failed_returns_400(self, mock_db, client, mock_resume_record):
        # processing_status is "ready", not "failed"
        mock_db.get_resume.return_value = mock_resume_record
        async with client:
            resp = await client.post("/api/v1/resumes/res-123/retry-processing")
        assert resp.status_code == 400


class TestImproveTailoringWorkflow:
    """Integration coverage for the backend tailoring workflow."""

    async def test_direct_improve_uses_verified_skill_targets(
        self,
        client,
        mock_resume_record,
        sample_resume,
        sample_job_keywords,
        sample_job_description,
    ):
        tailored_resume = copy.deepcopy(sample_resume)
        tailored_resume["additional"]["technicalSkills"].append("OpenAPI")
        verified_targets = [
            {
                "skill": "OpenAPI",
                "source": "supported_by_resume",
                "reason": "Appears in project content",
            }
        ]

        with (
            patch("app.routers.resumes.db") as mock_db,
            patch(
                "app.routers.resumes.extract_job_keywords",
                new_callable=AsyncMock,
            ) as mock_extract_keywords,
            patch(
                "app.routers.resumes.generate_skill_target_plan",
                new_callable=AsyncMock,
            ) as mock_generate_skill_target_plan,
            patch("app.routers.resumes.verify_skill_target_plan") as mock_verify_plan,
            patch(
                "app.routers.resumes.generate_resume_diffs",
                new_callable=AsyncMock,
            ) as mock_generate_diffs,
            patch("app.routers.resumes.apply_diffs") as mock_apply_diffs,
            patch(
                "app.routers.resumes.refine_resume",
                new_callable=AsyncMock,
            ) as mock_refine_resume,
            patch(
                "app.routers.resumes._generate_auxiliary_messages",
                new_callable=AsyncMock,
            ) as mock_auxiliary_messages,
        ):
            mock_db.get_resume.return_value = mock_resume_record
            mock_db.get_job.return_value = {
                "job_id": "job-123",
                "content": sample_job_description,
            }
            mock_db.get_master_resume.return_value = None
            mock_db.create_resume.return_value = {
                **mock_resume_record,
                "resume_id": "tailored-123",
                "parent_id": "res-123",
                "processed_data": tailored_resume,
                "is_master": False,
                "title": "Senior Backend Engineer @ TechCorp",
            }
            mock_db.create_improvement.return_value = {}

            mock_extract_keywords.return_value = sample_job_keywords
            mock_generate_skill_target_plan.return_value = {
                "target_skills": verified_targets,
                "strategy_notes": "Prioritize platform requirements",
            }
            mock_verify_plan.return_value = {
                "accepted": verified_targets,
                "gaps": [{"skill": "Kubernetes", "source": "jd_gap"}],
                "rejected": [{"skill": "BananaDB", "source": "unsupported"}],
            }
            mock_generate_diffs.return_value = ImproveDiffResult(
                changes=[],
                strategy_notes="Used verified skill targets",
            )
            mock_apply_diffs.return_value = (tailored_resume, [], [])
            mock_refine_resume.return_value = SimpleNamespace(
                refined_data=tailored_resume,
                passes_completed=0,
                keyword_analysis=None,
                ai_phrases_removed=[],
                alignment_report=None,
                final_match_percentage=0.0,
            )
            mock_auxiliary_messages.return_value = (
                None,
                None,
                "Senior Backend Engineer @ TechCorp",
                [],
            )

            async with client:
                resp = await client.post(
                    "/api/v1/resumes/improve",
                    json={
                        "resume_id": "res-123",
                        "job_id": "job-123",
                        "prompt_id": "full",
                    },
                )

        assert resp.status_code == 200
        payload = resp.json()["data"]
        assert payload["resume_id"] == "tailored-123"
        assert "1 unsupported skill target(s) rejected" in payload["warnings"]
        mock_generate_skill_target_plan.assert_awaited_once()
        assert mock_generate_diffs.await_args.kwargs["skill_targets"] == verified_targets
        assert mock_apply_diffs.call_args.kwargs["allowed_skill_targets"] == verified_targets

    async def test_preview_improve_uses_verified_skill_targets(
        self,
        client,
        mock_resume_record,
        sample_resume,
        sample_job_keywords,
        sample_job_description,
    ):
        tailored_resume = copy.deepcopy(sample_resume)
        tailored_resume["additional"]["technicalSkills"].append("OpenAPI")
        verified_targets = [
            {
                "skill": "OpenAPI",
                "source": "supported_by_resume",
                "reason": "Appears in project content",
            }
        ]

        with (
            patch("app.routers.resumes.db") as mock_db,
            patch(
                "app.routers.resumes.extract_job_keywords",
                new_callable=AsyncMock,
            ) as mock_extract_keywords,
            patch(
                "app.routers.resumes.generate_skill_target_plan",
                new_callable=AsyncMock,
            ) as mock_generate_skill_target_plan,
            patch("app.routers.resumes.verify_skill_target_plan") as mock_verify_plan,
            patch(
                "app.routers.resumes.generate_resume_diffs",
                new_callable=AsyncMock,
            ) as mock_generate_diffs,
            patch("app.routers.resumes.apply_diffs") as mock_apply_diffs,
            patch(
                "app.routers.resumes.refine_resume",
                new_callable=AsyncMock,
            ) as mock_refine_resume,
        ):
            mock_db.get_resume.return_value = mock_resume_record
            mock_db.get_job.return_value = {
                "job_id": "job-123",
                "content": sample_job_description,
            }
            mock_db.update_job.return_value = {
                "job_id": "job-123",
                "content": sample_job_description,
            }
            mock_db.get_master_resume.return_value = None

            mock_extract_keywords.return_value = sample_job_keywords
            mock_generate_skill_target_plan.return_value = {
                "target_skills": verified_targets,
                "strategy_notes": "Prioritize supported platform evidence",
            }
            mock_verify_plan.return_value = {
                "accepted": verified_targets,
                "gaps": [{"skill": "Kubernetes", "source": "jd_gap"}],
                "rejected": [],
            }
            mock_generate_diffs.return_value = ImproveDiffResult(
                changes=[],
                strategy_notes="Used verified skill targets",
            )
            mock_apply_diffs.return_value = (tailored_resume, [], [])
            mock_refine_resume.return_value = SimpleNamespace(
                refined_data=tailored_resume,
                passes_completed=0,
                keyword_analysis=None,
                ai_phrases_removed=[],
                alignment_report=None,
                final_match_percentage=0.0,
            )

            async with client:
                resp = await client.post(
                    "/api/v1/resumes/improve/preview",
                    json={
                        "resume_id": "res-123",
                        "job_id": "job-123",
                        "prompt_id": "full",
                    },
                )

        assert resp.status_code == 200
        payload = resp.json()["data"]
        assert payload["resume_id"] is None
        mock_generate_skill_target_plan.assert_awaited_once()
        assert mock_generate_diffs.await_args.kwargs["skill_targets"] == verified_targets
        assert mock_apply_diffs.call_args.kwargs["allowed_skill_targets"] == verified_targets
