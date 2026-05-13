# Full App Shell Redesign And Resume Evaluation Design

Date: 2026-05-13

## Summary

Redesign Resume Matcher into a cohesive app shell with a novice-ready dashboard, guided tailoring session, compact settings access, and real resume evaluation scores produced by the configured LLM provider. The redesign keeps existing core routes and tailoring APIs working while adding a new structured backend evaluation feature for resume readiness, pre-tailor fit, and post-tailor lift.

The app should feel more marketable and easier to understand, but it must stay honest: dashboard score cards display stored model evaluations only. When an evaluation has not been run, the UI shows a clear empty state and action instead of invented metrics.

## References And Direction

- Dashboard layout inspiration: constrained three-column command-center references supplied by the user.
- Card language inspiration: overlapping tilted card reference supplied by the user.
- External references:
  - Torph: https://torph.lochie.me/
  - DialKit: https://joshpuckett.me/dialkit
  - Fancy Components stacking cards: https://www.fancycomponents.dev/docs/components/blocks/stacking-cards

Use these references for layout rhythm, card motion, popover density, and product polish. Do not copy their branding, content, or component code directly.

### Reference Mapping

- Screenshot 1 defines the dashboard container model: dark bounded shell, visible top chrome/header, internal grid dividers, two large stacked left work areas, a tall right rail, and dashed or hatched empty-state placeholders.
- Screenshot 2 defines the metric band: dark full-width row, oversized numeric values, muted metric labels, vertical separators, and compact trend/lift deltas in the upper-right of each metric cell.
- Screenshot 3 defines the expressive card language: overlapping tilted cards on a black field, bold color blocks, layered depth, and a tactile editorial feel.
- Torph informs subtle text/number morphing, tasteful transitions, and polished product personality.
- DialKit informs compact dense floating controls, settings popovers, modal ergonomics, and crisp interaction states.
- Fancy Components stacking cards informs layered card progression with scroll or step-based scale/stack motion.

## Goals

- Create a shared app shell across dashboard, tailor, builder, and settings.
- Add breadcrumbs and route tabs so users always know where they are.
- Make the dashboard a command center with clear context separation.
- Convert tailoring into a guided card-stack workflow.
- Add compact settings and model status surfaces through modals and popovers.
- Add real backend LLM evaluation endpoints with structured output and TinyDB storage.
- Show readiness, pre-tailor, and post-tailor scores from stored evaluation records.
- Preserve existing resume upload, JD intake, preview diff, confirm, builder, print, and settings flows.

## Non-Goals

- Do not replace TinyDB in this pass.
- Do not redesign the internal resume editor forms beyond shell integration and visual consistency.
- Do not use authenticated page scraping, inbox access, browser profiles, or user cookies.
- Do not show fake dashboard metrics or hardcoded evaluation scores.
- Do not store full LLM prompts, raw LLM transcripts, or unnecessary scraped raw text.

## Product Scope

The V1 redesign covers the main novice journey:

1. Dashboard as the home command center.
2. Tailor as an interactive session.
3. Builder wrapped in the new shell while keeping its editor behavior stable.
4. Settings as both a full route and a compact modal for common provider/config checks.
5. Backend evaluation as a persistent analytics layer that dashboard and tailor can both consume.

## App Shell

The global shell appears around the main authenticated-style product routes:

- `/dashboard`
- `/tailor`
- `/builder`
- `/resumes/[id]`
- `/settings`

Shell elements:

- Breadcrumbs such as `Home / Dashboard`, `Home / Tailor / Review JD`, and `Home / Resumes / Edited Resume`.
- Top route tabs: `Dashboard`, `Tailor`, `Builder`, `Settings`.
- Model status indicator with healthy, setup required, unhealthy, and checking states.
- Compact settings modal trigger.
- Help/privacy disclosure trigger.

Dashboard and tailor use a dark command-center chrome. Resume editing and preview surfaces keep a calmer light document canvas inside that shell so the resume content stays central and readable.

## Dashboard Design

The dashboard becomes a constrained three-column command center.

Container model:

- The dashboard sits inside a bounded dark shell with a visible 1px border and internal dividers.
- The shell has a dedicated top chrome/header band for navigation, status, and account/settings controls.
- The main grid uses a wide two-column work area on the left and a persistent tall right rail.
- The left work area contains two stacked panels: a shorter top context/evaluation panel and a larger bottom workflow panel.
- The right rail runs the full height of the main dashboard region and contains activity, recommendations, and latest tailored resumes.
- Empty states use dashed or subtly hatched placeholders so “nothing here yet” still feels intentional and structured.

Top region:

- Breadcrumb row.
- Page heading and primary action.
- Model/config status.
- Compact settings modal trigger.

Metric row:

- Resume readiness.
- Pre-tailor match.
- Post-tailor lift.

Metric visual treatment:

- Metrics sit in a dark full-width band directly below the top chrome/header.
- Each metric cell uses muted labels, oversized stat typography, and a compact upper-right trend indicator.
- Vertical dividers separate metric cells.
- Trend/lift deltas appear only when backed by stored baseline/current evaluations.
- Missing or stale metrics preserve the same cell dimensions so the layout does not jump.

Metric behavior:

- If a stored score exists and is current, show score, confidence, phase, and last evaluated time.
- If missing, show `Not checked yet` and an action.
- If stale, show the last score with a stale marker and refresh action.
- Each metric has a popover with dimensions, evidence summary, model/provider, prompt version, and confidence.

Main dashboard zones:

- Left column: resume context, master resume state, setup progress, and privacy disclosure.
- Middle column: interactive tailoring session card stack with next action.
- Right column: latest tailored resumes, evaluation activity, and recommendations.

## Tailor Session Design

Tailoring becomes a card-stack workflow while preserving the existing backend flow.

Cards:

1. Add job.
2. Review extracted JD.
3. Check fit.
4. Tailor resume.
5. Review changes.
6. Save final.

Card behavior:

- The active card is visually dominant.
- Completed cards compress into the stack with status and score badges.
- Cards can flip between a concise front and a detailed back.
- Flips expose extracted questions, evidence, warnings, score breakdowns, or diff details.
- Reduced-motion users receive instant state transitions without 3D flip animation.

Card geometry:

- The dashboard card stack uses the Screenshot 3 language: overlapping cards, slight rotation, visible layered depth, and selective bold color blocks.
- Rotation is decorative and bounded to avoid reducing readability.
- The tailor route uses a more functional stacked deck: active card at full scale, previous/next cards partially visible behind it, and progress controlled by clicks or completed workflow steps.
- Scroll-scaled stacking may be used for supporting sections, but the primary tailor workflow is step-based so users do not accidentally skip required review actions.
- Flip is required for cards with meaningful detail states and optional for cards that only contain a single action.
- Card colors must be tokenized and varied; avoid making the stack a one-color palette.

The existing `previewImproveResume -> diff modal -> confirmImproveResume` flow remains intact. The visual treatment changes, but the confirmation semantics remain review-first.

## Settings, Disclosures, And Popovers

Settings modal:

- Shows active provider/model.
- Shows LLM health and setup state.
- Links to full settings.
- Exposes common feature toggles only when they already exist in current config.

Disclosures:

- `How scores are calculated`.
- `What data is used`.
- `Why this recommendation appeared`.
- `What happens when I tailor`.

Popovers:

- Metric detail popovers show dimensions and confidence.
- Job source popovers show intake method, redacted source URL, extracted links, questions, and warnings.
- Model status popover shows provider health and last check.

These surfaces should reveal detail on demand. The primary UI should stay action-oriented and beginner-friendly.

## Backend Evaluation Domain

Add an evaluation domain parallel to `job_intake` and `improver`.

New files:

- `apps/backend/app/schemas/evaluation.py`
- `apps/backend/app/prompts/evaluation.py`
- `apps/backend/app/services/evaluation.py`
- `apps/backend/app/routers/evaluations.py`

Register the router in `apps/backend/app/main.py`. Export evaluation schemas from `apps/backend/app/schemas/__init__.py` only for models consumed across modules or by tests.

### Evaluation Phases

Supported phases:

- `readiness`: resume quality without a specific job.
- `pre_tailor`: master or selected resume evaluated against a reviewed JD.
- `post_tailor`: tailored resume evaluated against the same JD.

### API Surface

```text
POST /api/v1/resumes/{resume_id}/evaluations
GET  /api/v1/resumes/{resume_id}/evaluations
GET  /api/v1/resumes/{resume_id}/evaluations/latest
```

Request:

```json
{
  "phase": "readiness",
  "job_id": null,
  "baseline_resume_id": null,
  "force_refresh": false
}
```

Rules:

- `readiness` does not require `job_id`.
- `pre_tailor` requires `job_id`.
- `post_tailor` requires `job_id` and may include `baseline_resume_id` for lift calculations.
- The service returns a cached matching evaluation unless `force_refresh` is true.

### Structured Response

```json
{
  "evaluation_id": "uuid",
  "resume_id": "uuid",
  "baseline_resume_id": null,
  "job_id": "uuid",
  "phase": "pre_tailor",
  "overall_score": 82,
  "confidence": 0.74,
  "dimensions": {
    "clarity": 80,
    "impact": 76,
    "ats_readability": 88,
    "keyword_alignment": 72,
    "role_fit": 79,
    "evidence_strength": 84
  },
  "strengths": [],
  "gaps": [],
  "next_actions": [],
  "model": "configured-model",
  "provider": "configured-provider",
  "prompt_version": "resume_evaluation_v1",
  "source_hash": "hash",
  "created_at": "iso-8601",
  "stale": false
}
```

### Storage

Add an `evaluations` TinyDB table.

Database methods:

- `create_evaluation(payload)`
- `list_evaluations(resume_id, phase=None, job_id=None)`
- `get_latest_evaluation(resume_id, phase=None, job_id=None)`
- `get_evaluation_by_source_hash(source_hash)`

Evaluation records store structured scores, bounded evidence snippets, recommendations, model/provider metadata, prompt version, source hash, and timestamps.

## Evaluation Prompt Contract

The prompt must instruct the model to:

- Score only from the supplied resume and optional JD.
- Return only JSON matching the requested schema.
- Use explicit absence when evidence is missing.
- Include bounded evidence snippets for strengths and gaps.
- Avoid inventing employers, metrics, skills, responsibilities, or credentials.
- Provide recommendations that improve positioning without fabricating experience.

The service validates the result after `complete_json()`:

- Clamp numeric scores to expected ranges.
- Drop malformed strengths, gaps, and next actions.
- Require every strength and gap to include an evidence source or explicit absence.
- Normalize unknown dimensions to the supported rubric.
- Store warnings when output is usable but incomplete.

## Evaluation Data Flow

Dashboard:

1. Load master resume and latest tailored resume list.
2. Load latest evaluations for readiness, pre-tailor, and post-tailor.
3. Render score, missing, stale, evaluating, or error states.
4. Trigger evaluation only when the user requests it or a tailor step needs it.

Tailor:

1. User confirms reviewed JD intake.
2. Pre-tailor evaluation runs against selected resume plus JD.
3. User previews and confirms tailored resume.
4. Post-tailor evaluation runs against tailored resume plus same JD.
5. Dashboard computes lift from stored pre/post scores.

Caching:

- Build `source_hash` from phase, resume content or processed data, job content if present, baseline resume id if present, and prompt version.
- Reuse matching records unless `force_refresh` is true.
- Mark records stale when the current source hash no longer matches the latest stored evaluation.

## Frontend Integration

Add evaluation API helpers in the frontend API layer:

- `createResumeEvaluation(resumeId, request)`
- `fetchResumeEvaluations(resumeId, filters)`
- `fetchLatestResumeEvaluations(resumeId, filters)`

Dashboard state:

- Load evaluations independently from resumes so the dashboard can still render when evaluation fails.
- Treat `not found`, `stale`, `loading`, and `error` as first-class visual states.
- Avoid blocking upload and tailoring actions on evaluation availability.

Tailor state:

- Run pre-tailor evaluation after JD confirm.
- Run post-tailor evaluation after final tailored resume creation.
- If evaluation fails, preserve the tailored resume result and show a retry action.

## i18n And Copy

Add copy for all supported message files:

- Evaluation phases.
- Score states.
- Confidence and stale labels.
- Disclosures.
- Settings modal.
- Card front/back labels.
- Error and retry states.

Copy should favor outcome language:

- `Check my resume`.
- `Match this job`.
- `Review changes`.
- `Save tailored resume`.
- `Score not checked yet`.

## Error Handling

Backend:

- Missing resume: `404`.
- Missing required job for pre/post evaluation: `400`.
- Missing LLM config: user-safe `400`.
- Configured but unhealthy LLM provider: user-safe `503`.
- Malformed LLM output: log details server-side; return a safe retryable error.
- Unexpected failures: log detailed error server-side and return a generic message.

Frontend:

- Dashboard still loads without evaluation data.
- Score cards show retry actions on failed evaluation.
- Tailor confirm remains successful even if post-tailor evaluation fails.
- Settings modal guides users to configure a model when needed.

## Accessibility And Motion

- Breadcrumbs and tabs use semantic navigation.
- Modals trap focus and close with Escape.
- Popovers are keyboard reachable.
- Disclosure controls expose expanded state.
- Card flipping respects `prefers-reduced-motion`.
- Score colors are accompanied by text labels.
- Text must not overlap or truncate inside buttons, cards, tabs, or metric panels.

## Testing

Backend unit tests:

- Evaluation schema validation.
- Score clamping and malformed LLM output cleanup.
- Missing resume/job handling.
- Source hash caching and stale detection.
- Evidence-only validation rules.
- Prompt output contract parsing.

Backend integration tests:

- Create readiness evaluation.
- Create pre-tailor evaluation with job.
- Create post-tailor evaluation with baseline resume.
- List evaluations.
- Fetch latest evaluations.
- Cached response behavior.
- Safe errors for missing config, missing job, and missing resume.

Frontend tests:

- Dashboard missing score states.
- Dashboard stale score states.
- Dashboard evaluating and error states.
- Metric popovers.
- Settings modal open/close.
- Route tabs and breadcrumbs.
- Tailor card stack state transitions.
- Pre/post evaluation handoff.

Browser QA:

- Dashboard desktop and mobile.
- Screenshot 1 fidelity: bounded dark shell, top chrome, internal dividers, stacked left panels, tall right rail, and intentional empty-state placeholders.
- Screenshot 2 fidelity: full-width metric band, oversized values, muted labels, separators, and evidence-backed deltas.
- Screenshot 3 fidelity: overlapping tilted card language where card stacks are decorative or workflow-oriented.
- Reference fidelity: compact popovers/settings controls in the DialKit spirit, subtle motion in the Torph spirit, and layered card motion in the Fancy Components spirit.
- Tailor card workflow.
- Builder inside shell.
- Settings route and settings modal.
- Reduced-motion behavior.
- Deployed Railway smoke check after implementation.

Verification commands:

```bash
cd apps/backend && uv run pytest
cd apps/frontend && npm run format
cd apps/frontend && npm run lint
cd apps/frontend && npm run test
cd apps/frontend && npm run build
git diff --check
```

## Rollout Plan

Implementation should proceed in this order:

1. Add backend evaluation schemas, prompt, service, router, and TinyDB methods.
2. Add backend tests for evaluation behavior.
3. Add frontend evaluation API helpers and types.
4. Build shared app shell components.
5. Wrap dashboard, tailor, builder, and settings in the shell.
6. Rebuild dashboard command center with real evaluation states.
7. Convert tailor to the card-stack workflow while preserving the preview/confirm flow.
8. Add modal, popover, disclosure, and transition polish.
9. Add i18n copy and frontend tests.
10. Run full verification and browser QA.

## Acceptance Criteria

- Dashboard, tailor, builder, and settings share a coherent shell.
- Dashboard uses breadcrumbs, tabs, compact settings, metric popovers, clear context zones, and the bounded three-column visual anatomy from the supplied dashboard reference.
- Dashboard metric cards match the supplied metric-band reference while showing only stored, evidence-backed scores and deltas.
- Tailor presents the workflow as an interactive card stack with explicit overlap, depth, bounded rotation, and readable flip/detail states.
- Readiness, pre-tailor, and post-tailor scores are produced by the backend LLM evaluation endpoint.
- Evaluation results are stored in TinyDB and reused when source hashes match.
- No fake scores appear in the UI.
- Evaluation failures are recoverable and do not block unrelated workflows.
- Existing upload, JD intake, preview, confirm, builder, print, and settings flows keep working.
- Tests and browser QA cover the new trust boundaries and primary user journey.
