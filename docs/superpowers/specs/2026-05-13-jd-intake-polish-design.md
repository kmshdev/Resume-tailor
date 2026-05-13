# JD Intake Polish Design

## Summary

JD intake crosses several trust boundaries: remote URLs, browser-rendered pages, PDFs, pasted recruiter messages, LLM cleanup, persisted metadata, and frontend review state. This polish pass keeps endpoint paths and the user flow stable while reducing leakage, making boundaries explicit, and splitting the implementation into smaller units.

## Design

- Backend intake is a package under `app.services.job_intake` with focused modules for URL safety, fetching, deterministic extraction, LLM cleanup, and orchestration. The package re-exports the existing public service API for routers/tests.
- Remote source handling stores and returns only safe source URLs with credentials, query strings, and fragments removed. Full URLs are used only during the fetch operation.
- `JobIntakeExtractResponse` no longer exposes raw scraped text. The frontend receives only reviewed JD text plus metadata that the user can inspect.
- The Tailor wizard keeps the same product flow but delegates source selection, source input, and review display to smaller components. Client-side validation catches obvious URL/PDF mistakes before API calls.
- The original implementation plan is archived as complete. This hardening design and plan are the active docs for remaining JD intake polish.

## Acceptance Criteria

- Existing intake endpoints still work at the same paths.
- No extract response contains `raw_text`.
- Persisted/displayed source URLs are redacted.
- Public URL, PDF, HTML, question extraction, and Playwright fallback behavior are covered by backend tests.
- Frontend tests cover source validation, switching, review editing, confirm gating, and API handoff.
