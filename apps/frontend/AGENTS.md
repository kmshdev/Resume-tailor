# Frontend Agent Instructions

## Scope
- Applies to `apps/frontend`.
- Frontend stack: Next.js 16, React 19, Tailwind CSS v4, npm, Vitest, Testing Library.

## Commands
Run from `apps/frontend`.

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| CI install | `npm ci` |
| Start dev server | `npm run dev` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Test | `npm run test` |
| Build | `npm run build` |
| Start built app | `npm run start` |
| E2E eval | `npm run eval:e2e` |

## References
| Need | File |
| --- | --- |
| Frontend architecture | `../../docs/agent/architecture/frontend-architecture.md` |
| Frontend workflow | `../../docs/agent/architecture/frontend-workflow.md` |
| Swiss UI system | `../../docs/portable/swiss-design-system/README.md` |
| Next.js performance | `../../docs/portable/nextjs-performance/README.md` |
| i18n | `../../docs/agent/features/i18n.md` |
| Templates and PDF | `../../docs/agent/design/template-system.md`, `../../docs/agent/design/pdf-template-guide.md` |
| Job intake | `../../docs/agent/features/job-intake.md` |
| Resume evaluation | `../../docs/agent/features/resume-evaluation.md` |

## UI Rules
- Follow the Swiss style pack: `#F0F0E8` canvas, black ink, `#1D4ED8` action blue, `rounded-none`, 1px black borders, hard shadows.
- Use `font-serif` for headers, `font-sans` for body, and `font-mono` for metadata.
- New visible copy must update `messages/en.json`, `messages/es.json`, `messages/zh.json`, `messages/ja.json`, and `messages/pt-BR.json`.
- Textareas must stop Enter key propagation so parent keyboard handlers do not block newlines.
- Avoid `app/api/` routes; `next.config.ts` rewrites `/api`, `/docs`, `/redoc`, and `/openapi.json` to the backend.

## Component Rules
- Keep shared shell work in `components/shell/`; default routes are wrapped by `app/(default)/layout.tsx`.
- Keep the `@fancy` registry in `components.json` before adding or re-adding Fancy components.
- Tailor/Fancy deck contracts include `data-layout="fancy-stacking-cards"`, `role="list"`, `role="listitem"`, and `aria-current="step"`.
- For app shell, dashboard, Tailor, or evaluation changes, run `npm run lint` and `npm run format` before handoff.
