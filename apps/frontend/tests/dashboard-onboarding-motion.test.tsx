import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();

  return {
    ...actual,
    useReducedMotion: () => motionPreference.reduced,
  };
});

import {
  OnboardingBreathingText,
  OnboardingCutReveal,
} from '@/components/dashboard/onboarding/onboarding-motion';

describe('dashboard onboarding motion primitives', () => {
  beforeEach(() => {
    motionPreference.reduced = false;
  });

  it('renders children with stable semantic content', () => {
    render(
      <OnboardingCutReveal aria-label="Resume setup">
        <h2>Start with your master resume</h2>
        <p>Upload once, then tailor against each role.</p>
      </OnboardingCutReveal>
    );

    const region = screen.getByRole('region', { name: 'Resume setup' });

    expect(region).toHaveAttribute('data-motion', 'safe');
    expect(
      within(region).getByRole('heading', { name: 'Start with your master resume' })
    ).toBeInTheDocument();
    expect(
      within(region).getByText('Upload once, then tailor against each role.')
    ).toBeInTheDocument();
  });

  it('marks reduced motion and disables animation state for text wrappers', () => {
    motionPreference.reduced = true;

    render(<OnboardingBreathingText variant="label">Step 01</OnboardingBreathingText>);

    const label = screen.getByText('Step 01');
    expect(label).toHaveAttribute('data-motion', 'reduced');
    expect(label).toHaveAttribute('data-animation', 'none');
  });

  it('uses Swiss hard-border and typography classes without rounded card styling', () => {
    render(
      <OnboardingCutReveal aria-label="Swiss wrapper">
        <OnboardingBreathingText>Profile readiness</OnboardingBreathingText>
        <OnboardingBreathingText variant="label">Dashboard setup</OnboardingBreathingText>
      </OnboardingCutReveal>
    );

    const region = screen.getByRole('region', { name: 'Swiss wrapper' });

    expect(region).toHaveClass('border-2', 'border-black', 'bg-background');
    expect(region).toHaveClass('shadow-sw-default', 'rounded-none');
    expect(region.className).not.toMatch(/rounded-(sm|md|lg|xl|2xl|3xl|full)/);
    expect(screen.getByText('Profile readiness')).toHaveClass('font-serif');
    const label = screen.getByText('Dashboard setup');
    expect(label).toHaveClass('font-mono', 'uppercase');
    expect(label.className).not.toMatch(/tracking-/);
  });
});
