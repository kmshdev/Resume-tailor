import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormattingControls } from '@/components/builder/formatting-controls';
import { RetroTabs } from '@/components/ui/retro-tabs';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('builder mobile responsiveness', () => {
  it('uses mobile-safe grids for formatting choices and sliders', () => {
    render(
      <FormattingControls
        settings={{
          ...DEFAULT_TEMPLATE_SETTINGS,
          template: 'modern',
        }}
        onChange={vi.fn()}
      />
    );

    const redButton = screen.getByRole('button', {
      name: 'builder.formatting.accentColors.red',
    });
    expect(redButton.parentElement).toHaveClass('grid', 'grid-cols-2', 'sm:grid-cols-4');

    const bottomMarginLabel = screen.getByText('builder.formatting.margin.bottom:');
    expect(bottomMarginLabel.parentElement).toHaveClass('grid', 'min-w-0');
    expect(bottomMarginLabel.parentElement?.parentElement).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-2'
    );
  });

  it('renders preview tabs as an accessible two-column mobile tablist', () => {
    render(
      <RetroTabs
        tabs={[
          { id: 'resume', label: 'Resume' },
          { id: 'cover-letter', label: 'Cover letter', disabled: true },
          { id: 'outreach', label: 'Outreach', disabled: true },
          { id: 'jd-match', label: 'JD match' },
        ]}
        activeTab="resume"
        onTabChange={vi.fn()}
      />
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveClass('grid', 'grid-cols-2', 'sm:flex');
    expect(screen.getByRole('tab', { name: 'Resume' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Cover letter' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
