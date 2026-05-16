'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  label?: string;
  ariaLabel?: string;
  labelId?: string;
}

export function Popover({ trigger, children, className, label, ariaLabel, labelId }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogLabel = ariaLabel ?? label ?? 'Popover';

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget as Node | null;
    if (nextFocus && event.currentTarget.contains(nextFocus)) return;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleOutsidePress = (event: Event) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsidePress);
    document.addEventListener('mousedown', handleOutsidePress);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsidePress);
      document.removeEventListener('mousedown', handleOutsidePress);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block" onBlur={handleBlur}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-none border border-black bg-[#10131A] px-3 py-2',
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
          aria-label={labelId ? undefined : dialogLabel}
          aria-labelledby={labelId}
          className={cn(
            'fixed left-4 right-4 top-20 z-40 max-h-[calc(100vh-6rem)] overflow-y-auto border border-black bg-[#10131A] p-4 text-white shadow-sw-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-reduce:animate-none sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(32rem,calc(100vh-8rem))] sm:w-80',
            className
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
