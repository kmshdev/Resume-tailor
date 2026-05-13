import { apiFetch } from './client';

export type EvaluationPhase = 'readiness' | 'pre_tailor' | 'post_tailor';
export type EvaluationEvidenceSource = 'resume' | 'job_description' | 'absence';
export type EvaluationSeverity = 'low' | 'medium' | 'high';

export interface EvaluationDimensionScores {
  clarity: number;
  impact: number;
  ats_readability: number;
  keyword_alignment: number;
  role_fit: number;
  evidence_strength: number;
}

export interface EvaluationEvidenceItem {
  title: string;
  detail: string;
  evidence_source: EvaluationEvidenceSource;
  evidence_snippet: string | null;
  recommendation: string | null;
  severity: EvaluationSeverity;
}

export interface ResumeEvaluationRequest {
  phase: EvaluationPhase;
  job_id?: string | null;
  baseline_resume_id?: string | null;
  force_refresh?: boolean;
}

export interface ResumeEvaluationResponse {
  evaluation_id: string;
  resume_id: string;
  baseline_resume_id: string | null;
  job_id: string | null;
  phase: EvaluationPhase;
  overall_score: number;
  confidence: number;
  dimensions: EvaluationDimensionScores;
  strengths: EvaluationEvidenceItem[];
  gaps: EvaluationEvidenceItem[];
  next_actions: EvaluationEvidenceItem[];
  model: string;
  provider: string;
  prompt_version: string;
  source_hash: string;
  created_at: string;
  stale: boolean;
  warnings: string[];
}

export interface ResumeEvaluationListResponse {
  evaluations: ResumeEvaluationResponse[];
}

export interface LatestResumeEvaluationsResponse {
  readiness: ResumeEvaluationResponse | null;
  pre_tailor: ResumeEvaluationResponse | null;
  post_tailor: ResumeEvaluationResponse | null;
}

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `${fallback} (status ${res.status}).`);
  }
  return res.json();
}

export async function createResumeEvaluation(
  resumeId: string,
  request: ResumeEvaluationRequest
): Promise<ResumeEvaluationResponse> {
  const res = await apiFetch(`/resumes/${resumeId}/evaluations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });
  return parseOrThrow<ResumeEvaluationResponse>(res, 'Failed to evaluate resume');
}

export async function fetchResumeEvaluations(
  resumeId: string,
  filters: { phase?: EvaluationPhase; jobId?: string } = {}
): Promise<ResumeEvaluationListResponse> {
  const query = toQuery({ phase: filters.phase, job_id: filters.jobId });
  const res = await apiFetch(`/resumes/${resumeId}/evaluations${query}`, {
    credentials: 'include',
  });
  return parseOrThrow<ResumeEvaluationListResponse>(res, 'Failed to load resume evaluations');
}

export async function fetchLatestResumeEvaluations(
  resumeId: string,
  filters: { jobId?: string } = {}
): Promise<LatestResumeEvaluationsResponse> {
  const query = toQuery({ job_id: filters.jobId });
  const res = await apiFetch(`/resumes/${resumeId}/evaluations/latest${query}`, {
    credentials: 'include',
  });
  return parseOrThrow<LatestResumeEvaluationsResponse>(res, 'Failed to load latest evaluations');
}
