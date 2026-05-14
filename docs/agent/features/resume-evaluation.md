# Resume Evaluation

> LLM-backed structured scoring for resume readiness, pre-tailor fit, and post-tailor lift.

## Overview

Resume evaluation produces stored, structured scores and evidence-grounded recommendations for three phases:

| Phase | Meaning |
| --- | --- |
| `readiness` | Master or selected resume quality before any specific job |
| `pre_tailor` | Baseline resume fit against a job before tailoring |
| `post_tailor` | Tailored resume fit and lift after tailoring |

Evaluations are shown on the dashboard and in the Tailor session. Evaluation failures are nonblocking for tailoring.

## Data Model

Each evaluation stores:

- `overall_score` on a 0-100 scale
- `dimensions`: clarity, impact, ATS readability, keyword alignment, role fit, evidence strength
- `strengths`, `gaps`, and `next_actions`
- `provider`, `model`, `prompt_version`, `source_hash`, `created_at`, `stale`, and `warnings`

LLM output is untrusted. Backend schemas clamp scores, require evidence source metadata, and drop malformed evidence before persisting.

## Backend Files

| File | Purpose |
| --- | --- |
| `apps/backend/app/routers/evaluations.py` | Evaluation API endpoints and error mapping |
| `apps/backend/app/schemas/evaluation.py` | Structured response schema, validation, score clamping |
| `apps/backend/app/services/evaluation.py` | Source loading, cache lookup, LLM call, cleanup, persistence |
| `apps/backend/app/prompts/evaluation.py` | Prompt and response contract for structured evaluation |
| `apps/backend/app/database.py` | TinyDB evaluation storage and lookup helpers |

## Frontend Files

| File | Purpose |
| --- | --- |
| `apps/frontend/lib/api/evaluation.ts` | Evaluation API client and TypeScript types |
| `apps/frontend/components/evaluation/evaluation-card.tsx` | Readiness/pre/post score card |
| `apps/frontend/components/evaluation/evaluation-popover.tsx` | Evidence details, gaps, and next actions |
| `apps/frontend/app/(default)/dashboard/page.tsx` | Dashboard evaluation fetching and check actions |
| `apps/frontend/app/(default)/tailor/page.tsx` | Pre/post-tailor evaluation flow and warning handling |

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/resumes/{resume_id}/evaluations` | Create or fetch cached evaluation |
| GET | `/api/v1/resumes/{resume_id}/evaluations` | List evaluations; optional `phase` and `job_id` filters |
| GET | `/api/v1/resumes/{resume_id}/evaluations/latest` | Latest `readiness`, `pre_tailor`, and `post_tailor` records |

## Caching and Staleness

Evaluations are cached by source hash, phase, prompt version, provider/model, resume, job, and baseline resume where relevant. Latest evaluation responses mark records stale when source content has changed since the evaluation was created.

## Testing

- Backend unit tests: `apps/backend/tests/unit/test_evaluation.py`
- Backend integration tests: `apps/backend/tests/integration/test_evaluations_api.py`
- Frontend tests: `apps/frontend/tests/evaluation-api.test.ts`, `apps/frontend/tests/dashboard-command-center.test.tsx`, `apps/frontend/tests/tailor-page-diagnostics.test.tsx`
