import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderMobilePanelSwitcher } from '@/components/builder/mobile-panel-switcher';

describe('BuilderMobilePanelSwitcher', () => {
  it('exposes an accessible mobile-only editor/preview switch', () => {
    const onPanelChange = vi.fn();

    render(
      <BuilderMobilePanelSwitcher
        activePanel="editor"
        onPanelChange={onPanelChange}
        labels={{
          ariaLabel: 'Builder workspace',
          editor: 'Editor',
          preview: 'Preview',
        }}
      />
    );

    const switcher = screen.getByRole('tablist', { name: 'Builder workspace' });
    expect(switcher).toHaveClass('grid', 'grid-cols-2', 'lg:hidden');
    expect(screen.getByRole('tab', { name: 'Editor' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(onPanelChange).toHaveBeenCalledWith('preview');
  });
});
