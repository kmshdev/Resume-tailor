'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type BuilderMobilePanel = 'editor' | 'preview';

interface BuilderMobilePanelSwitcherProps {
  activePanel: BuilderMobilePanel;
  onPanelChange: (panel: BuilderMobilePanel) => void;
  labels: {
    ariaLabel: string;
    editor: string;
    preview: string;
  };
}

const panels: BuilderMobilePanel[] = ['editor', 'preview'];

export function BuilderMobilePanelSwitcher({
  activePanel,
  onPanelChange,
  labels,
}: BuilderMobilePanelSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label={labels.ariaLabel}
      className="grid grid-cols-2 border border-black lg:hidden"
    >
      {panels.map((panel) => {
        const isActive = activePanel === panel;

        return (
          <button
            key={panel}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onPanelChange(panel)}
            className={cn(
              'min-h-11 min-w-0 border-black px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
              panel === 'preview' && 'border-l',
              isActive ? 'bg-blue-700 text-white' : 'bg-background text-black hover:bg-secondary'
            )}
          >
            {panel === 'editor' ? labels.editor : labels.preview}
          </button>
        );
      })}
    </div>
  );
}
