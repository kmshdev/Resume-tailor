# Job Intake Automation

> Reviewed job-description intake before Tailor creates or improves a resume.

## Overview

The Tailor page no longer relies on a raw textarea-only JD paste. Users can provide manual JD text, a public job URL, a PDF URL, a local PDF upload, or pasted recruiter-message text. The system extracts reviewable JD text and metadata, then requires user confirmation before persisting a job record.

## Flow

1. User selects an intake source in `JobIntakeWizard`.
2. Frontend validates obvious source errors before calling the API.
3. Backend extracts reviewable JD text and reviewed metadata.
4. User reviews/edits canonical JD text, screening questions, and draft answers.
5. Frontend calls `confirmJobIntake`.
6. Backend stores reviewed JD text as `jobs.content` and reviewed metadata as `jobs.intake_metadata`.
7. Tailor proceeds through preview improvements, diff review, and save.

## Trust Boundaries

- V1 does not use authenticated pages, user cookies, browser profiles, Gmail, LinkedIn inbox access, or private/internal URLs.
- Remote URLs must be `http` or `https`, credential-free, public, redirect-revalidated, byte-limited, and timeout-bounded.
- Raw scraped text is not returned to the frontend.
- `source_url` values shown or persisted are redacted: no credentials, query strings, or fragments.
- Screening questions and draft answers are metadata only; do not append them to the JD used for keyword extraction.
- Users must review extracted content before job creation and tailoring.

## Backend Files

| File | Purpose |
| --- | --- |
| `apps/backend/app/routers/job_intake.py` | Public intake endpoints and user-safe error mapping |
| `apps/backend/app/schemas/job_intake.py` | Request/response and metadata models |
| `apps/backend/app/services/job_intake/` | URL safety, fetchers, PDF validation, extraction, LLM cleanup |
| `apps/backend/app/prompts/job_intake.py` | Recruiter/JD extraction and evidence-only answer prompt |
| `apps/backend/app/database.py` | Stores `intake_metadata` on job records |

## Frontend Files

| File | Purpose |
| --- | --- |
| `apps/frontend/lib/api/job-intake.ts` | Intake API client and public TypeScript types |
| `apps/frontend/components/tailor/job-intake-wizard.tsx` | Source selection, extraction, review, confirm handoff |
| `apps/frontend/components/tailor/job-intake/source-selector.tsx` | Source buttons |
| `apps/frontend/components/tailor/job-intake/source-input.tsx` | Source-specific input controls |
| `apps/frontend/components/tailor/job-intake/review-panel.tsx` | Reviewed JD, links, warnings, questions, draft answers |

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/jobs/intake/extract` | Extract from manual text, public job URL, PDF URL, or recruiter message |
| POST | `/api/v1/jobs/intake/pdf-upload` | Extract from uploaded PDF bytes |
| POST | `/api/v1/jobs/intake/confirm` | Persist reviewed JD and reviewed metadata |

## Testing

- Backend unit tests: `apps/backend/tests/unit/test_job_intake.py`
- Backend integration tests: `apps/backend/tests/integration/test_job_intake_api.py`
- Frontend tests: `apps/frontend/tests/job-intake-api.test.ts`, `apps/frontend/tests/job-intake-wizard.test.tsx`
