'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Settings from 'lucide-react/dist/esm/icons/settings';
import { CommandCenter } from '@/components/dashboard/command-center';
import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import { TailorCardStack } from '@/components/dashboard/tailor-card-stack';
import { EvaluationCard } from '@/components/evaluation/evaluation-card';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  createResumeEvaluation,
  fetchLatestResumeEvaluations,
  type EvaluationPhase,
  type LatestResumeEvaluationsResponse,
  type ResumeEvaluationRequest,
} from '@/lib/api/evaluation';
import {
  deleteResume,
  fetchJobDescription,
  fetchResume,
  fetchResumeList,
  retryProcessing,
  type ResumeListItem,
} from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';
import { useTranslations } from '@/lib/i18n';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';
type EvaluationErrors = Partial<Record<EvaluationPhase, string | null>>;

const EMPTY_EVALUATIONS: LatestResumeEvaluationsResponse = {
  readiness: null,
  pre_tailor: null,
  post_tailor: null,
};

export default function DashboardPage() {
  const { t, locale } = useTranslations();
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('loading');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tailoredResumes, setTailoredResumes] = useState<ResumeListItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [latestEvaluations, setLatestEvaluations] =
    useState<LatestResumeEvaluationsResponse>(EMPTY_EVALUATIONS);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationErrors, setEvaluationErrors] = useState<EvaluationErrors>({});
  const [checkingPhase, setCheckingPhase] = useState<EvaluationPhase | null>(null);
  const router = useRouter();

  const {
    status: systemStatus,
    isLoading: statusLoading,
    incrementResumes,
    decrementResumes,
    setHasMasterResume,
  } = useStatusCache();

  const loadRequestIdRef = useRef(0);
  const evaluationRequestIdRef = useRef(0);
  const jobSnippetCacheRef = useRef<Record<string, string>>({});

  const isLlmConfigured = Boolean(!statusLoading && systemStatus?.llm_configured);
  const isTailorEnabled =
    Boolean(masterResumeId) && processingStatus === 'ready' && isLlmConfigured;
  const canRunReadinessEvaluation = isTailorEnabled;

  const formatDate = (value: string) => {
    if (!value) return t('common.unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('common.unknown');

    const dateLocale =
      locale === 'es' ? 'es-ES' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';

    return date.toLocaleDateString(dateLocale, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const checkResumeStatus = useCallback(async (resumeId: string) => {
    try {
      setProcessingStatus('loading');
      const data = await fetchResume(resumeId);
      const status = data.raw_resume?.processing_status || 'pending';
      setProcessingStatus(status as ProcessingStatus);
    } catch (err: unknown) {
      console.error('Failed to check resume status:', err);
      if (err instanceof Error && err.message.includes('404')) {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
        return;
      }
      setProcessingStatus('failed');
    }
  }, []);

  const loadLatestEvaluations = useCallback(
    async (resumeId: string) => {
      const requestId = ++evaluationRequestIdRef.current;
      setEvaluationsLoading(true);
      setEvaluationErrors({});
      try {
        const latest = await fetchLatestResumeEvaluations(resumeId);
        if (requestId === evaluationRequestIdRef.current) {
          setLatestEvaluations(latest);
        }
      } catch (err) {
        console.error('Failed to load latest evaluations:', err);
        if (requestId === evaluationRequestIdRef.current) {
          setLatestEvaluations(EMPTY_EVALUATIONS);
          setEvaluationErrors({
            readiness: t('evaluation.errors.loadFailed'),
            pre_tailor: t('evaluation.errors.loadFailed'),
            post_tailor: t('evaluation.errors.loadFailed'),
          });
        }
      } finally {
        if (requestId === evaluationRequestIdRef.current) {
          setEvaluationsLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    const storedId = localStorage.getItem('master_resume_id');
    if (storedId) {
      setMasterResumeId(storedId);
      checkResumeStatus(storedId);
    }
  }, [checkResumeStatus]);

  useEffect(() => {
    if (!masterResumeId) {
      setLatestEvaluations(EMPTY_EVALUATIONS);
      setEvaluationErrors({});
      setEvaluationsLoading(false);
      return;
    }

    void loadLatestEvaluations(masterResumeId);
  }, [loadLatestEvaluations, masterResumeId]);

  const loadTailoredResumes = useCallback(async () => {
    try {
      const data = await fetchResumeList(true);
      const masterFromList = data.find((r) => r.is_master);
      const storedId = localStorage.getItem('master_resume_id');
      const resolvedMasterId = masterFromList?.resume_id || storedId;

      if (resolvedMasterId) {
        localStorage.setItem('master_resume_id', resolvedMasterId);
        setMasterResumeId(resolvedMasterId);
        checkResumeStatus(resolvedMasterId);
      } else {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
      }

      const filtered = data.filter((r) => r.resume_id !== resolvedMasterId);
      setTailoredResumes(filtered);
      const tailoredWithParent = filtered.filter((r) => r.parent_id);
      const requestId = ++loadRequestIdRef.current;
      const jobSnippets: Record<string, string> = {};

      await Promise.all(
        tailoredWithParent.map(async (resume) => {
          if (jobSnippetCacheRef.current[resume.resume_id]) {
            jobSnippets[resume.resume_id] = jobSnippetCacheRef.current[resume.resume_id];
            return;
          }
          try {
            const jd = await fetchJobDescription(resume.resume_id);
            const snippet = (jd?.content || '').slice(0, 80);
            jobSnippetCacheRef.current[resume.resume_id] = snippet;
            jobSnippets[resume.resume_id] = snippet;
          } catch {
            jobSnippetCacheRef.current[resume.resume_id] = '';
            jobSnippets[resume.resume_id] = '';
          }
        })
      );

      if (requestId === loadRequestIdRef.current) {
        setTailoredResumes((prev) =>
          prev.map((resume) => ({
            ...resume,
            jobSnippet: jobSnippets[resume.resume_id] || resume.jobSnippet || '',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load tailored resumes:', err);
    }
  }, [checkResumeStatus]);

  useEffect(() => {
    void loadTailoredResumes();
  }, [loadTailoredResumes]);

  useEffect(() => {
    const handleFocus = () => {
      void loadTailoredResumes();
      const storedId = localStorage.getItem('master_resume_id') || masterResumeId;
      if (storedId) {
        void loadLatestEvaluations(storedId);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadLatestEvaluations, loadTailoredResumes, masterResumeId]);

  const runEvaluation = useCallback(
    async (resumeId: string, request: ResumeEvaluationRequest) => {
      if (!resumeId || !isLlmConfigured) return;

      setCheckingPhase(request.phase);
      setEvaluationErrors((current) => ({ ...current, [request.phase]: null }));
      try {
        const evaluation = await createResumeEvaluation(resumeId, request);
        setLatestEvaluations((current) => ({ ...current, [request.phase]: evaluation }));
      } catch (err) {
        console.error('Failed to run evaluation:', err);
        setEvaluationErrors((current) => ({
          ...current,
          [request.phase]: t('evaluation.errors.checkFailed'),
        }));
      } finally {
        setCheckingPhase((current) => (current === request.phase ? null : current));
      }
    },
    [isLlmConfigured, t]
  );

  const handleRunReadinessEvaluation = useCallback(() => {
    if (!masterResumeId || !canRunReadinessEvaluation) return;
    void runEvaluation(masterResumeId, {
      phase: 'readiness',
      force_refresh: Boolean(latestEvaluations.readiness?.stale),
    });
  }, [
    canRunReadinessEvaluation,
    latestEvaluations.readiness?.stale,
    masterResumeId,
    runEvaluation,
  ]);

  const handleRefreshEvaluation = useCallback(
    (phase: Exclude<EvaluationPhase, 'readiness'>) => {
      const current = latestEvaluations[phase];
      if (!current?.stale || !current.job_id) return;

      void runEvaluation(current.resume_id, {
        phase,
        job_id: current.job_id,
        baseline_resume_id:
          phase === 'post_tailor' ? current.baseline_resume_id || masterResumeId : undefined,
        force_refresh: true,
      });
    },
    [latestEvaluations, masterResumeId, runEvaluation]
  );

  const handleUploadComplete = (resumeId: string) => {
    localStorage.setItem('master_resume_id', resumeId);
    setMasterResumeId(resumeId);
    checkResumeStatus(resumeId);
    incrementResumes();
    setHasMasterResume(true);
  };

  const handleRetryProcessing = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!masterResumeId) return;
    setIsRetrying(true);
    try {
      const result = await retryProcessing(masterResumeId);
      if (result.processing_status === 'ready') {
        setProcessingStatus('ready');
      } else if (
        result.processing_status === 'processing' ||
        result.processing_status === 'pending'
      ) {
        setProcessingStatus(result.processing_status);
      } else {
        setProcessingStatus('failed');
      }
    } catch (err) {
      console.error('Retry processing failed:', err);
      setProcessingStatus('failed');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteAndReupload = (e: MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDeleteAndReupload = async () => {
    if (!masterResumeId) return;
    try {
      await deleteResume(masterResumeId);
      decrementResumes();
      setHasMasterResume(false);
      localStorage.removeItem('master_resume_id');
      setMasterResumeId(null);
      setProcessingStatus('loading');
      setIsUploadDialogOpen(true);
      await loadTailoredResumes();
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const getStatusDisplay = () => {
    switch (processingStatus) {
      case 'loading':
        return {
          text: t('dashboard.status.checking'),
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          color: 'text-steel-grey',
        };
      case 'processing':
        return {
          text: t('dashboard.status.processing'),
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          color: 'text-blue-700',
        };
      case 'ready':
        return { text: t('dashboard.status.ready'), icon: null, color: 'text-green-700' };
      case 'failed':
        return {
          text: t('dashboard.status.failed'),
          icon: <AlertCircle className="h-3 w-3" />,
          color: 'text-red-600',
        };
      default:
        return { text: t('dashboard.status.pending'), icon: null, color: 'text-steel-grey' };
    }
  };

  const getMonogram = (title: string): string => {
    const words = title.split(/\s+/).filter((word) => /^[a-zA-Z]/.test(word));
    return words
      .slice(0, 3)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  };

  const cardPalette = [
    { bg: '#1D4ED8', fg: '#FFFFFF' },
    { bg: '#15803D', fg: '#FFFFFF' },
    { bg: '#000000', fg: '#FFFFFF' },
    { bg: '#F97316', fg: '#FFFFFF' },
    { bg: '#DC2626', fg: '#FFFFFF' },
  ];

  const hashTitle = (title: string): number => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash << 5) - hash + title.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const hasTailoredResume = tailoredResumes.length > 0;
  const readinessLoading = evaluationsLoading || checkingPhase === 'readiness';
  const preTailorLoading = evaluationsLoading || checkingPhase === 'pre_tailor';
  const postTailorLoading = evaluationsLoading || checkingPhase === 'post_tailor';
  const canRefreshPreTailor = Boolean(
    latestEvaluations.pre_tailor?.stale && latestEvaluations.pre_tailor.job_id && isLlmConfigured
  );
  const canRefreshPostTailor = Boolean(
    latestEvaluations.post_tailor?.stale && latestEvaluations.post_tailor.job_id && isLlmConfigured
  );

  const configurationWarning =
    masterResumeId && !isLlmConfigured && !statusLoading ? (
      <div className="flex flex-col gap-4 border-2 border-orange-500 bg-background p-4 shadow-sw-default md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-500" />
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-orange-500">
              {t('dashboard.llmNotConfiguredTitle')}
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-wide text-black">
              {t('dashboard.llmNotConfiguredMessage')}
            </p>
          </div>
        </div>
        <Link href="/settings" className="shrink-0">
          <Button variant="outline" size="sm" className="bg-white text-black">
            <Settings className="h-4 w-4" />
            {t('nav.settings')}
          </Button>
        </Link>
      </div>
    ) : null;

  const resumeContext = (
    <section className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-black pb-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-blue-700">
            {t('dashboard.cardStack.masterResume')}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold uppercase leading-none">
            {t('dashboard.masterResume')}
          </h2>
        </div>
        <span
          aria-hidden="true"
          className={`mt-1 h-3 w-3 ${processingStatus === 'ready' ? 'bg-green-700' : processingStatus === 'failed' ? 'bg-red-600' : 'bg-orange-500'}`}
        />
      </div>

      <div className="mt-5">
        {!masterResumeId ? (
          !isLlmConfigured && !statusLoading ? (
            <Link href="/settings" className="block">
              <Card
                variant="interactive"
                className="min-h-72 border-2 border-orange-500 bg-background"
              >
                <div className="flex flex-1 flex-col justify-between">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-orange-500 bg-white">
                    <AlertTriangle className="h-7 w-7 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="mb-2 text-lg uppercase text-orange-500">
                      {t('dashboard.setupRequiredTitle')}
                    </CardTitle>
                    <CardDescription className="text-xs text-black">
                      {t('dashboard.setupRequiredMessage')}
                    </CardDescription>
                    <div className="mt-4 flex items-center gap-2 text-black">
                      <Settings className="h-4 w-4" />
                      <span className="font-mono text-xs font-bold uppercase">
                        {t('nav.goToSettings')}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <ResumeUploadDialog
              open={isUploadDialogOpen}
              onOpenChange={setIsUploadDialogOpen}
              onUploadComplete={handleUploadComplete}
              trigger={
                <Card
                  variant="interactive"
                  className="min-h-72 border-2 border-black bg-background hover:bg-blue-700 hover:text-white"
                >
                  <div className="pointer-events-none flex flex-1 flex-col justify-between">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-current">
                      <span className="relative top-[-2px] text-2xl leading-none">+</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl uppercase">
                        {t('dashboard.initializeMasterResume')}
                      </CardTitle>
                      <CardDescription className="mt-2 text-current opacity-70">
                        {'// '}
                        {t('dashboard.initializeSequence')}
                      </CardDescription>
                    </div>
                  </div>
                </Card>
              }
            />
          )
        ) : (
          <Card
            variant="interactive"
            className="min-h-72 border-2 border-black bg-background"
            onClick={() => router.push(`/resumes/${masterResumeId}`)}
          >
            <div className="flex h-full flex-1 flex-col">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex h-16 w-16 items-center justify-center border-2 border-black bg-blue-700 text-white">
                  <span className="font-mono text-lg font-bold">M</span>
                </div>
                <div className="flex gap-1">
                  {(processingStatus === 'failed' || processingStatus === 'processing') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative z-10 h-8 w-8 rounded-none hover:bg-blue-100 hover:text-blue-700"
                      onClick={handleRetryProcessing}
                      disabled={isRetrying}
                      aria-label={t('dashboard.retryProcessing')}
                      title={t('dashboard.retryProcessing')}
                    >
                      {isRetrying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <CardTitle className="text-lg group-hover:text-primary">
                {t('dashboard.masterResume')}
              </CardTitle>

              <div
                className={`mt-auto flex flex-col gap-2 pt-4 font-mono text-xs uppercase ${getStatusDisplay().color}`}
              >
                <div className="flex items-center gap-1">
                  {getStatusDisplay().icon}
                  {t('dashboard.statusLine', { status: getStatusDisplay().text })}
                </div>
                {(processingStatus === 'failed' || processingStatus === 'processing') && (
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none border-black text-xs"
                      onClick={handleRetryProcessing}
                      disabled={isRetrying}
                    >
                      {isRetrying
                        ? t('dashboard.retryingProcessing')
                        : t('dashboard.retryProcessing')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-none border-red-600 text-xs text-red-600 hover:bg-red-50"
                      onClick={handleDeleteAndReupload}
                    >
                      {t('dashboard.deleteAndReupload')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </section>
  );

  const workflow = (
    <section>
      <div className="border-b border-black p-5 md:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-blue-700">
          {t('dashboard.cardStack.tailorFlow')}
        </p>
        <h2 className="mt-2 font-serif text-3xl font-bold uppercase leading-none">
          {t('dashboard.tailorFirstRole')}
        </h2>
      </div>
      <TailorCardStack
        hasMasterResume={Boolean(masterResumeId)}
        canUploadMaster={isLlmConfigured || statusLoading}
        canTailor={isTailorEnabled}
        hasTailoredResume={hasTailoredResume}
        onUploadMaster={() => setIsUploadDialogOpen(true)}
      />
      <div className="border-t border-black p-5 md:p-6">
        <Button
          type="button"
          onClick={() => router.push('/tailor')}
          disabled={!isTailorEnabled}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          {t('dashboard.tailorFirstRole')}
        </Button>
      </div>
    </section>
  );

  const activity = (
    <section className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-black pb-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-blue-700">
            {t('dashboard.cardStack.reviewLift')}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold uppercase leading-none">
            {t('dashboard.tailoredResume')}
          </h2>
        </div>
        <span className="border border-black bg-white px-2 py-1 font-mono text-xs font-bold">
          {tailoredResumes.length}
        </span>
      </div>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {tailoredResumes.length === 0 ? (
          <div className="border-2 border-black bg-white p-5 shadow-sw-default">
            <p className="font-mono text-sm font-bold uppercase tracking-wide text-green-700">
              {t('dashboard.tailorFirstRole')}
            </p>
          </div>
        ) : null}

        {tailoredResumes.map((resume) => {
          const title =
            resume.title || resume.jobSnippet || resume.filename || t('dashboard.tailoredResume');
          const color = cardPalette[hashTitle(title) % cardPalette.length];
          return (
            <Card
              key={resume.resume_id}
              variant="interactive"
              className="min-h-40 border-2 border-black bg-canvas"
              onClick={() => router.push(`/resumes/${resume.resume_id}`)}
            >
              <div className="flex flex-1 flex-col">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black"
                    style={{ backgroundColor: color.bg, color: color.fg }}
                  >
                    <span className="font-mono font-bold">{getMonogram(title)}</span>
                  </div>
                  <span className="font-mono text-xs uppercase text-steel-grey">
                    {resume.processing_status}
                  </span>
                </div>
                <CardTitle className="text-lg">
                  <span className="line-clamp-2 block w-full font-serif text-base font-bold leading-tight">
                    {title}
                  </span>
                </CardTitle>
                <CardDescription className="mt-auto pt-4 uppercase">
                  {t('dashboard.edited', {
                    date: formatDate(resume.updated_at || resume.created_at),
                  })}
                </CardDescription>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <CommandCenter
        ariaLabel={t('dashboard.workspaceEyebrow')}
        alert={configurationWarning}
        metrics={[
          <EvaluationCard
            key="readiness"
            phase="readiness"
            evaluation={latestEvaluations.readiness}
            isLoading={readinessLoading}
            error={evaluationErrors.readiness}
            onCheck={canRunReadinessEvaluation ? handleRunReadinessEvaluation : undefined}
            onRefresh={canRunReadinessEvaluation ? handleRunReadinessEvaluation : undefined}
            disabled={!canRunReadinessEvaluation}
          />,
          <EvaluationCard
            key="pre_tailor"
            phase="pre_tailor"
            evaluation={latestEvaluations.pre_tailor}
            isLoading={preTailorLoading}
            error={evaluationErrors.pre_tailor}
            onRefresh={
              canRefreshPreTailor ? () => handleRefreshEvaluation('pre_tailor') : undefined
            }
            disabled={!canRefreshPreTailor}
          />,
          <EvaluationCard
            key="post_tailor"
            phase="post_tailor"
            evaluation={latestEvaluations.post_tailor}
            isLoading={postTailorLoading}
            error={evaluationErrors.post_tailor}
            onRefresh={
              canRefreshPostTailor ? () => handleRefreshEvaluation('post_tailor') : undefined
            }
            disabled={!canRefreshPostTailor}
          />,
        ]}
        resumeContext={resumeContext}
        workflow={workflow}
        activity={activity}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t('confirmations.deleteMasterResumeTitle')}
        description={t('confirmations.deleteMasterResumeDescription')}
        confirmLabel={t('dashboard.deleteAndReupload')}
        cancelLabel={t('confirmations.keepResumeCancelLabel')}
        onConfirm={confirmDeleteAndReupload}
        variant="danger"
      />
    </div>
  );
}
