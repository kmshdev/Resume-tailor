'use client';

import React, { useMemo, useState } from 'react';
import { Edit3, FileText, LinkIcon, Loader2, MessageSquare, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';
import {
  confirmJobIntake,
  extractJobIntake,
  uploadJobIntakePdf,
  type JobIntakeExtractResponse,
  type JobIntakeMetadata,
  type JobSourceType,
} from '@/lib/api/job-intake';

type IntakeSource = Exclude<JobSourceType, 'pdf_upload'> | 'pdf_upload';

interface JobIntakeWizardProps {
  masterResumeId: string;
  disabled: boolean;
  canTailor: boolean;
  onJobConfirmed: (result: { jobId: string; jobDescription: string }) => void | Promise<void>;
}

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

function toMetadata(extraction: JobIntakeExtractResponse): JobIntakeMetadata {
  return {
    source_type: extraction.source_type,
    source_url: extraction.source_url ?? null,
    source_title: extraction.source_title ?? null,
    links: extraction.links,
    screening_questions: extraction.screening_questions,
    draft_answers: extraction.draft_answers,
    extraction_method: extraction.extraction_method,
    warnings: extraction.warnings,
    confidence: extraction.confidence,
  };
}

export function JobIntakeWizard({
  masterResumeId,
  disabled,
  canTailor,
  onJobConfirmed,
}: JobIntakeWizardProps) {
  const { t } = useTranslations();
  const [sourceType, setSourceType] = useState<IntakeSource>('manual_text');
  const [sourceText, setSourceText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<JobIntakeExtractResponse | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExtract = useMemo(() => {
    if (disabled || isExtracting || isConfirming) return false;
    if (sourceType === 'pdf_upload') return Boolean(selectedFile);
    return sourceText.trim().length > 0;
  }, [disabled, isExtracting, isConfirming, selectedFile, sourceText, sourceType]);

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') event.stopPropagation();
  };

  const handleExtract = async () => {
    if (!canExtract) return;
    setError(null);
    setIsExtracting(true);
    try {
      const result =
        sourceType === 'pdf_upload'
          ? await uploadJobIntakePdf(selectedFile as File, masterResumeId)
          : await extractJobIntake({
              source_type: sourceType,
              source_text:
                sourceType === 'manual_text' || sourceType === 'recruiter_message'
                  ? sourceText.trim()
                  : undefined,
              url:
                sourceType === 'job_url' || sourceType === 'pdf_url'
                  ? sourceText.trim()
                  : undefined,
              resume_id: masterResumeId,
            });
      setExtraction(result);
      setReviewText(result.job_description);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tailor.intake.errors.extractFailed'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirm = async () => {
    if (!extraction || !canTailor || reviewText.trim().length < 50) return;
    setError(null);
    setIsConfirming(true);
    try {
      const confirmed = await confirmJobIntake({
        job_description: reviewText.trim(),
        resume_id: masterResumeId,
        intake_metadata: toMetadata(extraction),
      });
      await onJobConfirmed({
        jobId: confirmed.job_id,
        jobDescription: reviewText.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tailor.intake.errors.confirmFailed'));
    } finally {
      setIsConfirming(false);
    }
  };

  const resetReview = () => {
    setExtraction(null);
    setReviewText('');
    setError(null);
  };

  return (
    <div className="space-y-6">
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
                disabled={disabled || isExtracting || isConfirming}
                onClick={() => {
                  setSourceType(source.id);
                  resetReview();
                }}
              >
                <Icon className="w-4 h-4" />
                {t(`tailor.intake.sources.${source.id}`)}
              </Button>
            );
          })}
        </div>
      </div>

      {!extraction && (
        <div className="space-y-3">
          <label htmlFor="job-intake-input" className="font-mono text-sm font-bold uppercase">
            {t('tailor.intake.inputLabel')}
          </label>
          {sourceType === 'pdf_upload' ? (
            <Input
              id="job-intake-input"
              type="file"
              accept="application/pdf,.pdf"
              disabled={disabled || isExtracting}
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          ) : sourceType === 'job_url' || sourceType === 'pdf_url' ? (
            <Input
              id="job-intake-input"
              value={sourceText}
              disabled={disabled || isExtracting}
              placeholder={t(`tailor.intake.placeholders.${sourceType}`)}
              onChange={(event) => setSourceText(event.target.value)}
            />
          ) : (
            <Textarea
              id="job-intake-input"
              value={sourceText}
              disabled={disabled || isExtracting}
              placeholder={t(`tailor.intake.placeholders.${sourceType}`)}
              onKeyDown={handleTextareaKeyDown}
              onChange={(event) => setSourceText(event.target.value)}
              className="min-h-[240px] font-mono text-sm bg-background border-2 border-black rounded-none"
            />
          )}
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleExtract}
            disabled={!canExtract}
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
      )}

      {extraction && (
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
              <Button type="button" variant="outline" onClick={resetReview} disabled={isConfirming}>
                {t('tailor.intake.changeSource')}
              </Button>
            </div>

            <label htmlFor="job-intake-review" className="font-mono text-sm font-bold uppercase">
              {t('tailor.intake.reviewJdLabel')}
            </label>
            <Textarea
              id="job-intake-review"
              value={reviewText}
              onKeyDown={handleTextareaKeyDown}
              onChange={(event) => setReviewText(event.target.value)}
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
            onClick={handleConfirm}
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
      )}

      {error && (
        <div className="border-2 border-red-600 bg-red-50 p-4 font-mono text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
