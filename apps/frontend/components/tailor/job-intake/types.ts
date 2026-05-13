import type { JobSourceType } from '@/lib/api/job-intake';

export type IntakeSource = Exclude<JobSourceType, 'pdf_upload'> | 'pdf_upload';
