import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createResumeEvaluation,
  fetchLatestResumeEvaluations,
  fetchResumeEvaluations,
} from '@/lib/api/evaluation';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('evaluation api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('creates an evaluation', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          evaluation_id: 'eval-1',
          resume_id: 'resume-1',
          baseline_resume_id: null,
          job_id: null,
          phase: 'readiness',
          overall_score: 80,
          confidence: 0.8,
          dimensions: {
            clarity: 80,
            impact: 80,
            ats_readability: 80,
            keyword_alignment: 80,
            role_fit: 80,
            evidence_strength: 80,
          },
          strengths: [],
          gaps: [],
          next_actions: [],
          model: 'test-model',
          provider: 'openai',
          prompt_version: 'resume_evaluation_v1',
          source_hash: 'hash',
          created_at: '2026-05-13T00:00:00+00:00',
          stale: false,
          warnings: [],
        }),
        { status: 200 }
      )
    );

    const result = await createResumeEvaluation('resume-1', { phase: 'readiness' });

    expect(result.overall_score).toBe(80);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phase: 'readiness' }),
      })
    );
  });

  it('fetches latest evaluations with a job id query', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ readiness: null }), { status: 200 })
    );

    await fetchLatestResumeEvaluations('resume-1', { jobId: 'job-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations/latest?job_id=job-1'),
      expect.any(Object)
    );
  });

  it('fetches a filtered evaluation list', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ evaluations: [] }), { status: 200 })
    );

    const result = await fetchResumeEvaluations('resume-1', {
      phase: 'pre_tailor',
      jobId: 'job-1',
    });

    expect(result.evaluations).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resumes/resume-1/evaluations?phase=pre_tailor&job_id=job-1'),
      expect.any(Object)
    );
  });
});
