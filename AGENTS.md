# Agent Instructions

## Scope
- Resume Matcher is split into `apps/backend` and `apps/frontend`; closer `AGENTS.md` files override this root file.
- Start with `docs/agent/README.md`, then open only the task-specific docs it points to.
- Use `SETUP.md` and `docs/agent/quickstart.md` for setup truth; `.github/CONTRIBUTING.md` may lag the current app shape.

## Command Rules
- If `rtk` is on `PATH`, prefix shell commands with `rtk`; otherwise run the command directly.
- Prefer `rg` and `rg --files` for repository search.
- Run `git status --short` before and after edits; preserve unrelated local changes.
- Do not modify `.github/workflows/`, Docker, CI/CD, or deployment behavior unless explicitly requested.

## Current Docs
| Need | File |
| --- | --- |
| Project index | `docs/agent/README.md` |
| Setup and local run | `SETUP.md`, `docs/agent/quickstart.md` |
| Workflow and PR checks | `docs/agent/workflow.md` |
| Coding conventions | `docs/agent/coding-standards.md` |
| API contracts | `docs/agent/apis/front-end-apis.md` |
| Backend architecture | `docs/agent/architecture/backend-guide.md` |
| Frontend architecture | `docs/agent/architecture/frontend-architecture.md` |
| Frontend workflow | `docs/agent/architecture/frontend-workflow.md` |
| LLM providers | `docs/agent/llm-integration.md` |
| Swiss UI system | `docs/portable/swiss-design-system/README.md` |
| Next.js performance guidance | `docs/portable/nextjs-performance/README.md` |

## Current Docs Lookup
- For library, framework, SDK, API, CLI, or cloud-service docs, run `ctx7` first:
  `npx ctx7@latest library <name> "<question>"`, then `npx ctx7@latest docs <libraryId> "<question>"`.
- Treat `docs/portable/nextjs-performance/README.md` as project guidance, not version-current Next.js API documentation.

## Package Areas
| Area | Package manager | Commands |
| --- | --- | --- |
| `apps/backend` | `uv` | See `apps/backend/AGENTS.md` |
| `apps/frontend` | `npm` | See `apps/frontend/AGENTS.md` |

## Project-Wide Conventions
- Call out schema, prompt, or API contract changes in handoffs and PR notes.
- Do not expose secrets, API keys, credentialed URLs, query strings, or fragments in logs or UI.
- Update relevant docs when behavior changes; reference existing docs instead of duplicating them here.
