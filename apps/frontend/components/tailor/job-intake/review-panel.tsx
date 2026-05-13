'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';
import type { JobIntakeExtractResponse } from '@/lib/api/job-intake';

interface ReviewPanelProps {
  extraction: JobIntakeExtractResponse;
  reviewText: string;
  isConfirming: boolean;
  canTailor: boolean;
  onReviewTextChange: (value: string) => void;
  onTextareaKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onChangeSource: () => void;
  onConfirm: () => void;
}

export function ReviewPanel({
  extraction,
  reviewText,
  isConfirming,
  canTailor,
  onReviewTextChange,
  onTextareaKeyDown,
  onChangeSource,
  onConfirm,
}: ReviewPanelProps) {
  const { t } = useTranslations();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-2 border-black bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase text-blue-700">
              {t('tailor.intake.stepLabel', { step: 2 })}
            </p>
            <h2 className="font-serif text-2xl font-bold uppercase">
              {t('tailor.intake.reviewTitle')}
            </h2>
          </div>
          <Button type="button" variant="outline" onClick={onChangeSource} disabled={isConfirming}>
            {t('tailor.intake.changeSource')}
          </Button>
        </div>

        <label htmlFor="job-intake-review" className="font-mono text-sm font-bold uppercase">
          {t('tailor.intake.reviewJdLabel')}
        </label>
        <Textarea
          id="job-intake-review"
          value={reviewText}
          onKeyDown={onTextareaKeyDown}
          onChange={(event) => onReviewTextChange(event.target.value)}
          disabled={isConfirming}
          className="min-h-[260px] font-mono text-sm bg-background border-2 border-black rounded-none"
        />
        <div className="flex flex-wrap gap-2 font-mono text-xs uppercase">
          <span className="border border-black bg-background px-2 py-1">
            {t(`tailor.intake.methods.${extraction.extraction_method}`)}
          </span>
          <span className="border border-black bg-background px-2 py-1">
            {t('tailor.intake.confidence', {
              value: Math.round(extraction.confidence * 100),
            })}
          </span>
        </div>
      </div>

      {extraction.links.length > 0 && (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-mono text-sm font-bold uppercase mb-2">
            {t('tailor.intake.linksTitle')}
          </h3>
          <ul className="space-y-2 font-mono text-xs">
            {extraction.links.map((link) => (
              <li key={link.url} className="break-all text-blue-700">
                {link.url}
              </li>
            ))}
          </ul>
        </div>
      )}

      {extraction.screening_questions.length > 0 && (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-mono text-sm font-bold uppercase mb-3">
            {t('tailor.intake.questionsTitle')}
          </h3>
          <div className="space-y-3">
            {extraction.screening_questions.map((question) => {
              const answer = extraction.draft_answers.find(
                (candidate) => candidate.question_id === question.id
              );
              return (
                <div key={question.id} className="border border-black bg-background p-3">
                  <p className="font-mono text-sm font-bold">{question.question}</p>
                  {answer?.needs_user_input ? (
                    <p className="mt-2 font-mono text-xs text-orange-700">
                      {answer.prompt || t('tailor.intake.needsInput')}
                    </p>
                  ) : answer?.answer ? (
                    <p className="mt-2 font-sans text-sm">{answer.answer}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {extraction.warnings.length > 0 && (
        <div className="border-2 border-orange-500 bg-orange-50 p-4">
          <h3 className="font-mono text-sm font-bold uppercase text-orange-700 mb-2">
            {t('tailor.intake.warningsTitle')}
          </h3>
          <ul className="list-disc pl-5 font-mono text-xs text-orange-700">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        variant="success"
        className="w-full"
        onClick={onConfirm}
        disabled={isConfirming || !canTailor || reviewText.trim().length < 50}
      >
        {isConfirming ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('tailor.intake.confirming')}
          </>
        ) : (
          t('tailor.intake.confirmButton')
        )}
      </Button>
    </div>
  );
}
