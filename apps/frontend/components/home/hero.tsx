'use client';

import React from 'react';
import Link from 'next/link';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import LinkIcon from 'lucide-react/dist/esm/icons/link';
import MessageSquareText from 'lucide-react/dist/esm/icons/message-square-text';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import { useTranslations } from '@/lib/i18n';

const STEP_KEYS = ['upload', 'addJob', 'review'] as const;
const FEATURE_KEYS = ['links', 'pdfs', 'messages', 'diffs'] as const;
const TRUST_KEYS = ['review', 'private', 'plain'] as const;

const featureIcons = {
  links: LinkIcon,
  pdfs: FileText,
  messages: MessageSquareText,
  diffs: CheckCircle2,
};

export default function Hero() {
  const { t } = useTranslations();

  const ctaClass =
    'inline-flex min-h-12 items-center justify-center gap-2 border-2 border-black px-5 py-3 font-mono text-sm font-bold uppercase transition-[transform,box-shadow,background-color,color] duration-150 ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none';

  return (
    <main className="min-h-screen bg-background text-black">
      <header className="border-b border-black bg-background">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-4 px-5 py-5 font-mono text-xs font-bold uppercase text-blue-700 md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="text-sm text-black">
            {t('home.brandName')}
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how-it-works" className="hover:text-black">
              {t('home.navHowItWorks')}
            </a>
            <a href="#privacy" className="hover:text-black">
              {t('home.navPrivacy')}
            </a>
            <Link href="/dashboard" className="hover:text-black">
              {t('home.navOpenApp')}
            </Link>
          </nav>
        </div>
      </header>

      <section
        className="relative isolate overflow-hidden border-b border-black px-5 py-14 md:px-8 md:py-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(29, 78, 216, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 78, 216, 0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="pointer-events-none absolute bottom-[-4rem] right-[-18rem] z-0 hidden w-[48rem] border-2 border-black bg-background shadow-sw-xl lg:block xl:right-[-10rem]">
          <div className="flex items-center justify-between border-b-2 border-black bg-white px-5 py-4 font-mono text-xs font-bold uppercase text-blue-700">
            <span>{t('home.previewLabel')}</span>
            <span>{t('home.previewTime')}</span>
          </div>
          <div className="grid grid-cols-[0.82fr_1.18fr]">
            <div className="border-r border-black p-5">
              {STEP_KEYS.map((step, index) => (
                <div key={step} className="mb-4 border-2 border-black bg-white p-4 shadow-sw-sm">
                  <p className="font-mono text-xs font-bold uppercase text-green-700">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-bold uppercase leading-none">
                    {t(`home.steps.${step}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-snug text-ink-soft">
                    {t(`home.steps.${step}.description`)}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-6">
              <div className="border-2 border-black bg-white p-5 shadow-sw-card">
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-black pb-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase text-blue-700">
                      {t('home.previewResumeTitle')}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl font-bold uppercase leading-none">
                      {t('home.previewMatch')}
                    </h3>
                  </div>
                  <div className="border-2 border-black bg-green-700 px-3 py-2 font-mono text-xs font-bold uppercase text-white">
                    {t('home.previewJobTitle')}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-3/4 bg-blue-700" />
                  <div className="h-3 w-full bg-black" />
                  <div className="h-3 w-5/6 bg-secondary" />
                  <div className="h-3 w-2/3 bg-secondary" />
                  <div className="h-3 w-1/2 bg-green-700" />
                  <div className="h-3 w-4/5 bg-secondary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[70svh] max-w-[88rem] items-center">
          <div className="max-w-[46rem]">
            <p className="font-mono text-sm font-bold uppercase text-green-700">
              {t('home.heroEyebrow')}
            </p>
            <h1 className="mt-5 font-serif text-5xl font-bold uppercase leading-[0.92] md:text-6xl lg:text-7xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 md:text-xl">{t('home.heroSubtitle')}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className={`${ctaClass} bg-blue-700 text-white shadow-sw-default`}
              >
                {t('home.primaryCta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className={`${ctaClass} bg-background text-black shadow-sw-sm`}
              >
                {t('home.secondaryCta')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[88rem] grid-cols-1 border-x border-black bg-background md:grid-cols-3">
        {TRUST_KEYS.map((item) => (
          <article key={item} className="border-b border-black p-6 md:border-r md:last:border-r-0">
            <div className="mb-5 flex h-11 w-11 items-center justify-center border-2 border-black bg-white shadow-sw-sm">
              <ShieldCheck className="h-5 w-5 text-green-700" />
            </div>
            <h2 className="font-serif text-3xl font-bold uppercase leading-none">
              {t(`home.trust.${item}.title`)}
            </h2>
            <p className="mt-3 leading-7 text-ink-soft">{t(`home.trust.${item}.description`)}</p>
          </article>
        ))}
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-[88rem] border-x border-b border-black bg-white px-5 py-12 md:px-8 md:py-16"
      >
        <div className="max-w-3xl">
          <p className="font-mono text-sm font-bold uppercase text-blue-700">
            {t('home.howItWorksEyebrow')}
          </p>
          <h2 className="mt-4 font-serif text-4xl font-bold uppercase leading-none md:text-6xl">
            {t('home.howItWorksTitle')}
          </h2>
          <p className="mt-5 text-lg leading-8 text-ink-soft">{t('home.howItWorksSubtitle')}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-[1px] bg-black md:grid-cols-3">
          {STEP_KEYS.map((step, index) => (
            <article key={step} className="bg-background p-6 md:p-8">
              <p className="font-mono text-sm font-bold uppercase text-green-700">0{index + 1}</p>
              <h3 className="mt-8 font-serif text-3xl font-bold uppercase leading-none">
                {t(`home.steps.${step}.title`)}
              </h3>
              <p className="mt-4 leading-7 text-ink-soft">{t(`home.steps.${step}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[88rem] grid-cols-1 border-x border-b border-black bg-background md:grid-cols-4">
        {FEATURE_KEYS.map((feature) => {
          const Icon = featureIcons[feature];
          return (
            <article
              key={feature}
              className="border-b border-black p-6 md:border-r md:last:border-r-0"
            >
              <Icon className="mb-8 h-7 w-7 text-blue-700" />
              <h3 className="font-serif text-3xl font-bold uppercase leading-none">
                {t(`home.features.${feature}.title`)}
              </h3>
              <p className="mt-4 leading-7 text-ink-soft">
                {t(`home.features.${feature}.description`)}
              </p>
            </article>
          );
        })}
      </section>

      <section
        id="privacy"
        className="mx-auto mb-12 grid max-w-[88rem] grid-cols-1 border-x border-b border-black bg-blue-700 text-white md:grid-cols-[1fr_auto]"
      >
        <div className="p-8 md:p-10">
          <p className="font-mono text-sm font-bold uppercase">{t('home.privacyEyebrow')}</p>
          <h2 className="mt-4 max-w-4xl font-serif text-4xl font-bold uppercase leading-none md:text-6xl">
            {t('home.privacyTitle')}
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8">{t('home.privacyBody')}</p>
        </div>
        <div className="flex items-end border-t border-black p-8 md:border-l md:border-t-0 md:p-10">
          <Link href="/dashboard" className={`${ctaClass} bg-white text-black shadow-sw-default`}>
            {t('home.privacyCta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
