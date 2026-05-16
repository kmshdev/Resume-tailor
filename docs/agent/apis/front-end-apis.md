# Frontend API Client

> API client layer for Resume Matcher frontend.

## Base Client (`lib/api/client.ts`)

```typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_BASE = `${API_URL}/api/v1`;

export async function apiFetch(endpoint: string, options?: RequestInit);
export async function apiPost<T>(endpoint: string, body: T);
export async function apiPatch<T>(endpoint: string, body: T);
export async function apiPut<T>(endpoint: string, body: T);
export async function apiDelete(endpoint: string);
export function getUploadUrl(): string;
```

## Resume Operations (`lib/api/resume.ts`)

```typescript
// Job descriptions
uploadJobDescriptions(descriptions: string[], resumeId: string) → job_id

// Resume improvement
improveResume(resumeId: string, jobId: string) → ImprovedResult

// CRUD
fetchResume(resumeId: string) → ResumeResponse['data']
fetchResumeList(includeMaster?: boolean) → ResumeListItem[]
updateResume(resumeId: string, data: ResumeData) → ResumeResponse['data']
deleteResume(resumeId: string) → void

// PDF
downloadResumePdf(resumeId: string, settings?: TemplateSettings) → Blob
downloadCoverLetterPdf(resumeId: string, pageSize?: string) → Blob

// Content updates
updateCoverLetter(resumeId: string, content: string) → void
updateOutreachMessage(resumeId: string, content: string) → void
```

## Job Intake Operations (`lib/api/job-intake.ts`)

```typescript
// Extract reviewable JD content before tailoring
extractJobIntake(request) → JobIntakeExtractResponse
uploadJobIntakePdf(file: File, resumeId?: string) → JobIntakeExtractResponse
confirmJobIntake(request) → { job_id }
```

The reviewed `job_description` becomes the canonical job content used by tailoring. Screening questions, detected links, warnings, extraction method, and draft answers are stored as job metadata and are not appended to the JD used for keyword extraction.

`JobIntakeExtractResponse` intentionally omits raw scraped text. Remote `source_url` values returned by intake helpers are safe display URLs with credentials, query strings, and fragments removed.

Endpoint paths:

| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | `/jobs/intake/extract` | JSON body for `manual_text`, `job_url`, `pdf_url`, or `recruiter_message` |
| POST | `/jobs/intake/pdf-upload` | Multipart PDF upload plus optional `resume_id` |
| POST | `/jobs/intake/confirm` | Persists reviewed JD and reviewed `intake_metadata` |

## Resume Evaluation Operations (`lib/api/evaluation.ts`)

```typescript
createResumeEvaluation(resumeId, request) → ResumeEvaluationResponse
fetchResumeEvaluations(resumeId, filters?) → { evaluations }
fetchLatestResumeEvaluations(resumeId, { jobId? }) → {
  readiness,
  pre_tailor,
  post_tailor,
}
```

Evaluation phases are `readiness`, `pre_tailor`, and `post_tailor`. Pre/post-tailor evaluations require `job_id`; post-tailor may include `baseline_resume_id` to compare the tailored resume against the original.

Endpoint paths:

| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | `/resumes/{resume_id}/evaluations` | Creates or fetches cached structured LLM evaluation |
| GET | `/resumes/{resume_id}/evaluations` | Optional query params: `phase`, `job_id` |
| GET | `/resumes/{resume_id}/evaluations/latest` | Optional `job_id`; returns latest records by phase |

Public response scores are clamped to 0-100. Evidence items are server-sanitized and marked with `evidence_source` values of `resume`, `job_description`, or `absence`.

## Config Operations (`lib/api/config.ts`)

```typescript
fetchLlmConfig() → LLMConfig
updateLlmConfig(config: LLMConfigUpdate) → LLMConfig
testLlmConnection() → LLMHealthCheck
fetchSystemStatus() → SystemStatus

// Feature flags
fetchFeatureConfig() → FeatureConfig
updateFeatureConfig(config: FeatureConfigUpdate) → FeatureConfig

// Language
fetchLanguageConfig() → LanguageConfig
updateLanguageConfig(language: string) → LanguageConfig
```

## Provider Info

```typescript
export const PROVIDER_INFO = {
  openai: { name: 'OpenAI', defaultModel: 'gpt-5-nano-2025-08-07', requiresKey: true },
  anthropic: { name: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', requiresKey: true },
  openrouter: { name: 'OpenRouter', defaultModel: 'deepseek/deepseek-chat', requiresKey: true },
  gemini: { name: 'Google Gemini', defaultModel: 'gemini-3-flash-preview', requiresKey: true },
  deepseek: { name: 'DeepSeek', defaultModel: 'deepseek-chat', requiresKey: true },
  ollama: { name: 'Ollama (Local)', defaultModel: 'gemma3:4b', requiresKey: false },
};
```

## Usage

```typescript
import { fetchResume, API_BASE, PROVIDER_INFO } from '@/lib/api';
```
