'use client';

import Link from 'next/link';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import FileUp from 'lucide-react/dist/esm/icons/file-up';
import Lock from 'lucide-react/dist/esm/icons/lock';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  active: boolean;
  enabled: boolean;
  tone: string;
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
      active: hasMasterResume,
      enabled: canUploadMaster,
      tone: hasMasterResume
        ? 'bg-green-700 text-white'
        : canUploadMaster
          ? 'bg-background text-black'
          : 'bg-secondary text-black',
    },
    {
      key: 'jobIntake',
      active: canTailor || hasTailoredResume,
      enabled: canTailor,
      tone: canTailor || hasTailoredResume ? 'bg-blue-700 text-white' : 'bg-secondary text-black',
    },
    {
      key: 'tailorFlow',
      active: hasTailoredResume,
      enabled: canTailor,
      tone: hasTailoredResume ? 'bg-black text-white' : 'bg-white text-black',
    },
    {
      key: 'reviewLift',
      active: hasTailoredResume,
      enabled: hasTailoredResume,
      tone: hasTailoredResume ? 'bg-orange-500 text-white' : 'bg-background text-black',
    },
  ];

  return (
    <div className="relative h-[21rem] overflow-hidden p-4">
      {cards.map((card, index) => {
        const label = t(`dashboard.cardStack.${card.key}`);
        const offset = index * 18;
        return (
          <article
            key={card.key}
            className={cn(
              'absolute left-4 right-4 flex h-40 flex-col border-2 border-black p-4',
              'shadow-[4px_4px_0px_0px_#000000]',
              card.tone
            )}
            style={{ top: `${offset}px`, zIndex: cards.length + index }}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-xs font-bold uppercase tracking-wide">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 items-center justify-center border border-current',
                  card.active ? 'bg-white text-black' : 'bg-transparent'
                )}
              >
                {card.active ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </span>
            </div>
            <h3 className="mt-auto max-w-[12rem] font-serif text-2xl font-bold uppercase leading-none">
              {label}
            </h3>
            <div className="mt-3 flex justify-end">
              {card.key === 'masterResume' && !hasMasterResume && canUploadMaster ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onUploadMaster}
                  aria-label={label}
                  title={label}
                  className="h-9 w-9 bg-white"
                >
                  <FileUp aria-hidden="true" className="h-4 w-4" />
                </Button>
              ) : card.enabled ? (
                <Link
                  href="/tailor"
                  aria-label={label}
                  title={label}
                  className="inline-flex h-9 w-9 items-center justify-center border border-black bg-white text-black shadow-sw-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 items-center justify-center border border-current opacity-50"
                >
                  <Lock className="h-4 w-4" />
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
