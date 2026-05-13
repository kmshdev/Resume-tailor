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
  it('uses Fancy stacking cards with Swiss step-card state semantics', () => {
    render(
      <TailorSessionCards
        activeStep="tailor"
        completedSteps={['add_job', 'review_jd', 'pre_score']}
        scores={{ pre_score: 74, post_score: 88 }}
        warnings={{ post_score: 'evaluation.errors.checkFailed' }}
      />
    );

    const deck = screen.getByRole('list', { name: 'tailor.session.deckLabel' });
    expect(deck).toHaveAttribute('data-layout', 'fancy-stacking-cards');

    expect(within(deck).getAllByRole('listitem')).toHaveLength(6);

    const activeStep = within(deck)
      .getByText('tailor.session.steps.tailor')
      .closest('[role="listitem"]');
    expect(activeStep).toHaveAttribute('aria-current', 'step');
    expect(activeStep).toHaveAttribute('data-state', 'active');

    const completedStep = within(deck)
      .getByText('tailor.session.steps.pre_score')
      .closest('[role="listitem"]');
    expect(completedStep).toHaveAttribute('data-state', 'complete');
    expect(within(completedStep as HTMLElement).getByText('74/100')).toBeInTheDocument();

    const warningStep = within(deck)
      .getByText('tailor.session.steps.post_score')
      .closest('[role="listitem"]');
    expect(warningStep).toHaveAttribute('data-state', 'warning');
    expect(
      within(warningStep as HTMLElement).getByText('evaluation.errors.checkFailed')
    ).toBeInTheDocument();
  });
});
