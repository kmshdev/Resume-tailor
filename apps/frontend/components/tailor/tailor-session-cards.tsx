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
