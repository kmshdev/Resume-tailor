import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TailorPage from '@/app/(default)/tailor/page';

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock('@/components/common/resume_previewer_context', () => ({
  useResumePreview: () => ({
    setImprovedData: vi.fn(),
  }),
}));

vi.mock('@/lib/api/resume', () => ({
  previewImproveResume: vi.fn(),
  confirmImproveResume: vi.fn(),
}));

vi.mock('@/lib/api/evaluation', () => ({
  createResumeEvaluation: vi.fn(),
}));

vi.mock('@/lib/api/config', () => ({
  fetchPromptConfig: vi.fn(async () => ({
    default_prompt_id: 'tailored_resume_generator',
    prompt_options: [],
  })),
}));

vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: {
      llm_configured: true,
    },
    isLoading: false,
    incrementJobs: vi.fn(),
    incrementImprovements: vi.fn(),
    incrementResumes: vi.fn(),
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/tailor/job-intake-wizard', () => ({
  JobIntakeWizard: () => <div>job intake wizard</div>,
}));

vi.mock('@/components/tailor/diff-preview-modal', () => ({
  DiffPreviewModal: () => null,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/components/ui/dropdown', () => ({
  Dropdown: ({ label }: { label?: string }) => <div>{label}</div>,
}));

vi.mock('@/components/tailor/tailor-session-cards', () => ({
  TailorSessionCards: () => <div>tailor session cards</div>,
}));

describe('TailorPage diagnostics', () => {
  beforeEach(() => {
    routerPushMock.mockClear();
    window.localStorage.clear();
  });

  it('renders an in-place setup state instead of silently redirecting when the master resume is missing', async () => {
    render(<TailorPage />);

    await waitFor(() => {
      expect(screen.getByText('tailor.heroTitle')).toBeInTheDocument();
    });

    expect(routerPushMock).not.toHaveBeenCalledWith('/dashboard');
  });

  it('presents the no-master setup state as a named novice guidance region', async () => {
    render(<TailorPage />);

    const setupRegion = await screen.findByRole('region', {
      name: 'dashboard.initializeMasterResume',
    });

    expect(setupRegion).toHaveAttribute('data-state', 'needs-master-resume');
    expect(
      within(setupRegion).getByRole('link', { name: 'dashboard.guided.resume.action' })
    ).toHaveAttribute('href', '/dashboard');
    expect(routerPushMock).not.toHaveBeenCalledWith('/dashboard');
  });
});
