'use client';

import React from 'react';
import { Edit3, FileText, LinkIcon, MessageSquare, Upload } from 'lucide-react';
import { SelectionTileGroup, type SelectionTileOption } from '@/components/ui/selection-tile-group';
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
  const options: SelectionTileOption<IntakeSource>[] = SOURCES.map((source) => {
    const Icon = source.icon;
    return {
      value: source.id,
      label: t(`tailor.intake.sources.${source.id}`),
      description: t(`tailor.intake.sourceDescriptions.${source.id}`),
      icon: <Icon className="h-4 w-4" />,
    };
  });

  return (
    <SelectionTileGroup
      label={t('tailor.intake.stepLabel', { step: 1 })}
      options={options}
      value={sourceType}
      onValueChange={onSourceChange}
      columns={4}
      disabled={disabled}
    />
  );
}
