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
    <section
      aria-label={ariaLabel}
      className={cn('border-2 border-black bg-black shadow-[8px_8px_0px_0px_#000000]', className)}
    >
      {alert ? <div className="border-b-2 border-black bg-background p-4">{alert}</div> : null}

      <div
        data-testid="command-center-metrics"
        className="grid grid-cols-1 gap-[1px] bg-black md:grid-cols-3 lg:grid-cols-3"
      >
        {metrics.map((metric, index) => (
          <div key={index} className="min-h-full bg-[#10131A]">
            {metric}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[1px] bg-black lg:grid-cols-3">
        <div className="min-w-0 bg-background text-black">{resumeContext}</div>
        <div className="min-w-0 bg-white text-black">{workflow}</div>
        <aside className="min-w-0 bg-background text-black">{activity}</aside>
      </div>
    </section>
  );
}
