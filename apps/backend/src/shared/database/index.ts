import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Prisma Client Singleton
class DatabaseManager {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new PrismaClient({
        log: ['query', 'error', 'info', 'warn'] as any,
      });

      // Event handling is disabled for now due to TypeScript issues
    }

    return DatabaseManager.instance;
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.$disconnect();
    }
  }

  public static async connect(): Promise<void> {
    try {
      const db = DatabaseManager.getInstance();
      await db.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed', { error });
      throw error;
    }
  }

  // Health check
  public static async healthCheck(): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance();
      await db.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }
}

export const db = DatabaseManager.getInstance();
export { DatabaseManager };

// Helper functions for common database operations
export const withTransaction = async <T>(
  callback: (tx: any) => Promise<T>
): Promise<T> => {
  return await db.$transaction(callback);
};

// Helper function to safely parse JSON fields
const parseJSONField = (field: any, fallback: any = null) => {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (error) {
      logger.warn('Failed to parse JSON field', { field, error: error.message });
      return fallback;
    }
  }
  return field || fallback;
};

// Database transformers to convert Prisma models to API types
export const transformVideoToApi = (video: any) => ({
  id: video.id,
  orgId: video.orgId,
  projectId: video.projectId,
  title: video.title,
  description: video.description,
  status: video.status.toLowerCase(),
  sourceType: video.sourceType.toLowerCase(),
  durationSec: video.durationSec,
  aspect: video.aspect,
  createdAt: video.createdAt.toISOString(),
  updatedAt: video.updatedAt.toISOString(),
  urls: parseJSONField(video.urls, {}),
  score: parseJSONField(video.score, null),
  metadata: parseJSONField(video.metadata, {}),
  feedbackSummary: video.feedbackSummary,
  version: video.version,
  project: video.project ? transformProjectToApi(video.project) : undefined,
});

export const transformJobToApi = (job: any) => ({
  id: job.id,
  videoId: job.videoId,
  prompt: job.prompt,
  stylePreset: job.stylePreset,
  status: job.status.toLowerCase(),
  error: job.error,
  progress: job.progress,
  createdAt: job.createdAt.toISOString(),
  completedAt: job.completedAt?.toISOString(),
});

export const transformUserToApi = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  orgId: user.orgId,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const transformProjectToApi = (project: any) => ({
  id: project.id,
  name: project.name,
  orgId: project.orgId,
  createdAt: project.createdAt.toISOString(),
});

export const transformTemplateToApi = (template: any) => ({
  id: template.id,
  orgId: template.orgId,
  name: template.name,
  prompt: template.prompt,
  stylePreset: template.stylePreset,
  createdAt: template.createdAt.toISOString(),
});