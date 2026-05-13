"""Unit tests for resume evaluation schemas and storage helpers."""

from pathlib import Path

import pytest

from app.database import Database
from app.schemas.evaluation import (
    EvaluationDimensionScores,
    EvaluationEvidenceItem,
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)


def test_evaluation_scores_are_clamped() -> None:
    response = ResumeEvaluationResponse(
        evaluation_id="eval-1",
        resume_id="resume-1",
        baseline_resume_id=None,
        job_id=None,
        phase="readiness",
        overall_score=140,
        confidence=2,
        dimensions={
            "clarity": -5,
            "impact": 101,
            "ats_readability": 88,
            "keyword_alignment": 50,
            "role_fit": 50,
            "evidence_strength": 50,
        },
        strengths=[],
        gaps=[],
        next_actions=[],
        model="test-model",
        provider="openai",
        prompt_version="resume_evaluation_v1",
        source_hash="hash",
        created_at="2026-05-13T00:00:00+00:00",
        stale=False,
        warnings=[],
    )

    assert response.overall_score == 100
    assert response.confidence == 1
    assert response.dimensions.clarity == 0
    assert response.dimensions.impact == 100


def test_pre_tailor_requires_job_id() -> None:
    with pytest.raises(ValueError, match="job_id"):
        ResumeEvaluationRequest(phase="pre_tailor")


def test_post_tailor_accepts_baseline_resume_id() -> None:
    request = ResumeEvaluationRequest(
        phase="post_tailor",
        job_id="job-1",
        baseline_resume_id="resume-master",
    )

    assert request.phase == "post_tailor"
    assert request.job_id == "job-1"
    assert request.baseline_resume_id == "resume-master"


def test_evidence_item_requires_source_or_absence() -> None:
    with pytest.raises(ValueError, match="evidence_source"):
        EvaluationEvidenceItem(
            title="Strong backend impact",
            detail="Mentions scalable APIs.",
            evidence_source=None,
            evidence_snippet="Built APIs.",
            recommendation=None,
            severity="medium",
        )


def test_database_evaluation_round_trip(tmp_path: Path) -> None:
    database = Database(tmp_path / "db.json")
    payload = {
        "evaluation_id": "eval-1",
        "resume_id": "resume-1",
        "baseline_resume_id": None,
        "job_id": None,
        "phase": "readiness",
        "overall_score": 82,
        "confidence": 0.72,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": "resume_evaluation_v1",
        "source_hash": "hash-1",
        "created_at": "2026-05-13T00:00:00+00:00",
        "stale": False,
        "warnings": [],
    }

    created = database.create_evaluation(payload)

    assert created["evaluation_id"] == "eval-1"
    assert database.get_evaluation_by_source_hash("hash-1")["evaluation_id"] == "eval-1"
    assert database.get_latest_evaluation("resume-1", phase="readiness")["evaluation_id"] == "eval-1"
    assert len(database.list_evaluations("resume-1")) == 1


def test_database_finds_post_tailor_by_baseline_resume(tmp_path: Path) -> None:
    database = Database(tmp_path / "db.json")
    payload = {
        "evaluation_id": "eval-post",
        "resume_id": "tailored-resume-1",
        "baseline_resume_id": "master-resume-1",
        "job_id": "job-1",
        "phase": "post_tailor",
        "overall_score": 90,
        "confidence": 0.8,
        "dimensions": EvaluationDimensionScores().model_dump(),
        "strengths": [],
        "gaps": [],
        "next_actions": [],
        "model": "test-model",
        "provider": "openai",
        "prompt_version": "resume_evaluation_v1",
        "source_hash": "hash-post",
        "created_at": "2026-05-13T00:00:00+00:00",
        "stale": False,
        "warnings": [],
    }

    database.create_evaluation(payload)

    latest = database.get_latest_evaluation_for_baseline(
        baseline_resume_id="master-resume-1",
        phase="post_tailor",
        job_id="job-1",
    )

    assert latest["evaluation_id"] == "eval-post"
