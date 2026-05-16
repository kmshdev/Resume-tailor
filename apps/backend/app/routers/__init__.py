"""API routers."""

from app.routers.config import router as config_router
from app.routers.enrichment import router as enrichment_router
from app.routers.evaluations import router as evaluations_router
from app.routers.health import router as health_router
from app.routers.job_intake import router as job_intake_router
from app.routers.jobs import router as jobs_router
from app.routers.resumes import router as resumes_router

__all__ = [
    "resumes_router",
    "jobs_router",
    "config_router",
    "health_router",
    "enrichment_router",
    "job_intake_router",
    "evaluations_router",
]
