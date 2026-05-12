import { apiFetch, apiPost } from './client';

export type JobSourceType =
  | 'manual_text'
  | 'job_url'
  | 'pdf_url'
  | 'pdf_upload'
  | 'recruiter_message';

export type ExtractionMethod = 'manual' | 'deterministic' | 'http' | 'playwright' | 'pdf' | 'llm';

export interface DetectedJobLink {
  url: string;
  label?: string | null;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
}

export interface DraftAnswer {
  question_id: string;
  answer: string;
  evidence: string[];
  needs_user_input: boolean;
  prompt: string;
}

export interface JobIntakeMetadata {
  source_type: JobSourceType;
  source_url?: string | null;
  source_title?: string | null;
  links: DetectedJobLink[];
  screening_questions: ScreeningQuestion[];
  draft_answers: DraftAnswer[];
  extraction_method: ExtractionMethod;
  warnings: string[];
  confidence: number;
}

export interface JobIntakeExtractRequest {
  source_type: Exclude<JobSourceType, 'pdf_upload'>;
  source_text?: string;
  url?: string;
  resume_id?: string | null;
  resume_text?: string | null;
}

export interface JobIntakeExtractResponse extends JobIntakeMetadata {
  job_description: string;
  raw_text: string;
  requires_review: boolean;
}

export interface JobIntakeConfirmRequest {
  job_description: string;
  resume_id?: string | null;
  intake_metadata?: JobIntakeMetadata | null;
}

export interface JobIntakeConfirmResponse {
  message: string;
  job_id: string;
  request: Record<string, unknown>;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data ? String(data.detail) : fallbackMessage;
    throw new Error(detail);
  }
  return data as T;
}

export async function extractJobIntake(
  request: JobIntakeExtractRequest
): Promise<JobIntakeExtractResponse> {
  const response = await apiPost('/jobs/intake/extract', request, 60_000);
  return parseJsonResponse<JobIntakeExtractResponse>(
    response,
    'Failed to extract the job description.'
  );
}

export async function uploadJobIntakePdf(
  file: File,
  resumeId?: string | null
): Promise<JobIntakeExtractResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (resumeId) {
    formData.append('resume_id', resumeId);
  }
  const response = await apiFetch(
    '/jobs/intake/pdf-upload',
    {
      method: 'POST',
      body: formData,
    },
    60_000
  );
  return parseJsonResponse<JobIntakeExtractResponse>(
    response,
    'Failed to extract the PDF job description.'
  );
}

export async function confirmJobIntake(
  request: JobIntakeConfirmRequest
): Promise<JobIntakeConfirmResponse> {
  const response = await apiPost('/jobs/intake/confirm', request);
  return parseJsonResponse<JobIntakeConfirmResponse>(
    response,
    'Failed to save the job description.'
  );
}
