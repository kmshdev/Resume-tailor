import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TailorSessionCards } from '@/components/tailor/tailor-session-cards';
import { TailorStepCard } from '@/components/tailor/tailor-step-card';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('scrolls the active session card into view when the step changes', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const { rerender } = render(<TailorSessionCards activeStep="add_job" completedSteps={[]} />);

    scrollIntoView.mockClear();

    rerender(<TailorSessionCards activeStep="review_changes" completedSteps={['add_job']} />);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  });
});

describe('TailorStepCard', () => {
  it('exposes state text accessibly and keeps warning copy wrapped defensively', () => {
    const longWarning =
      'evaluation.warning.ThisProviderReturnedAnExtremelyLongUnbrokenDiagnosticThatMustWrapWithinTheCard';

    render(
      <TailorStepCard
        index={2}
        title="Review score"
        state="warning"
        warning={longWarning}
        actionLabel="Open review"
        actionHref="/tailor"
      />
    );

    expect(screen.getByText('State: warning')).toHaveClass('sr-only');

    const warning = screen.getByText(longWarning);
    expect(warning).toHaveClass('break-words');
    expect(warning).toHaveClass('whitespace-normal');
    expect(warning).toHaveClass('[overflow-wrap:anywhere]');

    expect(screen.getByRole('link', { name: 'Open review' })).toHaveClass('focus-visible:ring-2');
  });

  it('marks cards with the resize transition hook for variable step heights', () => {
    render(<TailorStepCard index={0} title="Upload" state="active" />);

    expect(screen.getByText('Upload').closest('article')).toHaveClass('t-resize');
  });
});
