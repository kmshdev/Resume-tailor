# Backend Agent Instructions

## Scope
- Applies to `apps/backend`.
- Backend stack: FastAPI, Python 3.13+, TinyDB, LiteLLM, Playwright Chromium for PDF.

## Commands
Run from `apps/backend`.

| Task | Command |
| --- | --- |
| Install runtime deps | `uv sync` |
| Install test/dev deps | `uv sync --extra dev` |
| Start dev server | `uv run uvicorn app.main:app --reload --port 8000` |
| Start app entrypoint | `uv run app` |
| Run tests | `uv run pytest` |

## References
| Need | File |
| --- | --- |
| Backend architecture | `../../docs/agent/architecture/backend-guide.md` |
| API contract | `../../docs/agent/apis/front-end-apis.md` |
| LLM integration | `../../docs/agent/llm-integration.md` |
| Resume evaluation | `../../docs/agent/features/resume-evaluation.md` |
| JD intake | `../../docs/agent/features/job-intake.md` |

## Conventions
- Add type hints to every Python function you create or modify.
- Use async functions for I/O paths such as database, network, PDF, and LLM work.
- Log detailed backend errors server-side; return generic, user-safe messages to clients.
- Use `copy.deepcopy()` for mutable defaults; do not share module-level mutable data between requests.
- Treat LLM output as untrusted: clamp scores, drop malformed evidence, cache by source hash, and surface provider/config failures safely.
- Keep prompts in `app/prompts/`, Pydantic schemas in `app/schemas/`, routers in `app/routers/`, and business logic in `app/services/`.
- Tests live in `tests/` and use `test_*.py`; prefer targeted `uv run pytest tests/path/to/test_file.py` while iterating.
