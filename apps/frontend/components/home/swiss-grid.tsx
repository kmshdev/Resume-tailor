'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

interface SwissGridProps {
  children: React.ReactNode;
  intro?: React.ReactNode;
}

export const SwissGrid = ({ children, intro }: SwissGridProps) => {
  const { t } = useTranslations();

  return (
    <div
      className="min-h-screen w-full bg-background px-4 py-8 md:px-8 md:py-12"
      style={{
        backgroundImage:
          'linear-gradient(rgba(29, 78, 216, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 78, 216, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="mx-auto flex w-full max-w-[86rem] flex-col border border-black bg-background shadow-sw-lg">
        <div className="border-b border-black p-8 md:p-12 shrink-0 bg-background relative z-30">
          <p className="mb-4 font-mono text-sm font-bold uppercase text-green-700">
            {t('dashboard.workspaceEyebrow')}
          </p>
          <h1 className="font-serif text-5xl md:text-7xl text-black leading-[0.95] uppercase">
            {t('dashboard.workspaceTitle')}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-soft md:text-lg">
            {t('dashboard.workspaceSubtitle')}
          </p>
        </div>

        {intro}

        <div className="@container relative z-10 overflow-x-hidden">
          <div className="p-[1.5px]">
            <div className="grid grid-cols-1 @2xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5 bg-black gap-[1px] border-b border-black">
              {children}
            </div>
          </div>
        </div>

        <div className="p-4 bg-background flex justify-between items-center font-mono text-xs text-blue-700 border-t border-black shrink-0 relative z-30">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Resume Matcher"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span className="uppercase font-bold">Resume Matcher</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="bg-warning text-black border border-black px-6 py-2 uppercase font-bold tracking-wide shadow-sw-sm hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all min-w-[140px] text-center"
            >
              {t('nav.settings')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
