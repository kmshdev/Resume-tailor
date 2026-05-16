'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectionTileOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  meta?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type SelectionTileColumns = 1 | 2 | 3 | 4;

export interface SelectionTileGroupProps<T extends string> {
  label: string;
  description?: string;
  options: SelectionTileOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  columns?: SelectionTileColumns;
  disabled?: boolean;
  className?: string;
}

const columnClasses: Record<SelectionTileColumns, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

function enabledIndexes<T extends string>(
  options: SelectionTileOption<T>[],
  disabled: boolean
): number[] {
  if (disabled) return [];

  return options.reduce<number[]>((indexes, option, index) => {
    if (!option.disabled) indexes.push(index);
    return indexes;
  }, []);
}

function nextEnabledIndex(indexes: number[], currentIndex: number, direction: 1 | -1): number {
  if (indexes.length === 0) return -1;

  const currentEnabledPosition = indexes.indexOf(currentIndex);
  if (currentEnabledPosition === -1) {
    return direction === 1 ? indexes[0] : indexes[indexes.length - 1];
  }

  return indexes[(currentEnabledPosition + direction + indexes.length) % indexes.length];
}

export function SelectionTileGroup<T extends string>({
  label,
  description,
  options,
  value,
  onValueChange,
  columns = 2,
  disabled = false,
  className,
}: SelectionTileGroupProps<T>) {
  const labelId = React.useId();
  const descriptionId = React.useId();
  const optionId = React.useId();
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const selectableIndexes = enabledIndexes(options, disabled);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStopIndex =
    selectedIndex >= 0 && selectableIndexes.includes(selectedIndex)
      ? selectedIndex
      : (selectableIndexes[0] ?? -1);

  function selectOptionAtIndex(index: number) {
    const option = options[index];
    if (!option || disabled || option.disabled) return;

    optionRefs.current[index]?.focus();
    if (option.value !== value) {
      onValueChange(option.value);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled) return;

    let targetIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        targetIndex = nextEnabledIndex(selectableIndexes, index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        targetIndex = nextEnabledIndex(selectableIndexes, index, -1);
        break;
      case 'Home':
        targetIndex = selectableIndexes[0] ?? -1;
        break;
      case 'End':
        targetIndex = selectableIndexes[selectableIndexes.length - 1] ?? -1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectOptionAtIndex(targetIndex);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="space-y-1">
        <div
          id={labelId}
          className="font-mono text-sm font-bold uppercase tracking-wider text-black"
        >
          {label}
        </div>
        {description && (
          <p id={descriptionId} className="font-sans text-sm leading-6 text-steel-grey">
            {description}
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled || undefined}
        className={cn('grid gap-3', columnClasses[columns])}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isDisabled = disabled || Boolean(option.disabled);
          const tileLabelId = `${optionId}-${index}-label`;
          const tileDescriptionId = option.description ? `${optionId}-${index}-description` : '';
          const tileMetaId = option.meta ? `${optionId}-${index}-meta` : '';
          const describedBy = [tileDescriptionId, tileMetaId].filter(Boolean).join(' ');

          return (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isDisabled || undefined}
              aria-labelledby={tileLabelId}
              aria-describedby={describedBy || undefined}
              data-state={isSelected ? 'checked' : 'unchecked'}
              disabled={isDisabled}
              tabIndex={index === tabStopIndex ? 0 : -1}
              onClick={() => selectOptionAtIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'flex min-h-32 w-full items-start gap-3 rounded-none border-2 border-black bg-white p-4 text-left text-black shadow-sw-default',
                'font-sans',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                !isDisabled &&
                  'cursor-pointer hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-background hover:shadow-none',
                isSelected && 'outline outline-2 outline-blue-700 outline-offset-[-4px]'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 border border-black',
                  isSelected ? 'bg-blue-700' : 'bg-background',
                  isDisabled && !isSelected && 'bg-paper-tint'
                )}
              />

              <span className="min-w-0 flex-1">
                <span
                  id={tileLabelId}
                  className="block font-mono text-sm font-bold uppercase tracking-wider"
                >
                  {option.label}
                </span>
                {option.description && (
                  <span
                    id={tileDescriptionId}
                    className="mt-2 block text-sm leading-6 text-steel-grey"
                  >
                    {option.description}
                  </span>
                )}
                {option.meta && (
                  <span
                    id={tileMetaId}
                    className="mt-3 inline-flex border border-black bg-background px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider"
                  >
                    {option.meta}
                  </span>
                )}
              </span>

              {option.icon && (
                <span aria-hidden="true" className="shrink-0 text-black">
                  {option.icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
