'use client';

import React from 'react';
import Link from 'next/link';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import FileUp from 'lucide-react/dist/esm/icons/file-up';
import Lock from 'lucide-react/dist/esm/icons/lock';
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
  if (state === 'complete') return 'bg-green-700';
  if (state === 'active') return 'bg-blue-700';
  if (state === 'warning') return 'bg-orange-500';
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
    state === 'complete' ? (
      <Check aria-hidden="true" className="h-4 w-4" />
    ) : (
      <Lock aria-hidden="true" className="h-4 w-4" />
    );
  const actionClassName =
    'inline-flex h-11 w-11 items-center justify-center border border-black bg-white text-black shadow-sw-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none';

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
            <span
              aria-hidden="true"
              className={cn('h-3 w-3 border border-black', stateSquareClass(state))}
            />
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
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center border border-black bg-white"
            >
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
            <Link
              href={actionHref}
              aria-label={actionLabel}
              title={actionLabel}
              className={actionClassName}
            >
              <ActionIcon aria-hidden="true" className="h-4 w-4" />
            </Link>
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
