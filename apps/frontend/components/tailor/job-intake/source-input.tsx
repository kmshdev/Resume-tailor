'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';
import type { IntakeSource } from './types';

interface SourceInputProps {
  sourceType: IntakeSource;
  sourceText: string;
  disabled: boolean;
  isExtracting: boolean;
  canExtract: boolean;
  onTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onExtract: () => void;
  onTextareaKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function SourceInput({
  sourceType,
  sourceText,
  disabled,
  isExtracting,
  canExtract,
  onTextChange,
  onFileChange,
  onExtract,
  onTextareaKeyDown,
}: SourceInputProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-3">
      <div className="border-2 border-black bg-white p-4">
        <p className="font-mono text-xs font-bold uppercase text-green-700">
          {t(`tailor.intake.inputHelp.${sourceType}.title`)}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {t(`tailor.intake.inputHelp.${sourceType}.description`)}
        </p>
      </div>

      <label htmlFor="job-intake-input" className="font-mono text-sm font-bold uppercase">
        {t('tailor.intake.inputLabel')}
      </label>
      {sourceType === 'pdf_upload' ? (
        <Input
          key="pdf_upload"
          id="job-intake-input"
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled || isExtracting}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      ) : sourceType === 'job_url' || sourceType === 'pdf_url' ? (
        <Input
          key={sourceType}
          id="job-intake-input"
          value={sourceText}
          disabled={disabled || isExtracting}
          placeholder={t(`tailor.intake.placeholders.${sourceType}`)}
          onChange={(event) => onTextChange(event.target.value)}
        />
      ) : (
        <Textarea
          key={sourceType}
          id="job-intake-input"
          value={sourceText}
          disabled={disabled || isExtracting}
          placeholder={t(`tailor.intake.placeholders.${sourceType}`)}
          onKeyDown={onTextareaKeyDown}
          onChange={(event) => onTextChange(event.target.value)}
          className="min-h-[240px] font-mono text-sm bg-background border-2 border-black rounded-none"
        />
      )}
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={onExtract}
        disabled={!canExtract || disabled || isExtracting}
      >
        {isExtracting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('tailor.intake.extracting')}
          </>
        ) : (
          t('tailor.intake.extractButton')
        )}
      </Button>
    </div>
  );
}
