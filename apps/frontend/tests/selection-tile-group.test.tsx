import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionTileGroup, type SelectionTileOption } from '@/components/ui/selection-tile-group';

type Density = 'compact' | 'locked' | 'balanced' | 'detailed';

const options = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Shorter bullets for fast review.',
    meta: '2 min scan',
  },
  {
    value: 'locked',
    label: 'Locked',
    description: 'Unavailable until the resume has a job target.',
    disabled: true,
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Keeps the strongest proof points visible.',
    meta: 'Recommended',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    description: 'Preserves all role-specific context.',
  },
] satisfies SelectionTileOption<Density>[];

function ControlledSelectionTileGroup({
  initialValue = 'compact',
  onValueChange = vi.fn(),
  disabled = false,
}: {
  initialValue?: Density;
  onValueChange?: (value: Density) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState<Density>(initialValue);

  return (
    <SelectionTileGroup
      label="Resume density"
      description="Choose how much context the tailored resume should keep."
      options={options}
      value={value}
      onValueChange={(nextValue) => {
        onValueChange(nextValue);
        setValue(nextValue);
      }}
      columns={3}
      disabled={disabled}
    />
  );
}

describe('SelectionTileGroup', () => {
  it('renders a radiogroup with radio tiles and checked state', () => {
    render(<ControlledSelectionTileGroup />);

    const group = screen.getByRole('radiogroup', { name: 'Resume density' });
    expect(group).toBeInTheDocument();
    expect(
      screen.getByText('Choose how much context the tailored resume should keep.')
    ).toHaveClass('font-sans');

    const tiles = within(group).getAllByRole('radio');
    expect(tiles).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Balanced' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('selects an enabled tile on click and calls onValueChange once', () => {
    const onValueChange = vi.fn();
    render(<ControlledSelectionTileGroup onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Balanced' }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('balanced');
    expect(screen.getByRole('radio', { name: 'Balanced' })).toHaveAttribute('aria-checked', 'true');
  });

  it('does not call onValueChange for a disabled tile', () => {
    const onValueChange = vi.fn();
    render(<ControlledSelectionTileGroup onValueChange={onValueChange} />);

    const locked = screen.getByRole('radio', { name: 'Locked' });
    fireEvent.click(locked);

    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves selection among enabled tiles with arrow keys, Home, and End', () => {
    const onValueChange = vi.fn();
    render(<ControlledSelectionTileGroup onValueChange={onValueChange} />);

    const compact = screen.getByRole('radio', { name: 'Compact' });
    compact.focus();
    fireEvent.keyDown(compact, { key: 'ArrowRight' });

    const balanced = screen.getByRole('radio', { name: 'Balanced' });
    expect(onValueChange).toHaveBeenNthCalledWith(1, 'balanced');
    expect(balanced).toHaveAttribute('aria-checked', 'true');
    expect(balanced).toHaveFocus();

    fireEvent.keyDown(balanced, { key: 'End' });
    const detailed = screen.getByRole('radio', { name: 'Detailed' });
    expect(onValueChange).toHaveBeenNthCalledWith(2, 'detailed');
    expect(detailed).toHaveAttribute('aria-checked', 'true');
    expect(detailed).toHaveFocus();

    fireEvent.keyDown(detailed, { key: 'Home' });
    expect(onValueChange).toHaveBeenNthCalledWith(3, 'compact');
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveFocus();
  });

  it('keeps focus-visible and Swiss classes on the group and tiles', () => {
    render(<ControlledSelectionTileGroup />);

    expect(screen.getByText('Resume density')).toHaveClass(
      'font-mono',
      'uppercase',
      'tracking-wider'
    );

    const group = screen.getByRole('radiogroup', { name: 'Resume density' });
    expect(group).toHaveClass('grid', 'gap-3', 'sm:grid-cols-3');

    const compact = screen.getByRole('radio', { name: 'Compact' });
    expect(compact).toHaveClass(
      'rounded-none',
      'border-2',
      'border-black',
      'bg-white',
      'shadow-sw-default',
      'focus-visible:ring-2',
      'focus-visible:ring-blue-700'
    );
  });
});
