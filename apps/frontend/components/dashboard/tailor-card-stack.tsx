'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { StackingCardItem, StackingCards } from '@/components/fancy/stacking-cards';
import {
  OnboardingBreathingText,
  OnboardingCutReveal,
} from '@/components/dashboard/onboarding/onboarding-motion';
import { TailorStepCard, type TailorStepState } from '@/components/tailor/tailor-step-card';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type DashboardWorkflowStep = 'uploadResume' | 'reviewResume' | 'tailorRole' | 'reviewLift';

interface TailorCardStackProps {
  activeStep: DashboardWorkflowStep;
  hasMasterResume: boolean;
  canUploadMaster: boolean;
  canTailor: boolean;
  hasTailoredResume: boolean;
  onUploadMaster: () => void;
  onContinueToTailorStep: () => void;
  resumeContent?: ReactNode;
  readinessContent?: ReactNode;
  tailoredContent?: ReactNode;
  disabledReason?: string | null;
  processingStatusText?: string;
  tailoredCount?: number;
}

type StackCard = {
  key: DashboardWorkflowStep;
  index: number;
  state: TailorStepState;
  title: string;
  description: string;
};

const STEP_ORDER: DashboardWorkflowStep[] = [
  'uploadResume',
  'reviewResume',
  'tailorRole',
  'reviewLift',
];

function getState({
  card,
  activeStep,
  hasMasterResume,
  hasTailoredResume,
}: {
  card: DashboardWorkflowStep;
  activeStep: DashboardWorkflowStep;
  hasMasterResume: boolean;
  hasTailoredResume: boolean;
}): TailorStepState {
  if (card === activeStep) return 'active';
  if (card === 'uploadResume' && hasMasterResume) return 'complete';
  if (card === 'reviewResume' && STEP_ORDER.indexOf(activeStep) > 1) return 'complete';
  if (card === 'tailorRole' && hasTailoredResume) return 'complete';
  return 'pending';
}

function CollapsedCard({
  card,
  isRevealed,
}: {
  card: StackCard & { isCurrent: boolean };
  isRevealed: boolean;
}) {
  return (
    <article
      aria-label={isRevealed ? card.title : `Step ${card.index + 1}`}
      data-state={card.state}
      className={cn(
        't-resize flex min-h-20 items-center justify-between border-2 border-black bg-background p-4 shadow-sw-sm',
        card.state === 'complete' && 'bg-green-50',
        card.state === 'pending' && 'bg-white'
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'h-3 w-3 border border-black',
            card.state === 'complete' ? 'bg-green-700' : 'bg-white'
          )}
        />
        <span className="font-mono text-[11px] uppercase tracking-wider text-steel-grey">
          {String(card.index + 1).padStart(2, '0')}
        </span>
      </div>
      {isRevealed ? (
        <p className="max-w-[14rem] truncate font-mono text-xs font-bold uppercase tracking-wider text-black">
          {card.title}
        </p>
      ) : (
        <span className="h-px w-24 bg-black" aria-hidden="true" />
      )}
    </article>
  );
}

export function TailorCardStack({
  activeStep,
  hasMasterResume,
  canUploadMaster,
  canTailor,
  hasTailoredResume,
  onUploadMaster,
  onContinueToTailorStep,
  resumeContent,
  readinessContent,
  tailoredContent,
  disabledReason,
  processingStatusText,
  tailoredCount = 0,
}: TailorCardStackProps) {
  const { t } = useTranslations();
  const prefersReducedMotion = useReducedMotion();
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const deckLabel = t('dashboard.workflow.ariaLabel');
  const cards: StackCard[] = STEP_ORDER.map((key, index) => ({
    key,
    index,
    state: getState({ card: key, activeStep, hasMasterResume, hasTailoredResume }),
    title: t(`dashboard.workflow.${key}.title`),
    description: t(`dashboard.workflow.${key}.description`),
  }));
  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const visibleCards = cards.filter((card) => card.index <= activeIndex);

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof activeCardRef.current?.scrollIntoView !== 'function') return;
    activeCardRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  }, [activeStep, prefersReducedMotion]);

  const renderActiveContent = (card: StackCard) => {
    if (card.key === 'uploadResume') {
      return (
        <OnboardingCutReveal
          aria-label={t('dashboard.onboarding.ariaLabel')}
          data-testid="dashboard-onboarding-deck"
          data-state="needs-upload"
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <div className="space-y-5">
            <div>
              <OnboardingBreathingText variant="label" className="text-blue-700">
                {t('dashboard.onboarding.stepLabel')}
              </OnboardingBreathingText>
              <p className="mt-2 font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
                {t('dashboard.onboarding.eyebrow')}
              </p>
              <p className="mt-4 max-w-2xl font-mono text-sm uppercase tracking-wide text-ink-soft">
                {'// '}
                {t('dashboard.onboarding.uploadDescription')}
              </p>
            </div>
            <Button
              type="button"
              onClick={onUploadMaster}
              disabled={!canUploadMaster}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.onboarding.uploadAction')}
            </Button>
          </div>
        </OnboardingCutReveal>
      );
    }

    if (card.key === 'reviewResume') {
      return (
        <div className="space-y-5">
          <div className="border-2 border-black bg-white p-4 shadow-sw-sm" role="status">
            <OnboardingBreathingText variant="label" className="text-blue-700">
              {processingStatusText ?? t('dashboard.workflow.reviewResume.status')}
            </OnboardingBreathingText>
          </div>
          {resumeContent}
          {readinessContent}
          {canTailor ? (
            <Button type="button" onClick={onContinueToTailorStep} className="w-full sm:w-auto">
              {t('dashboard.workflow.reviewResume.action')}
            </Button>
          ) : disabledReason ? (
            <p className="border-2 border-black bg-white p-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              {disabledReason}
            </p>
          ) : null}
        </div>
      );
    }

    if (card.key === 'tailorRole') {
      return (
        <div className="space-y-5">
          {disabledReason ? (
            <p className="border-2 border-black bg-white p-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              {disabledReason}
            </p>
          ) : (
            <p className="font-mono text-sm uppercase tracking-wide text-ink-soft">
              {card.description}
            </p>
          )}
          {canTailor ? (
            <Link
              href="/tailor"
              className="inline-flex min-h-11 w-full items-center justify-center border-2 border-black bg-blue-700 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-sw-default hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 sm:w-auto"
            >
              {t('dashboard.tailorCta')}
            </Link>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="inline-flex border border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
          {t('dashboard.workflow.reviewLift.count', { count: tailoredCount })}
        </div>
        {tailoredContent}
      </div>
    );
  };

  const renderCard = (card: StackCard, visibleIndex: number) => {
    const isCurrent = card.key === activeStep;
    const isRevealed = card.state === 'complete';

    return (
      <StackingCardItem
        key={card.key}
        role="listitem"
        aria-current={isCurrent ? 'step' : undefined}
        data-testid={`dashboard-stack-card-${card.key}`}
        data-step={card.key}
        data-state={card.state}
        data-expanded={isCurrent ? 'true' : 'false'}
        index={visibleIndex}
        topPosition={`${1.5 + visibleIndex * 1.25}rem`}
        className={cn('min-h-20 md:min-h-24', isCurrent && 'min-h-0')}
      >
        <div ref={isCurrent ? activeCardRef : undefined}>
          {isCurrent ? (
            <TailorStepCard
              index={card.index}
              title={card.title}
              state={card.state}
              className="min-h-[28rem] p-5 md:min-h-[32rem] md:p-6"
            >
              <p className="mb-5 max-w-2xl font-mono text-sm uppercase tracking-wide text-ink-soft">
                {card.description}
              </p>
              {renderActiveContent(card)}
            </TailorStepCard>
          ) : (
            <CollapsedCard card={{ ...card, isCurrent }} isRevealed={isRevealed} />
          )}
        </div>
      </StackingCardItem>
    );
  };

  return (
    <div data-testid="dashboard-tailor-stack" className="relative min-h-0 overflow-visible">
      <StackingCards
        role="list"
        aria-label={deckLabel}
        data-layout="fancy-stacking-cards"
        data-active-step={activeStep}
        data-motion={prefersReducedMotion ? 'reduced' : 'safe'}
        totalCards={visibleCards.length}
        scaleMultiplier={0.018}
        className={cn(
          'relative flex min-h-[34rem] flex-col gap-4 overflow-visible pb-8 md:min-h-[40rem]',
          visibleCards.length >= 3 && 'md:min-h-[44rem]',
          prefersReducedMotion && 'gap-3'
        )}
      >
        {visibleCards.map(renderCard)}
      </StackingCards>
    </div>
  );
}
