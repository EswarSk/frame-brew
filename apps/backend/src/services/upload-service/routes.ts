import { Router } from 'express';
import multer from 'multer';
import { db, transformVideoToApi } from '../../shared/database';
import { requireAuth } from '../../shared/utils/auth';
import { logger } from '../../shared/utils/logger';
import { UploadService } from './upload-service';
import { VideoProcessingService } from './processing-service';
import type { UploadResponse, ProcessedUpload } from '../../shared/types';

const router = Router();

// Configure multer for file uploads (memory storage for direct S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    const allowedMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // AVI
      'video/x-ms-wmv',  // WMV
      'video/webm',
      'video/3gpp',
      'video/x-flv',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  },
});

// All routes require authentication
router.use(requireAuth);

// Upload single video file
router.post('/video', upload.single('video'), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        code: 'NO_FILE_PROVIDED',
        message: 'No video file provided',
      });
    }

    const { projectId, title, description } = req.body;

    // Validate project exists and belongs to org
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId, orgId },
      });

      if (!project) {
        return res.status(404).json({
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        });
      }
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    logger.info('Starting video upload', {
      fileName: file.originalname,
      fileSize: file.size,
      orgId,
      userId: req.user.userId,
    });

    // Upload to S3
    const uploadResult = await UploadService.uploadVideo({
      file: file.buffer,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      orgId,
    });

    // Create video record
    const video = await db.video.create({
      data: {
        title: title || file.originalname.replace(/\.[^/.]+$/, ''),
        description: description || null,
        orgId,
        projectId: projectId || null,
        status: 'PROCESSING',
        sourceType: 'UPLOADED',
        urls: {
          original: uploadResult.url,
        },
        metadata: {
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadId: uploadResult.uploadId,
        },
      },
      include: {
        project: true,
      },
    });

    // Start processing pipeline
    await VideoProcessingService.processUploadedVideo({
      videoId: video.id,
      originalUrl: uploadResult.url,
      orgId,
    });

    const response: UploadResponse = {
      video: transformVideoToApi(video),
      uploadId: uploadResult.uploadId,
    };

    logger.info('Video upload completed', {
      videoId: video.id,
      uploadId: uploadResult.uploadId,
      userId: req.user.userId,
    });

    res.status(201).json(response);
  } catch (error) {
    logger.error('Video upload error', { 
      error, 
      user: req.user.userId,
      fileName: req.file?.originalname,
    });

    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds 500MB limit',
      });
    }

    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({
        code: 'INVALID_FILE_TYPE',
        message: error.message,
      });
    }

    res.status(500).json({
      code: 'UPLOAD_FAILED',
      message: 'Failed to upload video',
    });
  }
});

// Upload multiple video files
router.post('/videos/batch', upload.array('videos', 10), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        code: 'NO_FILES_PROVIDED',
        message: 'No video files provided',
      });
    }

    const { projectId } = req.body;

    // Validate project if provided
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId, orgId },
      });

      if (!project) {
        return res.status(404).json({
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        });
      }
    }

    logger.info('Starting batch video upload', {
      fileCount: files.length,
      orgId,
      userId: req.user.userId,
    });

    // Process uploads in parallel
    const uploadPromises = files.map(async (file) => {
      try {
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

        const uploadResult = await UploadService.uploadVideo({
          file: file.buffer,
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          orgId,
        });

        const video = await db.video.create({
          data: {
            title: file.originalname.replace(/\.[^/.]+$/, ''),
            orgId,
            projectId: projectId || null,
            status: 'PROCESSING',
            sourceType: 'UPLOADED',
            urls: {
              original: uploadResult.url,
            },
            metadata: {
              originalName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadId: uploadResult.uploadId,
            },
          },
          include: {
            project: true,
          },
        });

        // Start processing
        await VideoProcessingService.processUploadedVideo({
          videoId: video.id,
          originalUrl: uploadResult.url,
          orgId,
        });

        return {
          success: true,
          video: transformVideoToApi(video),
          uploadId: uploadResult.uploadId,
        };
      } catch (error) {
        logger.error('Individual file upload failed', { 
          error, 
          fileName: file.originalname 
        });
        return {
          success: false,
          fileName: file.originalname,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(uploadPromises);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.info('Batch video upload completed', {
      successful: successful.length,
      failed: failed.length,
      userId: req.user.userId,
    });

    res.status(201).json({
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    logger.error('Batch upload error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'BATCH_UPLOAD_FAILED',
      message: 'Failed to process batch upload',
    });
  }
});

// Get upload progress
router.get('/progress/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const orgId = req.user.orgId;

    // Find video by upload ID
    const video = await db.video.findFirst({
      where: {
        orgId,
        metadata: {
          path: ['uploadId'],
          equals: uploadId,
        },
      },
    });

    if (!video) {
      return res.status(404).json({
        code: 'UPLOAD_NOT_FOUND',
        message: 'Upload not found',
      });
    }

    // Get processing status
    const progress = await VideoProcessingService.getProcessingProgress(video.id);

    res.json({
      uploadId,
      videoId: video.id,
      status: video.status,
      progress,
    });
  } catch (error) {
    logger.error('Get upload progress error', { error, uploadId: req.params.uploadId });
    res.status(500).json({
      code: 'PROGRESS_FETCH_FAILED',
      message: 'Failed to get upload progress',
    });
  }
});

// Cancel upload/processing
router.post('/cancel/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const orgId = req.user.orgId;

    // Find video by upload ID
    const video = await db.video.findFirst({
      where: {
        orgId,
        metadata: {
          path: ['uploadId'],
          equals: uploadId,
        },
      },
    });

    if (!video) {
      return res.status(404).json({
        code: 'UPLOAD_NOT_FOUND',
        message: 'Upload not found',
      });
    }

    if (!['PROCESSING', 'QUEUED'].includes(video.status)) {
      return res.status(400).json({
        code: 'CANNOT_CANCEL',
        message: 'Upload cannot be cancelled in current state',
      });
    }

    // Cancel processing
    await VideoProcessingService.cancelProcessing(video.id);

    // Update video status
    await db.video.update({
      where: { id: video.id },
      data: { status: 'FAILED' },
    });

    logger.info('Upload cancelled', { uploadId, videoId: video.id, userId: req.user.userId });
    res.json({ message: 'Upload cancelled successfully' });
  } catch (error) {
    logger.error('Cancel upload error', { error, uploadId: req.params.uploadId });
    res.status(500).json({
      code: 'CANCEL_FAILED',
      message: 'Failed to cancel upload',
    });
  }
});

// Generate presigned URL for direct S3 upload (alternative approach)
router.post('/presigned-url', async (req, res) => {
  try {
    const { fileName, fileSize, mimeType } = req.body;
    const orgId = req.user.orgId;

    if (!fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        code: 'MISSING_PARAMETERS',
        message: 'fileName, fileSize, and mimeType are required',
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      'video/mp4',
      'video/mpeg', 
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/webm',
      'video/3gpp',
      'video/x-flv',
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file type. Only video files are allowed.',
      });
    }

    // Check file size
    if (fileSize > 500 * 1024 * 1024) {
      return res.status(400).json({
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds 500MB limit',
      });
    }

    const presignedData = await UploadService.generatePresignedUrl({
      fileName,
      fileSize,
      mimeType,
      orgId,
    });

    res.json(presignedData);
  } catch (error) {
    logger.error('Generate presigned URL error', { error, user: req.user.userId });
    res.status(500).json({
      code: 'PRESIGNED_URL_FAILED',
      message: 'Failed to generate presigned URL',
    });
  }
});

export default router;