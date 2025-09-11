// Re-export all shared types
export * from '@frame-brew/shared-types';

// Backend-specific interfaces (not in shared types)
export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
}

// Job data interfaces for queue processing
export interface GenerationJobData {
  videoId: string;
  prompt: string;
  stylePreset?: string;
  durationSec: number;
  userId: string;
  orgId: string;
}

export interface ScoringJobData {
  videoId: string;
  videoPath: string;
  userId: string;
  orgId: string;
}

export interface ProcessUploadParams {
  uploadId: string;
  filePath: string;
  userId: string;
  orgId: string;
}

export interface ProcessingJob {
  id: string;
  uploadId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  error?: string;
}

export interface UploadVideoParams {
  title: string;
  description?: string;
  projectId?: string;
}

export interface UploadResult {
  videoId: string;
  uploadId: string;
}

export interface PresignedUrlParams {
  filename: string;
  contentType: string;
  userId: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  uploadId: string;
}