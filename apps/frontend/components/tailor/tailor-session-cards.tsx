'use client';

import React from 'react';
import { cn } from '@/lib/utils';
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

const STEP_OFFSET_CLASSES = ['md:ml-0', 'md:ml-2', 'md:ml-4', 'md:ml-6', 'md:ml-8', 'md:ml-10'];

interface TailorSessionCardsProps {
  activeStep: TailorSessionStep;
  completedSteps?: TailorSessionStep[];
  scores?: Partial<Record<TailorSessionStep, number | null>>;
  warnings?: Partial<Record<TailorSessionStep, string | null>>;
}

function formatScore(value: number): string {
  return `${Math.round(value)}/100`;
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
      <ul
        role="list"
        aria-label={t('tailor.session.deckLabel')}
        data-layout="stacked-deck"
        className="grid gap-3"
      >
        {TAILOR_SESSION_STEPS.map((step, index) => {
          const isActive = step === activeStep;
          const isComplete = completedSet.has(step);
          const warning = warnings[step];
          const score = scores[step];
          const state = isComplete ? 'complete' : isActive ? 'active' : 'pending';

          return (
            <li
              key={step}
              aria-current={isActive ? 'step' : undefined}
              data-state={state}
              className={cn(
                'relative min-h-20 border-2 border-black bg-white p-4 shadow-sw-default',
                'flex flex-col justify-between gap-3 overflow-hidden',
                STEP_OFFSET_CLASSES[index],
                isActive && 'bg-blue-50 shadow-sw-lg',
                isComplete && 'bg-green-50',
                warning && 'bg-amber-50'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 h-3 w-3 shrink-0 border border-black bg-white',
                      isActive && 'bg-blue-700',
                      isComplete && 'bg-green-700',
                      warning && 'bg-orange-500'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-steel-grey">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <p className="break-words font-serif text-xl font-bold leading-tight">
                      {t(`tailor.session.steps.${step}`)}
                    </p>
                  </div>
                </div>

                {typeof score === 'number' && (
                  <span className="shrink-0 border border-black bg-white px-2 py-1 font-mono text-xs font-bold">
                    {formatScore(score)}
                  </span>
                )}
              </div>

              {warning && (
                <p className="border border-orange-500 bg-white px-2 py-1 font-mono text-xs text-orange-700">
                  {warning}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
