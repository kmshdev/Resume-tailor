'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetchLlmConfig, type LLMConfig } from '@/lib/api/config';
import { useStatusCache } from '@/lib/context/status-cache';
import { useTranslations } from '@/lib/i18n';

interface CompactSettingsModalProps {
  trigger: React.ReactElement;
}

export function CompactSettingsModal({ trigger }: CompactSettingsModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const { status, isLoading: isStatusLoading, refreshStatus } = useStatusCache();
  const { t } = useTranslations();

  useEffect(() => {
    if (!open) return;

    let active = true;
    setIsConfigLoading(true);
    setConfigError(null);

    fetchLlmConfig()
      .then((nextConfig) => {
        if (!active) return;
        setConfig(nextConfig);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setConfigError(error instanceof Error ? error.message : 'Unable to load model settings.');
      })
      .finally(() => {
        if (!active) return;
        setIsConfigLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const handleRefresh = () => {
    void refreshStatus();
    setIsConfigLoading(true);
    setConfigError(null);

    fetchLlmConfig()
      .then(setConfig)
      .catch((error: unknown) => {
        setConfigError(error instanceof Error ? error.message : 'Unable to load model settings.');
      })
      .finally(() => {
        setIsConfigLoading(false);
      });
  };

  const healthy = Boolean(status?.llm_configured && status?.llm_healthy);
  const statusLabel = isStatusLoading
    ? t('shell.status.checking')
    : healthy
      ? t('shell.status.ready')
      : t('shell.status.setupRequired');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md border border-black bg-background p-0 shadow-sw-lg">
        <DialogHeader className="border-b border-black bg-white p-6 pr-14">
          <DialogTitle className="font-serif text-2xl font-bold">
            {t('shell.settings.title')}
          </DialogTitle>
          <DialogDescription className="font-sans text-sm leading-6 text-ink-soft">
            {t('shell.settings.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] border border-black bg-white text-sm">
            <dt className="border-b border-r border-black p-3 font-mono uppercase tracking-wide">
              {t('shell.settings.modelStatus')}
            </dt>
            <dd className="border-b border-black p-3 font-sans">{statusLabel}</dd>
            <dt className="border-b border-r border-black p-3 font-mono uppercase tracking-wide">
              {t('shell.settings.provider')}
            </dt>
            <dd className="border-b border-black p-3 font-sans">
              {isConfigLoading ? t('common.loading') : (config?.provider ?? '-')}
            </dd>
            <dt className="border-r border-black p-3 font-mono uppercase tracking-wide">
              {t('shell.settings.model')}
            </dt>
            <dd className="p-3 font-sans">
              {isConfigLoading ? t('common.loading') : (config?.model ?? '-')}
            </dd>
          </dl>
          {configError ? (
            <p className="border border-red-600 bg-red-100 p-3 font-sans text-sm text-red-600">
              {configError}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={isStatusLoading || isConfigLoading}
              className="flex-1 bg-white"
            >
              {t('shell.status.refresh')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/settings');
              }}
              className="flex-1"
            >
              {t('shell.settings.fullSettings')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
