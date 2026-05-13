import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommandCenter } from '@/components/dashboard/command-center';
import { TailorCardStack } from '@/components/dashboard/tailor-card-stack';
import { EvaluationCard } from '@/components/evaluation/evaluation-card';
import type { ResumeEvaluationResponse } from '@/lib/api/evaluation';

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
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'evaluation.confidence') {
          return `${key}:${String(params?.value)}`;
        }
        if (key === 'dashboard.tailorCta') {
          return getNestedValue(key);
        }
        return key;
      },
    }),
  };
});

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

  it('opens evaluation details in a light Swiss popover shell', () => {
    render(<EvaluationCard phase="readiness" evaluation={baseEvaluation} />);

    fireEvent.click(screen.getByRole('button', { name: 'evaluation.details' }));

    const dialog = screen.getByRole('dialog', { name: 'evaluation.details' });
    expect(dialog).toHaveClass('bg-background');
    expect(dialog).toHaveClass('text-black');
    expect(dialog.className).not.toContain('bg-[#10131A]');
    expect(dialog.className).not.toContain('text-white');
  });

  it('shows a missing score state and check action', () => {
    const onCheck = vi.fn();

    render(<EvaluationCard phase="pre_tailor" evaluation={null} onCheck={onCheck} />);

    expect(screen.getByText('evaluation.phases.pre_tailor')).toBeInTheDocument();
    expect(screen.getByText('evaluation.states.notChecked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'evaluation.actions.check' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'evaluation.actions.refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows loading and error states without hiding the phase label', () => {
    render(
      <EvaluationCard
        phase="readiness"
        evaluation={null}
        isLoading
        error="evaluation.errors.checkFailed"
      />
    );

    expect(screen.getByText('evaluation.phases.readiness')).toBeInTheDocument();
    expect(screen.getByText('evaluation.states.checking')).toBeInTheDocument();
    expect(screen.getByText('evaluation.errors.checkFailed')).toBeInTheDocument();
  });
});

describe('CommandCenter', () => {
  it('renders three constrained metric columns and the lower command zones', () => {
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
    expect(screen.getByTestId('command-center-metrics')).toHaveClass('md:grid-cols-3');
    expect(screen.getByText('Resume context')).toBeInTheDocument();
    expect(screen.getByText('Workflow stack')).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });
});

describe('TailorCardStack', () => {
  it('uses Fancy stacking cards for the dashboard tailoring deck', () => {
    const onUploadMaster = vi.fn();
    const { container } = render(
      <TailorCardStack
        hasMasterResume={false}
        canUploadMaster
        canTailor={false}
        hasTailoredResume={false}
        onUploadMaster={onUploadMaster}
      />
    );

    const deck = container.querySelector('[data-layout="fancy-stacking-cards"]');
    expect(deck).toBeInTheDocument();

    const cards = Array.from(container.querySelectorAll('article'));
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveAttribute('data-state', 'active');
    expect(cards[1]).toHaveAttribute('data-state', 'pending');

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.cardStack.masterResume' }));
    expect(onUploadMaster).toHaveBeenCalledTimes(1);
  });

  it('keeps the master upload action visible and clickable', () => {
    const onUploadMaster = vi.fn();

    render(
      <TailorCardStack
        hasMasterResume={false}
        canUploadMaster
        canTailor={false}
        hasTailoredResume={false}
        onUploadMaster={onUploadMaster}
      />
    );

    const uploadAction = screen.getByRole('button', {
      name: 'dashboard.cardStack.masterResume',
    });
    expect(uploadAction).toBeVisible();

    fireEvent.click(uploadAction);
    expect(onUploadMaster).toHaveBeenCalledTimes(1);
  });

  it('renders translated dashboard CTA copy when tailoring is available', () => {
    render(
      <TailorCardStack
        hasMasterResume
        canUploadMaster={false}
        canTailor
        hasTailoredResume={false}
        onUploadMaster={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Tailor for a role' })).toHaveAttribute(
      'href',
      '/tailor'
    );
    expect(screen.queryByText('dashboard.tailorCta')).not.toBeInTheDocument();
  });
});
