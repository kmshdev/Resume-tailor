# AGENTS.md

Resume Matcher is an AI-powered resume tailoring app with a FastAPI/Python backend and a Next.js/React frontend.

Full project orientation starts at [docs/agent/README.md](docs/agent/README.md).

## Tech Stack

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, Python 3.13+, LiteLLM |
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Database | TinyDB JSON storage |
| PDF | Headless Chromium via Playwright |

## Project Map

```text
apps/
├── backend/                 # FastAPI API
│   ├── app/
│   │   ├── main.py          # Entry point
│   │   ├── config.py        # Environment settings
│   │   ├── database.py      # TinyDB wrapper
│   │   ├── llm.py           # LiteLLM wrapper
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── schemas/         # Pydantic models
│   │   └── prompts/         # LLM prompt templates
│   └── data/                # Database storage
└── frontend/                # Next.js UI
    ├── app/                 # Pages: dashboard, builder, tailor, print
    ├── components/          # UI components, app shell, dashboard, Tailor, evaluation
    ├── components/fancy/    # shadcn-installed Fancy components
    ├── lib/                 # Utilities and API clients
    ├── hooks/               # React hooks
    └── messages/            # i18n messages: en, es, zh, ja, pt-BR
```

<important if="you are starting work in this repository">

- Read [docs/agent/README.md](docs/agent/README.md) before exploring code.
- Use that index to choose the task-specific docs instead of loading every document.
- Inspect existing code patterns before adding new abstractions.

</important>

<important if="you run shell commands in Codex">

- If `rtk` is available on `PATH`, prefix shell commands with `rtk` for token-filtered output; if it is missing, run the command directly and continue.
- Prefer `rg` and `rg --files` for searching.
- Check `git status --short` before and after edits so unrelated user changes stay untouched.

</important>

<important if="you need to install, run, build, lint, test, or format">

Run package commands from the app directory shown in the table.

| Purpose | Directory | Command |
| --- | --- | --- |
| Install backend deps | `apps/backend` | `uv sync` |
| Start backend dev server | `apps/backend` | `uv run uvicorn app.main:app --reload --port 8000` |
| Run backend tests | `apps/backend` | `uv run pytest` |
| Copy backend env sample | repo root | `cp apps/backend/.env.example apps/backend/.env` |
| Install frontend deps | `apps/frontend` | `npm install` |
| Start frontend dev server | `apps/frontend` | `npm run dev` |
| Build frontend | `apps/frontend` | `npm run build` |
| Start built frontend | `apps/frontend` | `npm run start` |
| Lint frontend | `apps/frontend` | `npm run lint` |
| Format frontend | `apps/frontend` | `npm run format` |
| Test frontend | `apps/frontend` | `npm run test` |
| Copy frontend env sample | repo root | `cp apps/frontend/.env.sample apps/frontend/.env.local` |

</important>

<important if="you are changing backend code">

- Read [docs/agent/architecture/backend-guide.md](docs/agent/architecture/backend-guide.md).
- Check API expectations in [docs/agent/apis/front-end-apis.md](docs/agent/apis/front-end-apis.md).
- For LLM provider work, read [docs/agent/llm-integration.md](docs/agent/llm-integration.md).
- Add type hints to every Python function you create or modify.

</important>

<important if="you are adding or changing backend error handling">

- Log detailed errors server-side.
- Return generic, user-safe messages to clients.

</important>

<important if="you are using mutable default data in Python">

- Use `copy.deepcopy()` for mutable defaults; do not share module-level mutable defaults between requests or records.

</important>

<important if="you are changing frontend UI or components">

- Read [docs/agent/architecture/frontend-workflow.md](docs/agent/architecture/frontend-workflow.md).
- For app shell, dashboard, Tailor, or evaluation UI, also read
  [frontend architecture](docs/agent/architecture/frontend-architecture.md),
  [resume evaluation](docs/agent/features/resume-evaluation.md), and
  [job intake](docs/agent/features/job-intake.md) as relevant.
- Follow the required Swiss International Style pack:
  [README](docs/portable/swiss-design-system/README.md),
  [tokens](docs/portable/swiss-design-system/tokens.md),
  [components](docs/portable/swiss-design-system/components.md),
  [anti-patterns](docs/portable/swiss-design-system/anti-patterns.md).
- Read [docs/portable/nextjs-performance/README.md](docs/portable/nextjs-performance/README.md) for Next.js performance guidance.
- Run `npm run lint` and `npm run format` from `apps/frontend` before committing frontend changes.

</important>

<important if="you are changing app shell, dashboard command center, or Tailor card decks">

- The shared shell lives in `apps/frontend/components/shell/`; `apps/frontend/app/(default)/layout.tsx` wraps default routes in `AppShell`.
- Dashboard uses `CommandCenter`, `EvaluationCard`, and `TailorCardStack`.
- Tailor uses `TailorSessionCards`, `TailorStepCard`, and `JobIntakeWizard`.
- Fancy stacking cards are installed in `apps/frontend/components/fancy/stacking-cards.tsx`; keep the `@fancy` registry in `apps/frontend/components.json` before adding or re-adding Fancy components.
- Stable Tailor deck contracts include `data-layout="fancy-stacking-cards"`, `role="list"`, `role="listitem"`, and `aria-current="step"`.

</important>

<important if="you are changing JD intake, job scraping, recruiter-message intake, or job metadata">

- Read [docs/agent/features/job-intake.md](docs/agent/features/job-intake.md) and [docs/agent/apis/front-end-apis.md](docs/agent/apis/front-end-apis.md).
- Backend files: `app/routers/job_intake.py`, `app/schemas/job_intake.py`, `app/services/job_intake/`, `app/prompts/job_intake.py`.
- Frontend files: `lib/api/job-intake.ts`, `components/tailor/job-intake-wizard.tsx`, and `components/tailor/job-intake/`.
- Users must review extracted JD text before `confirm`; `content` remains the canonical JD.
- `intake_metadata` stores reviewed source metadata, detected links, screening questions, and draft answers. Do not append screening questions to the JD used for tailoring.
- Do not log, persist, or display raw remote URLs with credentials, query strings, or fragments.

</important>

<important if="you are changing resume readiness, pre-tailor, post-tailor, or evaluation scoring">

- Read [docs/agent/features/resume-evaluation.md](docs/agent/features/resume-evaluation.md), [docs/agent/llm-integration.md](docs/agent/llm-integration.md), and [docs/agent/apis/front-end-apis.md](docs/agent/apis/front-end-apis.md).
- Backend files: `app/routers/evaluations.py`, `app/schemas/evaluation.py`, `app/services/evaluation.py`, `app/prompts/evaluation.py`.
- Frontend files: `lib/api/evaluation.ts`, `components/evaluation/`, dashboard page, and Tailor page.
- Evaluation phases are `readiness`, `pre_tailor`, and `post_tailor`.
- LLM output is untrusted: clamp scores, drop malformed evidence, cache by source hash, and surface provider/config failures as user-safe errors.

</important>

<important if="you are styling frontend UI">

Use the Swiss design tokens unless an existing component establishes a narrower local pattern.

| Element | Value |
| --- | --- |
| Canvas background | `#F0F0E8` |
| Ink text | `#000000` |
| Hyper Blue links | `#1D4ED8` |
| Signal Green success | `#15803D` |
| Alert Orange warning | `#F97316` |
| Alert Red error | `#DC2626` |
| Headers | `font-serif` |
| Body | `font-sans` |
| Metadata | `font-mono` |
| Borders | `rounded-none`, 1px black, hard shadows |

</important>

<important if="you are adding or modifying a textarea">

- Ensure Enter key presses call `stopPropagation()` so parent keyboard handlers do not intercept normal text entry.

</important>

<important if="you are changing templates, print views, or PDF generation">

- Read [docs/agent/design/pdf-template-guide.md](docs/agent/design/pdf-template-guide.md).
- Read [docs/agent/design/template-system.md](docs/agent/design/template-system.md).
- For template controls and variants, read [docs/agent/features/resume-templates.md](docs/agent/features/resume-templates.md).

</important>

<important if="you are changing a feature area">

| Feature | Doc |
| --- | --- |
| Custom sections | [docs/agent/features/custom-sections.md](docs/agent/features/custom-sections.md) |
| Resume templates | [docs/agent/features/resume-templates.md](docs/agent/features/resume-templates.md) |
| i18n | [docs/agent/features/i18n.md](docs/agent/features/i18n.md) |
| AI enrichment | [docs/agent/features/enrichment.md](docs/agent/features/enrichment.md) |
| JD matching | [docs/agent/features/jd-match.md](docs/agent/features/jd-match.md) |
| JD intake automation | [docs/agent/features/job-intake.md](docs/agent/features/job-intake.md) |
| Resume evaluation | [docs/agent/features/resume-evaluation.md](docs/agent/features/resume-evaluation.md) |

</important>

<important if="you are changing schemas, prompt templates, or LLM behavior">

- Update or call out the relevant docs and smoke-test expectations.
- In PR notes or final handoff, explicitly mention schema and prompt changes so downstream behavior can be reviewed.

</important>

<important if="you are changing tests">

- Do not remove or disable existing tests unless explicitly requested.
- Backend tests live in `apps/backend/tests/` and use `test_*.py` naming.
- Frontend tests live under `apps/frontend/tests/` and use `*.test.tsx` naming.

</important>

<important if="you are about to modify repository automation, deployment config, Docker behavior, or GitHub workflows">

- Do not modify `.github/workflows/`, CI/CD configuration, or Docker build behavior without an explicit user request.

</important>

<important if="you are finishing a code change">

- Verify the code compiles or explain why verification was not run.
- For frontend changes, run `npm run lint` and `npm run format` from `apps/frontend`.
- For backend behavior changes, run relevant `uv run pytest` tests from `apps/backend`.
- Document any schema or prompt changes in the handoff.

</important>
