'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from '@/lib/i18n';
import {
  confirmJobIntake,
  extractJobIntake,
  uploadJobIntakePdf,
  type DraftAnswer,
  type JobIntakeExtractResponse,
  type JobIntakeMetadata,
  type ScreeningQuestion,
} from '@/lib/api/job-intake';
import { ReviewPanel } from '@/components/tailor/job-intake/review-panel';
import { SourceInput } from '@/components/tailor/job-intake/source-input';
import { SourceSelector } from '@/components/tailor/job-intake/source-selector';
import type { IntakeSource } from '@/components/tailor/job-intake/types';

interface JobIntakeWizardProps {
  masterResumeId: string;
  disabled: boolean;
  canTailor: boolean;
  onJobConfirmed: (result: { jobId: string; jobDescription: string }) => void | Promise<void>;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPdfFile(file: File): boolean {
  const hasPdfName = file.name.toLowerCase().endsWith('.pdf');
  const mimeType = file.type.toLowerCase();
  const hasPdfType =
    mimeType === '' || mimeType.includes('pdf') || mimeType.endsWith('octet-stream');
  return hasPdfName && hasPdfType;
}

function toMetadata(
  extraction: JobIntakeExtractResponse,
  screeningQuestions: ScreeningQuestion[],
  draftAnswers: DraftAnswer[]
): JobIntakeMetadata {
  return {
    source_type: extraction.source_type,
    source_url: extraction.source_url ?? null,
    source_title: extraction.source_title ?? null,
    links: extraction.links,
    screening_questions: screeningQuestions,
    draft_answers: draftAnswers,
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
  const [reviewedScreeningQuestions, setReviewedScreeningQuestions] = useState<ScreeningQuestion[]>(
    []
  );
  const [reviewedDraftAnswers, setReviewedDraftAnswers] = useState<DraftAnswer[]>([]);
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

    if ((sourceType === 'job_url' || sourceType === 'pdf_url') && !isHttpUrl(sourceText.trim())) {
      setError(t('tailor.intake.errors.invalidUrl'));
      return;
    }
    if (sourceType === 'pdf_upload' && selectedFile && !isPdfFile(selectedFile)) {
      setError(t('tailor.intake.errors.invalidPdf'));
      return;
    }

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
      setReviewedScreeningQuestions(result.screening_questions);
      setReviewedDraftAnswers(result.draft_answers);
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
        intake_metadata: toMetadata(extraction, reviewedScreeningQuestions, reviewedDraftAnswers),
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
    setReviewedScreeningQuestions([]);
    setReviewedDraftAnswers([]);
    setError(null);
  };

  const handleScreeningQuestionChange = (questionId: string, questionText: string) => {
    setReviewedScreeningQuestions((questions) =>
      questions.map((question) =>
        question.id === questionId ? { ...question, question: questionText } : question
      )
    );
  };

  const handleDraftAnswerChange = (questionId: string, answerText: string) => {
    setReviewedDraftAnswers((answers) => {
      const existingAnswer = answers.find((answer) => answer.question_id === questionId);
      if (!existingAnswer) {
        return [
          ...answers,
          {
            question_id: questionId,
            answer: answerText,
            evidence: [],
            needs_user_input: answerText.trim().length === 0,
            prompt: '',
          },
        ];
      }
      return answers.map((answer) =>
        answer.question_id === questionId
          ? {
              ...answer,
              answer: answerText,
              needs_user_input: answerText.trim().length === 0,
            }
          : answer
      );
    });
  };

  const handleSourceChange = (nextSourceType: IntakeSource) => {
    if (nextSourceType === sourceType) return;
    setSourceType(nextSourceType);
    setSourceText('');
    setSelectedFile(null);
    resetReview();
  };

  return (
    <div className="space-y-6">
      <SourceSelector
        sourceType={sourceType}
        disabled={disabled || isExtracting || isConfirming}
        onSourceChange={handleSourceChange}
      />

      {!extraction && (
        <SourceInput
          sourceType={sourceType}
          sourceText={sourceText}
          disabled={disabled}
          isExtracting={isExtracting}
          canExtract={canExtract}
          onTextChange={setSourceText}
          onFileChange={setSelectedFile}
          onExtract={handleExtract}
          onTextareaKeyDown={handleTextareaKeyDown}
        />
      )}

      {extraction && (
        <ReviewPanel
          extraction={extraction}
          reviewText={reviewText}
          screeningQuestions={reviewedScreeningQuestions}
          draftAnswers={reviewedDraftAnswers}
          isConfirming={isConfirming}
          canTailor={canTailor}
          onReviewTextChange={setReviewText}
          onScreeningQuestionChange={handleScreeningQuestionChange}
          onDraftAnswerChange={handleDraftAnswerChange}
          onTextareaKeyDown={handleTextareaKeyDown}
          onChangeSource={resetReview}
          onConfirm={handleConfirm}
        />
      )}

      {error && (
        <div className="border-2 border-red-600 bg-red-50 p-4 font-mono text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
