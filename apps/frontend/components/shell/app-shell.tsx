'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/shell/breadcrumbs';
import { CompactSettingsModal } from '@/components/shell/compact-settings-modal';
import { ModelStatusPopover } from '@/components/shell/model-status-popover';
import { RouteTabs } from '@/components/shell/route-tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { useTranslations } from '@/lib/i18n';

interface AppShellProps {
  children: React.ReactNode;
}

type PageKey = 'dashboard' | 'tailor' | 'builder' | 'settings' | 'resumes';

const HELP_TOPICS = ['score', 'data', 'recommendation', 'tailor'] as const;

function getPageKey(pathname: string | null): PageKey {
  const segment = pathname?.split('/').filter(Boolean)[0];

  if (segment === 'tailor' || segment === 'builder' || segment === 'settings') {
    return segment;
  }

  if (segment === 'resumes') {
    return 'resumes';
  }

  return 'dashboard';
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [helpOpen, setHelpOpen] = useState(false);
  const pageKey = getPageKey(pathname);
  const breadcrumbs: BreadcrumbItem[] =
    pageKey === 'dashboard' ? [] : [{ label: t(`shell.pages.${pageKey}`) }];

  return (
    <div className="min-h-screen bg-background text-black">
      <header className="border-b border-black bg-[#10131A] text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Breadcrumbs items={breadcrumbs} />
            <div className="flex flex-wrap items-center gap-3">
              <ModelStatusPopover />
              <CompactSettingsModal
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('shell.settings.open')}
                    className="bg-white text-black"
                  >
                    <SettingsIcon aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('shell.settings.open')}</span>
                  </Button>
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t('shell.help.open')}
                onClick={() => setHelpOpen(true)}
                className="bg-white text-black"
              >
                <HelpCircle aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">{t('shell.help.open')}</span>
              </Button>
            </div>
          </div>
          <RouteTabs />
        </div>
      </header>
      <main className="bg-background text-black">
        <div className="mx-auto min-h-[calc(100vh-144px)] w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl border border-black bg-background p-0 shadow-sw-lg">
          <DialogHeader className="border-b border-black bg-white p-6 pr-14">
            <DialogTitle className="font-serif text-2xl font-bold">
              {t('shell.help.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {HELP_TOPICS.map((topic, index) => (
              <Disclosure
                key={topic}
                title={t(`shell.help.topics.${topic}.title`)}
                defaultOpen={index === 0}
              >
                {t(`shell.help.topics.${topic}.body`)}
              </Disclosure>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
