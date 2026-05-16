'use client';

import type { PropsWithChildren } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps, type Transition } from 'motion/react';

import { cn } from '@/lib/utils';

export interface OnboardingCutRevealProps extends PropsWithChildren<HTMLMotionProps<'section'>> {
  delay?: number;
}

export type OnboardingBreathingTextVariant = 'headline' | 'label';

export interface OnboardingBreathingTextProps extends PropsWithChildren<HTMLMotionProps<'span'>> {
  delay?: number;
  variant?: OnboardingBreathingTextVariant;
}

export function OnboardingCutReveal({
  children,
  className,
  delay = 0,
  ...props
}: OnboardingCutRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const transition: Transition = {
    delay,
    duration: 0.36,
    ease: 'easeOut',
  };
  const motionProps = shouldReduceMotion
    ? {}
    : {
        animate: {
          clipPath: 'inset(0% 0% 0% 0%)',
          opacity: 1,
          y: 0,
        },
        initial: {
          clipPath: 'inset(0% 0% 100% 0%)',
          opacity: 0,
          y: 12,
        },
        transition,
      };

  return (
    <motion.section
      {...motionProps}
      {...props}
      data-animation={shouldReduceMotion ? 'none' : 'vertical-cut-reveal'}
      data-motion={shouldReduceMotion ? 'reduced' : 'safe'}
      className={cn(
        'rounded-none border-2 border-black bg-background p-4 font-sans text-black shadow-sw-default',
        className
      )}
    >
      {children}
    </motion.section>
  );
}

export function OnboardingBreathingText({
  children,
  className,
  delay = 0,
  variant = 'headline',
  ...props
}: OnboardingBreathingTextProps) {
  const shouldReduceMotion = useReducedMotion();
  const transition: Transition = {
    delay,
    duration: 2.4,
    ease: 'easeInOut',
    repeat: Infinity,
  };
  const motionProps = shouldReduceMotion
    ? {}
    : {
        animate: {
          opacity: [0.78, 1, 0.78],
        },
        initial: {
          opacity: 0.78,
        },
        transition,
      };

  return (
    <motion.span
      {...motionProps}
      {...props}
      data-animation={shouldReduceMotion ? 'none' : 'breathing-text'}
      data-motion={shouldReduceMotion ? 'reduced' : 'safe'}
      className={cn(
        'inline-block text-black',
        variant === 'headline' && 'font-serif text-2xl font-bold leading-tight',
        variant === 'label' && 'font-mono text-xs font-bold uppercase text-steel-grey',
        className
      )}
    >
      {children}
    </motion.span>
  );
}
