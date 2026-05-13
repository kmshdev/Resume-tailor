'use client';

import React from 'react';
import { Edit3, FileText, LinkIcon, MessageSquare, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import type { IntakeSource } from './types';

const SOURCES: Array<{
  id: IntakeSource;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'manual_text', icon: Edit3 },
  { id: 'job_url', icon: LinkIcon },
  { id: 'pdf_url', icon: FileText },
  { id: 'pdf_upload', icon: Upload },
  { id: 'recruiter_message', icon: MessageSquare },
];

interface SourceSelectorProps {
  sourceType: IntakeSource;
  disabled: boolean;
  onSourceChange: (sourceType: IntakeSource) => void;
}

export function SourceSelector({ sourceType, disabled, onSourceChange }: SourceSelectorProps) {
  const { t } = useTranslations();

  return (
    <div>
      <p className="font-mono text-xs font-bold uppercase text-blue-700 mb-3">
        {t('tailor.intake.stepLabel', { step: 1 })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {SOURCES.map((source) => {
          const Icon = source.icon;
          const selected = source.id === sourceType;
          return (
            <Button
              key={source.id}
              type="button"
              variant={selected ? 'default' : 'outline'}
              className="h-auto min-h-16 flex-col whitespace-normal px-3 py-3 text-center"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onSourceChange(source.id)}
            >
              <Icon className="w-4 h-4" />
              {t(`tailor.intake.sources.${source.id}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
