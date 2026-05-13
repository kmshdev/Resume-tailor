import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/components/shell/app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
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
});
