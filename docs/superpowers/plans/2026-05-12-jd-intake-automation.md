# JD Intake Automation Implementation Archive

**Status:** Complete as of the `feat/jd-automation` implementation branch.

**Original goal:** Build a reviewed JD-intake wizard before the existing resume-tailoring flow.

**Completed outcome:** The Tailor flow now accepts manual JD text, public job URLs, PDF URLs/uploads, and pasted recruiter messages. Extracted text is reviewed by the user, saved as canonical `jobs.content`, and source links/questions/draft answers are stored separately in `intake_metadata`.

**Follow-up hardening:** The active cleanup source of truth is now `docs/superpowers/plans/2026-05-13-jd-intake-polish-hardening.md`.

## Completed Tasks

- [x] Add backend schemas, prompts, and service tests for JD intake.
- [x] Implement URL safety, HTTP/Playwright extraction, PDF parsing, and deterministic recruiter-message parsing.
- [x] Add intake router endpoints and TinyDB metadata persistence.
- [x] Add frontend intake API helpers and Tailor wizard tests.
- [x] Replace the Tailor textarea-only flow with the source/extract/review/tailor wizard.
- [x] Update i18n and agent docs.
- [x] Run backend and frontend verification during implementation.
