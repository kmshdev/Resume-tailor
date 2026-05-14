# Dashboard Tailor Fancy Stacking Cards Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the dashboard and Tailor experience into a clearer, novice-ready Swiss app shell while using Fancy Components `@fancy/stacking-cards` for the interactive resume-tailoring card deck.

**Architecture:** Keep the existing FastAPI/Next.js product flow intact and focus this pass on frontend composition. Add a shadcn/Fancy registry config, install the Fancy stacking card source component into the app, wrap it behind a local Tailor deck component, then restyle dashboard metrics and Tailor guidance around shared Swiss cards instead of one-off panels.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Vitest/Testing Library, shadcn CLI registry install, Fancy Components Stacking Cards, Motion.

---

## Research Notes

- Fancy Stacking Cards docs: `StackingCards` wraps the animated group and `StackingCardItem` wraps each card; `StackingCards` takes `totalCards`, optional `scaleMultiplier`, optional `scrollOptions`, and `className`; `StackingCardItem` takes `index`, optional `topPosition`, and `className`.
- Fancy Installation docs: Fancy components use React, TypeScript, Tailwind CSS, and Motion; if the project lacks `components.json`, initialize/configure shadcn first; add the registry as `"@fancy": "https://fancycomponents.dev/r/{name}.json"`; extra dependencies may be added to `package.json` but still require `npm install`.
- Context7 shadcn docs: namespaced registries are installed with `npx shadcn@latest add @namespace/component`; dry-runs are supported with `--dry-run`.
- Current repo fact: `apps/frontend` has no `components.json`, and `npx shadcn@latest add @fancy/stacking-cards --dry-run` currently fails with `Unknown registry "@fancy"`.
- Current dirty baseline: the previous diagnostic pass already modified shell, command center, Tailor no-master setup, intake review editing, messages, and tests. Do not revert those changes.

## File Structure

- Create `apps/frontend/components.json`
  - shadcn CLI configuration for this Next.js/Tailwind v4 app.
  - Adds the `@fancy` registry required by `@fancy/stacking-cards`.
- Create via CLI `apps/frontend/components/fancy/stacking-cards.tsx`
  - Source component installed by `npx shadcn@latest add @fancy/stacking-cards`.
  - Do not hand-write this file unless the CLI fails after `components.json` is correct.
- Modify `apps/frontend/package.json`
  - Ensure `motion` is present after the Fancy install.
- Modify `apps/frontend/package-lock.json`
  - Lock any dependency changes from `npm install`.
- Create `apps/frontend/components/tailor/tailor-step-card.tsx`
  - Shared Swiss card presentation for dashboard and Tailor step cards.
- Modify `apps/frontend/components/tailor/tailor-session-cards.tsx`
  - Use Fancy `StackingCards`/`StackingCardItem` for the Tailor route session deck.
- Modify `apps/frontend/components/dashboard/tailor-card-stack.tsx`
  - Use the same shared step card presentation and Fancy stacking behavior for the dashboard “Tailor for a role” deck.
- Modify `apps/frontend/components/evaluation/evaluation-card.tsx`
  - Restyle readiness/pre/post metric cards away from the heavy dark block toward light Swiss cards with a compact score rail.
- Modify `apps/frontend/components/evaluation/evaluation-popover.tsx`
  - Make popover content readable on light Swiss surfaces.
- Modify `apps/frontend/app/(default)/dashboard/page.tsx`
  - Keep the constrained three-column layout but improve section hierarchy and novice copy placement using existing translations.
- Modify `apps/frontend/app/(default)/tailor/page.tsx`
  - Keep the no-master setup state and make it visually consistent with the new Tailor deck.
- Modify `apps/frontend/messages/en.json`, `es.json`, `ja.json`, `pt-BR.json`, `zh.json`
  - Add any new card labels only if the implementation needs visible strings not already present.
- Modify tests:
  - `apps/frontend/tests/tailor-session-cards.test.tsx`
  - `apps/frontend/tests/dashboard-command-center.test.tsx`
  - `apps/frontend/tests/app-shell.test.tsx`
  - `apps/frontend/tests/tailor-page-diagnostics.test.tsx`

## Task 1: Configure shadcn and Install Fancy Stacking Cards

**Files:**
- Create: `apps/frontend/components.json`
- Create via CLI: `apps/frontend/components/fancy/stacking-cards.tsx`
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/package-lock.json`

- [ ] **Step 1: Write the registry config**

Create `apps/frontend/components.json` with this exact content:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/(default)/css/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide",
  "registries": {
    "@fancy": "https://fancycomponents.dev/r/{name}.json"
  }
}
```

- [ ] **Step 2: Verify shadcn sees the project and registry config**

Run from `apps/frontend`:

```bash
npx shadcn@latest info --json
```

Expected: JSON includes `"frameworkName": "next-app"`, `"tailwindVersion": "v4"`, `"tailwindCss": "app/(default)/css/globals.css"`, and no `Unknown registry` error.

- [ ] **Step 3: Dry-run the Fancy install**

Run from `apps/frontend`:

```bash
npx shadcn@latest add @fancy/stacking-cards --dry-run
```

Expected: succeeds and lists files/dependencies to add. It must not print `Unknown registry "@fancy"`.

- [ ] **Step 4: Install the Fancy component source**

Run from `apps/frontend`:

```bash
npx shadcn@latest add @fancy/stacking-cards
```

Expected: creates a Fancy stacking-card source file under `components/fancy/` or another path printed by the CLI. If the CLI chooses a different path, move the file to `apps/frontend/components/fancy/stacking-cards.tsx` and update imports to use `@/components/fancy/stacking-cards`.

- [ ] **Step 5: Install dependencies after the registry add**

Run from `apps/frontend`:

```bash
npm install
```

Expected: `package-lock.json` updates if `motion` was added by the Fancy registry. `apps/frontend/package.json` must contain:

```json
"motion": "^12"
```

The exact patch version may differ; keep the version range produced by npm.

- [ ] **Step 6: Inspect the generated component API**

Open `apps/frontend/components/fancy/stacking-cards.tsx` and confirm it exports both names:

```ts
export { StackingCards, StackingCardItem };
```

If it uses named function exports instead, the import below still must work:

```ts
import { StackingCardItem, StackingCards } from '@/components/fancy/stacking-cards';
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/components.json apps/frontend/components/fancy/stacking-cards.tsx apps/frontend/package.json apps/frontend/package-lock.json
git commit -m "chore: install fancy stacking cards"
```

## Task 2: Add Shared Tailor Step Card Presentation

**Files:**
- Create: `apps/frontend/components/tailor/tailor-step-card.tsx`
- Test: `apps/frontend/tests/tailor-session-cards.test.tsx`

- [ ] **Step 1: Write the failing shared-card behavior test**

Append this test inside the `TailorSessionCards` describe block in `apps/frontend/tests/tailor-session-cards.test.tsx`:

```tsx
it('uses Fancy stacking cards with Swiss step-card state semantics', () => {
  render(
    <TailorSessionCards
      activeStep="tailor"
      completedSteps={['add_job', 'review_jd', 'pre_score']}
      scores={{ pre_score: 74, post_score: 88 }}
      warnings={{ post_score: 'evaluation.errors.checkFailed' }}
    />
  );

  const deck = screen.getByRole('list', { name: 'tailor.session.deckLabel' });
  expect(deck).toHaveAttribute('data-layout', 'fancy-stacking-cards');

  const activeStep = within(deck).getByText('tailor.session.steps.tailor').closest('[role="listitem"]');
  expect(activeStep).toHaveAttribute('aria-current', 'step');
  expect(activeStep).toHaveAttribute('data-state', 'active');

  const completedStep = within(deck).getByText('tailor.session.steps.pre_score').closest('[role="listitem"]');
  expect(completedStep).toHaveAttribute('data-state', 'complete');
  expect(within(completedStep as HTMLElement).getByText('74/100')).toBeInTheDocument();

  const warningStep = within(deck).getByText('tailor.session.steps.post_score').closest('[role="listitem"]');
  expect(warningStep).toHaveAttribute('data-state', 'warning');
  expect(within(warningStep as HTMLElement).getByText('evaluation.errors.checkFailed')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/frontend`:

```bash
npm run test -- tailor-session-cards.test.tsx
```

Expected: FAIL because the deck currently has `data-layout="stacked-deck"` and no Fancy stacking wrapper.

- [ ] **Step 3: Create the shared step card component**

Create `apps/frontend/components/tailor/tailor-step-card.tsx`:

```tsx
'use client';

import React from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import Lock from 'lucide-react/dist/esm/icons/lock';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import FileUp from 'lucide-react/dist/esm/icons/file-up';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TailorStepState = 'active' | 'complete' | 'pending' | 'warning';

interface TailorStepCardProps {
  index: number;
  title: string;
  state: TailorStepState;
  score?: string;
  warning?: string | null;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  actionKind?: 'navigate' | 'upload';
  className?: string;
}

function stateSquareClass(state: TailorStepState): string {
  if (state === 'complete') return 'bg-success';
  if (state === 'active') return 'bg-primary';
  if (state === 'warning') return 'bg-warning';
  return 'bg-white';
}

export function TailorStepCard({
  index,
  title,
  state,
  score,
  warning,
  actionLabel,
  actionHref,
  onAction,
  actionKind = 'navigate',
  className,
}: TailorStepCardProps) {
  const ActionIcon = actionKind === 'upload' ? FileUp : ArrowRight;
  const statusIcon =
    state === 'complete' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Lock aria-hidden="true" className="h-4 w-4" />;

  return (
    <article
      data-state={state}
      className={cn(
        'flex min-h-40 flex-col justify-between border-2 border-black bg-background p-4 shadow-sw-default',
        state === 'active' && 'bg-blue-50 shadow-sw-lg',
        state === 'complete' && 'bg-green-50',
        state === 'warning' && 'bg-orange-50',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('h-3 w-3 border border-black', stateSquareClass(state))} />
            <p className="font-mono text-[11px] uppercase tracking-wider text-steel-grey">
              {String(index + 1).padStart(2, '0')}
            </p>
          </div>
          <h3 className="mt-2 break-words font-serif text-xl font-bold leading-tight">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {score ? (
            <span className="border border-black bg-white px-2 py-1 font-mono text-xs font-bold">
              {score}
            </span>
          ) : (
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center border border-black bg-white">
              {statusIcon}
            </span>
          )}
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={actionLabel}
              title={actionLabel}
              onClick={onAction}
              className="bg-white"
            >
              <ActionIcon aria-hidden="true" className="h-4 w-4" />
            </Button>
          ) : actionLabel && actionHref ? (
            <a
              href={actionHref}
              aria-label={actionLabel}
              title={actionLabel}
              className="inline-flex h-11 w-11 items-center justify-center border border-black bg-white text-black shadow-sw-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              <ActionIcon aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>

      {warning ? (
        <p className="mt-3 border border-orange-500 bg-white px-2 py-1 font-mono text-xs uppercase tracking-wide text-orange-700">
          {warning}
        </p>
      ) : (
        <div className="mt-6 h-4 border-t border-black" aria-hidden="true" />
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run typecheck through the focused test**

Run from `apps/frontend`:

```bash
npm run test -- tailor-session-cards.test.tsx
```

Expected: still FAIL because `TailorSessionCards` does not use `TailorStepCard` or Fancy yet.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/tailor/tailor-step-card.tsx apps/frontend/tests/tailor-session-cards.test.tsx
git commit -m "test: define tailor step card stacking contract"
```

## Task 3: Convert Tailor Session Deck to Fancy Stacking Cards

**Files:**
- Modify: `apps/frontend/components/tailor/tailor-session-cards.tsx`
- Test: `apps/frontend/tests/tailor-session-cards.test.tsx`

- [ ] **Step 1: Replace TailorSessionCards with Fancy-backed deck**

Replace the body of `apps/frontend/components/tailor/tailor-session-cards.tsx` with this structure while preserving exports:

```tsx
'use client';

import React from 'react';
import { StackingCardItem, StackingCards } from '@/components/fancy/stacking-cards';
import { TailorStepCard, type TailorStepState } from '@/components/tailor/tailor-step-card';
import { useTranslations } from '@/lib/i18n';

export const TAILOR_SESSION_STEPS = [
  'add_job',
  'review_jd',
  'pre_score',
  'tailor',
  'review_changes',
  'post_score',
] as const;

export type TailorSessionStep = (typeof TAILOR_SESSION_STEPS)[number];

interface TailorSessionCardsProps {
  activeStep: TailorSessionStep;
  completedSteps?: TailorSessionStep[];
  scores?: Partial<Record<TailorSessionStep, number | null>>;
  warnings?: Partial<Record<TailorSessionStep, string | null>>;
}

function formatScore(value: number): string {
  return `${Math.round(value)}/100`;
}

function getStepState({
  isActive,
  isComplete,
  warning,
}: {
  isActive: boolean;
  isComplete: boolean;
  warning?: string | null;
}): TailorStepState {
  if (warning) return 'warning';
  if (isComplete) return 'complete';
  if (isActive) return 'active';
  return 'pending';
}

export function TailorSessionCards({
  activeStep,
  completedSteps = [],
  scores = {},
  warnings = {},
}: TailorSessionCardsProps) {
  const { t } = useTranslations();
  const completedSet = new Set<TailorSessionStep>(completedSteps);

  return (
    <section aria-label={t('tailor.session.deckLabel')} className="w-full">
      <StackingCards
        role="list"
        aria-label={t('tailor.session.deckLabel')}
        data-layout="fancy-stacking-cards"
        totalCards={TAILOR_SESSION_STEPS.length}
        scaleMultiplier={0.018}
        className="relative flex min-h-[44rem] flex-col gap-4"
      >
        {TAILOR_SESSION_STEPS.map((step, index) => {
          const isActive = step === activeStep;
          const warning = warnings[step];
          const score = scores[step];
          const state = getStepState({
            isActive,
            isComplete: completedSet.has(step),
            warning,
          });

          return (
            <StackingCardItem
              key={step}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              data-state={state}
              index={index}
              topPosition={`${5 + index * 2}rem`}
              className="min-h-40"
            >
              <TailorStepCard
                index={index}
                title={t(`tailor.session.steps.${step}`)}
                state={state}
                score={typeof score === 'number' ? formatScore(score) : undefined}
                warning={warning}
              />
            </StackingCardItem>
          );
        })}
      </StackingCards>
    </section>
  );
}
```

- [ ] **Step 2: Run focused Tailor deck test**

Run from `apps/frontend`:

```bash
npm run test -- tailor-session-cards.test.tsx
```

Expected: PASS. The implementation relies only on the HTML div props documented for `StackingCards` and `StackingCardItem`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/tailor/tailor-session-cards.tsx apps/frontend/tests/tailor-session-cards.test.tsx
git commit -m "feat: use fancy stacking cards for tailor session deck"
```

## Task 4: Convert Dashboard Tailor Deck to the Same Fancy Card System

**Files:**
- Modify: `apps/frontend/components/dashboard/tailor-card-stack.tsx`
- Test: `apps/frontend/tests/dashboard-command-center.test.tsx`

- [ ] **Step 1: Write the failing dashboard deck test**

Append this test inside the `TailorCardStack` describe block in `apps/frontend/tests/dashboard-command-center.test.tsx`:

```tsx
it('uses Fancy stacking cards for the dashboard tailoring deck', () => {
  const onUploadMaster = vi.fn();
  const { container } = render(
    <TailorCardStack
      hasMasterResume={false}
      canUploadMaster
      canTailor={false}
      hasTailoredResume={false}
      onUploadMaster={onUploadMaster}
    />
  );

  const deck = container.querySelector('[data-layout="fancy-stacking-cards"]');
  expect(deck).toBeInTheDocument();

  const cards = Array.from(container.querySelectorAll('article'));
  expect(cards).toHaveLength(4);
  expect(cards[0]).toHaveAttribute('data-state', 'active');
  expect(cards[1]).toHaveAttribute('data-state', 'pending');

  fireEvent.click(screen.getByRole('button', { name: 'dashboard.cardStack.masterResume' }));
  expect(onUploadMaster).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/frontend`:

```bash
npm run test -- dashboard-command-center.test.tsx
```

Expected: FAIL because `TailorCardStack` currently uses absolute-positioned articles, not Fancy stacking cards.

- [ ] **Step 3: Rewrite TailorCardStack using the shared card**

Replace `apps/frontend/components/dashboard/tailor-card-stack.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { StackingCardItem, StackingCards } from '@/components/fancy/stacking-cards';
import {
  TailorStepCard,
  type TailorStepState,
} from '@/components/tailor/tailor-step-card';
import { useTranslations } from '@/lib/i18n';

interface TailorCardStackProps {
  hasMasterResume: boolean;
  canUploadMaster: boolean;
  canTailor: boolean;
  hasTailoredResume: boolean;
  onUploadMaster: () => void;
}

type StackCard = {
  key: 'masterResume' | 'jobIntake' | 'tailorFlow' | 'reviewLift';
  state: TailorStepState;
  actionHref?: string;
  actionKind?: 'navigate' | 'upload';
  onAction?: () => void;
};

export function TailorCardStack({
  hasMasterResume,
  canUploadMaster,
  canTailor,
  hasTailoredResume,
  onUploadMaster,
}: TailorCardStackProps) {
  const { t } = useTranslations();
  const cards: StackCard[] = [
    {
      key: 'masterResume',
      state: hasMasterResume ? 'complete' : 'active',
      actionKind: !hasMasterResume && canUploadMaster ? 'upload' : undefined,
      onAction: !hasMasterResume && canUploadMaster ? onUploadMaster : undefined,
    },
    {
      key: 'jobIntake',
      state: canTailor || hasTailoredResume ? 'active' : 'pending',
      actionHref: canTailor ? '/tailor' : undefined,
    },
    {
      key: 'tailorFlow',
      state: hasTailoredResume ? 'complete' : 'pending',
      actionHref: canTailor ? '/tailor' : undefined,
    },
    {
      key: 'reviewLift',
      state: hasTailoredResume ? 'complete' : 'pending',
      actionHref: hasTailoredResume ? '/dashboard' : undefined,
    },
  ];

  return (
    <div className="relative min-h-[32rem] overflow-hidden p-4">
      <StackingCards
        data-layout="fancy-stacking-cards"
        totalCards={cards.length}
        scaleMultiplier={0.02}
        className="relative flex min-h-[30rem] flex-col gap-4"
      >
        {cards.map((card, index) => {
          const label = t(`dashboard.cardStack.${card.key}`);
          return (
            <StackingCardItem
              key={card.key}
              index={index}
              topPosition={`${2 + index * 3.25}rem`}
              className="min-h-40"
            >
              <TailorStepCard
                index={index}
                title={label}
                state={card.state}
                actionLabel={card.actionHref || card.onAction ? label : undefined}
                actionHref={card.actionHref}
                actionKind={card.actionKind}
                onAction={card.onAction}
              />
            </StackingCardItem>
          );
        })}
      </StackingCards>
      {hasMasterResume && canTailor ? (
        <Link
          href="/tailor"
          className="mt-4 inline-flex w-full justify-center border-2 border-black bg-primary px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-sw-default hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          {t('dashboard.tailorCta')}
        </Link>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run focused dashboard tests**

Run from `apps/frontend`:

```bash
npm run test -- dashboard-command-center.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/dashboard/tailor-card-stack.tsx apps/frontend/tests/dashboard-command-center.test.tsx
git commit -m "feat: use fancy stacking cards on dashboard tailor deck"
```

## Task 5: Lighten Evaluation Metrics and Popover Surfaces

**Files:**
- Modify: `apps/frontend/components/evaluation/evaluation-card.tsx`
- Modify: `apps/frontend/components/evaluation/evaluation-popover.tsx`
- Test: `apps/frontend/tests/dashboard-command-center.test.tsx`

- [ ] **Step 1: Write failing metric-surface tests**

Add this test inside the `EvaluationCard` describe block:

```tsx
it('uses light Swiss metric surfaces instead of dark metric blocks', () => {
  render(<EvaluationCard phase="readiness" evaluation={baseEvaluation} />);

  const card = screen.getByText('evaluation.phases.readiness').closest('article');
  expect(card).toHaveClass('bg-background');
  expect(card).toHaveClass('text-black');
  expect(card?.className).not.toContain('bg-[#10131A]');
  expect(card?.className).not.toContain('text-white');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/frontend`:

```bash
npm run test -- dashboard-command-center.test.tsx
```

Expected: FAIL because `EvaluationCard` still uses `bg-[#10131A] text-white`.

- [ ] **Step 3: Restyle EvaluationCard**

In `apps/frontend/components/evaluation/evaluation-card.tsx`, replace the `article` classes and light/dark text classes:

```tsx
<article
  className={cn(
    'flex min-h-52 flex-col border-2 border-black bg-background p-5 text-black',
    'shadow-sw-default'
  )}
>
```

Replace the phase label class:

```tsx
className="font-mono text-xs font-bold uppercase tracking-wide text-steel-grey"
```

Replace the score class block:

```tsx
className={cn('font-serif text-5xl font-bold leading-none', !scoreAvailable && 'text-steel-grey')}
```

Replace the status row class:

```tsx
className="flex min-h-5 items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-soft"
```

Replace the error paragraph class:

```tsx
className="font-mono text-xs uppercase tracking-wide text-red-600"
```

Keep the action button behavior unchanged.

- [ ] **Step 4: Restyle EvaluationPopover for light surfaces**

In `apps/frontend/components/evaluation/evaluation-popover.tsx`, replace all white-on-dark classes:

```tsx
className="font-mono text-xs uppercase tracking-wide text-ink-soft"
```

Replace the error panel:

```tsx
<div className="border border-red-600 bg-red-50 p-3 font-mono text-xs uppercase tracking-wide text-red-700">
  {error}
</div>
```

Replace stale panel:

```tsx
<div className="border border-orange-500 bg-orange-50 p-3 font-mono text-xs uppercase tracking-wide text-orange-700">
  {t('evaluation.states.stale')}
</div>
```

Replace dimension rows:

```tsx
className="grid grid-cols-[1fr_auto] gap-4 border-t border-black pt-2"
```

Replace dimension label:

```tsx
className="font-mono text-xs uppercase tracking-wide text-ink-soft"
```

Replace dimension score:

```tsx
className="font-mono text-xs font-bold text-black"
```

Replace provider footer:

```tsx
className="border-t border-black pt-3 font-mono text-[11px] uppercase tracking-wide text-ink-soft"
```

- [ ] **Step 5: Run dashboard tests**

Run from `apps/frontend`:

```bash
npm run test -- dashboard-command-center.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/evaluation/evaluation-card.tsx apps/frontend/components/evaluation/evaluation-popover.tsx apps/frontend/tests/dashboard-command-center.test.tsx
git commit -m "style: lighten dashboard evaluation cards"
```

## Task 6: Tighten Tailor No-Master Setup State and Page Hierarchy

**Files:**
- Modify: `apps/frontend/app/(default)/tailor/page.tsx`
- Test: `apps/frontend/tests/tailor-page-diagnostics.test.tsx`

- [ ] **Step 1: Add setup-state semantic test**

Extend `apps/frontend/tests/tailor-page-diagnostics.test.tsx`:

```tsx
it('presents the no-master setup state as a named novice guidance region', async () => {
  render(<TailorPage />);

  const setupRegion = await screen.findByRole('region', { name: 'dashboard.initializeMasterResume' });
  expect(setupRegion).toHaveAttribute('data-state', 'needs-master-resume');
  expect(within(setupRegion).getByRole('link', { name: 'dashboard.guided.resume.action' })).toHaveAttribute('href', '/dashboard');
  expect(routerPushMock).not.toHaveBeenCalledWith('/dashboard');
});
```

Add this import if missing:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/frontend`:

```bash
npm run test -- tailor-page-diagnostics.test.tsx
```

Expected: FAIL because the setup card is not a named region and lacks `data-state`.

- [ ] **Step 3: Update Tailor no-master markup**

In `apps/frontend/app/(default)/tailor/page.tsx`, replace the no-master setup wrapper with:

```tsx
<section
  aria-label={t('dashboard.initializeMasterResume')}
  data-state="needs-master-resume"
  className="border-2 border-orange-500 bg-orange-50 p-6 shadow-sw-default"
>
  <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
    <div className="h-4 w-4 bg-orange-500" aria-hidden="true" />
    <div className="min-w-0">
      <p className="font-mono text-sm font-bold uppercase tracking-wider text-orange-700">
        {t('dashboard.initializeSequence')}
      </p>
      <h2 className="mt-2 font-serif text-3xl font-bold uppercase text-black">
        {t('dashboard.initializeMasterResume')}
      </h2>
      <p className="mt-3 max-w-2xl font-sans text-base text-black">
        {t('dashboard.guided.resume.description')}
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex border-2 border-black bg-white px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider text-black shadow-sw-default hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
      >
        {t('dashboard.guided.resume.action')}
      </Link>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Run focused Tailor test**

Run from `apps/frontend`:

```bash
npm run test -- tailor-page-diagnostics.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'apps/frontend/app/(default)/tailor/page.tsx' apps/frontend/tests/tailor-page-diagnostics.test.tsx
git commit -m "style: clarify tailor setup state"
```

## Task 7: Browser Visual QA and Final Verification

**Files:**
- Modify only files needed to fix issues found by verification.

- [ ] **Step 1: Run all frontend checks**

Run from `apps/frontend`:

```bash
npm run lint
npm run format
npm run test
npm run build
```

Expected:

```text
eslint exits 0
prettier exits 0
Vitest reports all tests passing
next build compiles successfully
```

- [ ] **Step 2: Run diff whitespace check**

Run from repo root:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 3: Start local servers if not already running**

Backend:

```bash
cd apps/backend
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd apps/frontend
npm run dev
```

Expected:

```text
Uvicorn running on http://127.0.0.1:8000
Next.js ready on http://localhost:3000
```

- [ ] **Step 4: Browser smoke the dashboard**

Open `http://localhost:3000/dashboard`.

Expected visible checks:

- The app canvas is light `#F0F0E8`, not a dark page frame.
- The command center has three metric cards across the top.
- Metric cards are light Swiss cards, not dark blocks.
- The Tailor deck visibly stacks cards and keeps the upload action reachable.
- No console errors unrelated to intentional backend configuration.

- [ ] **Step 5: Browser smoke the Tailor route**

Open `http://localhost:3000/tailor` with `localStorage.master_resume_id` cleared.

Expected visible checks:

- The URL remains `/tailor`; it does not redirect to `/dashboard`.
- The left session deck uses the Fancy stacking-card interaction.
- The no-master setup panel is named and visible with an Upload Resume CTA.
- Text does not overflow card boundaries at 1280px and 390px widths.

- [ ] **Step 6: Mobile responsive check**

Use the browser viewport tool or Playwright to inspect:

```text
390x844
768x1024
1440x900
```

Expected:

- Dashboard metrics stack on mobile and become three columns on desktop.
- Stacking cards remain readable and actionable on mobile.
- No nested card-in-card composition creates unclear boundaries.
- The page uses solid borders and hard shadows only.

- [ ] **Step 7: Commit final verification adjustments**

If any verification fixes were needed:

```bash
git add apps/frontend
git commit -m "fix: polish stacking card refinement"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage:
  - Uses Fancy Components `@fancy/stacking-cards`: Task 1 installs it and Tasks 3-4 integrate it.
  - Interactive resume tailoring cards: Tasks 3-4 replace current manual stacks with Fancy stacking cards on Tailor and Dashboard.
  - Novice-ready dashboard/Tailor refinement: Tasks 4-6 improve action hierarchy, setup state, and metric readability.
  - Current repo stack: plan targets Next.js 16, React 19, Tailwind v4, Vitest, shadcn CLI, and existing message/i18n files.
  - Verification: Task 7 includes lint, format, test, build, diff check, and browser QA.
- Placeholder scan:
  - No `TBD`, `TODO`, or unspecified “add validation” instructions remain.
  - Each code-changing task includes concrete snippets and exact commands.
- Type consistency:
  - `TailorStepState`, `TailorStepCard`, `TAILOR_SESSION_STEPS`, and `TailorSessionStep` are defined before use.
  - `StackingCards` and `StackingCardItem` import names match Fancy docs and the required post-install inspection.
