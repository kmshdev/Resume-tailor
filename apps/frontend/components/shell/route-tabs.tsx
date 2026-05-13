'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

const TABS = [
  { href: '/dashboard', labelKey: 'shell.tabs.dashboard' },
  { href: '/tailor', labelKey: 'shell.tabs.tailor' },
  { href: '/builder', labelKey: 'shell.tabs.builder' },
  { href: '/settings', labelKey: 'shell.tabs.settings' },
] as const;

export function RouteTabs() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <nav aria-label={t('shell.tabs.label')}>
      <div className="grid grid-cols-2 border border-black bg-background text-black shadow-sw-sm sm:grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'border-black px-4 py-3 text-center font-mono text-xs font-medium uppercase tracking-wide',
                'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
                'sm:border-l first:sm:border-l-0 odd:border-r sm:odd:border-r-0',
                'border-t first:border-t-0 sm:border-t-0 [&:nth-child(2)]:border-t-0',
                active ? 'bg-blue-700 text-white' : 'bg-background text-black hover:bg-secondary'
              )}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
