import { z } from 'zod';

// Validation schemas
export const videoStatusSchema = z.enum(['queued', 'running', 'transcoding', 'scoring', 'ready', 'failed']);
export const sourceTypeSchema = z.enum(['generated', 'uploaded']);

export const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  projectId: z.string().min(1, 'Project ID is required'),
  sourceType: sourceTypeSchema,
  durationSec: z.number().int().min(1, 'Duration must be positive').max(300, 'Duration too long'),
});

export const updateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: videoStatusSchema.optional(),
  score: z.object({
    overall: z.number().min(0).max(100),
    hook: z.number().min(0).max(100),
    pacing: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    brandSafety: z.number().min(0).max(100),
    durationFit: z.number().min(0).max(100),
    visualQoe: z.number().min(0).max(100),
    audioQoe: z.number().min(0).max(100),
  }).optional(),
  feedbackSummary: z.string().max(1000).optional(),
  urls: z.object({
    hls: z.string().url().optional(),
    mp4: z.string().url().optional(),
    thumb: z.string().url().optional(),
    captions: z.string().url().optional(),
  }).optional(),
});

export const getVideosSchema = z.object({
  query: z.string().optional(),
  status: z.array(videoStatusSchema).optional(),
  minScore: z.number().min(0).max(100).optional(),
  projectId: z.string().optional(),
  sourceType: sourceTypeSchema.optional(),
  sortBy: z.enum(['newest', 'oldest', 'score-high', 'score-low', 'title-az']).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const createGenerationSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(2000, 'Prompt too long'),
  stylePreset: z.string().optional(),
  durationSec: z.number().int().min(5, 'Minimum 5 seconds').max(60, 'Maximum 60 seconds'),
  captions: z.boolean().optional().default(true),
  watermark: z.boolean().optional().default(false),
  // Veo3 specific parameters
  negativePrompt: z.string().max(1000, 'Negative prompt too long').optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9'),
  resolution: z.enum(['720p', '1080p']).optional().default('720p'),
  model: z.enum(['stable', 'fast']).optional().default('fast'),
  image: z.object({
    imageBytes: z.string(),
    mimeType: z.string(),
  }).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(1000, 'Prompt too long'),
  stylePreset: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  orgName: z.string().min(1, 'Organization name is required').max(100, 'Organization name too long'),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse({
        ...req.body,
        ...req.query,
        ...req.params,
      });
      
      // Attach validated data to request
      req.validated = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};

// Helper to validate CUID
export const isValidCuid = (id: string): boolean => {
  return /^c[a-z0-9]{24}$/.test(id);
};

// File validation
export const validateVideoFile = (file: any) => {
  const allowedMimes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo', // .avi
    'video/webm'
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only video files are allowed.');
  }

  // Max file size: 100MB
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 100MB.');
  }

  return true;
};