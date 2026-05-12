import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JobIntakeWizard } from '@/components/tailor/job-intake-wizard';
import type { JobIntakeExtractResponse } from '@/lib/api/job-intake';

const extractJobIntake = vi.fn();
const uploadJobIntakePdf = vi.fn();
const confirmJobIntake = vi.fn();

vi.mock('@/lib/api/job-intake', () => ({
  extractJobIntake: (...args: unknown[]) => extractJobIntake(...args),
  uploadJobIntakePdf: (...args: unknown[]) => uploadJobIntakePdf(...args),
  confirmJobIntake: (...args: unknown[]) => confirmJobIntake(...args),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'tailor.intake.stepLabel') return `STEP ${params?.step}`;
      return key;
    },
  }),
}));

function extraction(overrides: Partial<JobIntakeExtractResponse> = {}): JobIntakeExtractResponse {
  return {
    source_type: 'manual_text',
    job_description: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
    source_url: null,
    source_title: null,
    links: [],
    screening_questions: [],
    draft_answers: [],
    raw_text: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
    extraction_method: 'manual',
    warnings: [],
    confidence: 1,
    requires_review: true,
    ...overrides,
  };
}

describe('JobIntakeWizard', () => {
  beforeEach(() => {
    extractJobIntake.mockReset();
    uploadJobIntakePdf.mockReset();
    confirmJobIntake.mockReset();
  });

  it('extracts manual text, shows review, and confirms reviewed JD', async () => {
    extractJobIntake.mockResolvedValue(extraction());
    confirmJobIntake.mockResolvedValue({
      message: 'job intake saved',
      job_id: 'job-123',
      request: {},
    });
    const onJobConfirmed = vi.fn();

    render(
      <JobIntakeWizard
        masterResumeId="resume-123"
        disabled={false}
        canTailor={true}
        onJobConfirmed={onJobConfirmed}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.sources.manual_text' }));
    fireEvent.change(screen.getByLabelText('tailor.intake.inputLabel'), {
      target: {
        value: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.extractButton' }));

    await screen.findByText('tailor.intake.reviewTitle');
    expect(extractJobIntake).toHaveBeenCalledWith({
      source_type: 'manual_text',
      source_text: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      resume_id: 'resume-123',
    });

    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.confirmButton' }));

    await waitFor(() => {
      expect(confirmJobIntake).toHaveBeenCalledWith(
        expect.objectContaining({
          job_description: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
          resume_id: 'resume-123',
        })
      );
      expect(onJobConfirmed).toHaveBeenCalledWith({
        jobId: 'job-123',
        jobDescription: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      });
    });
  });

  it('keeps screening questions visible and separate during review', async () => {
    extractJobIntake.mockResolvedValue(
      extraction({
        source_type: 'recruiter_message',
        screening_questions: [{ id: 'q1', question: 'Are you open to relocation?' }],
        draft_answers: [
          {
            question_id: 'q1',
            answer: '',
            evidence: [],
            needs_user_input: true,
            prompt: 'Confirm relocation before answering.',
          },
        ],
      })
    );

    render(
      <JobIntakeWizard
        masterResumeId="resume-123"
        disabled={false}
        canTailor={true}
        onJobConfirmed={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'tailor.intake.sources.recruiter_message' })
    );
    fireEvent.change(screen.getByLabelText('tailor.intake.inputLabel'), {
      target: {
        value:
          'Senior Backend Engineer using Python, FastAPI, and AWS.\nAre you open to relocation?',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.extractButton' }));

    await screen.findByText('Are you open to relocation?');
    expect(screen.getByText('Confirm relocation before answering.')).toBeInTheDocument();
    expect(screen.getByLabelText('tailor.intake.reviewJdLabel')).toHaveValue(
      'Senior Backend Engineer using Python, FastAPI, and AWS.'
    );
  });

  it('clears source-specific values when switching intake sources', async () => {
    render(
      <JobIntakeWizard
        masterResumeId="resume-123"
        disabled={false}
        canTailor={true}
        onJobConfirmed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.sources.pdf_upload' }));
    fireEvent.change(screen.getByLabelText('tailor.intake.inputLabel'), {
      target: {
        files: [new File(['fake pdf'], 'job.pdf', { type: 'application/pdf' })],
      },
    });
    expect(screen.getByRole('button', { name: 'tailor.intake.extractButton' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.sources.job_url' }));
    expect(screen.getByLabelText('tailor.intake.inputLabel')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('tailor.intake.inputLabel'), {
      target: { value: 'https://company.example/jobs/backend' },
    });
    expect(screen.getByRole('button', { name: 'tailor.intake.extractButton' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.sources.pdf_upload' }));
    expect(screen.getByRole('button', { name: 'tailor.intake.extractButton' })).toBeDisabled();
  });

  it('allows extraction but blocks tailoring confirmation when tailoring is unavailable', async () => {
    extractJobIntake.mockResolvedValue(extraction());

    render(
      <JobIntakeWizard
        masterResumeId="resume-123"
        disabled={false}
        canTailor={false}
        onJobConfirmed={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('tailor.intake.inputLabel'), {
      target: {
        value: 'Senior Backend Engineer using Python, FastAPI, and AWS.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tailor.intake.extractButton' }));

    await screen.findByText('tailor.intake.reviewTitle');
    expect(extractJobIntake).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'tailor.intake.confirmButton' })).toBeDisabled();
  });
});
