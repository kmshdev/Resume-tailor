'use client';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { useStatusCache } from '@/lib/context/status-cache';
import { useTranslations } from '@/lib/i18n';

export function ModelStatusPopover() {
  const { status, isLoading, error, lastFetched, refreshStatus } = useStatusCache();
  const { t } = useTranslations();

  const ready = Boolean(status?.llm_configured && status?.llm_healthy && !error);
  const labelKey = isLoading
    ? 'shell.status.checking'
    : ready
      ? 'shell.status.ready'
      : 'shell.status.setupRequired';
  const detailKey = ready ? 'shell.status.readyDetail' : 'shell.status.setupDetail';
  const StatusIcon = isLoading ? Loader2 : ready ? CheckCircle2 : AlertTriangle;

  return (
    <Popover
      trigger={
        <>
          <StatusIcon
            aria-hidden="true"
            className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
          <span>{t(labelKey)}</span>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-serif text-xl font-bold">{t('shell.status.title')}</p>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide">
            <span
              aria-hidden="true"
              className={ready ? 'h-3 w-3 bg-green-700' : 'h-3 w-3 bg-orange-500'}
            />
            <span>{t(labelKey)}</span>
          </div>
          <p className="font-sans text-sm leading-6 text-white/80">
            {error ? error : t(detailKey)}
          </p>
        </div>
        <div className="border-t border-white/40 pt-3 font-mono text-xs uppercase tracking-wide text-white/70">
          <p>{t('shell.status.lastChecked')}</p>
          <p className="mt-1 text-white">{lastFetched ? lastFetched.toLocaleString() : '-'}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void refreshStatus();
          }}
          disabled={isLoading}
          className="w-full bg-white text-black"
        >
          {t('shell.status.refresh')}
        </Button>
      </div>
    </Popover>
  );
}
