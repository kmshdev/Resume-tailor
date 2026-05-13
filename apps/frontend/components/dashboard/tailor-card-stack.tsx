'use client';

import Link from 'next/link';
import { StackingCardItem, StackingCards } from '@/components/fancy/stacking-cards';
import { TailorStepCard, type TailorStepState } from '@/components/tailor/tailor-step-card';
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
          className="mt-4 inline-flex w-full justify-center border-2 border-black bg-blue-700 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-sw-default hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          {t('dashboard.tailorCta')}
        </Link>
      ) : null}
    </div>
  );
}
