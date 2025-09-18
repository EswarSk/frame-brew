import { logger } from '../../shared/utils/logger';
import { db } from '../../shared/database';
import { UploadService } from './upload-service';
import { VideoScoringService } from '../generation-service/scoring-service';
import { v4 as uuidv4 } from 'uuid';

interface ProcessUploadParams {
  videoId: string;
  originalUrl: string;
  orgId: string;
}

interface ProcessingProgress {
  stage: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  fileSize: number;
}

interface ProcessingJob {
  id: string;
  videoId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  stage: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class VideoProcessingService {
  private static processingJobs = new Map<string, ProcessingJob>();

  /**
   * Process uploaded video through the complete pipeline
   */
  static async processUploadedVideo(params: ProcessUploadParams): Promise<void> {
    const { videoId, originalUrl, orgId } = params;
    const jobId = uuidv4();

    // Create processing job record
    const job: ProcessingJob = {
      id: jobId,
      videoId,
      status: 'QUEUED',
      progress: 0,
      stage: 'Queued',
    };

    this.processingJobs.set(videoId, job);

    logger.info('Starting video processing pipeline', {
      videoId,
      jobId,
      originalUrl,
    });

    try {
      await this.runProcessingPipeline(videoId, originalUrl, orgId);
    } catch (error) {
      logger.error('Video processing pipeline failed', {
        error,
        videoId,
        jobId,
      });

      // Update job status
      const failedJob = this.processingJobs.get(videoId);
      if (failedJob) {
        failedJob.status = 'FAILED';
        failedJob.error = error.message;
        failedJob.completedAt = new Date();
      }

      // Update video status in database
      const existingMetadata = await this.getVideoMetadata(videoId);
      await db.video.update({
        where: { id: videoId },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({
            ...existingMetadata,
            error: error.message,
            processingFailedAt: new Date().toISOString(),
          }),
        },
      });

      throw error;
    }
  }

  /**
   * Run the complete processing pipeline
   */
  private static async runProcessingPipeline(
    videoId: string,
    originalUrl: string,
    orgId: string
  ): Promise<void> {
    const job = this.processingJobs.get(videoId)!;
    job.status = 'RUNNING';
    job.startedAt = new Date();

    // Stage 1: Extract metadata
    await this.updateProgress(videoId, 10, 'Analyzing video metadata');
    const metadata = await this.extractVideoMetadata(originalUrl);

    // Stage 2: Generate thumbnail
    await this.updateProgress(videoId, 30, 'Generating thumbnail');
    const thumbnailUrl = await this.generateThumbnail(videoId, originalUrl, orgId);

    // Stage 3: Create optimized versions
    await this.updateProgress(videoId, 50, 'Creating optimized versions');
    const optimizedVersions = await this.createOptimizedVersions(
      videoId,
      originalUrl,
      metadata,
      orgId
    );

    // Stage 4: Generate preview/GIF
    await this.updateProgress(videoId, 70, 'Creating preview');
    const previewUrl = await this.generatePreview(videoId, originalUrl, orgId);

    // Stage 5: Extract audio (if needed)
    await this.updateProgress(videoId, 80, 'Processing audio');
    const audioUrl = await this.extractAudio(videoId, originalUrl, orgId);

    // Stage 6: Auto-generate captions (optional)
    await this.updateProgress(videoId, 90, 'Generating captions');
    const captionsUrl = await this.generateCaptions(videoId, originalUrl, orgId);

    // Stage 7: Score video quality
    await this.updateProgress(videoId, 95, 'Analyzing video quality');
    const score = await VideoScoringService.scoreVideo(originalUrl);

    // Stage 8: Finalize
    await this.updateProgress(videoId, 100, 'Finalizing');

    // Update video record with all processed data
    const processedUrls = {
      original: originalUrl,
      mp4: optimizedVersions.mp4,
      webm: optimizedVersions.webm,
      hls: optimizedVersions.hls,
      thumbnail: thumbnailUrl,
      preview: previewUrl,
      audio: audioUrl,
      captions: captionsUrl,
    };

    const processedMetadata = {
      ...metadata,
      processedAt: new Date().toISOString(),
      processingDuration: Date.now() - (job.startedAt?.getTime() || 0),
    };

    await db.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        durationSec: metadata.duration,
        aspect: this.calculateAspectRatio(metadata.width, metadata.height),
        urls: JSON.stringify(processedUrls),
        score: typeof score === 'object' ? JSON.stringify(score) : score,
        metadata: JSON.stringify(processedMetadata),
      },
    });

    // Complete the job
    job.status = 'COMPLETED';
    job.progress = 100;
    job.stage = 'Completed';
    job.completedAt = new Date();

    logger.info('Video processing completed successfully', {
      videoId,
      processingDuration: job.completedAt.getTime() - (job.startedAt?.getTime() || 0),
    });
  }

  /**
   * Extract video metadata (mock implementation for MVP)
   */
  private static async extractVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    // Simulate metadata extraction time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In production, this would use FFmpeg or similar to extract real metadata
    return {
      duration: 30 + Math.random() * 60, // 30-90 seconds
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 2500000, // 2.5 Mbps
      codec: 'h264',
      fileSize: Math.floor(30 * 1024 * 1024 * (1 + Math.random())), // ~30MB +/- random
    };
  }

  /**
   * Generate thumbnail from video
   */
  private static async generateThumbnail(
    videoId: string,
    videoUrl: string,
    orgId: string
  ): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create mock thumbnail
    const thumbnailBuffer = Buffer.from(`THUMBNAIL_${videoId}`);
    const key = `processed/${orgId}/${videoId}/thumbnail.jpg`;

    return await UploadService.uploadProcessedFile(
      thumbnailBuffer,
      key,
      'image/jpeg',
      {
        'video-id': videoId,
        'type': 'thumbnail',
        'extracted-from': videoUrl,
      }
    );
  }

  /**
   * Create optimized video versions
   */
  private static async createOptimizedVersions(
    videoId: string,
    videoUrl: string,
    metadata: VideoMetadata,
    orgId: string
  ): Promise<{
    mp4: string;
    webm: string;
    hls: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 3000));

    // In production, this would use FFmpeg to create actual optimized versions
    const baseKey = `processed/${orgId}/${videoId}`;

    // Mock optimized MP4
    const mp4Buffer = Buffer.from(`OPTIMIZED_MP4_${videoId}`);
    const mp4Key = `${baseKey}/optimized.mp4`;
    const mp4Url = await UploadService.uploadProcessedFile(
      mp4Buffer,
      mp4Key,
      'video/mp4',
      {
        'video-id': videoId,
        'type': 'optimized',
        'format': 'mp4',
        'bitrate': '2500000',
      }
    );

    // Mock WebM version
    const webmBuffer = Buffer.from(`OPTIMIZED_WEBM_${videoId}`);
    const webmKey = `${baseKey}/optimized.webm`;
    const webmUrl = await UploadService.uploadProcessedFile(
      webmBuffer,
      webmKey,
      'video/webm',
      {
        'video-id': videoId,
        'type': 'optimized',
        'format': 'webm',
      }
    );

    // Mock HLS playlist
    const hlsPlaylist = this.generateHLSPlaylist(videoId, baseKey);
    const hlsKey = `${baseKey}/playlist.m3u8`;
    const hlsUrl = await UploadService.uploadProcessedFile(
      Buffer.from(hlsPlaylist),
      hlsKey,
      'application/x-mpegURL',
      {
        'video-id': videoId,
        'type': 'hls',
        'format': 'hls',
      }
    );

    return {
      mp4: mp4Url,
      webm: webmUrl,
      hls: hlsUrl,
    };
  }

  /**
   * Generate video preview/GIF
   */
  private static async generatePreview(
    videoId: string,
    videoUrl: string,
    orgId: string
  ): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create mock preview GIF
    const previewBuffer = Buffer.from(`PREVIEW_GIF_${videoId}`);
    const key = `processed/${orgId}/${videoId}/preview.gif`;

    return await UploadService.uploadProcessedFile(
      previewBuffer,
      key,
      'image/gif',
      {
        'video-id': videoId,
        'type': 'preview',
        'duration': '3',
      }
    );
  }

  /**
   * Extract audio track
   */
  private static async extractAudio(
    videoId: string,
    videoUrl: string,
    orgId: string
  ): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create mock audio file
    const audioBuffer = Buffer.from(`AUDIO_${videoId}`);
    const key = `processed/${orgId}/${videoId}/audio.mp3`;

    return await UploadService.uploadProcessedFile(
      audioBuffer,
      key,
      'audio/mpeg',
      {
        'video-id': videoId,
        'type': 'audio',
        'bitrate': '128000',
      }
    );
  }

  /**
   * Generate captions/subtitles
   */
  private static async generateCaptions(
    videoId: string,
    videoUrl: string,
    orgId: string
  ): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create mock captions
    const captions = `WEBVTT

00:00:00.000 --> 00:00:05.000
Video content starts here

00:00:05.000 --> 00:00:10.000
Auto-generated captions for uploaded video

00:00:10.000 --> 00:00:15.000
Content continues...`;

    const key = `processed/${orgId}/${videoId}/captions.vtt`;

    return await UploadService.uploadProcessedFile(
      Buffer.from(captions),
      key,
      'text/vtt',
      {
        'video-id': videoId,
        'type': 'captions',
        'language': 'en',
      }
    );
  }

  /**
   * Update processing progress
   */
  private static async updateProgress(
    videoId: string,
    progress: number,
    message: string
  ): Promise<void> {
    const job = this.processingJobs.get(videoId);
    if (job) {
      job.progress = progress;
      job.stage = message;
    }

    // Get existing video to merge metadata
    const existingVideo = await db.video.findUnique({
      where: { id: videoId },
      select: { metadata: true },
    });

    // Parse existing metadata or create new object
    let existingMetadata = {};
    if (existingVideo?.metadata) {
      try {
        existingMetadata = JSON.parse(existingVideo.metadata);
      } catch (error) {
        logger.warn('Failed to parse existing metadata', { videoId, error: error.message });
      }
    }

    // Merge with processing progress data
    const updatedMetadata = {
      ...existingMetadata,
      processingProgress: progress,
      processingStage: message,
      lastUpdateAt: new Date().toISOString(),
    };

    // Update database
    await db.video.update({
      where: { id: videoId },
      data: {
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    logger.debug('Processing progress updated', { videoId, progress, message });
  }

  /**
   * Get processing progress for a video
   */
  static async getProcessingProgress(videoId: string): Promise<ProcessingProgress | null> {
    const job = this.processingJobs.get(videoId);
    
    if (!job) {
      // Try to get from database
      const video = await db.video.findUnique({
        where: { id: videoId },
      });

      if (!video || !video.metadata) {
        return null;
      }

      // Parse metadata JSON string
      const metadata = typeof video.metadata === 'string' ? JSON.parse(video.metadata) : video.metadata;

      return {
        stage: metadata.processingStage || 'Unknown',
        progress: metadata.processingProgress || 0,
        message: metadata.processingStage || 'Processing...',
      };
    }

    return {
      stage: job.stage,
      progress: job.progress,
      message: job.stage,
    };
  }

  /**
   * Cancel video processing
   */
  static async cancelProcessing(videoId: string): Promise<boolean> {
    const job = this.processingJobs.get(videoId);
    
    if (!job) {
      return false;
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return false;
    }

    // Mark job as failed
    job.status = 'FAILED';
    job.error = 'Cancelled by user';
    job.completedAt = new Date();

    // Remove from processing queue
    this.processingJobs.delete(videoId);

    logger.info('Video processing cancelled', { videoId });
    return true;
  }

  /**
   * Generate HLS playlist (mock)
   */
  private static generateHLSPlaylist(videoId: string, baseKey: string): string {
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${baseKey}/segment_0.ts
#EXTINF:10.0,
${baseKey}/segment_1.ts
#EXTINF:10.0,
${baseKey}/segment_2.ts
#EXT-X-ENDLIST`;
  }

  /**
   * Calculate aspect ratio string
   */
  private static calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Get video metadata from database
   */
  private static async getVideoMetadata(videoId: string): Promise<any> {
    const video = await db.video.findUnique({
      where: { id: videoId },
      select: { metadata: true },
    });

    return video?.metadata || {};
  }

  /**
   * Clean up processing jobs (maintenance)
   */
  static cleanupCompletedJobs(): number {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleaned = 0;

    for (const [videoId, job] of this.processingJobs.entries()) {
      if (
        (job.status === 'COMPLETED' || job.status === 'FAILED') &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAge
      ) {
        this.processingJobs.delete(videoId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up completed processing jobs', { cleaned });
    }

    return cleaned;
  }

  /**
   * Get all active processing jobs
   */
  static getActiveJobs(): ProcessingJob[] {
    return Array.from(this.processingJobs.values()).filter(
      job => job.status === 'RUNNING' || job.status === 'QUEUED'
    );
  }
}