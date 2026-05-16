'use client';

import Link from 'next/link';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { useTranslations } from '@/lib/i18n';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  const { t } = useTranslations();

  return (
    <nav aria-label={t('shell.breadcrumbs.label')} className="font-mono text-xs uppercase">
      <ol className="flex flex-wrap items-center gap-2 text-white">
        <li>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10131A]"
          >
            {t('shell.breadcrumbs.home')}
          </Link>
        </li>
        {items.map((item) => (
          <li key={`${item.href ?? 'current'}-${item.label}`} className="flex items-center gap-2">
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10131A]"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
