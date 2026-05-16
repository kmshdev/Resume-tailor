'use client';

import { useId } from 'react';
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
  const statusId = useId();
  const errorId = useId();
  const scoreAvailable = hasScore(evaluation);
  const stale = Boolean(evaluation?.stale);
  const showRefresh = stale && Boolean(onRefresh);
  const showCheck = !scoreAvailable && Boolean(onCheck);
  const phaseLabel = t(`evaluation.phases.${phase}`);
  const actionLabel = showRefresh ? t('evaluation.actions.refresh') : t('evaluation.actions.check');
  const ActionIcon = showRefresh ? RefreshCw : ScanSearch;
  const statusLabel = isLoading
    ? t('evaluation.states.checking')
    : stale
      ? t('evaluation.states.stale')
      : scoreAvailable
        ? t('evaluation.confidence', { value: formatConfidence(evaluation.confidence) })
        : t('evaluation.states.notChecked');
  const actionDisabled = isLoading || disabled || (!showCheck && !showRefresh);
  const actionA11yLabel = `${actionLabel}: ${phaseLabel}. ${statusLabel}.`;
  const describedBy = error ? `${statusId} ${errorId}` : statusId;

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
        'flex min-h-52 flex-col border-2 border-black bg-background p-5 text-black',
        'shadow-sw-default'
      )}
      aria-busy={isLoading ? 'true' : undefined}
      aria-describedby={describedBy}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-steel-grey">
            {phaseLabel}
          </p>
          <p
            className={cn(
              'font-serif text-5xl font-bold leading-none',
              !scoreAvailable && 'text-steel-grey'
            )}
          >
            {isLoading && !scoreAvailable ? (
              <>
                <span
                  aria-hidden="true"
                  data-loading-placeholder="score"
                  className="block h-12 w-20 border border-black bg-secondary motion-safe:animate-pulse motion-reduce:animate-none"
                />
                <span className="sr-only">{statusLabel}</span>
              </>
            ) : (
              formatScore(evaluation)
            )}
          </p>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            'h-4 w-4 border border-black',
            isLoading
              ? 'bg-blue-700'
              : error
                ? 'bg-red-600'
                : stale
                  ? 'bg-orange-500'
                  : 'bg-green-700',
            !scoreAvailable && !isLoading && !error && 'bg-transparent',
            isLoading && 'motion-safe:animate-pulse motion-reduce:animate-none'
          )}
        />
      </div>

      <div className="mt-auto space-y-4 pt-5">
        <div className="space-y-2">
          <div
            id={statusId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex min-h-5 items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-soft"
          >
            {isLoading ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
              />
            ) : null}
            <span>{statusLabel}</span>
          </div>
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="font-mono text-xs uppercase tracking-wide text-red-600"
            >
              {error}
            </p>
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
              disabled={actionDisabled}
              aria-label={actionA11yLabel}
              aria-describedby={describedBy}
              title={actionA11yLabel}
              className={cn(showRefresh ? '' : 'bg-white text-black')}
            >
              {isLoading ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
                />
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
