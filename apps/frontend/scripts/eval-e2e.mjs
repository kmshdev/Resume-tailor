#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.EVAL_BASE_URL || 'http://localhost:3100').replace(/\/$/, '');
const artifactDir = path.resolve(process.env.EVAL_ARTIFACT_DIR || '/tmp/resume-matcher-e2e-eval');
const waitMs = Number(process.env.EVAL_WAIT_MS || 45_000);

const checks = [];

function addCheck({ id, area = 'overall', weight, passed, detail, artifact }) {
  checks.push({
    id,
    area,
    weight,
    passed: Boolean(passed),
    detail,
    artifact,
  });
}

function score(area) {
  const scoped = area ? checks.filter((check) => check.area === area) : checks;
  const total = scoped.reduce((sum, check) => sum + check.weight, 0);
  const earned = scoped.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  return total ? Math.round((earned / total) * 1000) / 10 : 0;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function count(locator) {
  return locator.count().catch(() => 0);
}

async function hasNoFrameworkOverlay(page) {
  const overlayTexts = [
    'Unhandled Runtime Error',
    'Build Error',
    'Application error',
    'This page could not be found',
  ];
  for (const text of overlayTexts) {
    if ((await count(page.getByText(text, { exact: false }))) > 0) return false;
  }
  return true;
}

async function main() {
  await mkdir(artifactDir, { recursive: true });

  let healthJson = null;
  let statusJson = null;
  try {
    const health = await waitForHttp(`${baseUrl}/api/v1/health`, waitMs);
    healthJson = await health.json().catch(() => null);
    addCheck({
      id: 'api.health',
      weight: 8,
      passed: health.ok && healthJson?.status === 'healthy',
      detail: `GET /api/v1/health -> ${health.status}`,
    });
  } catch (error) {
    addCheck({
      id: 'api.health',
      weight: 8,
      passed: false,
      detail: String(error?.message || error),
    });
  }

  try {
    const status = await fetch(`${baseUrl}/api/v1/status`, { cache: 'no-store' });
    statusJson = await status.json().catch(() => null);
    addCheck({
      id: 'api.status',
      weight: 6,
      passed: status.ok && typeof statusJson?.llm_configured === 'boolean',
      detail: `GET /api/v1/status -> ${status.status}`,
    });
    addCheck({
      id: 'llm.status-shape',
      area: 'llm',
      weight: 20,
      passed:
        status.ok &&
        typeof statusJson?.llm_configured === 'boolean' &&
        typeof statusJson?.llm_healthy === 'boolean',
      detail: `llm_configured=${String(statusJson?.llm_configured)} llm_healthy=${String(
        statusJson?.llm_healthy
      )}`,
    });
  } catch (error) {
    addCheck({
      id: 'api.status',
      weight: 6,
      passed: false,
      detail: String(error?.message || error),
    });
    addCheck({
      id: 'llm.status-shape',
      area: 'llm',
      weight: 20,
      passed: false,
      detail: String(error?.message || error),
    });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleIssues = [];

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    addCheck({
      id: 'route.home',
      weight: 6,
      passed: (await hasNoFrameworkOverlay(page)) && (await count(page.getByRole('link'))) > 0,
      detail: await page.title(),
    });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('list', { name: 'Resume onboarding flow' }).waitFor({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(artifactDir, 'dashboard-desktop.png'),
      fullPage: false,
    });

    const deck = page.getByRole('list', { name: 'Resume onboarding flow' });
    const stackCards = page.locator('[data-testid^="dashboard-stack-card-"]');
    const expandedCards = page.locator(
      '[data-testid^="dashboard-stack-card-"][data-expanded="true"]'
    );
    const activeStep = await deck.getAttribute('data-active-step');
    const visibleCardCount = await stackCards.count();
    const expandedCardCount = await expandedCards.count();
    const futureReviewCount = await count(
      page.locator('[data-testid="dashboard-stack-card-reviewResume"]')
    );
    const futureTailorCount = await count(
      page.locator('[data-testid="dashboard-stack-card-tailorRole"]')
    );
    const futureLiftCount = await count(
      page.locator('[data-testid="dashboard-stack-card-reviewLift"]')
    );
    const commandCenterCount = await count(page.locator('[data-testid="command-center-metrics"]'));
    const uploadButton = page.getByRole('button', { name: 'Upload resume' });
    const uploadButtonCount = await count(uploadButton);
    const uploadButtonEnabled = uploadButtonCount === 1 ? await uploadButton.isEnabled() : false;

    addCheck({
      id: 'dashboard.no-framework-overlay',
      weight: 8,
      passed: await hasNoFrameworkOverlay(page),
      detail: 'dashboard renders without framework error overlay',
      artifact: path.join(artifactDir, 'dashboard-desktop.png'),
    });
    addCheck({
      id: 'dashboard.single-focus-stack',
      weight: 14,
      passed:
        activeStep === 'uploadResume' &&
        visibleCardCount === 1 &&
        expandedCardCount === 1 &&
        futureReviewCount === 0 &&
        futureTailorCount === 0 &&
        futureLiftCount === 0 &&
        commandCenterCount === 0,
      detail: `active=${activeStep} visible=${visibleCardCount} expanded=${expandedCardCount} future=${futureReviewCount}/${futureTailorCount}/${futureLiftCount} command=${commandCenterCount}`,
    });
    addCheck({
      id: 'dashboard.aria-current',
      weight: 8,
      passed:
        (await page
          .locator('[data-testid="dashboard-stack-card-uploadResume"]')
          .getAttribute('aria-current')) === 'step',
      detail: 'active upload card exposes aria-current=step',
    });
    addCheck({
      id: 'dashboard.upload-enabled',
      weight: 10,
      passed: uploadButtonEnabled,
      detail: `Upload resume button count=${uploadButtonCount} enabled=${uploadButtonEnabled}`,
    });
    addCheck({
      id: 'llm.upload-not-blocked',
      area: 'llm',
      weight: 25,
      passed: uploadButtonEnabled,
      detail: `Upload onboarding remains available when llm_configured=${String(
        statusJson?.llm_configured
      )}`,
    });

    let dialogOpened = false;
    let acceptValue = '';
    if (uploadButtonEnabled) {
      await uploadButton.click();
      const dialog = page.getByRole('dialog');
      dialogOpened = (await count(dialog)) === 1;
      acceptValue = await page
        .locator('input[type="file"]')
        .getAttribute('accept')
        .catch(() => '');
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    addCheck({
      id: 'dashboard.upload-dialog',
      weight: 8,
      passed:
        dialogOpened &&
        acceptValue.includes('.pdf') &&
        acceptValue.includes('.doc') &&
        acceptValue.includes('.docx'),
      detail: `dialog=${dialogOpened} accept=${acceptValue}`,
    });

    await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(artifactDir, 'settings-desktop.png'),
      fullPage: false,
    });
    const settingsText = await page
      .locator('main')
      .textContent()
      .catch(() => '');
    const hasProvider = /provider|openai|anthropic|gemini|ollama/i.test(settingsText ?? '');
    const hasApiKey = /api key|key|token/i.test(settingsText ?? '');
    addCheck({
      id: 'settings.llm-controls',
      weight: 8,
      passed: (await hasNoFrameworkOverlay(page)) && hasProvider && hasApiKey,
      detail: `provider=${hasProvider} apiKey=${hasApiKey}`,
      artifact: path.join(artifactDir, 'settings-desktop.png'),
    });
    addCheck({
      id: 'llm.settings-affordance',
      area: 'llm',
      weight: 20,
      passed: hasProvider && hasApiKey,
      detail: 'settings exposes provider/API-key controls',
    });

    await page.goto(`${baseUrl}/tailor`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(artifactDir, 'tailor-desktop.png'), fullPage: false });
    const tailorText = await page
      .locator('main')
      .textContent()
      .catch(() => '');
    const tailorGraceful =
      /upload|current resume|dashboard|tailor|initialize|master/i.test(tailorText ?? '') &&
      (await hasNoFrameworkOverlay(page));
    addCheck({
      id: 'route.tailor-graceful',
      weight: 6,
      passed: tailorGraceful,
      detail: (tailorText ?? '').slice(0, 160).replace(/\s+/g, ' '),
      artifact: path.join(artifactDir, 'tailor-desktop.png'),
    });
    addCheck({
      id: 'llm.tailor-graceful',
      area: 'llm',
      weight: 20,
      passed: tailorGraceful,
      detail: 'tailor route renders a user-safe blocked/setup state without a master resume',
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      ignoreHTTPSErrors: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'dashboard-mobile.png'),
      fullPage: false,
    });
    const mobileMetrics = await mobilePage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      buttonCount: document.querySelectorAll('button').length,
    }));
    const mobileDeckCount = await count(
      mobilePage.getByRole('list', { name: 'Resume onboarding flow' })
    );
    const mobileUpload = mobilePage.getByRole('button', { name: 'Upload resume' });
    const mobileUploadEnabled =
      (await count(mobileUpload)) === 1 ? await mobileUpload.isEnabled() : false;
    addCheck({
      id: 'dashboard.mobile-no-overflow',
      weight: 10,
      passed:
        mobileDeckCount === 1 &&
        mobileUploadEnabled &&
        mobileMetrics.scrollWidth <= mobileMetrics.clientWidth + 2 &&
        mobileMetrics.bodyScrollWidth <= mobileMetrics.clientWidth + 2,
      detail: JSON.stringify({ mobileDeckCount, mobileUploadEnabled, mobileMetrics }),
      artifact: path.join(artifactDir, 'dashboard-mobile.png'),
    });
    await mobileContext.close();

    const currentRunIssues = consoleIssues.filter(
      (issue) => !issue.includes('[Fast Refresh]') && !issue.includes('Download the React DevTools')
    );
    addCheck({
      id: 'browser.console-clean',
      weight: 6,
      passed: currentRunIssues.length === 0,
      detail: currentRunIssues.slice(0, 5).join(' | ') || 'no relevant console issues',
    });
    addCheck({
      id: 'llm.console-clean',
      area: 'llm',
      weight: 15,
      passed: currentRunIssues.length === 0,
      detail: 'LLM-dependent fallback paths do not emit browser error-level logs',
    });
  } finally {
    await browser.close();
  }

  const result = {
    scope:
      'Docker-served production E2E: health/status APIs, dashboard onboarding stack, upload dialog, settings LLM affordance, tailor blocked/setup state, desktop and mobile visual smoke.',
    baseUrl,
    artifactDir,
    scores: {
      overallScore: score(),
      llmAverage: score('llm'),
    },
    pass: score() >= 90 && score('llm') >= 90,
    checks,
    health: healthJson,
    status: statusJson,
    artifacts: {
      dashboardDesktop: path.join(artifactDir, 'dashboard-desktop.png'),
      dashboardMobile: path.join(artifactDir, 'dashboard-mobile.png'),
      settingsDesktop: path.join(artifactDir, 'settings-desktop.png'),
      tailorDesktop: path.join(artifactDir, 'tailor-desktop.png'),
      result: path.join(artifactDir, 'eval-result.json'),
    },
  };

  await writeFile(result.artifacts.result, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}

main().catch(async (error) => {
  const result = {
    scope: 'Docker-served production E2E',
    baseUrl,
    artifactDir,
    scores: {
      overallScore: 0,
      llmAverage: 0,
    },
    pass: false,
    fatal: String(error?.stack || error?.message || error),
    checks,
  };
  await mkdir(artifactDir, { recursive: true }).catch(() => undefined);
  await writeFile(
    path.join(artifactDir, 'eval-result.json'),
    JSON.stringify(result, null, 2)
  ).catch(() => undefined);
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
});
