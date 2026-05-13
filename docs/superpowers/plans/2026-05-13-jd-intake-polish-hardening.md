# JD Intake Polish And Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish JD intake trust boundaries while preserving endpoint paths and the Tailor source → extract → review → confirm → preview flow.

**Architecture:** Split the backend intake service into boundary-focused modules, remove raw scraped text from frontend-facing responses, redact source URLs before display/persistence, and break the frontend wizard into smaller components with source-specific validation.

**Tech Stack:** FastAPI, Pydantic v2, TinyDB, LiteLLM, httpx/httpcore, BeautifulSoup, Playwright Python, Next.js 16, React 19, Tailwind CSS v4, Vitest.

---

## Tasks

- [x] Add failing backend tests for SSL context preservation, multi-question extraction, redacted source URLs, and no `raw_text`.
- [x] Add failing frontend tests for URL/PDF source validation.
- [x] Split `app.services.job_intake` into a package with URL safety, fetchers, extraction, LLM cleanup, and orchestration modules.
- [x] Remove `raw_text` from `JobIntakeExtractResponse` and frontend types.
- [x] Redact `source_url` in extract responses and confirm metadata persistence.
- [x] Preserve `trust_env=False` SSL behavior in the safe httpx transport.
- [x] Extract all screening question clauses on a line with set-based dedupe.
- [x] Refactor the Tailor intake wizard into source selector, source input, and review panel components.
- [x] Add client-side URL and PDF preflight validation plus i18n messages.
- [x] Archive the original JD intake implementation plan and add this hardening design/plan.
- [x] Run full backend and frontend verification.
