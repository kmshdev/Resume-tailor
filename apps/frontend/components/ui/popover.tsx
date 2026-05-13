'use client';

import React, { useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Popover({ trigger, children, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget as Node | null;
    if (nextFocus && event.currentTarget.contains(nextFocus)) return;
    setOpen(false);
  };

  return (
    <div className="relative inline-block" onBlur={handleBlur}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex items-center gap-2 rounded-none border border-black bg-[#10131A] px-3 py-2',
          'font-mono text-xs font-medium uppercase tracking-wide text-white shadow-sw-sm',
          'transition-[transform,box-shadow,background-color] duration-100 ease-out',
          'hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-black hover:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2'
        )}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={contentId}
          role="dialog"
          className={cn(
            'absolute right-0 top-full z-40 mt-2 w-80 border border-black bg-[#10131A] p-4 text-white shadow-sw-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95',
            className
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
