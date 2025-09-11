import { Router } from 'express';
import { 
  db, 
  transformVideoToApi, 
  transformProjectToApi, 
  transformTemplateToApi 
} from '../../shared/database';
import { requireAuth } from '../../shared/utils/auth';
import { 
  validate, 
  getVideosSchema, 
  createVideoSchema,
  updateVideoSchema,
  createProjectSchema,
  createTemplateSchema 
} from '../../shared/utils/validation';
import { logger } from '../../shared/utils/logger';
import type { 
  GetVideosParams, 
  VideosResponse, 
  VideoDetailResponse 
} from '../../shared/types';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// === VIDEO ROUTES ===

// Get videos with filtering, sorting, and pagination
router.get('/videos', validate(getVideosSchema), async (req, res) => {
  try {
    const params: GetVideosParams = req.validated;
    const {
      query,
      status = [],
      minScore,
      projectId,
      sourceType,
      sortBy = 'newest',
      cursor,
      limit = 20
    } = params;

    const orgId = req.user.orgId;

    // Build where clause
    const where: any = { orgId };

    if (query) {
      where.title = {
        contains: query,
        mode: 'insensitive',
      };
    }

    if (status.length > 0) {
      where.status = {
        in: status.map(s => s.toUpperCase()),
      };
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (sourceType) {
      where.sourceType = sourceType.toUpperCase();
    }

    if (minScore !== undefined) {
      where.score = {
        path: ['overall'],
        gte: minScore,
      };
    }

    // Handle cursor-based pagination
    const cursorCondition = cursor ? {
      cursor: { id: cursor },
      skip: 1,
    } : {};

    // Build order by clause
    let orderBy: any;
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'score-high':
        orderBy = [
          { score: { path: ['overall'], sort: 'desc' } },
          { createdAt: 'desc' }
        ];
        break;
      case 'score-low':
        orderBy = [
          { score: { path: ['overall'], sort: 'asc' } },
          { createdAt: 'desc' }
        ];
        break;
      case 'title-az':
        orderBy = { title: 'asc' };
        break;
      default: // newest
        orderBy = { createdAt: 'desc' };
    }

    // Get videos
    const videos = await db.video.findMany({
      where,
      ...cursorCondition,
      take: limit + 1, // Take one extra to check if there are more
      orderBy,
      include: {
        project: true,
      },
    });

    // Check if there are more results
    const hasMore = videos.length > limit;
    if (hasMore) {
      videos.pop(); // Remove the extra item
    }

    const nextCursor = hasMore && videos.length > 0 
      ? videos[videos.length - 1].id 
      : undefined;

    // Get total count for first page
    const total = !cursor ? await db.video.count({ where }) : undefined;

    const response: VideosResponse = {
      items: videos.map(transformVideoToApi),
      nextCursor,
      total: total ?? 0,
    };

    res.json(response);
  } catch (error) {
    logger.error('Get videos error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'VIDEOS_FETCH_FAILED',
      message: 'Failed to fetch videos',
    });
  }
});

// Get single video with versions
router.get('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const video = await db.video.findUnique({
      where: { id, orgId },
      include: {
        project: true,
      },
    });

    if (!video) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    // Get other versions (same title)
    const versions = await db.video.findMany({
      where: {
        title: video.title,
        orgId,
        id: { not: id },
      },
      orderBy: { version: 'desc' },
    });

    const response: VideoDetailResponse = {
      video: transformVideoToApi(video),
      versions: versions.map(transformVideoToApi),
    };

    res.json(response);
  } catch (error) {
    logger.error('Get video error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'VIDEO_FETCH_FAILED',
      message: 'Failed to fetch video',
    });
  }
});

// Create new video
router.post('/videos', validate(createVideoSchema), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const videoData = { ...req.validated, orgId };

    const video = await db.video.create({
      data: {
        ...videoData,
        status: videoData.sourceType === 'UPLOADED' ? 'READY' : 'QUEUED',
        sourceType: videoData.sourceType.toUpperCase() as any,
      },
      include: {
        project: true,
      },
    });

    logger.info('Video created', { videoId: video.id, userId: req.user.userId });
    res.status(201).json(transformVideoToApi(video));
  } catch (error) {
    logger.error('Create video error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'VIDEO_CREATE_FAILED',
      message: 'Failed to create video',
    });
  }
});

// Update video
router.put('/videos/:id', validate(updateVideoSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    // Check if video exists and belongs to user's org
    const existingVideo = await db.video.findUnique({
      where: { id, orgId },
    });

    if (!existingVideo) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    const updateData = { ...req.validated };
    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }

    const video = await db.video.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
      },
    });

    logger.info('Video updated', { videoId: id, userId: req.user.userId });
    res.json(transformVideoToApi(video));
  } catch (error) {
    logger.error('Update video error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'VIDEO_UPDATE_FAILED',
      message: 'Failed to update video',
    });
  }
});

// Delete video
router.delete('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    // Check if video exists and belongs to user's org
    const video = await db.video.findUnique({
      where: { id, orgId },
    });

    if (!video) {
      return res.status(404).json({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    }

    // Delete video (cascading delete will handle jobs)
    await db.video.delete({
      where: { id },
    });

    logger.info('Video deleted', { videoId: id, userId: req.user.userId });
    res.status(204).send();
  } catch (error) {
    logger.error('Delete video error', { error, videoId: req.params.id });
    res.status(500).json({
      code: 'VIDEO_DELETE_FAILED',
      message: 'Failed to delete video',
    });
  }
});

// === PROJECT ROUTES ===

// Get projects
router.get('/projects', async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const projects = await db.project.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects.map(transformProjectToApi));
  } catch (error) {
    logger.error('Get projects error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'PROJECTS_FETCH_FAILED',
      message: 'Failed to fetch projects',
    });
  }
});

// Create project
router.post('/projects', validate(createProjectSchema), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const projectData = { ...req.validated, orgId };

    const project = await db.project.create({
      data: projectData,
    });

    logger.info('Project created', { projectId: project.id, userId: req.user.userId });
    res.status(201).json(transformProjectToApi(project));
  } catch (error) {
    logger.error('Create project error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'PROJECT_CREATE_FAILED',
      message: 'Failed to create project',
    });
  }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    // Check if project exists and belongs to user's org
    const project = await db.project.findUnique({
      where: { id, orgId },
      include: {
        videos: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      });
    }

    // Check if project has videos
    if (project.videos.length > 0) {
      return res.status(400).json({
        code: 'PROJECT_HAS_VIDEOS',
        message: 'Cannot delete project with existing videos. Please delete videos first.',
      });
    }

    // Delete project
    await db.project.delete({
      where: { id },
    });

    logger.info('Project deleted', { projectId: id, userId: req.user.userId });
    res.status(204).send();
  } catch (error) {
    logger.error('Delete project error', { error, projectId: req.params.id });
    res.status(500).json({
      code: 'PROJECT_DELETE_FAILED',
      message: 'Failed to delete project',
    });
  }
});

// === TEMPLATE ROUTES ===

// Get templates
router.get('/templates', async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const templates = await db.template.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(templates.map(transformTemplateToApi));
  } catch (error) {
    logger.error('Get templates error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'TEMPLATES_FETCH_FAILED',
      message: 'Failed to fetch templates',
    });
  }
});

// Create template
router.post('/templates', validate(createTemplateSchema), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const templateData = { ...req.validated, orgId };

    const template = await db.template.create({
      data: templateData,
    });

    logger.info('Template created', { templateId: template.id, userId: req.user.userId });
    res.status(201).json(transformTemplateToApi(template));
  } catch (error) {
    logger.error('Create template error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'TEMPLATE_CREATE_FAILED',
      message: 'Failed to create template',
    });
  }
});

// Update template
router.put('/templates/:id', validate(createTemplateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const template = await db.template.findUnique({
      where: { id, orgId },
    });

    if (!template) {
      return res.status(404).json({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
      });
    }

    const updatedTemplate = await db.template.update({
      where: { id },
      data: req.validated,
    });

    logger.info('Template updated', { templateId: id, userId: req.user.userId });
    res.json(transformTemplateToApi(updatedTemplate));
  } catch (error) {
    logger.error('Update template error', { error, templateId: req.params.id });
    res.status(500).json({
      code: 'TEMPLATE_UPDATE_FAILED',
      message: 'Failed to update template',
    });
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const template = await db.template.findUnique({
      where: { id, orgId },
    });

    if (!template) {
      return res.status(404).json({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
      });
    }

    await db.template.delete({
      where: { id },
    });

    logger.info('Template deleted', { templateId: id, userId: req.user.userId });
    res.status(204).send();
  } catch (error) {
    logger.error('Delete template error', { error, templateId: req.params.id });
    res.status(500).json({
      code: 'TEMPLATE_DELETE_FAILED',
      message: 'Failed to delete template',
    });
  }
});

export default router;