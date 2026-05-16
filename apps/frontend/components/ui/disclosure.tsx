'use client';

import React, { useId, useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ title, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="border-t border-black">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 rounded-none bg-transparent px-0 py-4 text-left font-serif text-lg font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 transition-transform duration-100 ease-out',
            open ? 'rotate-180' : 'rotate-0'
          )}
        />
      </button>
      <div id={contentId} hidden={!open} className="pb-4 font-sans text-sm leading-6 text-ink-soft">
        {children}
      </div>
    </section>
  );
}
