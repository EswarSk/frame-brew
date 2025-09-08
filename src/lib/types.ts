export type ID = string;
export type Status = 'queued' | 'running' | 'transcoding' | 'scoring' | 'ready' | 'failed';
export type SourceType = 'generated' | 'uploaded';
export type ViewMode = 'list' | 'grid' | 'kanban';

export interface Video {
  id: ID;
  orgId: ID;
  projectId: ID;
  title: string;
  status: Status;
  sourceType: SourceType;
  durationSec: number;
  aspect: '9:16';
  createdAt: string;
  updatedAt: string;
  urls: {
    hls?: string;
    mp4?: string;
    thumb?: string;
    captions?: string;
  };
  score?: Score;
  feedbackSummary?: string;
  version: number;
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

export interface GenerationJob {
  id: ID;
  videoId: ID;
  prompt: string;
  stylePreset?: string;
  status: Status;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Template {
  id: ID;
  orgId: ID;
  name: string;
  prompt: string;
  style?: Record<string, any>;
}

export interface Project {
  id: ID;
  name: string;
  orgId: ID;
  createdAt: string;
}

export interface CreateGenerationRequest {
  projectId: ID;
  prompt: string;
  stylePreset?: string;
  durationSec: number;
  captions?: boolean;
}

export interface CreateGenerationResponse {
  job: GenerationJob;
  video: Video;
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