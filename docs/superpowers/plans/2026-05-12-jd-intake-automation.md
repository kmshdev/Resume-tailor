# JD Intake Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reviewed JD-intake wizard before the existing resume-tailoring flow.

**Architecture:** Add a FastAPI intake layer that normalizes manual text, job URLs, PDF URLs, PDF uploads, and pasted recruiter messages into reviewed JD text plus metadata. Store reviewed text as the canonical job content and keep screening questions/draft answers separate from tailoring keywords.

**Tech Stack:** FastAPI, Pydantic v2, TinyDB, LiteLLM, MarkItDown, Playwright Python, Next.js 16, React 19, Tailwind CSS v4, Vitest.

---

## Tasks

- [ ] Add backend schemas, prompts, and service tests for JD intake.
- [ ] Implement URL safety, HTTP/Playwright extraction, PDF parsing, and deterministic recruiter-message parsing.
- [ ] Add intake router endpoints and TinyDB metadata persistence.
- [ ] Add frontend intake API helpers and Tailor wizard tests.
- [ ] Replace the Tailor textarea-only flow with the source/extract/review/tailor wizard.
- [ ] Update i18n and agent docs.
- [ ] Run backend and frontend verification.
