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
const jobs: GenerationJob[] = [];
let templates: Template[] = [];
let projects: Project[] = [];

// Initialize with mock data
const initializeMockData = () => {
  if (projects.length === 0) {
    projects = [
      {
        id: 'proj_default',
        name: 'Personal Project',
        orgId: 'org-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'proj_work',
        name: 'Work Content',
        orgId: 'org-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'proj_social',
        name: 'Social Media',
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
        projectId: 'proj_default',
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
        projectId: 'proj_work',
        title: 'Product Demo v2',
        status: 'scoring',
        sourceType: 'generated',
        durationSec: 20,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
        urls: {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
        },
        version: 1,
      },
      {
        id: 'vid-3',
        orgId: 'org-1',
        projectId: 'proj_social',
        title: 'Uploaded Content Video',
        status: 'ready',
        sourceType: 'uploaded',
        durationSec: 15,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
        urls: {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
        },
        score: {
          overall: 92,
          hook: 95,
          pacing: 88,
          clarity: 90,
          brandSafety: 98,
          durationFit: 85,
          visualQoe: 90,
          audioQoe: 94,
        },
        feedbackSummary: 'Excellent video quality and engagement. Great pacing throughout.',
        version: 1,
      },
      {
        id: 'vid-4',
        orgId: 'org-1',
        projectId: 'proj_default',
        title: 'Tutorial Walkthrough',
        status: 'failed',
        sourceType: 'generated',
        durationSec: 30,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 10800000).toISOString(),
        updatedAt: new Date(Date.now() - 10800000).toISOString(),
        urls: {},
        version: 1,
      },
      {
        id: 'vid-5',
        orgId: 'org-1',
        projectId: 'proj_work',
        title: 'Company Introduction',
        status: 'ready',
        sourceType: 'uploaded',
        durationSec: 28,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
        urls: {
          mp4: '/placeholder.svg',
          thumb: '/placeholder.svg',
          captions: '/placeholder.vtt',
        },
        score: {
          overall: 78,
          hook: 82,
          pacing: 75,
          clarity: 80,
          brandSafety: 85,
          durationFit: 70,
          visualQoe: 76,
          audioQoe: 82,
        },
        feedbackSummary: 'Good content but could benefit from better pacing and visual improvements.',
        version: 1,
      },
      {
        id: 'vid-6',
        orgId: 'org-1',
        projectId: 'proj_social',
        title: 'Quick Tips Video',
        status: 'running',
        sourceType: 'generated',
        durationSec: 12,
        aspect: '9:16',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date().toISOString(),
        urls: {},
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
    sourceType?: 'generated' | 'uploaded';
    sortBy?: string;
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

    if (params.sourceType) {
      filtered = filtered.filter((v) => v.sourceType === params.sourceType);
    }

    // Apply sorting
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'newest':
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        case 'oldest':
          filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          break;
        case 'score-high':
          filtered.sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0));
          break;
        case 'score-low':
          filtered.sort((a, b) => (a.score?.overall || 0) - (b.score?.overall || 0));
          break;
        case 'title-az':
          filtered.sort((a, b) => a.title.localeCompare(b.title));
          break;
        default:
          // Default to newest
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } else {
      // Default sorting by newest
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    await delay(500);
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Template not found');
    templates[index] = { ...templates[index], ...data };
    return templates[index];
  },

  async deleteTemplate(id: string): Promise<void> {
    await delay(500);
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Template not found');
    templates.splice(index, 1);
  },

  async completeUpload(data: { filename: string; projectId: string; duration: number }): Promise<{ video: Video }> {
    await delay(1000);
    const video: Video = {
      id: `vid-${Date.now()}`,
      orgId: 'org-1',
      projectId: data.projectId,
      title: data.filename.replace(/\.[^/.]+$/, ""),
      status: 'ready',
      sourceType: 'uploaded',
      durationSec: Math.round(data.duration),
      aspect: '9:16',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      urls: { mp4: '/placeholder.svg', thumb: '/placeholder.svg' },
      version: 1,
    };
    videos.push(video);
    return { video };
  },

  async rerenderVideo(id: string): Promise<{ job: GenerationJob }> {
    await delay(500);
    const job: GenerationJob = { 
      id: `job-${Date.now()}`, 
      videoId: id, 
      prompt: 'Rerender job',
      status: 'queued',
      createdAt: new Date().toISOString()
    };
    return { job };
  },

  async duplicateAsTemplate(id: string): Promise<Template> {
    await delay(500);
    const video = videos.find(v => v.id === id);
    if (!video) throw new Error('Video not found');
    const template: Template = {
      id: `tpl-${Date.now()}`,
      orgId: 'org-1',
      name: `${video.title} Template`,
      prompt: `Generate a video similar to ${video.title}`,
      createdAt: new Date().toISOString(),
    };
    templates.push(template);
    return template;
  },

  async deleteVideo(id: string): Promise<void> {
    await delay(500);
    const index = videos.findIndex(v => v.id === id);
    if (index === -1) throw new Error('Video not found');
    videos.splice(index, 1);
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
interface SSEEvent {
  type: string;
  jobId: string;
  videoId: string;
  status: Status;
  video?: Video;
}

let sseCallbacks: ((event: SSEEvent) => void)[] = [];

function emitSSEEvent(event: SSEEvent) {
  sseCallbacks.forEach((callback) => callback(event));
}

export function subscribeToSSE(callback: (event: SSEEvent) => void): () => void {
  sseCallbacks.push(callback);
  return () => {
    sseCallbacks = sseCallbacks.filter((cb) => cb !== callback);
  };
}

// Utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}