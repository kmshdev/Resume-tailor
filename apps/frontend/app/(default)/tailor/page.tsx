'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useResumePreview } from '@/components/common/resume_previewer_context';
import type { ImprovedResult } from '@/components/common/resume_previewer_context';
import type { ResumeData } from '@/components/dashboard/resume-component';
import { previewImproveResume, confirmImproveResume } from '@/lib/api/resume';
import { createResumeEvaluation } from '@/lib/api/evaluation';
import { fetchPromptConfig, type PromptOption } from '@/lib/api/config';
import { Dropdown } from '@/components/ui/dropdown';
import { useStatusCache } from '@/lib/context/status-cache';
import { ArrowLeft, Loader2, AlertTriangle, Settings } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { DiffPreviewModal } from '@/components/tailor/diff-preview-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { JobIntakeWizard } from '@/components/tailor/job-intake-wizard';
import {
  TailorSessionCards,
  type TailorSessionStep,
} from '@/components/tailor/tailor-session-cards';

type EvaluationSessionStep = Extract<TailorSessionStep, 'pre_score' | 'post_score'>;

export default function TailorPage() {
  const { t } = useTranslations();
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [promptOptions, setPromptOptions] = useState<PromptOption[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('tailored_resume_generator');
  const [promptLoading, setPromptLoading] = useState(false);
  const hasUserSelectedPrompt = useRef(false);
  const missingDiffConfirmInFlight = useRef(false);

  // Diff preview modal state
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [pendingResult, setPendingResult] = useState<ImprovedResult | null>(null);
  const [diffConfirmError, setDiffConfirmError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showMissingDiffDialog, setShowMissingDiffDialog] = useState(false);
  const [missingDiffResult, setMissingDiffResult] = useState<ImprovedResult | null>(null);
  const [missingDiffError, setMissingDiffError] = useState<string | null>(null);
  const [activeSessionStep, setActiveSessionStep] = useState<TailorSessionStep>('add_job');
  const [completedSessionSteps, setCompletedSessionSteps] = useState<TailorSessionStep[]>([]);
  const [evaluationScores, setEvaluationScores] = useState<
    Partial<Record<EvaluationSessionStep, number>>
  >({});
  const [evaluationWarnings, setEvaluationWarnings] = useState<
    Partial<Record<EvaluationSessionStep, string | null>>
  >({});

  // Elapsed timer for long operations
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setElapsed(0);
  }, []);

  const completeSessionSteps = useCallback((steps: TailorSessionStep[]) => {
    setCompletedSessionSteps((previousSteps) => {
      const nextSteps = new Set(previousSteps);
      steps.forEach((step) => nextSteps.add(step));
      return Array.from(nextSteps);
    });
  }, []);

  const removeCompletedSessionSteps = useCallback((steps: TailorSessionStep[]) => {
    setCompletedSessionSteps((previousSteps) =>
      previousSteps.filter((step) => !steps.includes(step))
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const router = useRouter();
  const { setImprovedData } = useResumePreview();
  const {
    status: systemStatus,
    isLoading: statusLoading,
    incrementJobs,
    incrementImprovements,
    incrementResumes,
  } = useStatusCache();

  // Check if LLM is configured
  const isLlmConfigured = !statusLoading && systemStatus?.llm_configured;

  useEffect(() => {
    const storedId = localStorage.getItem('master_resume_id');
    if (!storedId) {
      router.push('/dashboard');
    } else {
      setMasterResumeId(storedId);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const loadPromptConfig = async () => {
      setPromptLoading(true);
      try {
        const config = await fetchPromptConfig();
        if (!cancelled) {
          setPromptOptions(config.prompt_options || []);
          if (!hasUserSelectedPrompt.current) {
            setSelectedPromptId(config.default_prompt_id || 'tailored_resume_generator');
          }
        }
      } catch (err) {
        console.error('Failed to load prompt config', err);
      } finally {
        if (!cancelled) {
          setPromptLoading(false);
        }
      }
    };

    loadPromptConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildConfirmPayload = (result: ImprovedResult) => {
    if (!masterResumeId) {
      throw new Error('Master resume ID is missing.');
    }
    const resumePreview = result.data.resume_preview;
    if (!resumePreview || typeof resumePreview !== 'object' || Array.isArray(resumePreview)) {
      throw new Error('Resume preview data is invalid.');
    }
    const previewRecord = resumePreview as unknown as Record<string, unknown>;
    if (
      !previewRecord.personalInfo ||
      typeof previewRecord.personalInfo !== 'object' ||
      Array.isArray(previewRecord.personalInfo)
    ) {
      throw new Error('Resume preview data is invalid.');
    }
    return {
      resume_id: masterResumeId,
      job_id: result.data.job_id,
      improved_data: resumePreview as ResumeData,
      improvements:
        result.data.improvements?.map((item) => ({
          suggestion: item.suggestion,
          lineNumber: typeof item.lineNumber === 'number' ? item.lineNumber : null,
        })) ?? [],
    };
  };

  const runTailorEvaluation = async ({
    resumeId,
    step,
    jobId,
    baselineResumeId,
  }: {
    resumeId: string;
    step: EvaluationSessionStep;
    jobId: string;
    baselineResumeId?: string;
  }) => {
    try {
      const evaluation =
        step === 'pre_score'
          ? await createResumeEvaluation(resumeId, {
              phase: 'pre_tailor',
              job_id: jobId,
            })
          : await createResumeEvaluation(resumeId, {
              phase: 'post_tailor',
              job_id: jobId,
              baseline_resume_id: baselineResumeId,
            });

      setEvaluationScores((previousScores) => ({
        ...previousScores,
        [step]: evaluation.overall_score,
      }));
      setEvaluationWarnings((previousWarnings) => ({
        ...previousWarnings,
        [step]: null,
      }));
    } catch (err) {
      console.error(`Failed to run ${step} evaluation`, err);
      setEvaluationScores((previousScores) => {
        const nextScores = { ...previousScores };
        delete nextScores[step];
        return nextScores;
      });
      setEvaluationWarnings((previousWarnings) => ({
        ...previousWarnings,
        [step]: t('evaluation.errors.checkFailed'),
      }));
    } finally {
      completeSessionSteps([step]);
    }
  };

  const confirmAndNavigate = async (result: ImprovedResult) => {
    const confirmed = await confirmImproveResume(buildConfirmPayload(result));
    incrementImprovements();
    incrementResumes();
    setImprovedData(confirmed);

    const newResumeId = confirmed?.data?.resume_id;
    if (newResumeId) {
      void runTailorEvaluation({
        resumeId: newResumeId,
        step: 'post_score',
        jobId: confirmed.data.job_id,
        baselineResumeId: masterResumeId ?? undefined,
      });
      router.push(`/resumes/${newResumeId}`);
    } else {
      router.push('/builder');
    }
  };

  const getGenerateValidationError = (trimmedDescription: string) => {
    if (!trimmedDescription) return null;
    if (trimmedDescription.length < 50) {
      return t('tailor.errors.jobDescriptionTooShort');
    }
    return null;
  };

  const runPreviewForJob = async (resumeId: string, jobId: string) => {
    setActiveSessionStep('tailor');
    try {
      const result = await previewImproveResume(resumeId, jobId, selectedPromptId);
      completeSessionSteps(['tailor']);
      setActiveSessionStep('review_changes');

      if (!result?.data?.diff_summary || !result?.data?.detailed_changes) {
        console.warn('Diff data missing for tailor preview; requesting user confirmation.');
        setDiffConfirmError(null);
        setPendingResult(null);
        setShowDiffModal(false);
        setMissingDiffError(null);
        setMissingDiffResult(result);
        setShowMissingDiffDialog(true);
        return;
      }

      setDiffConfirmError(null);
      setMissingDiffError(null);
      setPendingResult(result);
      setShowDiffModal(true);
    } catch (err) {
      console.error(err);
      setActiveSessionStep('tailor');
      removeCompletedSessionSteps(['tailor', 'review_changes', 'post_score']);
      // Check for common error patterns
      const errorMessage = err instanceof Error ? err.message : '';
      if (
        errorMessage.toLowerCase().includes('api key') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage.includes('401')
      ) {
        setError(t('tailor.errors.apiKeyError'));
      } else if (
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.includes('429')
      ) {
        setError(t('tailor.errors.rateLimit'));
      } else if (
        errorMessage.toLowerCase().includes('timed out') ||
        errorMessage.toLowerCase().includes('timeout')
      ) {
        setError(t('tailor.errors.timeout'));
      } else {
        setError(t('tailor.errors.failedToPreview'));
      }
    }
  };

  const handleJobConfirmed = async ({
    jobId,
    jobDescription: reviewedJobDescription,
  }: {
    jobId: string;
    jobDescription: string;
  }) => {
    const trimmedDescription = reviewedJobDescription.trim();
    if (!trimmedDescription || !masterResumeId) return;
    const validationError = getGenerateValidationError(trimmedDescription);
    if (validationError) {
      setError(validationError);
      return;
    }
    const resumeId = masterResumeId;
    setCurrentJobId(jobId);
    setJobDescription(trimmedDescription);
    setCompletedSessionSteps(['add_job', 'review_jd']);
    setActiveSessionStep('pre_score');
    setEvaluationScores({});
    setEvaluationWarnings({});
    incrementJobs();
    setIsLoading(true);
    setError(null);
    startTimer();
    try {
      void runTailorEvaluation({
        resumeId,
        step: 'pre_score',
        jobId,
      });
      await runPreviewForJob(resumeId, jobId);
    } finally {
      setIsLoading(false);
      stopTimer();
    }
  };

  // User confirms changes
  const handleConfirmChanges = async () => {
    if (!pendingResult || isConfirming) return;

    setIsConfirming(true);
    setError(null);
    setDiffConfirmError(null);
    setActiveSessionStep('post_score');
    completeSessionSteps(['review_changes']);
    removeCompletedSessionSteps(['post_score']);
    setEvaluationWarnings((previousWarnings) => ({
      ...previousWarnings,
      post_score: null,
    }));

    try {
      await confirmAndNavigate(pendingResult);
      setShowDiffModal(false);
      setPendingResult(null);
    } catch (err) {
      console.error(err);
      setActiveSessionStep('review_changes');
      removeCompletedSessionSteps(['post_score']);
      const errorMessage = t('tailor.errors.failedToConfirm');
      setError(errorMessage);
      setDiffConfirmError(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  };

  // User rejects changes
  const handleRejectChanges = () => {
    setShowDiffModal(false);
    setPendingResult(null);
    setDiffConfirmError(null);
    setShowRegenerateDialog(true);
    setActiveSessionStep('tailor');
    removeCompletedSessionSteps(['review_changes', 'post_score']);
  };

  const handleCloseDiffModal = () => {
    setShowDiffModal(false);
    setPendingResult(null);
    setDiffConfirmError(null);
  };

  const handleCloseMissingDiffDialog = () => {
    setShowMissingDiffDialog(false);
    setMissingDiffResult(null);
    setMissingDiffError(null);
    missingDiffConfirmInFlight.current = false;
  };

  const handleMissingDiffConfirm = async () => {
    if (!missingDiffResult || isLoading || missingDiffConfirmInFlight.current) return;
    missingDiffConfirmInFlight.current = true;
    setIsLoading(true);
    setError(null);
    setMissingDiffError(null);
    setActiveSessionStep('post_score');
    completeSessionSteps(['review_changes']);
    removeCompletedSessionSteps(['post_score']);
    setEvaluationWarnings((previousWarnings) => ({
      ...previousWarnings,
      post_score: null,
    }));
    try {
      await confirmAndNavigate(missingDiffResult);
      handleCloseMissingDiffDialog();
    } catch (err) {
      console.error(err);
      setActiveSessionStep('review_changes');
      removeCompletedSessionSteps(['post_score']);
      const errorMessage = t('tailor.errors.failedToConfirm');
      setError(errorMessage);
      setMissingDiffError(errorMessage);
    } finally {
      missingDiffConfirmInFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    setShowRegenerateDialog(false);
    const trimmedDescription = jobDescription.trim();
    if (!trimmedDescription || !masterResumeId || !currentJobId) return;
    const validationError = getGenerateValidationError(trimmedDescription);
    if (validationError) {
      setError(validationError);
      return;
    }
    const resumeId = masterResumeId;
    setIsLoading(true);
    setError(null);
    setActiveSessionStep('tailor');
    removeCompletedSessionSteps(['tailor', 'review_changes', 'post_score']);
    setEvaluationScores((previousScores) => {
      const nextScores = { ...previousScores };
      delete nextScores.post_score;
      return nextScores;
    });
    setEvaluationWarnings((previousWarnings) => ({
      ...previousWarnings,
      post_score: null,
    }));
    startTimer();
    try {
      await runPreviewForJob(resumeId, currentJobId);
    } finally {
      setIsLoading(false);
      stopTimer();
    }
  };

  const evaluationWarningMessages = [
    evaluationWarnings.pre_score
      ? `${t('tailor.session.steps.pre_score')}: ${evaluationWarnings.pre_score}`
      : null,
    evaluationWarnings.post_score
      ? `${t('tailor.session.steps.post_score')}: ${evaluationWarnings.post_score}`
      : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <div className="w-full font-sans">
      <div className="grid gap-6 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] xl:items-start">
        <aside className="xl:sticky xl:top-6">
          <TailorSessionCards
            activeStep={activeSessionStep}
            completedSteps={completedSessionSteps}
            scores={evaluationScores}
            warnings={evaluationWarnings}
          />
        </aside>

        <section className="min-w-0 border border-black bg-white p-4 shadow-sw-lg sm:p-6 lg:p-8">
          <div className="mb-6 border-b border-black pb-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black shadow-sw-default hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('common.back')}
            </button>
            <h1 className="font-serif text-3xl font-bold uppercase tracking-tight md:text-4xl">
              {t('tailor.heroTitle')}
            </h1>
            <p className="mt-2 font-mono text-sm font-bold uppercase text-blue-700">
              {'// '}
              {t('tailor.intake.subtitle')}
            </p>
          </div>

          {/* LLM Not Configured Warning */}
          {!statusLoading && !isLlmConfigured && (
            <div className="mb-6 border-2 border-amber-500 bg-amber-50 p-4 shadow-sw-default">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                    {t('tailor.setupRequiredTitle')}
                  </p>
                  <p className="mt-1 font-mono text-xs text-amber-700">
                    {t('tailor.noApiKeyMessage')}
                  </p>
                  <Link
                    href="/settings"
                    className="mt-3 inline-flex items-center gap-2 text-amber-700 hover:text-amber-900"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="font-mono text-xs font-bold uppercase underline">
                      {t('tailor.configureApiKey')}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Dropdown
              options={
                promptOptions.length > 0
                  ? promptOptions.map((opt) => ({
                      id: opt.id,
                      label: t(`tailor.promptOptions.${opt.id}.label`),
                      description: t(`tailor.promptOptions.${opt.id}.description`),
                    }))
                  : [
                      {
                        id: 'tailored_resume_generator',
                        label: t('tailor.promptOptions.tailored_resume_generator.label'),
                        description: t(
                          'tailor.promptOptions.tailored_resume_generator.description'
                        ),
                      },
                      {
                        id: 'nudge',
                        label: t('tailor.promptOptions.nudge.label'),
                        description: t('tailor.promptOptions.nudge.description'),
                      },
                      {
                        id: 'keywords',
                        label: t('tailor.promptOptions.keywords.label'),
                        description: t('tailor.promptOptions.keywords.description'),
                      },
                      {
                        id: 'full',
                        label: t('tailor.promptOptions.full.label'),
                        description: t('tailor.promptOptions.full.description'),
                      },
                    ]
              }
              value={selectedPromptId}
              onChange={(value) => {
                hasUserSelectedPrompt.current = true;
                setSelectedPromptId(value);
              }}
              label={t('tailor.promptLabel')}
              description={t('tailor.promptDescription')}
              disabled={isLoading || promptLoading}
            />

            {masterResumeId && (
              <JobIntakeWizard
                masterResumeId={masterResumeId}
                disabled={isLoading || statusLoading}
                canTailor={Boolean(isLlmConfigured)}
                onJobConfirmed={handleJobConfirmed}
              />
            )}

            {isLoading && (
              <div className="flex items-center justify-center gap-2 border-2 border-black bg-white p-4 font-mono text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('common.processing')}
                {elapsed > 0 && <span className="text-xs opacity-70">{elapsed}s</span>}
              </div>
            )}

            {evaluationWarningMessages.length > 0 && (
              <div className="border-2 border-orange-500 bg-orange-50 p-4 font-mono text-sm text-orange-700">
                {evaluationWarningMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 border border-red-600 bg-red-50 p-4 font-mono text-sm text-red-700">
                <span>!</span> {error}
              </div>
            )}

            {statusLoading && (
              <div className="flex items-center justify-center gap-2 border-2 border-black bg-white p-4 font-mono text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('common.checking')}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Diff preview modal */}
      {showDiffModal && pendingResult && (
        <DiffPreviewModal
          isOpen={showDiffModal}
          isConfirming={isConfirming}
          onClose={handleCloseDiffModal}
          onReject={handleRejectChanges}
          onConfirm={handleConfirmChanges}
          diffSummary={pendingResult?.data?.diff_summary}
          detailedChanges={pendingResult?.data?.detailed_changes}
          errorMessage={diffConfirmError ?? undefined}
        />
      )}

      <ConfirmDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        title={t('tailor.regenerateDialog.title')}
        description={t('tailor.regenerateDialog.description')}
        confirmLabel={t('tailor.regenerateDialog.confirmLabel')}
        cancelLabel={t('common.cancel')}
        variant="warning"
        onConfirm={handleRegenerateConfirm}
      />

      <ConfirmDialog
        open={showMissingDiffDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseMissingDiffDialog();
          }
        }}
        title={t('tailor.missingDiffDialog.title')}
        description={t('tailor.missingDiffDialog.description')}
        confirmLabel={t('tailor.missingDiffDialog.confirmLabel')}
        cancelLabel={t('common.cancel')}
        variant="warning"
        closeOnConfirm={false}
        onConfirm={handleMissingDiffConfirm}
        onCancel={handleCloseMissingDiffDialog}
        confirmDisabled={isLoading || !missingDiffResult}
        errorMessage={missingDiffError ?? undefined}
      />
    </div>
  );
}
