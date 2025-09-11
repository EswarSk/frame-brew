import { Router } from 'express';
import { 
  db, 
  transformVideoToApi, 
  transformJobToApi 
} from '../../shared/database';
import { requireAuth } from '../../shared/utils/auth';
import { validate, createGenerationSchema } from '../../shared/utils/validation';
import { logger } from '../../shared/utils/logger';
import { GenerationQueue } from './queue';
import type { 
  CreateGenerationRequest, 
  CreateGenerationResponse 
} from '../../shared/types';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create new video generation job
router.post('/', validate(createGenerationSchema), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const generationData: CreateGenerationRequest = req.validated;

    // Verify project belongs to user's organization
    const project = await db.project.findUnique({
      where: { 
        id: generationData.projectId,
        orgId 
      },
    });

    if (!project) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      });
    }

    // Create video and generation job in transaction
    const result = await db.$transaction(async (tx) => {
      // Create video record
      const video = await tx.video.create({
        data: {
          title: `Generated: ${generationData.prompt.slice(0, 50)}...`,
          orgId,
          projectId: generationData.projectId,
          status: 'QUEUED',
          sourceType: 'GENERATED',
          durationSec: generationData.durationSec,
          aspect: generationData.aspectRatio || '16:9',
        },
        include: {
          project: true,
        },
      });

      // Create generation job
      const job = await tx.generationJob.create({
        data: {
          videoId: video.id,
          prompt: generationData.prompt,
          stylePreset: generationData.stylePreset,
          status: 'QUEUED',
          negativePrompt: generationData.negativePrompt,
          aspectRatio: generationData.aspectRatio,
          resolution: generationData.resolution,
          model: generationData.model,
        },
      });

      return { video, job };
    });

    // Add job to queue for processing
    await GenerationQueue.addJob({
      jobId: result.job.id,
      videoId: result.video.id,
      prompt: generationData.prompt,
      stylePreset: generationData.stylePreset,
      durationSec: generationData.durationSec,
      captions: generationData.captions,
      watermark: generationData.watermark,
      orgId,
      // Veo3 specific parameters
      negativePrompt: generationData.negativePrompt,
      aspectRatio: generationData.aspectRatio,
      resolution: generationData.resolution,
      model: generationData.model,
      image: generationData.image,
    });

    const response: CreateGenerationResponse = {
      video: transformVideoToApi(result.video),
      job: transformJobToApi(result.job),
    };

    logger.info('Generation job created', { 
      jobId: result.job.id,
      videoId: result.video.id,
      userId: req.user.userId 
    });

    res.status(201).json(response);
  } catch (error) {
    logger.error('Create generation error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'GENERATION_CREATE_FAILED',
      message: 'Failed to create generation job',
    });
  }
});

// Get generation job status
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const job = await db.generationJob.findFirst({
      where: { 
        id,
        video: { orgId } // Ensure job belongs to user's org
      },
      include: {
        video: true,
      },
    });

    if (!job) {
      return res.status(404).json({
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found',
      });
    }

    res.json({
      job: transformJobToApi(job),
      video: transformVideoToApi(job.video),
    });
  } catch (error) {
    logger.error('Get job status error', { error, jobId: req.params.id });
    res.status(500).json({
      code: 'JOB_STATUS_FAILED',
      message: 'Failed to get job status',
    });
  }
});

// Get all jobs for user's organization
router.get('/jobs', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { status, limit = 50 } = req.query;

    const where: any = {
      video: { orgId }
    };

    if (status) {
      where.status = (status as string).toUpperCase();
    }

    const jobs = await db.generationJob.findMany({
      where,
      include: {
        video: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json({
      jobs: jobs.map(job => ({
        job: transformJobToApi(job),
        video: transformVideoToApi(job.video),
      })),
      total: jobs.length,
    });
  } catch (error) {
    logger.error('Get jobs error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'JOBS_FETCH_FAILED',
      message: 'Failed to fetch jobs',
    });
  }
});

// Cancel generation job
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const job = await db.generationJob.findFirst({
      where: { 
        id,
        video: { orgId },
        status: { in: ['QUEUED', 'RUNNING'] } // Only allow canceling queued/running jobs
      },
    });

    if (!job) {
      return res.status(404).json({
        code: 'JOB_NOT_FOUND',
        message: 'Active generation job not found',
      });
    }

    // Update job status
    await db.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id },
        data: { 
          status: 'FAILED',
          error: 'Cancelled by user',
          completedAt: new Date(),
        },
      });

      await tx.video.update({
        where: { id: job.videoId },
        data: { status: 'FAILED' },
      });
    });

    // Remove from queue if possible
    await GenerationQueue.cancelJob(id);

    logger.info('Generation job cancelled', { jobId: id, userId: req.user.userId });
    res.json({ message: 'Job cancelled successfully' });
  } catch (error) {
    logger.error('Cancel job error', { error, jobId: req.params.id });
    res.status(500).json({
      code: 'JOB_CANCEL_FAILED',
      message: 'Failed to cancel job',
    });
  }
});

// Retry failed generation job
router.post('/jobs/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const job = await db.generationJob.findFirst({
      where: { 
        id,
        video: { orgId },
        status: 'FAILED'
      },
      include: {
        video: true,
      },
    });

    if (!job) {
      return res.status(404).json({
        code: 'JOB_NOT_FOUND',
        message: 'Failed generation job not found',
      });
    }

    // Reset job status
    await db.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id },
        data: { 
          status: 'QUEUED',
          error: null,
          progress: 0,
          completedAt: null,
        },
      });

      await tx.video.update({
        where: { id: job.videoId },
        data: { status: 'QUEUED' },
      });
    });

    // Re-add to queue
    await GenerationQueue.addJob({
      jobId: job.id,
      videoId: job.videoId,
      prompt: job.prompt,
      stylePreset: job.stylePreset,
      durationSec: job.video.durationSec,
      captions: true, // Default values for retry
      watermark: false,
      orgId,
      // Veo3 specific parameters from original job
      negativePrompt: job.negativePrompt,
      aspectRatio: job.aspectRatio,
      resolution: job.resolution,
      model: job.model,
    });

    logger.info('Generation job retried', { jobId: id, userId: req.user.userId });
    res.json({ message: 'Job retried successfully' });
  } catch (error) {
    logger.error('Retry job error', { error, jobId: req.params.id });
    res.status(500).json({
      code: 'JOB_RETRY_FAILED',
      message: 'Failed to retry job',
    });
  }
});

// Video rescoring endpoint
router.post('/videos/:id/rescore', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const video = await db.video.findUnique({
      where: { id, orgId },
    });

    if (!video) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    if (video.status !== 'READY') {
      return res.status(400).json({
        code: 'INVALID_VIDEO_STATUS',
        message: 'Video must be ready to rescore',
      });
    }

    // Update video status to scoring
    await db.video.update({
      where: { id },
      data: { status: 'SCORING' },
    });

    // Add to scoring queue
    await GenerationQueue.addScoringJob({
      videoId: id,
      orgId,
    });

    logger.info('Video rescoring started', { videoId: id, userId: req.user.userId });
    res.json({ message: 'Video rescoring started' });
  } catch (error) {
    logger.error('Rescore video error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'RESCORE_FAILED',
      message: 'Failed to start rescoring',
    });
  }
});

// Video rerendering endpoint
router.post('/videos/:id/rerender', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const video = await db.video.findUnique({
      where: { id, orgId },
      include: {
        jobs: {
          where: { status: { not: 'FAILED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!video) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    if (video.sourceType !== 'GENERATED') {
      return res.status(400).json({
        code: 'INVALID_SOURCE_TYPE',
        message: 'Only generated videos can be rerendered',
      });
    }

    const lastJob = video.jobs[0];
    if (!lastJob) {
      return res.status(400).json({
        code: 'NO_GENERATION_DATA',
        message: 'No generation data found for this video',
      });
    }

    // Create new video version
    const result = await db.$transaction(async (tx) => {
      // Create new video with incremented version
      const newVideo = await tx.video.create({
        data: {
          title: video.title,
          orgId: video.orgId,
          projectId: video.projectId,
          status: 'QUEUED',
          sourceType: 'GENERATED',
          durationSec: video.durationSec,
          aspect: video.aspect,
          version: video.version + 1,
        },
      });

      // Create new generation job
      const newJob = await tx.generationJob.create({
        data: {
          videoId: newVideo.id,
          prompt: lastJob.prompt,
          stylePreset: lastJob.stylePreset,
          status: 'QUEUED',
          // Copy Veo3 parameters from original job
          negativePrompt: lastJob.negativePrompt,
          aspectRatio: lastJob.aspectRatio,
          resolution: lastJob.resolution,
          model: lastJob.model,
        },
      });

      return { video: newVideo, job: newJob };
    });

    // Add to queue
    await GenerationQueue.addJob({
      jobId: result.job.id,
      videoId: result.video.id,
      prompt: lastJob.prompt,
      stylePreset: lastJob.stylePreset,
      durationSec: video.durationSec,
      captions: true,
      watermark: false,
      orgId,
      // Copy Veo3 parameters from original job
      negativePrompt: lastJob.negativePrompt,
      aspectRatio: lastJob.aspectRatio,
      resolution: lastJob.resolution,
      model: lastJob.model,
    });

    logger.info('Video rerendering started', { 
      originalVideoId: id,
      newVideoId: result.video.id,
      userId: req.user.userId 
    });

    res.json({
      message: 'Video rerendering started',
      newVideo: transformVideoToApi(result.video),
      job: transformJobToApi(result.job),
    });
  } catch (error) {
    logger.error('Rerender video error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'RERENDER_FAILED',
      message: 'Failed to start rerendering',
    });
  }
});

// Duplicate video as template
router.post('/videos/:id/duplicate-template', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const video = await db.video.findUnique({
      where: { id, orgId },
      include: {
        jobs: {
          where: { status: { not: 'FAILED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!video) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    if (video.sourceType !== 'GENERATED') {
      return res.status(400).json({
        code: 'INVALID_SOURCE_TYPE',
        message: 'Only generated videos can be saved as templates',
      });
    }

    const lastJob = video.jobs[0];
    if (!lastJob) {
      return res.status(400).json({
        code: 'NO_GENERATION_DATA',
        message: 'No generation data found for this video',
      });
    }

    // Create template
    const template = await db.template.create({
      data: {
        name: `${video.title} Template`,
        prompt: lastJob.prompt,
        stylePreset: lastJob.stylePreset,
        orgId,
      },
    });

    logger.info('Video saved as template', { 
      videoId: id,
      templateId: template.id,
      userId: req.user.userId 
    });

    res.status(201).json({
      message: 'Video saved as template',
      template: {
        id: template.id,
        name: template.name,
        prompt: template.prompt,
        stylePreset: template.stylePreset,
        orgId: template.orgId,
        createdAt: template.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Duplicate template error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'DUPLICATE_TEMPLATE_FAILED',
      message: 'Failed to save video as template',
    });
  }
});

export default router;