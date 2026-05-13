'use client';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import ScanSearch from 'lucide-react/dist/esm/icons/scan-search';
import type { EvaluationPhase, ResumeEvaluationResponse } from '@/lib/api/evaluation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { EvaluationPopover } from './evaluation-popover';

interface EvaluationCardProps {
  phase: EvaluationPhase;
  evaluation: ResumeEvaluationResponse | null;
  isLoading?: boolean;
  error?: string | null;
  onCheck?: () => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

function hasScore(
  evaluation: ResumeEvaluationResponse | null
): evaluation is ResumeEvaluationResponse {
  return Boolean(evaluation && Number.isFinite(evaluation.overall_score));
}

function formatScore(evaluation: ResumeEvaluationResponse | null): string {
  return hasScore(evaluation) ? String(Math.round(evaluation.overall_score)) : '--';
}

function formatConfidence(value: number): number {
  const percentage = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, percentage)));
}

export function EvaluationCard({
  phase,
  evaluation,
  isLoading = false,
  error,
  onCheck,
  onRefresh,
  disabled = false,
}: EvaluationCardProps) {
  const { t } = useTranslations();
  const scoreAvailable = hasScore(evaluation);
  const stale = Boolean(evaluation?.stale);
  const showRefresh = stale && Boolean(onRefresh);
  const showCheck = !scoreAvailable && Boolean(onCheck);
  const actionLabel = showRefresh ? t('evaluation.actions.refresh') : t('evaluation.actions.check');
  const ActionIcon = showRefresh ? RefreshCw : ScanSearch;
  const statusLabel = isLoading
    ? t('evaluation.states.checking')
    : stale
      ? t('evaluation.states.stale')
      : scoreAvailable
        ? t('evaluation.confidence', { value: formatConfidence(evaluation.confidence) })
        : t('evaluation.states.notChecked');

  const handleAction = () => {
    if (isLoading || disabled) return;
    if (showRefresh) {
      onRefresh?.();
      return;
    }
    if (showCheck) {
      onCheck?.();
    }
  };

  return (
    <article
      className={cn(
        'flex min-h-52 flex-col border-2 border-white/60 bg-[#10131A] p-5 text-white',
        'shadow-[4px_4px_0px_0px_#000000]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-white/70">
            {t(`evaluation.phases.${phase}`)}
          </p>
          <p
            className={cn(
              'font-serif text-5xl font-bold leading-none',
              !scoreAvailable && 'text-white/45'
            )}
          >
            {formatScore(evaluation)}
          </p>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            'h-4 w-4 border border-white',
            isLoading
              ? 'bg-blue-700'
              : error
                ? 'bg-red-600'
                : stale
                  ? 'bg-orange-500'
                  : 'bg-green-700',
            !scoreAvailable && !isLoading && !error && 'bg-transparent'
          )}
        />
      </div>

      <div className="mt-auto space-y-4 pt-5">
        <div className="space-y-2">
          <div className="flex min-h-5 items-center gap-2 font-mono text-xs uppercase tracking-wide text-white/80">
            {isLoading ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{statusLabel}</span>
          </div>
          {error ? (
            <p className="font-mono text-xs uppercase tracking-wide text-red-200">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <EvaluationPopover phase={phase} evaluation={evaluation} error={error} />
          {(showCheck || showRefresh || isLoading) && (
            <Button
              type="button"
              variant={showRefresh ? 'warning' : 'outline'}
              size="sm"
              onClick={handleAction}
              disabled={isLoading || disabled || (!showCheck && !showRefresh)}
              aria-label={actionLabel}
              className={cn(showRefresh ? '' : 'bg-white text-black')}
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ActionIcon aria-hidden="true" className="h-4 w-4" />
              )}
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
