import { Request, Response, Router } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../../shared/utils/logger';
import { GCSService } from '../upload-service/gcs-service';

const router = Router();

/**
 * Serve video files from local storage
 */
router.get('/videos/:videoId/:filename', async (req: Request, res: Response) => {
  try {
    const { videoId, filename } = req.params;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Construct file path
    const filePath = join(process.cwd(), 'uploads', 'videos', videoId, filename);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set appropriate content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case 'mp4':
        contentType = 'video/mp4';
        break;
      case 'm3u8':
        contentType = 'application/vnd.apple.mpegurl';
        break;
      case 'ts':
        contentType = 'video/mp2t';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
    }
    
    // Set headers for video streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Send file
    res.sendFile(filePath);
    
    logger.debug('File served successfully', { videoId, filename, filePath });
    
  } catch (error) {
    logger.error('Failed to serve file', { error: error.message, params: req.params });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Serve uploaded files (GCS or local storage in development)
 */
router.get('/uploads/*', async (req: Request, res: Response) => {
  try {
    // Get the full path after /uploads/
    const filePath = req.params[0];

    // Validate path to prevent directory traversal
    if (!filePath || filePath.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // In development mode or when GCS is not configured, serve from local storage
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      // Construct full file path
      const fullPath = join(process.cwd(), 'uploads', filePath);

      // Check if file exists
      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file extension and set content type
      const ext = filePath.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';

      switch (ext) {
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'avi':
          contentType = 'video/x-msvideo';
          break;
        case 'mov':
          contentType = 'video/quicktime';
          break;
        case 'webm':
          contentType = 'video/webm';
          break;
        case 'm3u8':
          contentType = 'application/vnd.apple.mpegurl';
          break;
        case 'ts':
          contentType = 'video/mp2t';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'vtt':
          contentType = 'text/vtt';
          break;
      }

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');

      // Send file
      res.sendFile(fullPath);

      logger.debug('Local upload file served successfully', { filePath, fullPath });
      return;
    }

    // Production mode: Redirect to GCS public URL
    const bucketName = process.env.GCS_BUCKET_NAME || 'frame-brew-videos';
    const gcsUrl = `https://storage.googleapis.com/${bucketName}/uploads/${filePath}`;

    logger.debug('Redirecting to GCS public URL', { filePath, gcsUrl });

    // Redirect to the GCS public URL
    res.redirect(302, gcsUrl);

  } catch (error) {
    logger.error('Failed to serve upload file', { error: error.message, path: req.params[0] });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Serve generated/processed files (GCS or local storage in development)
 */
router.get('/generated/*', async (req: Request, res: Response) => {
  try {
    // Get the full path after /generated/
    const filePath = req.params[0];

    // Validate path to prevent directory traversal
    if (!filePath || filePath.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // In development mode or when GCS is not configured, serve from local storage
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      // Construct full file path
      const fullPath = join(process.cwd(), 'uploads', 'generated', filePath);

      // Check if file exists
      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file extension and set content type
      const ext = filePath.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';

      switch (ext) {
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'webm':
          contentType = 'video/webm';
          break;
        case 'm3u8':
          contentType = 'application/vnd.apple.mpegurl';
          break;
        case 'ts':
          contentType = 'video/mp2t';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'vtt':
          contentType = 'text/vtt';
          break;
        case 'mp3':
          contentType = 'audio/mpeg';
          break;
      }

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');

      // Send file
      res.sendFile(fullPath);

      logger.debug('Local generated file served successfully', { filePath, fullPath });
      return;
    }

    // Production mode: Redirect to GCS public URL
    const bucketName = process.env.GCS_BUCKET_NAME || 'frame-brew-videos';
    const gcsUrl = `https://storage.googleapis.com/${bucketName}/generated/${filePath}`;

    logger.debug('Redirecting to GCS generated file URL', { filePath, gcsUrl });

    // Redirect to the GCS public URL
    res.redirect(302, gcsUrl);

  } catch (error) {
    logger.error('Failed to serve generated file', { error: error.message, path: req.params[0] });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Serve processed files (GCS or local storage in development)
 */
router.get('/processed/*', async (req: Request, res: Response) => {
  try {
    // Get the full path after /processed/
    const filePath = req.params[0];

    // Validate path to prevent directory traversal
    if (!filePath || filePath.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // In development mode or when GCS is not configured, serve from local storage
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      // Construct full file path
      const fullPath = join(process.cwd(), 'uploads', 'processed', filePath);

      // Check if file exists
      if (!existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file extension and set content type
      const ext = filePath.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';

      switch (ext) {
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'webm':
          contentType = 'video/webm';
          break;
        case 'm3u8':
          contentType = 'application/vnd.apple.mpegurl';
          break;
        case 'ts':
          contentType = 'video/mp2t';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'vtt':
          contentType = 'text/vtt';
          break;
        case 'mp3':
          contentType = 'audio/mpeg';
          break;
      }

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');

      // Send file
      res.sendFile(fullPath);

      logger.debug('Local processed file served successfully', { filePath, fullPath });
      return;
    }

    // Production mode: Redirect to GCS public URL
    const bucketName = process.env.GCS_BUCKET_NAME || 'frame-brew-videos';
    const gcsUrl = `https://storage.googleapis.com/${bucketName}/processed/${filePath}`;

    logger.debug('Redirecting to GCS processed file URL', { filePath, gcsUrl });

    // Redirect to the GCS public URL
    res.redirect(302, gcsUrl);

  } catch (error) {
    logger.error('Failed to serve processed file', { error: error.message, path: req.params[0] });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Serve thumbnail files from local storage
 */
router.get('/thumbnails/:videoId/:filename', async (req: Request, res: Response) => {
  try {
    const { videoId, filename } = req.params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Construct file path
    const filePath = join(process.cwd(), 'uploads', 'thumbnails', videoId, filename);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    // Set content type for images
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'image/jpeg'; // default
    
    switch (ext) {
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    res.sendFile(filePath);
    
    logger.debug('Thumbnail served successfully', { videoId, filename, filePath });
    
  } catch (error) {
    logger.error('Failed to serve thumbnail', { error: error.message, params: req.params });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;