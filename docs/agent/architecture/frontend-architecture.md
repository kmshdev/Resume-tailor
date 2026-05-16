# Frontend Architecture

> Next.js 16 + React 19 | TypeScript | Tailwind CSS v4 | Swiss International Style

## Directory Structure

```
apps/frontend/
├── app/
│   ├── (default)/           # Main app routes
│   │   ├── page.tsx         # Landing (/)
│   │   ├── dashboard/       # /dashboard
│   │   ├── builder/         # /builder
│   │   ├── tailor/          # /tailor
│   │   ├── settings/        # /settings
│   │   └── resumes/[id]/    # /resumes/[id]
│   └── print/               # Print routes for PDF
├── components/
│   ├── ui/                  # Button, Input, Dialog, etc.
│   ├── builder/             # ResumeBuilder, forms/
│   ├── dashboard/           # CommandCenter, TailorCardStack
│   ├── evaluation/          # EvaluationCard, EvaluationPopover
│   ├── fancy/               # shadcn-installed Fancy components
│   ├── preview/             # PaginatedPreview, usePagination
│   ├── resume/              # Templates (single, two-column)
│   ├── shell/               # AppShell, breadcrumbs, route tabs, compact settings
│   └── tailor/              # JobIntakeWizard, TailorSessionCards
├── lib/
│   ├── api/                 # client, resume, config, job-intake, evaluation
│   ├── context/             # status-cache.tsx, language-context.tsx
│   └── constants/           # page-dimensions.ts
└── messages/                # i18n translations
```

## Pages

### Dashboard (`/dashboard`)
- App shell route with breadcrumbs, route tabs, compact settings, and help modal
- CommandCenter layout: metric cards, resume context, Tailor workflow, activity
- Evaluation cards for readiness, pre-tailor, and post-tailor
- Master resume card + tailored resume tiles
- States: `loading | pending | processing | ready | failed`
- Auto-refreshes on window focus
- localStorage: `master_resume_id`

### Builder (`/builder`)
- Left: Editor Panel (forms + formatting controls)
- Right: WYSIWYG PaginatedPreview
- Tabs: Resume | Cover Letter | Outreach
- Auto-saves to localStorage

### Tailor (`/tailor`)
- Fancy stacking-card session deck for Tailor progress
- JD intake wizard for manual text, public job URL, PDF URL/upload, or pasted recruiter message
- Calls: intake extract → review/edit → intake confirm → preview improvements → diff review → save tailored resume
- Runs pre-tailor and post-tailor evaluations when possible
- Redirects to `/resumes/[new_id]` after save

### Settings (`/settings`)
- Provider selection (6 providers)
- API key input
- System status (cached, 30-min refresh)

### Print Routes (`/print/resumes/[id]`, `/print/cover-letter/[id]`)
- Headless Chrome renders these for PDF
- Query params: template, pageSize, margins, spacing

## UI Components

**Button variants:** default (blue), destructive (red), success (green), warning (orange), outline, secondary

**Styling:** `rounded-none`, hard shadows, `font-mono` for labels

**Fancy cards:** `apps/frontend/components/fancy/stacking-cards.tsx` is installed through shadcn using the `@fancy` registry in `components.json`. The shared Tailor card presentation lives in `components/tailor/tailor-step-card.tsx`.

## Context Providers

### StatusCacheProvider
```typescript
const { status, refreshStatus, incrementResumes, decrementResumes } = useStatusCache();
```
- Caches system status, 30-min auto-refresh
- Optimistic counter updates on user actions

### LanguageProvider
```typescript
const { contentLanguage, setContentLanguage } = useLanguage();
```
- Content generation language (en, es, zh, ja, pt-BR)

## API Client (`lib/api/`)

```typescript
import { fetchResume, API_BASE } from '@/lib/api';

// client.ts exports
API_URL, API_BASE, apiFetch, apiPost, apiPatch, apiDelete

// resume.ts
uploadJobDescriptions, improveResume, fetchResume, fetchResumeList
updateResume, downloadResumePdf, deleteResume

// config.ts
fetchLlmConfig, updateLlmConfig, testLlmConnection, fetchSystemStatus

// job-intake.ts
extractJobIntake, uploadJobIntakePdf, confirmJobIntake

// evaluation.ts
createResumeEvaluation, fetchResumeEvaluations, fetchLatestResumeEvaluations
```

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `master_resume_id` | Master resume UUID |
| `resume_builder_draft` | Auto-saved form data |
| `resume_builder_settings` | Template preferences |

## Pagination System

`usePagination` hook calculates page breaks:
- Respects `.resume-item` boundaries
- Prevents orphaned headers
- 150ms debounce for performance

## Critical CSS Rule

For PDF generation, `globals.css` must whitelist print classes:
```css
@media print {
  body * { visibility: hidden !important; }
  .resume-print, .resume-print * { visibility: visible !important; }
  .cover-letter-print, .cover-letter-print * { visibility: visible !important; }
}
```
