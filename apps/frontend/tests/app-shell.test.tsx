import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/components/shell/app-shell';

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: routerPushMock }),
}));
vi.mock('@/lib/i18n', () => ({ useTranslations: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: {
      llm_configured: true,
      llm_healthy: true,
      database_stats: {
        total_resumes: 1,
        total_jobs: 1,
        total_improvements: 1,
        has_master_resume: true,
      },
    },
    isLoading: false,
    error: null,
    lastFetched: new Date('2026-05-13T00:00:00Z'),
    refreshStatus: vi.fn(),
  }),
}));
vi.mock('@/lib/api/config', () => ({
  fetchLlmConfig: vi.fn(async () => ({
    provider: 'openai',
    model: 'gpt-test',
    api_key: '***',
  })),
}));

describe('AppShell', () => {
  beforeEach(() => {
    routerPushMock.mockClear();
  });

  it('renders breadcrumbs, route tabs, and settings modal trigger', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );
    expect(screen.getByText('shell.breadcrumbs.home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'shell.tabs.dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('button', { name: 'shell.settings.open' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('keeps the global app shell on the shared Swiss canvas instead of a detached dark frame', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    const shellRoot = screen.getByText('Dashboard content').closest('.min-h-screen');
    expect(shellRoot).toHaveClass('bg-background');
    expect(shellRoot).not.toHaveClass('bg-[#10131A]');
  });

  it('opens compact settings modal', async () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );
    fireEvent.click(screen.getByRole('button', { name: 'shell.settings.open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('shell.settings.title')).toBeInTheDocument();
    expect(await screen.findByText('openai')).toBeInTheDocument();
  });

  it('renders score/privacy disclosure topics', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );
    fireEvent.click(screen.getByRole('button', { name: 'shell.help.open' }));
    expect(screen.getByText('shell.help.topics.score.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.data.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.recommendation.title')).toBeInTheDocument();
    expect(screen.getByText('shell.help.topics.tailor.title')).toBeInTheDocument();
  });

  it('closes the model status popover with Escape', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.status.ready' }));
    expect(screen.getByRole('dialog', { name: 'Popover' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Popover' })).not.toBeInTheDocument();
  });

  it('closes the model status popover on outside mouse down', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.status.ready' }));
    expect(screen.getByRole('dialog', { name: 'Popover' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Popover' })).not.toBeInTheDocument();
  });

  it('navigates to full settings with the Next router', () => {
    render(
      <AppShell>
        <div>Dashboard content</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole('button', { name: 'shell.settings.open' }));
    expect(screen.getByRole('dialog', { name: 'shell.settings.title' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'shell.settings.fullSettings' }));
    expect(routerPushMock).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog', { name: 'shell.settings.title' })).not.toBeInTheDocument();
  });
});
