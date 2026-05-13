"""Resume evaluation endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from app.database import db
from app.schemas.evaluation import (
    EvaluationPhase,
    LatestResumeEvaluationsResponse,
    ResumeEvaluationListResponse,
    ResumeEvaluationRequest,
    ResumeEvaluationResponse,
)
from app.services.evaluation import (
    EvaluationConfigError,
    EvaluationError,
    EvaluationProviderError,
    create_resume_evaluation,
    get_latest_resume_evaluations,
    list_resume_evaluations,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["Evaluations"])


def _http_exception_for_evaluation_error(exc: EvaluationError) -> HTTPException:
    """Map service-layer evaluation failures to user-safe HTTP errors."""
    if isinstance(exc, EvaluationConfigError):
        return HTTPException(
            status_code=400,
            detail="Configure an LLM provider before evaluation.",
        )
    if isinstance(exc, EvaluationProviderError):
        return HTTPException(
            status_code=503,
            detail="Evaluation provider failed. Please retry.",
        )
    if "not found" in str(exc).lower():
        return HTTPException(status_code=404, detail="Evaluation source not found.")
    return HTTPException(status_code=400, detail="Unable to evaluate resume.")


def _http_exception_for_validation_error(exc: ValidationError) -> HTTPException:
    """Map internal response validation failures to a user-safe 422."""
    logger.warning("Invalid evaluation data: %s", exc)
    return HTTPException(status_code=422, detail="Invalid evaluation data.")


@router.post("/{resume_id}/evaluations", response_model=ResumeEvaluationResponse)
async def create_evaluation(
    resume_id: str,
    request: ResumeEvaluationRequest,
) -> ResumeEvaluationResponse:
    """Create or fetch a cached resume evaluation."""
    try:
        return await create_resume_evaluation(
            database=db,
            resume_id=resume_id,
            request=request,
        )
    except EvaluationError as exc:
        raise _http_exception_for_evaluation_error(exc) from exc
    except ValidationError as exc:
        raise _http_exception_for_validation_error(exc) from exc
    except Exception as exc:
        logger.exception("Unexpected evaluation creation failure")
        raise HTTPException(
            status_code=500,
            detail="Failed to evaluate resume.",
        ) from exc


@router.get("/{resume_id}/evaluations", response_model=ResumeEvaluationListResponse)
async def list_evaluations(
    resume_id: str,
    phase: EvaluationPhase | None = Query(default=None),
    job_id: str | None = Query(default=None),
) -> ResumeEvaluationListResponse:
    """List stored evaluations for a resume."""
    try:
        return list_resume_evaluations(
            database=db,
            resume_id=resume_id,
            phase=phase,
            job_id=job_id,
        )
    except EvaluationError as exc:
        raise _http_exception_for_evaluation_error(exc) from exc
    except ValidationError as exc:
        raise _http_exception_for_validation_error(exc) from exc
    except Exception as exc:
        logger.exception("Unexpected evaluation list failure")
        raise HTTPException(
            status_code=500,
            detail="Failed to load resume evaluations.",
        ) from exc


@router.get(
    "/{resume_id}/evaluations/latest",
    response_model=LatestResumeEvaluationsResponse,
)
async def latest_evaluations(
    resume_id: str,
    job_id: str | None = Query(default=None),
) -> LatestResumeEvaluationsResponse:
    """Return latest stored evaluations grouped by phase."""
    try:
        return get_latest_resume_evaluations(
            database=db,
            resume_id=resume_id,
            job_id=job_id,
        )
    except EvaluationError as exc:
        raise _http_exception_for_evaluation_error(exc) from exc
    except ValidationError as exc:
        raise _http_exception_for_validation_error(exc) from exc
    except Exception as exc:
        logger.exception("Unexpected latest evaluations failure")
        raise HTTPException(
            status_code=500,
            detail="Failed to load latest resume evaluations.",
        ) from exc
