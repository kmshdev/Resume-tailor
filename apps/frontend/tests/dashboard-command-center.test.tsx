import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DashboardPage from '@/app/(default)/dashboard/page';
import { CommandCenter } from '@/components/dashboard/command-center';
import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import { TailorCardStack } from '@/components/dashboard/tailor-card-stack';
import { EvaluationCard } from '@/components/evaluation/evaluation-card';
import { AppShell } from '@/components/shell/app-shell';
import { RouteTabs } from '@/components/shell/route-tabs';
import type {
  LatestResumeEvaluationsResponse,
  ResumeEvaluationResponse,
} from '@/lib/api/evaluation';
import type { ResumeListItem } from '@/lib/api/resume';

const pathnameMock = vi.hoisted(() => ({ value: '/dashboard' }));
const routerPushMock = vi.hoisted(() => vi.fn());
const resumeApiMocks = vi.hoisted(() => ({
  deleteResume: vi.fn(),
  fetchJobDescription: vi.fn(),
  fetchResume: vi.fn(),
  fetchResumeList: vi.fn(),
  retryProcessing: vi.fn(),
}));
const evaluationApiMocks = vi.hoisted(() => ({
  createResumeEvaluation: vi.fn(),
  fetchLatestResumeEvaluations: vi.fn(),
}));
const statusCacheMock = vi.hoisted(() => ({
  state: {
    status: {
      status: 'ready',
      llm_configured: true,
      llm_healthy: true,
      has_master_resume: false,
      database_stats: {
        total_resumes: 0,
        total_jobs: 0,
        total_improvements: 0,
        has_master_resume: false,
      },
    },
    isLoading: false,
  },
  incrementResumes: vi.fn(),
  decrementResumes: vi.fn(),
  setHasMasterResume: vi.fn(),
}));
const i18nMock = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('@/lib/i18n', async () => {
  const messages = ((await import('@/messages/en.json')) as { default: Record<string, unknown> })
    .default;
  const getNestedValue = (key: string): string => {
    const value = key.split('.').reduce<unknown>((current, part) => {
      if (current && typeof current === 'object' && part in current) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);

    return typeof value === 'string' ? value : key;
  };

  return {
    useTranslations: () => ({
      locale: i18nMock.locale,
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'evaluation.confidence') {
          return `${key}:${String(params?.value)}`;
        }
        if (key === 'dashboard.onboarding.uploadTitle') {
          return 'Upload your current resume';
        }
        if (
          key === 'dashboard.tailorCta' ||
          key === 'dashboard.tailorFirstRole' ||
          key === 'dashboard.edited' ||
          key === 'dashboard.uploadResume' ||
          key.startsWith('dashboard.onboarding.') ||
          key === 'common.cancel' ||
          key === 'common.uploading' ||
          key === 'a11y.removeFile' ||
          key.startsWith('dashboard.workflow.') ||
          key.startsWith('dashboard.tailorDisabled.') ||
          key.startsWith('dashboard.tailoredList.') ||
          key.startsWith('dashboard.uploadDialog.')
        ) {
          const template = getNestedValue(key);
          return Object.entries(params ?? {}).reduce(
            (text, [name, value]) => text.replace(`{${name}}`, String(value)),
            template
          );
        }
        return key;
      },
    }),
  };
});

vi.mock('@/lib/api/client', () => ({
  getUploadUrl: () => '/api/v1/resumes/upload',
}));

vi.mock('@/lib/api/resume', () => resumeApiMocks);

vi.mock('@/lib/api/evaluation', () => evaluationApiMocks);

vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: statusCacheMock.state.status,
    isLoading: statusCacheMock.state.isLoading,
    error: null,
    lastFetched: new Date('2026-05-13T00:00:00Z'),
    refreshStatus: vi.fn(),
    incrementResumes: statusCacheMock.incrementResumes,
    decrementResumes: statusCacheMock.decrementResumes,
    setHasMasterResume: statusCacheMock.setHasMasterResume,
  }),
}));

vi.mock('@/lib/api/config', () => ({
  fetchLlmConfig: vi.fn(async () => ({
    provider: 'openai',
    model: 'gpt-test',
    api_key: '***',
  })),
}));

const uploadResponse = {
  resume_id: 'resume-upload-1',
  processing_status: 'ready',
  is_master: true,
};

const emptyLatestEvaluations: LatestResumeEvaluationsResponse = {
  readiness: null,
  pre_tailor: null,
  post_tailor: null,
};

beforeEach(() => {
  pathnameMock.value = '/dashboard';
  routerPushMock.mockReset();
  Object.values(resumeApiMocks).forEach((mock) => mock.mockReset());
  Object.values(evaluationApiMocks).forEach((mock) => mock.mockReset());
  statusCacheMock.state.status = {
    status: 'ready',
    llm_configured: true,
    llm_healthy: true,
    has_master_resume: false,
    database_stats: {
      total_resumes: 0,
      total_jobs: 0,
      total_improvements: 0,
      has_master_resume: false,
    },
  };
  statusCacheMock.state.isLoading = false;
  i18nMock.locale = 'en';
  resumeApiMocks.fetchResume.mockResolvedValue({
    raw_resume: { processing_status: 'ready' },
  });
  resumeApiMocks.fetchResumeList.mockResolvedValue([]);
  resumeApiMocks.fetchJobDescription.mockResolvedValue({
    job_id: 'job-1',
    content: 'Principal platform engineer role with TypeScript and systems work.',
  });
  resumeApiMocks.retryProcessing.mockResolvedValue({ processing_status: 'ready' });
  evaluationApiMocks.fetchLatestResumeEvaluations.mockResolvedValue(emptyLatestEvaluations);
  evaluationApiMocks.createResumeEvaluation.mockResolvedValue(baseEvaluation);

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify(uploadResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const baseEvaluation: ResumeEvaluationResponse = {
  evaluation_id: 'eval-1',
  resume_id: 'resume-1',
  baseline_resume_id: null,
  job_id: null,
  phase: 'readiness',
  overall_score: 82,
  confidence: 0.91,
  dimensions: {
    clarity: 80,
    impact: 82,
    ats_readability: 86,
    keyword_alignment: 72,
    role_fit: 78,
    evidence_strength: 84,
  },
  strengths: [],
  gaps: [],
  next_actions: [],
  model: 'gpt-test',
  provider: 'openai',
  prompt_version: 'resume_evaluation_v1',
  source_hash: 'hash-1',
  created_at: '2026-05-13T00:00:00Z',
  stale: false,
  warnings: [],
};

describe('AppShell responsive shell contract', () => {
  it('uses a dynamic viewport flex shell with safe-area containers instead of a fixed 100vh calc', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    const content = screen.getByText('Dashboard content');
    const shellRoot = content.closest('.min-h-dvh');
    expect(shellRoot).toHaveClass('min-h-screen', 'flex', 'flex-col', 'bg-background');

    const headerInner = screen.getByRole('banner').firstElementChild;
    expect(headerInner).toHaveClass('safe-area-shell-x', 'safe-area-header');

    const main = content.closest('main');
    expect(main).toHaveClass('min-h-0', 'flex-1');
    expect(main?.firstElementChild).toHaveClass('safe-area-shell-x', 'safe-area-main');

    const fixedViewportPanel = Array.from(document.querySelectorAll('[class]')).find((element) =>
      String((element as HTMLElement).className).includes('calc(100vh-144px)')
    );
    expect(fixedViewportPanel).toBeUndefined();
  });

  it('keeps the help overlay bounded and scrollable on mobile viewports', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.help.open' }));

    const dialog = screen.getByRole('dialog', { name: 'shell.help.title' });
    expect(dialog).toHaveClass('safe-area-overlay-panel', 'overflow-y-auto');
    expect(
      screen.getByText('shell.help.topics.score.title').closest('.safe-area-dialog-body')
    ).toHaveClass('safe-area-dialog-body');
  });
});

describe('RouteTabs responsive nav contract', () => {
  it('keeps every mobile tab target at least 44px tall without a hamburger variant', () => {
    render(<RouteTabs />);

    const nav = screen.getByRole('navigation', { name: 'shell.tabs.label' });
    expect(nav.querySelector('button[aria-label*="menu" i]')).not.toBeInTheDocument();

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('flex', 'min-h-11', 'items-center', 'justify-center');
    }
  });
});

describe('EvaluationCard', () => {
  it('renders the plural evaluation phase, confidence, and stored score', () => {
    render(<EvaluationCard phase="readiness" evaluation={baseEvaluation} />);

    expect(screen.getByText('evaluation.phases.readiness')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('evaluation.confidence:91')).toBeInTheDocument();
  });

  it('uses light Swiss metric surfaces instead of dark metric blocks', () => {
    render(<EvaluationCard phase="readiness" evaluation={baseEvaluation} />);

    const card = screen.getByText('evaluation.phases.readiness').closest('article');
    expect(card).toHaveClass('bg-background');
    expect(card).toHaveClass('text-black');
    expect(card?.className).not.toContain('bg-[#10131A]');
    expect(card?.className).not.toContain('text-white');
  });

  it('opens evaluation details in a light Swiss mobile-safe popover shell', () => {
    render(<EvaluationCard phase="readiness" evaluation={baseEvaluation} />);

    fireEvent.click(screen.getByRole('button', { name: 'evaluation.details' }));

    const dialog = screen.getByRole('dialog', { name: 'evaluation.details' });
    const heading = screen.getByRole('heading', { name: 'evaluation.details' });
    expect(dialog).toHaveClass('bg-background');
    expect(dialog).toHaveClass('text-black');
    expect(dialog).toHaveClass('fixed');
    expect(dialog).toHaveClass('left-4');
    expect(dialog).toHaveClass('right-4');
    expect(dialog).toHaveClass('sm:absolute');
    expect(dialog).toHaveClass('sm:right-0');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
    expect(dialog.className).not.toContain('bg-[#10131A]');
    expect(dialog.className).not.toContain('text-white');
    expect(dialog.className).not.toContain('absolute right-0 top-full');
  });

  it('shows a missing score state and check action', () => {
    const onCheck = vi.fn();

    render(<EvaluationCard phase="pre_tailor" evaluation={null} onCheck={onCheck} />);

    expect(screen.getByText('evaluation.phases.pre_tailor')).toBeInTheDocument();
    expect(screen.getByText('evaluation.states.notChecked')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'evaluation.actions.check: evaluation.phases.pre_tailor. evaluation.states.notChecked.',
      })
    );
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('uses the stale state and refresh action for stale scores', () => {
    const onRefresh = vi.fn();

    render(
      <EvaluationCard
        phase="post_tailor"
        evaluation={{ ...baseEvaluation, phase: 'post_tailor', stale: true }}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('evaluation.phases.post_tailor')).toBeInTheDocument();
    expect(screen.getByText('evaluation.states.stale')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'evaluation.actions.refresh: evaluation.phases.post_tailor. evaluation.states.stale.',
      })
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('exposes loading state with busy, live status, reduced-motion loader, and a skeleton score', () => {
    const { container } = render(
      <EvaluationCard phase="readiness" evaluation={null} isLoading onCheck={vi.fn()} />
    );

    const card = screen.getByText('evaluation.phases.readiness').closest('article');
    expect(screen.getByText('evaluation.phases.readiness')).toBeInTheDocument();
    expect(card).toHaveAttribute('aria-busy', 'true');

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('evaluation.states.checking');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');

    const scorePlaceholder = container.querySelector('[data-loading-placeholder="score"]');
    expect(scorePlaceholder).toBeInTheDocument();
    expect(scorePlaceholder).toHaveClass('motion-safe:animate-pulse');
    expect(scorePlaceholder).toHaveClass('motion-reduce:animate-none');

    const loader = container.querySelector('svg');
    expect(loader).toHaveClass('motion-safe:animate-spin');
    expect(loader).toHaveClass('motion-reduce:animate-none');
    expect(loader?.className.baseVal).not.toContain(' animate-spin');

    expect(
      screen.getByRole('button', {
        name: 'evaluation.actions.check: evaluation.phases.readiness. evaluation.states.checking.',
      })
    ).toBeDisabled();
  });

  it('exposes error state as an alert without hiding the phase label', () => {
    render(
      <EvaluationCard
        phase="readiness"
        evaluation={null}
        error="evaluation.errors.checkFailed"
        onCheck={vi.fn()}
      />
    );

    expect(screen.getByText('evaluation.phases.readiness')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('evaluation.errors.checkFailed');
  });
});

describe('CommandCenter', () => {
  it('renders metric cards as a named list and keeps the lower command zones visible', () => {
    render(
      <CommandCenter
        ariaLabel="Resume workspace"
        metrics={[
          <EvaluationCard key="readiness" phase="readiness" evaluation={baseEvaluation} />,
          <EvaluationCard key="pre" phase="pre_tailor" evaluation={null} />,
          <EvaluationCard key="post" phase="post_tailor" evaluation={null} />,
        ]}
        resumeContext={<div>Resume context</div>}
        workflow={<div>Workflow stack</div>}
        activity={<div>Recent activity</div>}
      />
    );

    expect(screen.getByLabelText('Resume workspace')).toBeInTheDocument();
    const metrics = screen.getByRole('list', { name: 'Resume workspace metrics' });
    expect(metrics).toBe(screen.getByTestId('command-center-metrics'));
    expect(within(metrics).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Resume context')).toBeInTheDocument();
    expect(screen.getByText('Workflow stack')).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });

  it('separates metric and workspace rows into independent bordered regions', () => {
    render(
      <CommandCenter
        ariaLabel="Resume workspace"
        metrics={[
          <EvaluationCard key="readiness" phase="readiness" evaluation={baseEvaluation} />,
          <EvaluationCard key="pre" phase="pre_tailor" evaluation={null} />,
          <EvaluationCard key="post" phase="post_tailor" evaluation={null} />,
        ]}
        resumeContext={<div>Resume context</div>}
        workflow={<div>Workflow stack</div>}
        activity={<div>Recent activity</div>}
      />
    );

    expect(screen.getByTestId('command-center-metrics-row')).toHaveAttribute('data-row', 'metrics');
    expect(screen.getByTestId('command-center-workspace-row')).toHaveAttribute(
      'data-row',
      'workspace'
    );
    expect(screen.getByTestId('command-center-metrics-row')).toHaveClass('border-2');
    expect(screen.getByTestId('command-center-workspace-row')).toHaveClass('border-2');
  });

  it('marks the body grid as workflow-priority instead of reusing equal desktop thirds', () => {
    render(
      <CommandCenter
        ariaLabel="Resume workspace"
        metrics={[
          <EvaluationCard key="readiness" phase="readiness" evaluation={baseEvaluation} />,
          <EvaluationCard key="pre" phase="pre_tailor" evaluation={null} />,
          <EvaluationCard key="post" phase="post_tailor" evaluation={null} />,
        ]}
        resumeContext={<div>Resume context</div>}
        workflow={<div>Workflow stack</div>}
        activity={<div>Recent activity</div>}
      />
    );

    const bodyGrid = screen.getByTestId('command-center-body');
    expect(bodyGrid).toHaveAttribute('data-layout', 'workflow-priority');
    expect(bodyGrid).not.toHaveClass('lg:grid-cols-3');
    expect(screen.getByTestId('command-center-workflow')).toHaveAttribute(
      'data-priority',
      'primary'
    );
  });
});

describe('DashboardPage', () => {
  it('uses the dashboard stack as the primary single-focus flow before a resume upload', async () => {
    resumeApiMocks.fetchResumeList.mockResolvedValue([]);

    render(<DashboardPage />);

    expect(await screen.findByText('Upload your current resume')).toBeInTheDocument();
    const deck = screen.getByRole('list', { name: 'Resume onboarding flow' });
    expect(deck).toHaveAttribute('data-layout', 'fancy-stacking-cards');
    expect(deck).toHaveAttribute('data-active-step', 'uploadResume');

    const cards = within(deck).getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    const expandedCards = cards.filter((card) => card.getAttribute('data-expanded') === 'true');
    expect(expandedCards).toHaveLength(1);
    expect(expandedCards[0]).toHaveAttribute('data-step', 'uploadResume');
    expect(expandedCards[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('STEP 01')).toHaveAttribute('data-animation', 'breathing-text');

    expect(screen.queryByText('Job intake')).not.toBeInTheDocument();
    expect(screen.queryByText('Tailor flow')).not.toBeInTheDocument();
    expect(screen.queryByText('Review lift')).not.toBeInTheDocument();
    expect(screen.queryByTestId('command-center-metrics')).not.toBeInTheDocument();
  });

  it('keeps resume upload available before AI provider setup', async () => {
    statusCacheMock.state.status = {
      ...statusCacheMock.state.status,
      llm_configured: false,
      llm_healthy: false,
    };
    resumeApiMocks.fetchResumeList.mockResolvedValue([]);

    render(<DashboardPage />);

    const uploadAction = await screen.findByRole('button', { name: 'Upload resume' });
    expect(uploadAction).toBeEnabled();

    fireEvent.click(uploadAction);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      expect.stringContaining('.docx')
    );
  });

  it('advances the dashboard stack from upload to resume review after upload completes', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    resumeApiMocks.fetchResumeList.mockResolvedValue([]);

    render(<DashboardPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Upload resume' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['resume'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Review your current resume')).toBeInTheDocument();
    const deck = screen.getByRole('list', { name: 'Resume onboarding flow' });
    expect(deck).toHaveAttribute('data-active-step', 'reviewResume');
    expect(within(deck).getAllByRole('listitem')).toHaveLength(2);
    const activeCard = screen.getByTestId('dashboard-stack-card-reviewResume');
    expect(activeCard).toHaveAttribute('data-expanded', 'true');
    expect(activeCard).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByTestId('dashboard-stack-card-tailorRole')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-stack-card-reviewLift')).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('ignores latest evaluation responses that resolve after the master resume is cleared', async () => {
    const statusRequest = createDeferred<{
      raw_resume: { processing_status: 'ready' | 'pending' | 'processing' | 'failed' };
    }>();
    const evaluationRequest = createDeferred<LatestResumeEvaluationsResponse>();
    window.localStorage.setItem('master_resume_id', 'master-1');
    resumeApiMocks.fetchResume.mockReturnValue(statusRequest.promise);
    evaluationApiMocks.fetchLatestResumeEvaluations.mockReturnValue(evaluationRequest.promise);

    render(<DashboardPage />);

    await waitFor(() =>
      expect(evaluationApiMocks.fetchLatestResumeEvaluations).toHaveBeenCalledWith('master-1')
    );

    await act(async () => {
      statusRequest.reject(new Error('404'));
    });

    await waitFor(() => expect(window.localStorage.getItem('master_resume_id')).toBeNull());

    await act(async () => {
      evaluationRequest.resolve({
        ...emptyLatestEvaluations,
        readiness: { ...baseEvaluation, overall_score: 91, resume_id: 'master-1' },
      });
    });

    expect(screen.queryByText('91')).not.toBeInTheDocument();
  });

  it('does not interrupt the active resume-review card with tailored-list loading noise', async () => {
    const resumeListRequest = createDeferred<ResumeListItem[]>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('master_resume_id', 'master-1');
    resumeApiMocks.fetchResume.mockResolvedValue({
      raw_resume: { processing_status: 'ready' },
    });
    resumeApiMocks.fetchResumeList.mockReturnValue(resumeListRequest.promise);

    render(<DashboardPage />);

    expect(await screen.findByText('Review your current resume')).toBeInTheDocument();
    expect(screen.queryByText('Loading tailored resumes...')).not.toBeInTheDocument();

    await act(async () => {
      resumeListRequest.reject(new Error('network unavailable'));
    });

    expect(
      screen.queryByText('Tailored resumes could not be loaded. Try refreshing.')
    ).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('handles background dashboard load failures without browser error-level logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('master_resume_id', 'master-1');
    resumeApiMocks.fetchResume.mockRejectedValue(new Error('Failed to load resume (status 500).'));
    resumeApiMocks.fetchResumeList.mockRejectedValue(
      new Error('Failed to load resumes list (status 500).')
    );
    evaluationApiMocks.fetchLatestResumeEvaluations.mockRejectedValue(
      new Error('Failed to load latest evaluations (status 500).')
    );

    render(<DashboardPage />);

    expect(await screen.findByText('Review your current resume')).toBeInTheDocument();
    await waitFor(() => expect(resumeApiMocks.fetchResumeList).toHaveBeenCalled());
    await waitFor(() => expect(evaluationApiMocks.fetchLatestResumeEvaluations).toHaveBeenCalled());

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    {
      name: 'pending processing',
      storedMasterId: 'master-1',
      processingStatus: 'pending',
      llmConfigured: true,
      reason: 'Wait until the base resume finishes processing.',
    },
    {
      name: 'failed processing',
      storedMasterId: 'master-1',
      processingStatus: 'failed',
      llmConfigured: true,
      reason: 'Fix the failed base resume processing before tailoring.',
    },
    {
      name: 'LLM not configured',
      storedMasterId: 'master-1',
      processingStatus: 'ready',
      llmConfigured: false,
      reason: 'Connect an AI provider before tailoring for a role.',
    },
  ] as const)('shows a non-primary disabled Tailor CTA reason for $name', async (scenario) => {
    if (scenario.storedMasterId) {
      window.localStorage.setItem('master_resume_id', scenario.storedMasterId);
    }
    statusCacheMock.state.status = {
      ...statusCacheMock.state.status,
      llm_configured: scenario.llmConfigured,
    };
    resumeApiMocks.fetchResume.mockResolvedValue({
      raw_resume: { processing_status: scenario.processingStatus },
    });

    render(<DashboardPage />);

    const reason = await screen.findByText(scenario.reason);
    const activeCard = screen.getByTestId('dashboard-stack-card-reviewResume');

    expect(reason).toBeInTheDocument();
    expect(activeCard).toHaveAttribute('data-expanded', 'true');
    expect(activeCard).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button', { name: 'Tailor for a role' })).not.toBeInTheDocument();
  });

  it('formats tailored resume dates with the pt-BR locale', async () => {
    const dateSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('13 de mai. de 2026');
    i18nMock.locale = 'pt-BR';
    resumeApiMocks.fetchResumeList.mockResolvedValue([
      {
        resume_id: 'tailored-1',
        filename: 'tailored.pdf',
        is_master: false,
        parent_id: null,
        processing_status: 'ready',
        created_at: '2026-05-13T00:00:00Z',
        updated_at: '2026-05-13T00:00:00Z',
        title: 'Platform Resume',
      },
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText('Edited 13 de mai. de 2026')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-stack-card-reviewLift')).toHaveAttribute(
      'data-expanded',
      'true'
    );
    expect(dateSpy).toHaveBeenCalledWith(
      'pt-BR',
      expect.objectContaining({ day: '2-digit', month: 'short', year: 'numeric' })
    );
    dateSpy.mockRestore();
  });
});

describe('ResumeUploadDialog', () => {
  it('advertises extension accepts for PDF and Word resume uploads', () => {
    render(<ResumeUploadDialog open onOpenChange={vi.fn()} />);

    const input = document.querySelector('input[type="file"]');

    expect(input).toHaveAttribute('accept', expect.stringContaining('.pdf'));
    expect(input).toHaveAttribute('accept', expect.stringContaining('.doc'));
    expect(input).toHaveAttribute('accept', expect.stringContaining('.docx'));
  });

  it('accepts a valid resume extension even when the browser reports a generic MIME type', async () => {
    render(<ResumeUploadDialog open onOpenChange={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['resume'], 'resume.docx', { type: 'application/octet-stream' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens the file picker from keyboard activation on the dropzone button', () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<ResumeUploadDialog open onOpenChange={vi.fn()} />);

    const dropzone = screen.getByRole('button', {
      name: /choose resume file/i,
    });

    expect(dropzone).toHaveAttribute('tabIndex', '0');
    expect(dropzone).toHaveAttribute('aria-invalid', 'false');
    expect(dropzone).toHaveAttribute('aria-describedby', expect.stringContaining('upload-help'));

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    fireEvent.keyDown(dropzone, { key: ' ' });

    expect(inputClick).toHaveBeenCalledTimes(2);
    inputClick.mockRestore();
  });

  it('announces validation errors and links them to the dropzone state', async () => {
    render(<ResumeUploadDialog open onOpenChange={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['plain text'], 'resume.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    const dropzone = screen.getByRole('button', {
      name: /choose resume file/i,
    });

    expect(alert).toHaveTextContent('Choose a PDF, DOC, or DOCX file.');
    expect(dropzone).toHaveAttribute('aria-invalid', 'true');
    expect(dropzone).toHaveAttribute('aria-describedby', expect.stringContaining(alert.id));
  });
});

describe('TailorCardStack', () => {
  it('uses Fancy stacking cards as a single-focus dashboard workflow', () => {
    const onUploadMaster = vi.fn();
    render(
      <TailorCardStack
        activeStep="uploadResume"
        hasMasterResume={false}
        canUploadMaster
        canTailor={false}
        hasTailoredResume={false}
        onUploadMaster={onUploadMaster}
        onContinueToTailorStep={vi.fn()}
      />
    );

    const deck = screen.getByRole('list', { name: 'Resume onboarding flow' });
    expect(deck).toHaveAttribute('data-layout', 'fancy-stacking-cards');
    expect(deck).toHaveAttribute('data-active-step', 'uploadResume');

    const cards = within(deck).getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(cards.filter((card) => card.getAttribute('data-expanded') === 'true')).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('data-step', 'uploadResume');
    expect(cards[0]).toHaveAttribute('data-expanded', 'true');
    expect(cards[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByTestId('dashboard-stack-card-reviewResume')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-stack-card-tailorRole')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-stack-card-reviewLift')).not.toBeInTheDocument();
    expect(screen.queryByText('Review your current resume')).not.toBeInTheDocument();
    expect(screen.queryByText('Tailor for a role')).not.toBeInTheDocument();

    fireEvent.click(within(cards[0]).getByRole('button', { name: 'Upload resume' }));
    expect(onUploadMaster).toHaveBeenCalledTimes(1);
  });

  it('keeps mobile stack content unclipped and the master upload action reachable', () => {
    const onUploadMaster = vi.fn();

    const { container } = render(
      <TailorCardStack
        activeStep="uploadResume"
        hasMasterResume={false}
        canUploadMaster
        canTailor={false}
        hasTailoredResume={false}
        onUploadMaster={onUploadMaster}
        onContinueToTailorStep={vi.fn()}
      />
    );

    const stackShell = container.querySelector('[data-testid="dashboard-tailor-stack"]');
    expect(stackShell?.className).not.toContain('overflow-hidden');

    const deck = screen.getByRole('list', { name: 'Resume onboarding flow' });
    const firstCard = within(deck).getAllByRole('listitem')[0];
    const uploadAction = within(firstCard).getByRole('button', {
      name: 'Upload resume',
    });
    expect(uploadAction).toBeEnabled();

    fireEvent.click(uploadAction);
    expect(onUploadMaster).toHaveBeenCalledTimes(1);
  });

  it('keeps card and deck CTA links reachable when tailoring is available', () => {
    render(
      <TailorCardStack
        activeStep="tailorRole"
        hasMasterResume
        canUploadMaster={false}
        canTailor
        hasTailoredResume={false}
        onUploadMaster={vi.fn()}
        onContinueToTailorStep={vi.fn()}
      />
    );

    const deck = screen.getByRole('list', { name: 'Resume onboarding flow' });
    const cards = within(deck).getAllByRole('listitem');
    const activeCard = screen.getByTestId('dashboard-stack-card-tailorRole');

    expect(cards).toHaveLength(3);
    expect(activeCard).toBe(cards[2]);
    expect(activeCard).toHaveAttribute('aria-current', 'step');
    expect(activeCard).toHaveAttribute('data-state', 'active');
    expect(screen.queryByTestId('dashboard-stack-card-reviewLift')).not.toBeInTheDocument();
    expect(
      within(activeCard as HTMLElement).getByRole('link', {
        name: 'Tailor for a role',
      })
    ).toHaveAttribute('href', '/tailor');
  });

  it('renders translated dashboard CTA copy when tailoring is available', () => {
    render(
      <TailorCardStack
        activeStep="tailorRole"
        hasMasterResume
        canUploadMaster={false}
        canTailor
        hasTailoredResume={false}
        onUploadMaster={vi.fn()}
        onContinueToTailorStep={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Tailor for a role' })).toHaveAttribute(
      'href',
      '/tailor'
    );
    expect(screen.queryByText('dashboard.tailorCta')).not.toBeInTheDocument();
  });

  it('scrolls the next dashboard stack card into view after the master resume is available', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const { rerender } = render(
      <TailorCardStack
        activeStep="uploadResume"
        hasMasterResume={false}
        canUploadMaster
        canTailor={false}
        hasTailoredResume={false}
        onUploadMaster={vi.fn()}
        onContinueToTailorStep={vi.fn()}
      />
    );

    scrollIntoView.mockClear();

    rerender(
      <TailorCardStack
        activeStep="reviewResume"
        hasMasterResume
        canUploadMaster={false}
        canTailor
        hasTailoredResume={false}
        onUploadMaster={vi.fn()}
        onContinueToTailorStep={vi.fn()}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });
});
