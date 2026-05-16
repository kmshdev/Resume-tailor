'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CommandCenterProps {
  ariaLabel: string;
  metrics: ReactNode[];
  resumeContext: ReactNode;
  workflow: ReactNode;
  activity: ReactNode;
  alert?: ReactNode;
  className?: string;
}

export function CommandCenter({
  ariaLabel,
  metrics,
  resumeContext,
  workflow,
  activity,
  alert,
  className,
}: CommandCenterProps) {
  return (
    <section aria-label={ariaLabel} className={cn('space-y-4', className)}>
      {alert ? (
        <div className="border-2 border-black bg-background p-4 shadow-sw-default">{alert}</div>
      ) : null}

      <div
        data-testid="command-center-metrics-row"
        data-row="metrics"
        className="border-2 border-black bg-black shadow-sw-default"
      >
        <div
          role="list"
          aria-label={`${ariaLabel} metrics`}
          data-testid="command-center-metrics"
          className="grid grid-cols-1 gap-[1px] bg-black md:grid-cols-3 lg:grid-cols-3"
        >
          {metrics.map((metric, index) => (
            <div key={index} role="listitem" className="min-h-full bg-[#10131A]">
              {metric}
            </div>
          ))}
        </div>
      </div>

      <div
        data-testid="command-center-workspace-row"
        data-row="workspace"
        className="border-2 border-black bg-black shadow-sw-lg"
      >
        <div
          data-testid="command-center-body"
          data-layout="workflow-priority"
          className="grid grid-cols-1 gap-[1px] bg-black lg:grid-cols-[minmax(14rem,0.85fr)_minmax(22rem,1.25fr)_minmax(14rem,0.85fr)] xl:grid-cols-[minmax(18rem,0.9fr)_minmax(28rem,1.2fr)_minmax(18rem,0.9fr)]"
        >
          <div className="min-w-0 bg-background text-black">{resumeContext}</div>
          <div
            data-testid="command-center-workflow"
            data-priority="primary"
            className="min-w-0 bg-white text-black"
          >
            {workflow}
          </div>
          <aside className="min-w-0 bg-background text-black">{activity}</aside>
        </div>
      </div>
    </section>
  );
}
