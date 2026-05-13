import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TailorSessionCards } from '@/components/tailor/tailor-session-cards';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('TailorSessionCards', () => {
  it('renders a stacked progress deck with the current and completed steps marked', () => {
    render(
      <TailorSessionCards
        activeStep="pre_score"
        completedSteps={['add_job', 'review_jd']}
        scores={{ pre_score: 74 }}
        warnings={{ post_score: 'evaluation.errors.checkFailed' }}
      />
    );

    const deck = screen.getByRole('list', { name: 'tailor.session.deckLabel' });
    expect(deck).toHaveAttribute('data-layout', 'stacked-deck');

    const activeStep = within(deck).getByText('tailor.session.steps.pre_score').closest('li');
    expect(activeStep).toHaveAttribute('aria-current', 'step');

    const completedStep = within(deck).getByText('tailor.session.steps.add_job').closest('li');
    expect(completedStep).toHaveAttribute('data-state', 'complete');

    expect(within(deck).getByText('74/100')).toBeInTheDocument();
    expect(within(deck).getByText('evaluation.errors.checkFailed')).toBeInTheDocument();
  });
});
