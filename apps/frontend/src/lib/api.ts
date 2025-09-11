import {
  Video,
  GenerationJob,
  Template,
  Project,
  CreateGenerationRequest,
  CreateGenerationResponse,
  VideosResponse,
  VideoDetailResponse,
  GetVideosParams,
  ApiResponse,
  ID,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// HTTP client utility
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Handle specific error status codes
        if (response.status === 401) {
          // Unauthorized - possibly expired token
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          throw new Error('Authentication expired. Please log in again.');
        }
        
        if (response.status === 503 && retryCount < 2) {
          // Service unavailable - retry after delay
          console.log(`Service unavailable, retrying in ${(retryCount + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        // Try to parse error response
        let errorData;
        try {
          const errorText = await response.text();
          errorData = errorText ? JSON.parse(errorText) : { message: 'Network error' };
        } catch {
          errorData = { message: 'Network error' };
        }
        
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      const hasJson = contentType && contentType.includes('application/json');
      
      // Check if response has content
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        // No content response (like DELETE operations)
        return null as T;
      }
      
      if (hasJson) {
        // Try to parse JSON, handle empty responses gracefully
        const text = await response.text();
        if (!text.trim()) {
          return null as T;
        }
        try {
          return JSON.parse(text) as T;
        } catch (parseError) {
          console.warn('Failed to parse JSON response:', text);
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
        }
      } else {
        // Non-JSON response
        const text = await response.text();
        return text as T;
      }
    } catch (error) {
      // Handle network errors with retry
      if ((error as Error).name === 'TypeError' && retryCount < 1) {
        console.log('Network error, retrying once...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const client = new ApiClient(API_URL);

// API functions
export const api = {
  async getProjects(): Promise<Project[]> {
    return client.get<Project[]>('/api/projects');
  },

  async createProject(project: { name: string; description?: string }): Promise<Project> {
    return client.post<Project>('/api/projects', project);
  },

  async deleteProject(id: string): Promise<void> {
    return client.delete<void>(`/api/projects/${id}`);
  },

  async getVideos(params: GetVideosParams = {}): Promise<VideosResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.set('query', params.query);
    if (params.status) searchParams.set('status', params.status.join(','));
    if (params.minScore) searchParams.set('minScore', params.minScore.toString());
    if (params.projectId) searchParams.set('projectId', params.projectId);
    if (params.sourceType) searchParams.set('sourceType', params.sourceType);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/api/videos${queryString ? `?${queryString}` : ''}`;
    
    return client.get<VideosResponse>(endpoint);
  },

  async getVideo(id: ID): Promise<VideoDetailResponse> {
    return client.get<VideoDetailResponse>(`/api/videos/${id}`);
  },

  async createGeneration(request: CreateGenerationRequest): Promise<CreateGenerationResponse> {
    return client.post<CreateGenerationResponse>('/api/generation', request);
  },

  async rescoreVideo(id: ID): Promise<{ video: Video }> {
    return client.post<{ video: Video }>(`/api/videos/${id}/rescore`);
  },

  async getTemplates(): Promise<Template[]> {
    return client.get<Template[]>('/api/templates');
  },

  async createTemplate(template: Omit<Template, 'id' | 'orgId' | 'createdAt'>): Promise<Template> {
    return client.post<Template>('/api/templates', template);
  },

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    return client.put<Template>(`/api/templates/${id}`, data);
  },

  async deleteTemplate(id: string): Promise<void> {
    return client.delete<void>(`/api/templates/${id}`);
  },

  async uploadVideo(file: File, projectId?: string, onProgress?: (progress: number) => void): Promise<{ video: Video; uploadId: string }> {
    const formData = new FormData();
    formData.append('video', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/api/upload/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  async getUploadProgress(uploadId: string): Promise<{ status: string; progress: number; stage: string; error?: string }> {
    return client.get<{ status: string; progress: number; stage: string; error?: string }>(`/api/upload/progress/${uploadId}`);
  },

  async cancelUpload(uploadId: string): Promise<void> {
    return client.post<void>(`/api/upload/cancel/${uploadId}`);
  },

  async getPresignedUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; fileUrl: string; key: string; uploadId: string }> {
    return client.post<{ uploadUrl: string; fileUrl: string; key: string; uploadId: string }>('/api/upload/presigned-url', {
      filename,
      contentType,
    });
  },

  async completeUpload(data: { filename: string; projectId: string; duration: number }): Promise<{ video: Video }> {
    return client.post<{ video: Video }>('/api/upload/complete', data);
  },

  async rerenderVideo(id: string): Promise<{ job: GenerationJob }> {
    return client.post<{ job: GenerationJob }>(`/api/videos/${id}/rerender`);
  },

  async duplicateAsTemplate(id: string): Promise<Template> {
    return client.post<Template>(`/api/videos/${id}/duplicate-template`);
  },

  async deleteVideo(id: string): Promise<void> {
    return client.delete<void>(`/api/videos/${id}`);
  },

  // Authentication methods
  async login(credentials: { email: string; password: string }) {
    const url = `${API_URL}/api/auth/login`;
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Store auth token
    localStorage.setItem('auth_token', data.tokens.accessToken);
    localStorage.setItem('refresh_token', data.tokens.refreshToken);
    
    return data;
  },

  async register(data: { email: string; password: string; name: string; orgName: string }) {
    const url = `${API_URL}/api/auth/register`;
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    
    // Store auth token
    localStorage.setItem('auth_token', responseData.tokens.accessToken);
    localStorage.setItem('refresh_token', responseData.tokens.refreshToken);
    
    return responseData;
  },

  async logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }
};

// SSE Event handling for real-time updates
interface SSEEvent {
  type: 'status' | 'progress' | 'error' | 'complete';
  jobId: string;
  videoId: string;
  status?: string;
  progress?: number;
  message?: string;
  video?: Video;
  error?: string;
}

export function subscribeToSSE(callback: (event: SSEEvent) => void): () => void {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.warn('No auth token available for SSE connection');
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let isManualClose = false;

  const connect = () => {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(token)}`);
    
    eventSource.onopen = () => {
      console.log('SSE connection established');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        callback(data);
      } catch (error) {
        console.error('Failed to parse SSE event:', error, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      
      if (!isManualClose && eventSource?.readyState === EventSource.CLOSED) {
        console.log('SSE connection lost, attempting to reconnect in 3 seconds...');
        reconnectTimer = setTimeout(connect, 3000);
      }
    };
  };

  // Initial connection
  connect();

  return () => {
    isManualClose = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (eventSource) {
      eventSource.close();
    }
  };
}

// Development fallback - if backend is not available, use mock data
const isDevelopment = import.meta.env.DEV;

if (isDevelopment) {
  // Override API methods to fall back to mock data on error
  const originalApi = { ...api };

  // Import mock data fallback (you can keep some of the original mock logic as fallback)
  const createMockFallback = <T extends keyof typeof api>(method: T) => {
    return async (...args: Parameters<typeof api[T]>): Promise<any> => {
      try {
        // @ts-ignore
        return await originalApi[method](...args);
      } catch (error) {
        console.warn(`API call failed, using mock data fallback for ${method}:`, error);
        
        // Simple mock fallbacks for development
        switch (method) {
          case 'getProjects':
            return [
              { id: 'proj_default', name: 'Default Project', orgId: 'org-1', createdAt: new Date().toISOString() }
            ];
          case 'getVideos':
            return { items: [], total: 0 };
          case 'getTemplates':
            return [];
          default:
            throw error;
        }
      }
    };
  };

  // Apply fallbacks to critical methods
  api.getProjects = createMockFallback('getProjects');
  api.getVideos = createMockFallback('getVideos');
  api.getTemplates = createMockFallback('getTemplates');
}