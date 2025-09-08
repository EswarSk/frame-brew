import {
  Video,
  GenerationJob,
  Template,
  Project,
  CreateGenerationRequest,
  CreateGenerationResponse,
  VideosResponse,
  VideoDetailResponse,
  Status,
  ID,
} from './types';

// Mock data storage
let videos: Video[] = [];
let jobs: GenerationJob[] = [];
let templates: Template[] = [];
let projects: Project[] = [];

// Initialize with mock data
const initializeMockData = () => {
  if (projects.length === 0) {
    projects = [
      {
        id: 'proj-1',
        name: 'Marketing Campaign',
        orgId: 'org-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'proj-2',
        name: 'Product Demos',
        orgId: 'org-1',
        createdAt: new Date().toISOString(),
      },
    ];

    templates = [
      {
        id: 'tpl-1',
        orgId: 'org-1',
        name: 'Product Showcase',
        prompt: 'Create an engaging product demonstration video that highlights key features and benefits.',
        style: { music: 'upbeat', captions: true },
      },
      {
        id: 'tpl-2',
        orgId: 'org-1',
        name: 'Tutorial Style',
        prompt: 'Create a step-by-step tutorial video that is easy to follow and educational.',
        style: { music: 'calm', captions: true },
      },
    ];

    videos = [
      {
        id: 'vid-1',
        orgId: 'org-1',
        projectId: 'proj-1',
        title: 'Summer Sale Announcement',
        status: 'ready',
        sourceType: 'generated',
        durationSec: 25,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        urls: {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
          captions: '/placeholder.vtt',
        },
        score: {
          overall: 85,
          hook: 90,
          pacing: 80,
          clarity: 85,
          brandSafety: 95,
          durationFit: 90,
          visualQoe: 75,
          audioQoe: 80,
        },
        feedbackSummary: 'Strong opening hook with clear messaging. Consider improving visual quality.',
        version: 1,
      },
      {
        id: 'vid-2',
        orgId: 'org-1',
        projectId: 'proj-2',
        title: 'Product Demo v2',
        status: 'scoring',
        sourceType: 'generated',
        durationSec: 20,
        aspect: '9:16',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        urls: {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
        },
        version: 1,
      },
    ];
  }
};

// API functions
export const api = {
  async getProjects(): Promise<Project[]> {
    initializeMockData();
    await delay(300);
    return projects;
  },

  async getVideos(params: {
    query?: string;
    status?: string[];
    minScore?: number;
    projectId?: string;
    cursor?: string;
  }): Promise<VideosResponse> {
    initializeMockData();
    await delay(500);

    let filtered = [...videos];

    if (params.query) {
      filtered = filtered.filter((v) =>
        v.title.toLowerCase().includes(params.query!.toLowerCase())
      );
    }

    if (params.status && params.status.length > 0) {
      filtered = filtered.filter((v) => params.status!.includes(v.status));
    }

    if (params.minScore) {
      filtered = filtered.filter((v) => (v.score?.overall || 0) >= params.minScore!);
    }

    if (params.projectId) {
      filtered = filtered.filter((v) => v.projectId === params.projectId);
    }

    return {
      items: filtered,
      total: filtered.length,
    };
  },

  async getVideo(id: ID): Promise<VideoDetailResponse> {
    initializeMockData();
    await delay(300);
    
    const video = videos.find((v) => v.id === id);
    if (!video) throw new Error('Video not found');

    return {
      video,
      versions: videos.filter((v) => v.title === video.title),
    };
  },

  async createGeneration(request: CreateGenerationRequest): Promise<CreateGenerationResponse> {
    initializeMockData();
    await delay(800);

    const videoId = `vid-${Date.now()}`;
    const jobId = `job-${Date.now()}`;

    const video: Video = {
      id: videoId,
      orgId: 'org-1',
      projectId: request.projectId,
      title: `Generated from: ${request.prompt.slice(0, 30)}...`,
      status: 'queued',
      sourceType: 'generated',
      durationSec: request.durationSec,
      aspect: '9:16',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      urls: {},
      version: 1,
    };

    const job: GenerationJob = {
      id: jobId,
      videoId,
      prompt: request.prompt,
      stylePreset: request.stylePreset,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    videos.push(video);
    jobs.push(job);

    // Simulate job progression
    simulateJobProgression(jobId, videoId);

    return { job, video };
  },

  async rescoreVideo(id: ID): Promise<{ video: Video }> {
    await delay(2000);
    
    const video = videos.find((v) => v.id === id);
    if (!video) throw new Error('Video not found');

    // Update with new mock score
    video.score = {
      overall: Math.floor(Math.random() * 40) + 60,
      hook: Math.floor(Math.random() * 40) + 60,
      pacing: Math.floor(Math.random() * 40) + 60,
      clarity: Math.floor(Math.random() * 40) + 60,
      brandSafety: Math.floor(Math.random() * 40) + 60,
      durationFit: Math.floor(Math.random() * 40) + 60,
      visualQoe: Math.floor(Math.random() * 40) + 60,
      audioQoe: Math.floor(Math.random() * 40) + 60,
    };

    return { video };
  },

  async getTemplates(): Promise<Template[]> {
    initializeMockData();
    await delay(300);
    return templates;
  },

  async createTemplate(template: Omit<Template, 'id' | 'orgId'>): Promise<Template> {
    await delay(500);
    
    const newTemplate: Template = {
      ...template,
      id: `tpl-${Date.now()}`,
      orgId: 'org-1',
    };

    templates.push(newTemplate);
    return newTemplate;
  },
};

// Simulate job status progression
function simulateJobProgression(jobId: ID, videoId: ID) {
  const statuses: Status[] = ['running', 'transcoding', 'scoring', 'ready'];
  let currentIndex = 0;

  const progressJob = () => {
    if (currentIndex >= statuses.length) return;

    const status = statuses[currentIndex];
    
    // Update job and video status
    const job = jobs.find((j) => j.id === jobId);
    const video = videos.find((v) => v.id === videoId);
    
    if (job) job.status = status;
    if (video) {
      video.status = status;
      video.updatedAt = new Date().toISOString();
      
      if (status === 'ready') {
        video.urls = {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
          captions: '/placeholder.vtt',
        };
        video.score = {
          overall: Math.floor(Math.random() * 40) + 60,
          hook: Math.floor(Math.random() * 40) + 60,
          pacing: Math.floor(Math.random() * 40) + 60,
          clarity: Math.floor(Math.random() * 40) + 60,
          brandSafety: Math.floor(Math.random() * 40) + 60,
          durationFit: Math.floor(Math.random() * 40) + 60,
          visualQoe: Math.floor(Math.random() * 40) + 60,
          audioQoe: Math.floor(Math.random() * 40) + 60,
        };
        job.completedAt = new Date().toISOString();
      }
    }

    // Emit SSE event
    emitSSEEvent({
      type: 'status',
      jobId,
      videoId,
      status,
      ...(status === 'ready' && video ? { video } : {}),
    });

    currentIndex++;
    if (currentIndex < statuses.length) {
      setTimeout(progressJob, Math.random() * 3000 + 2000); // 2-5 seconds
    }
  };

  setTimeout(progressJob, 1000); // Start after 1 second
}

// SSE event emitter (simplified for mock)
let sseCallbacks: ((event: any) => void)[] = [];

function emitSSEEvent(event: any) {
  sseCallbacks.forEach((callback) => callback(event));
}

export function subscribeToSSE(callback: (event: any) => void): () => void {
  sseCallbacks.push(callback);
  return () => {
    sseCallbacks = sseCallbacks.filter((cb) => cb !== callback);
  };
}

// Utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}