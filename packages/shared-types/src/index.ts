// Core API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Common ID type
export type ID = string;

// Video types
export interface Video {
  id: ID;
  title: string;
  description?: string;
  status: VideoStatus;
  sourceType: VideoSourceType;
  durationSec?: number;
  aspect?: string;
  version: number;
  urls?: VideoUrls;
  score?: Score;
  metadata?: Record<string, any>;
  projectId?: ID;
  project?: Project;
  orgId: ID;
  createdAt: string;
  updatedAt: string;
  feedbackSummary?: string;
}

export interface VideoUrls {
  original?: string;
  mp4?: string;
  webm?: string;
  hls?: string;
  thumbnail?: string;
  thumb?: string;
  preview?: string;
  audio?: string;
  captions?: string;
}

export interface Score {
  overall: number;
  hook: number;
  pacing: number;
  clarity: number;
  brandSafety: number;
  durationFit: number;
  visualQoe: number;
  audioQoe: number;
}

export type VideoStatus = 
  | 'queued'
  | 'processing'
  | 'running'
  | 'polling'
  | 'downloading'
  | 'transcoding'
  | 'scoring'
  | 'ready'
  | 'failed';

export type VideoSourceType = 'uploaded' | 'generated';

// Project types
export interface Project {
  id: ID;
  name: string;
  description?: string;
  orgId: ID;
  createdAt: string;
  updatedAt?: string;
}

// Template types
export interface Template {
  id: ID;
  name: string;
  prompt: string;
  stylePreset?: string;
  style?: Record<string, any>;
  orgId: ID;
  createdAt: string;
  updatedAt?: string;
}

// Generation types
export interface GenerationJob {
  id: ID;
  videoId: ID;
  prompt: string;
  stylePreset?: string;
  status: JobStatus;
  progress?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt?: string;
  // Veo3 specific fields
  operationName?: string;
  operationId?: string;
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  model?: 'stable' | 'fast';
}

export type JobStatus = 
  | 'queued'
  | 'running'
  | 'polling'
  | 'downloading'
  | 'transcoding'
  | 'scoring'
  | 'ready'
  | 'failed';

// Request/Response types
export interface CreateGenerationRequest {
  projectId: ID;
  prompt: string;
  stylePreset?: string;
  durationSec: number;
  captions?: boolean;
  watermark?: boolean;
  // Veo3 specific parameters
  negativePrompt?: string | "";
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  model?: 'stable' | 'fast';
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

export interface CreateGenerationResponse {
  video: Video;
  job: GenerationJob;
}

export interface GetVideosParams {
  query?: string;
  status?: string[];
  minScore?: number;
  projectId?: ID;
  sourceType?: VideoSourceType;
  sortBy?: 'newest' | 'oldest' | 'score-high' | 'score-low' | 'title-az';
  cursor?: string;
  limit?: number;
}

export interface VideosResponse {
  items: Video[];
  nextCursor?: string;
  total: number;
}

export interface VideoDetailResponse {
  video: Video;
  versions: Video[];
}

// Upload types
export interface UploadResponse {
  video: Video;
  uploadId: string;
}

export interface ProcessedUpload {
  uploadId: string;
  videoId: ID;
  status: VideoStatus;
  progress: ProcessingProgress;
}

export interface ProcessingProgress {
  stage: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  uploadId: string;
  expiresIn: number;
}

// Batch upload types
export interface BatchUploadResult {
  successful: number;
  failed: number;
  results: Array<{
    success: boolean;
    video?: Video;
    uploadId?: string;
    fileName?: string;
    error?: string;
  }>;
}

// User/Auth types
export interface User {
  id: ID;
  email: string;
  name: string;
  orgId: ID;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: ID;
  name: string;
  plan: OrgPlan;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'USER' | 'ADMIN' | 'OWNER';
export type OrgPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  orgName: string;
}

export interface AuthResponse {
  user: User;
  organization?: Organization;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Validation schema types
export interface CreateVideoRequest {
  title: string;
  description?: string;
  projectId?: ID;
  sourceType: VideoSourceType;
  durationSec?: number;
  urls?: VideoUrls;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  projectId?: ID;
  status?: VideoStatus;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface CreateTemplateRequest {
  name: string;
  prompt: string;
  stylePreset?: string;
}

// Storage and processing types
export interface StorageUsage {
  totalSize: number;
  fileCount: number;
  files: Array<{
    key: string;
    size: number;
    lastModified: Date;
  }>;
}

export interface VideoMetadata {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  codec?: string;
  fileSize?: number;
  originalName?: string;
  mimeType?: string;
  uploadId?: string;
  processedAt?: string;
  processingDuration?: number;
  processingProgress?: number;
  processingStage?: string;
  lastUpdateAt?: string;
  error?: string;
  processingFailedAt?: string;
}

// Queue and job types
export interface QueueStats {
  generation: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  scoring: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  processing?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Pagination types
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
  hasMore: boolean;
}

// Filter and sort types
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  query?: string;
  status?: VideoStatus[];
  sourceType?: VideoSourceType;
  projectId?: ID;
  minScore?: number;
  maxScore?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface SortOptions {
  field: string;
  order: SortOrder;
}

// SSE Event types for real-time updates
export interface SSEEvent {
  type: 'status' | 'progress' | 'error' | 'complete';
  jobId: ID;
  videoId: ID;
  status?: VideoStatus;
  progress?: number;
  message?: string;
  video?: Video;
  error?: string;
}