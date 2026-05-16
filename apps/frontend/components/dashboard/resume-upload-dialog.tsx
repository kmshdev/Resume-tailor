'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  UploadIcon,
  Loader2Icon,
  AlertCircleIcon,
  FileIcon,
  XIcon,
  CheckCircle2Icon,
} from 'lucide-react';
import { OnboardingBreathingText } from '@/components/dashboard/onboarding/onboarding-motion';
import { useFileUpload, formatBytes } from '@/hooks/use-file-upload';
import { getUploadUrl } from '@/lib/api/client';
import { useTranslations } from '@/lib/i18n';
import { retryProcessing } from '@/lib/api/resume';

interface ResumeUploadDialogProps {
  trigger?: React.ReactNode;
  onUploadComplete?: (resumeId: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ACCEPTED_FILE_TYPES = [
  '.pdf',
  '.doc',
  '.docx',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

export function ResumeUploadDialog({
  trigger,
  onUploadComplete,
  open: controlledOpen,
  onOpenChange,
}: ResumeUploadDialogProps) {
  const { t } = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [failedResumeId, setFailedResumeId] = useState<string | null>(null);
  const [isRetryingProcessing, setIsRetryingProcessing] = useState(false);
  const uploadId = useId();
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const UPLOAD_URL = getUploadUrl();
  const inputId = `${uploadId}-upload-input`;
  const dropzoneHelpId = `${uploadId}-upload-help`;
  const dropzoneErrorId = `${uploadId}-upload-error`;
  const uploadStatusId = `${uploadId}-upload-status`;
  const validationMessages = useMemo(
    () => ({
      fileTooLarge: t('dashboard.uploadDialog.fileTooLarge', {
        maxSize: formatBytes(MAX_FILE_SIZE),
      }),
      invalidType: t('dashboard.uploadDialog.invalidFileType'),
      singleFileOnly: t('dashboard.uploadDialog.singleFileOnly'),
    }),
    [t]
  );

  const handleUploadSuccess = ({
    resumeId,
    fileId,
    message,
  }: {
    resumeId: string;
    fileId?: string;
    message: string;
  }) => {
    setUploadFeedback({ type: 'success', message });
    setFailedResumeId(null);

    // Defer parent state update to avoid setState during render
    setTimeout(() => {
      onUploadComplete?.(resumeId);
    }, 0);

    // Close dialog after a short delay to show success state
    setTimeout(() => {
      setIsOpen(false);
      setUploadFeedback(null);
      setFailedResumeId(null);
      if (fileId) {
        removeFile(fileId); // Clear file for next time
      }
    }, 1500);
  };

  const [
    { files, isDragging, errors, isUploadingGlobal },
    {
      getInputProps,
      openFileDialog,
      removeFile,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
    },
  ] = useFileUpload({
    maxSize: MAX_FILE_SIZE,
    accept: ACCEPTED_FILE_TYPES.join(','),
    multiple: false,
    validationMessages,
    uploadUrl: UPLOAD_URL,
    onUploadSuccess: (uploadedFile, response) => {
      const data = response as {
        resume_id?: string;
        processing_status?: 'pending' | 'processing' | 'ready' | 'failed';
        is_master?: boolean;
      };
      if (data.resume_id) {
        const processingFailed = data.processing_status === 'failed';
        const successMessage = data.is_master
          ? t('dashboard.uploadDialog.successMaster')
          : t('dashboard.uploadDialog.success');
        if (processingFailed) {
          // Keep dialog open on failure so users can retry processing.
          setUploadFeedback({
            type: 'error',
            message: t('dashboard.uploadDialog.parsingFailedKeepOpen'),
          });
          setFailedResumeId(data.resume_id);
          return;
        }
        handleUploadSuccess({
          resumeId: data.resume_id,
          fileId: uploadedFile.id,
          message: successMessage,
        });
      } else {
        setFailedResumeId(null);
        setUploadFeedback({
          type: 'error',
          message: t('dashboard.uploadDialog.successMissingId'),
        });
      }
    },
    onUploadError: (file, errorMsg) => {
      setFailedResumeId(null);
      setUploadFeedback({
        type: 'error',
        message: errorMsg || t('dashboard.uploadDialog.failed'),
      });
    },
    onFilesChange: (currentFiles) => {
      if (currentFiles.length === 0) {
        setUploadFeedback(null);
        setFailedResumeId(null);
      }
    },
  });

  const currentFile = files[0];
  const displayErrors = uploadFeedback?.type === 'error' ? [uploadFeedback.message] : errors;
  const hasErrors = displayErrors.length > 0;
  const isDropzoneInteractive = !currentFile && !isRetryingProcessing;
  const dropzoneDescription = [
    dropzoneHelpId,
    hasErrors ? dropzoneErrorId : null,
    uploadFeedback?.type === 'success' ? uploadStatusId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const preventDropzoneInteraction = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!isDropzoneInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFileDialog();
    }
  };

  const handleRetryProcessing = async () => {
    if (!failedResumeId) return;
    const resumeIdToRetry = failedResumeId;
    const fileIdToRemove = currentFile?.id;
    setIsRetryingProcessing(true);
    try {
      const result = await retryProcessing(resumeIdToRetry);
      if (result.processing_status !== 'ready') {
        setUploadFeedback({ type: 'error', message: t('dashboard.retryFailed') });
        return;
      }

      handleUploadSuccess({
        resumeId: resumeIdToRetry,
        fileId: fileIdToRemove,
        message: t('dashboard.retrySuccess'),
      });
    } catch (err) {
      console.error('Retry processing failed:', err);
      setUploadFeedback({ type: 'error', message: t('dashboard.retryFailed') });
    } finally {
      setIsRetryingProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="rounded-none border border-black shadow-sw-default motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0">
            <UploadIcon className="w-4 h-4 mr-2" />
            {t('dashboard.uploadResume')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md bg-background border border-black shadow-sw-lg p-0 gap-0 rounded-none">
        <DialogHeader className="shrink-0 p-6 border-b border-black bg-white">
          <DialogTitle className="font-serif text-2xl font-bold uppercase tracking-tight">
            {t('dashboard.uploadResume')}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-6 bg-background">
          <div
            className={`
                            relative border-2 border-dashed p-8 text-center transition-[border-color,background-color,opacity] duration-150 motion-reduce:transition-none
                            ${isDragging ? 'border-blue-700 bg-blue-50' : 'border-steel-grey hover:border-black hover:bg-white'}
                            ${currentFile ? 'bg-white border-solid border-black' : ''}
                            ${isDropzoneInteractive ? 'cursor-pointer' : 'cursor-default'}
                            ${isRetryingProcessing ? 'opacity-70' : ''}
                        `}
            role={isDropzoneInteractive ? 'button' : undefined}
            tabIndex={isDropzoneInteractive ? 0 : undefined}
            aria-label={
              isDropzoneInteractive ? t('dashboard.uploadDialog.dropzoneLabel') : undefined
            }
            aria-invalid={hasErrors}
            aria-describedby={dropzoneDescription}
            onClick={isDropzoneInteractive ? openFileDialog : undefined}
            onKeyDown={handleDropzoneKeyDown}
            onDragEnter={isRetryingProcessing ? preventDropzoneInteraction : handleDragEnter}
            onDragLeave={isRetryingProcessing ? preventDropzoneInteraction : handleDragLeave}
            onDragOver={isRetryingProcessing ? preventDropzoneInteraction : handleDragOver}
            onDrop={isRetryingProcessing ? preventDropzoneInteraction : handleDrop}
          >
            <input {...getInputProps({ id: inputId, 'aria-describedby': dropzoneDescription })} />

            {isUploadingGlobal ? (
              <div
                className="flex flex-col items-center py-4"
                id={uploadStatusId}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <Loader2Icon className="w-10 h-10 motion-safe:animate-spin motion-reduce:animate-none text-blue-700 mb-4" />
                <p className="font-mono text-sm font-bold uppercase text-blue-700">
                  <OnboardingBreathingText variant="label" className="text-blue-700">
                    {t('common.uploading')}
                  </OnboardingBreathingText>
                </p>
              </div>
            ) : currentFile ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-left overflow-hidden">
                  <div className="w-10 h-10 border border-black bg-paper-tint flex items-center justify-center shrink-0">
                    <FileIcon className="w-5 h-5 text-black" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate max-w-[200px]">
                      {currentFile.file.name}
                    </p>
                    <p className="font-mono text-xs text-steel-grey">
                      {formatBytes(currentFile.file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isRetryingProcessing}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(currentFile.id);
                  }}
                  className="hover:bg-red-100 text-red-600 rounded-none"
                  aria-label={t('a11y.removeFile')}
                  title={t('a11y.removeFile')}
                >
                  <XIcon className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 border border-black bg-white shadow-sw-default flex items-center justify-center mb-4">
                  <UploadIcon className="w-6 h-6 text-black" />
                </div>
                <p className="font-bold text-lg mb-1">
                  {t('dashboard.uploadDialog.dropzoneTitle')}
                </p>
                <p id={dropzoneHelpId} className="font-mono text-xs text-steel-grey uppercase">
                  {t('dashboard.uploadDialog.dropzoneSubtitle')}
                </p>
              </div>
            )}
          </div>

          {/* Feedback Messages */}
          {hasErrors && (
            <div
              id={dropzoneErrorId}
              className="mt-4 p-3 bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-sm"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircleIcon className="w-5 h-5 shrink-0" />
              <div>
                {displayErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            </div>
          )}

          {uploadFeedback?.type === 'success' && (
            <div
              id={uploadStatusId}
              className="mt-4 p-3 bg-green-50 border border-green-200 flex items-center gap-2 text-green-700 text-sm font-bold"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <CheckCircle2Icon className="w-5 h-5 shrink-0" />
              <p>{uploadFeedback.message}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-black bg-white flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          {uploadFeedback?.type === 'error' && failedResumeId && (
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-none border-black hover:bg-paper-tint sm:w-auto"
              onClick={handleRetryProcessing}
              disabled={isRetryingProcessing}
            >
              {isRetryingProcessing
                ? t('dashboard.retryingProcessing')
                : t('dashboard.retryProcessing')}
            </Button>
          )}
          {uploadFeedback?.type === 'error' && files.length > 0 && (
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-none border-black hover:bg-paper-tint sm:w-auto"
              disabled={isRetryingProcessing}
              onClick={() => {
                if (files[0]) removeFile(files[0].id);
                setUploadFeedback(null);
                setFailedResumeId(null);
              }}
            >
              {t('dashboard.uploadDialog.tryDifferentFile')}
            </Button>
          )}
          <DialogClose asChild>
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-none border-black hover:bg-paper-tint sm:w-auto"
            >
              {t('common.cancel')}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
