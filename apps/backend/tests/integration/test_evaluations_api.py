"""Integration tests for resume evaluation endpoints."""

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.evaluation import EvaluationConfigError, EvaluationProviderError


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Create an in-process HTTP client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


def _evaluation_payload(**overrides: Any) -> dict[str, Any]:
    """Return a valid evaluation response payload with optional overrides."""
    payload: dict[str, Any] = {
        "evaluation_id": "eval-1",
        "resume_id": "resume-1",
        "baseline_resume_id": None,
        "job_id": None,
        "phase": "readiness",
        "overall_score": 80,
        "confidence": 0.8,
        "dimensions": {},
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": "resume_evaluation_v1",
        "source_hash": "hash",
        "created_at": "2026-05-13T00:00:00+00:00",
        "stale": False,
        "warnings": [],
    }
    payload.update(overrides)
    return payload


class TestResumeEvaluationsApi:
    """API coverage for evaluation create, list, latest, and service failures."""

    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_create_readiness_evaluation(
        self,
        mock_create: AsyncMock,
        client: AsyncClient,
    ) -> None:
        mock_create.return_value = _evaluation_payload()

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 200
        assert resp.json()["overall_score"] == 80
        mock_create.assert_awaited_once()
        assert mock_create.await_args.kwargs["resume_id"] == "resume-1"
        assert mock_create.await_args.kwargs["request"].phase == "readiness"

    async def test_pre_tailor_requires_job_id(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "pre_tailor"},
        )

        assert resp.status_code == 422

    @patch("app.routers.evaluations.list_resume_evaluations")
    async def test_list_evaluations_filters_by_phase(
        self,
        mock_list: Mock,
        client: AsyncClient,
    ) -> None:
        mock_list.return_value = {"evaluations": [_evaluation_payload()]}

        resp = await client.get(
            "/api/v1/resumes/resume-1/evaluations",
            params={"phase": "readiness"},
        )

        assert resp.status_code == 200
        assert len(resp.json()["evaluations"]) == 1
        mock_list.assert_called_once()
        assert mock_list.call_args.kwargs["resume_id"] == "resume-1"
        assert mock_list.call_args.kwargs["phase"] == "readiness"

    @patch("app.routers.evaluations.get_latest_resume_evaluations")
    async def test_latest_evaluations(
        self,
        mock_latest: Mock,
        client: AsyncClient,
    ) -> None:
        mock_latest.return_value = {
            "readiness": None,
            "pre_tailor": None,
            "post_tailor": _evaluation_payload(
                resume_id="tailored-resume-1",
                baseline_resume_id="resume-1",
                job_id="job-1",
                phase="post_tailor",
                overall_score=88,
            ),
        }

        resp = await client.get(
            "/api/v1/resumes/resume-1/evaluations/latest",
            params={"job_id": "job-1"},
        )

        assert resp.status_code == 200
        assert resp.json()["post_tailor"]["baseline_resume_id"] == "resume-1"
        mock_latest.assert_called_once()
        assert mock_latest.call_args.kwargs["resume_id"] == "resume-1"
        assert mock_latest.call_args.kwargs["job_id"] == "job-1"

    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_missing_llm_config_returns_400(
        self,
        mock_create: AsyncMock,
        client: AsyncClient,
    ) -> None:
        mock_create.side_effect = EvaluationConfigError("LLM configuration is required")

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 400
        assert resp.json()["detail"] == "Configure an LLM provider before evaluation."

    @patch("app.routers.evaluations.create_resume_evaluation", new_callable=AsyncMock)
    async def test_provider_failure_returns_503(
        self,
        mock_create: AsyncMock,
        client: AsyncClient,
    ) -> None:
        mock_create.side_effect = EvaluationProviderError("Failed to evaluate resume")

        resp = await client.post(
            "/api/v1/resumes/resume-1/evaluations",
            json={"phase": "readiness"},
        )

        assert resp.status_code == 503
        assert resp.json()["detail"] == "Evaluation provider failed. Please retry."
