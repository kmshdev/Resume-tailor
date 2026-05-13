'use client';

import Info from 'lucide-react/dist/esm/icons/info';
import type {
  EvaluationDimensionScores,
  EvaluationPhase,
  ResumeEvaluationResponse,
} from '@/lib/api/evaluation';
import { useTranslations } from '@/lib/i18n';
import { Popover } from '@/components/ui/popover';

interface EvaluationPopoverProps {
  phase: EvaluationPhase;
  evaluation: ResumeEvaluationResponse | null;
  error?: string | null;
}

const dimensionOrder: Array<keyof EvaluationDimensionScores> = [
  'clarity',
  'impact',
  'ats_readability',
  'keyword_alignment',
  'role_fit',
  'evidence_strength',
];

function formatScore(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : '-';
}

function formatConfidence(value: number): number {
  const percentage = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, percentage)));
}

export function EvaluationPopover({ phase, evaluation, error }: EvaluationPopoverProps) {
  const { t } = useTranslations();

  return (
    <Popover
      label={t('evaluation.details')}
      trigger={
        <>
          <Info aria-hidden="true" className="h-4 w-4" />
          <span>{t('evaluation.details')}</span>
        </>
      }
      className="w-[min(22rem,calc(100vw-2rem))]"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-serif text-xl font-bold">{t('evaluation.details')}</p>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide">
            <span aria-hidden="true" className="h-3 w-3 bg-blue-700" />
            <span>{t(`evaluation.phases.${phase}`)}</span>
          </div>
          {evaluation ? (
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
              {t('evaluation.confidence', { value: formatConfidence(evaluation.confidence) })}
            </p>
          ) : (
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
              {t('evaluation.states.notChecked')}
            </p>
          )}
        </div>

        {error ? (
          <div className="border border-red-600 bg-red-50 p-3 font-mono text-xs uppercase tracking-wide text-red-700">
            {error}
          </div>
        ) : null}

        {evaluation?.stale ? (
          <div className="border border-orange-500 bg-orange-50 p-3 font-mono text-xs uppercase tracking-wide text-orange-700">
            {t('evaluation.states.stale')}
          </div>
        ) : null}

        {evaluation ? (
          <div className="space-y-2">
            {dimensionOrder.map((key) => (
              <div key={key} className="grid grid-cols-[1fr_auto] gap-4 border-t border-black pt-2">
                <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                  {t(`evaluation.dimensions.${key}`)}
                </span>
                <span className="font-mono text-xs font-bold text-black">
                  {formatScore(evaluation.dimensions[key])}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {evaluation ? (
          <div className="border-t border-black pt-3 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            <p>
              {evaluation.provider} / {evaluation.model}
            </p>
            <p className="mt-1">{evaluation.prompt_version}</p>
          </div>
        ) : null}
      </div>
    </Popover>
  );
}
