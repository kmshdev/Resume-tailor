import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  confirmJobIntake,
  extractJobIntake,
  uploadJobIntakePdf,
  type JobIntakeExtractResponse,
} from '@/lib/api/job-intake';

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('job intake API helpers', () => {
  it('posts JSON intake extraction requests', async () => {
    const payload: JobIntakeExtractResponse = {
      source_type: 'manual_text',
      job_description: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      source_url: null,
      source_title: null,
      links: [],
      screening_questions: [],
      draft_answers: [],
      extraction_method: 'manual',
      warnings: [],
      confidence: 1,
      requires_review: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await extractJobIntake({
      source_type: 'manual_text',
      source_text: payload.job_description,
    });

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/jobs/intake/extract',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'manual_text',
          source_text: payload.job_description,
        }),
      })
    );
  });

  it('throws the fallback message when a successful response is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      extractJobIntake({
        source_type: 'manual_text',
        source_text: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      })
    ).rejects.toThrow('Failed to extract the job description.');
  });

  it('uploads PDF intake with FormData and no JSON content type', async () => {
    const payload: JobIntakeExtractResponse = {
      source_type: 'pdf_upload',
      job_description: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      source_url: null,
      source_title: 'job.pdf',
      links: [],
      screening_questions: [],
      draft_answers: [],
      extraction_method: 'pdf',
      warnings: [],
      confidence: 0.9,
      requires_review: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['fake pdf'], 'job.pdf', { type: 'application/pdf' });
    await uploadJobIntakePdf(file);

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/jobs/intake/pdf-upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
  });

  it('confirms reviewed JD intake and returns a job id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        message: 'job intake saved',
        job_id: 'job-123',
        request: {},
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await confirmJobIntake({
      job_description: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      resume_id: 'resume-123',
      intake_metadata: {
        source_type: 'manual_text',
        source_url: null,
        source_title: null,
        links: [],
        screening_questions: [],
        draft_answers: [],
        extraction_method: 'manual',
        warnings: [],
        confidence: 1,
      },
    });

    expect(result.job_id).toBe('job-123');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/jobs/intake/confirm',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
