import { logger } from '../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { veo3Client, Veo3GenerationRequest } from './veo3-client';
import { GCSService } from '../upload-service/gcs-service';
import { promises as fs } from 'fs';
import path from 'path';

interface GenerationRequest {
  prompt: string;
  stylePreset?: string;
  durationSec: number;
  aspectRatio?: '16:9' | '9:16';
  negativePrompt?: string;
  resolution?: '720p' | '1080p';
  model?: 'stable' | 'fast';
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

interface GenerationResult {
  id: string;
  url?: string;
  duration: number;
  operationName?: string;
  operationId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata: {
    prompt: string;
    stylePreset?: string;
    resolution: string;
    fileSize?: number;
    aspectRatio?: '16:9' | '9:16';
    model?: 'stable' | 'fast';
    negativePrompt?: string;
  };
}

interface ProcessingOptions {
  captions?: boolean;
  watermark?: boolean;
}

interface ProcessedVideo {
  urls: {
    mp4: string;
    hls?: string;
    thumb: string;
    captions?: string;
  };
  metadata: {
    duration: number;
    fileSize: number;
    resolution: string;
  };
}

export class AIGenerationService {
  /**
   * Generate video using Google Veo3 AI
   */
  static async generateVideo(request: GenerationRequest): Promise<GenerationResult> {
    const { 
      prompt, 
      stylePreset, 
      durationSec, 
      aspectRatio = '16:9',
      negativePrompt,
      resolution = '720p',
      model = 'fast',
      image
    } = request;
    
    logger.info('Starting Veo3 video generation', { 
      prompt: prompt.slice(0, 100),
      stylePreset,
      durationSec,
      aspectRatio,
      resolution,
      model
    });

    try {
      // Validate the request
      const veo3Request: Veo3GenerationRequest = {
        prompt,
        aspectRatio,
        resolution,
        model,
        ...(negativePrompt && { negativePrompt }),
        ...(image && { image })
      };

      veo3Client.validateRequest(veo3Request);

      // Start Veo3 generation
      const veo3Response = await veo3Client.generateVideo(veo3Request);
      
      const videoId = uuidv4();
      
      const result: GenerationResult = {
        id: videoId,
        duration: 8, // Veo3 generates 8-second videos
        operationName: veo3Response.operationName,
        operationId: veo3Response.operationId,
        status: 'pending',
        metadata: {
          prompt,
          ...(stylePreset && { stylePreset }),
          resolution: resolution === '720p' ? '1280x720' : '1920x1080',
          aspectRatio,
          model,
          ...(negativePrompt && { negativePrompt })
        },
      };

      logger.info('Veo3 video generation started', { 
        videoId,
        operationName: veo3Response.operationName,
        operationId: veo3Response.operationId 
      });

      return result;

    } catch (error) {
      logger.error('Veo3 video generation failed', { 
        error: error.message,
        prompt: prompt.slice(0, 100)
      });

      // Return failed result
      const videoId = uuidv4();
      return {
        id: videoId,
        duration: 8,
        status: 'failed',
        metadata: {
          prompt,
          ...(stylePreset && { stylePreset }),
          resolution: resolution === '720p' ? '1280x720' : '1920x1080',
          aspectRatio,
          model,
          ...(negativePrompt && { negativePrompt })
        },
      };
    }
  }

  /**
   * Poll Veo3 generation status
   */
  static async pollGenerationStatus(operationName: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    videoUrl?: any; // Changed to any to handle file references
    error?: string;
  }> {
    try {
      const result = await veo3Client.pollGenerationStatus(operationName);
      
      logger.debug('Veo3 polling result', {
        operationName,
        status: result.status,
        progress: result.progress,
        hasVideoUrl: !!result.videoUrl,
        videoUrlType: typeof result.videoUrl
      });
      
      return {
        status: result.status.toLowerCase() as any,
        progress: result.progress,
        videoUrl: result.videoUrl, // This can now be a file reference or URL
        error: result.error
      };
    } catch (error) {
      logger.error('Failed to poll Veo3 generation status', { 
        operationName,
        error: error.message,
        stack: error.stack
      });
      
      return {
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Download and store completed Veo3 video
   */
  static async downloadAndStoreVideo(
    videoId: string,
    videoFile: any, // Can be a file reference or URL string
    orgId: string = 'default'
  ): Promise<string> {
    try {
      logger.info('Downloading Veo3 video', {
        videoId,
        videoFileType: typeof videoFile,
        isString: typeof videoFile === 'string'
      });

      // Download video from Veo3 using the updated method signature
      const videoBuffer = await veo3Client.downloadVideo(videoFile, videoId);

      // Store video in GCS
      const key = `generated/${orgId}/${videoId}/video.mp4`;
      const videoUrl = await GCSService.uploadProcessedFile(
        videoBuffer,
        key,
        'video/mp4',
        {
          'video-id': videoId,
          'type': 'generated',
          'source': 'veo3',
          'org-id': orgId,
          'generated-at': new Date().toISOString(),
        }
      );

      logger.info('Veo3 video stored in GCS', {
        videoId,
        videoUrl,
        size: videoBuffer.length,
        sizeKB: Math.round(videoBuffer.length / 1024),
        sizeMB: Math.round(videoBuffer.length / (1024 * 1024))
      });

      return videoUrl;

    } catch (error) {
      logger.error('Failed to download and store Veo3 video', {
        videoId,
        videoFile: typeof videoFile === 'string' ? videoFile : '[File Reference]',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process and optimize generated video
   */
  static async processVideo(
    generationResult: GenerationResult,
    options: ProcessingOptions,
    orgId: string = 'default'
  ): Promise<ProcessedVideo> {
    const { url, id, duration } = generationResult;
    const { captions, watermark } = options;

    logger.info('Starting video processing', { videoId: id, options, orgId });

    // Simulate processing time
    await this.simulateProcessing(3000, 'Video optimization');

    // Generate thumbnail
    const thumbnailUrl = await this.generateThumbnail(id, url, orgId);

    // Generate HLS for streaming (optional)
    const hlsUrl = await this.generateHLS(id, url, orgId);

    // Generate captions if requested
    let captionsUrl: string | undefined;
    if (captions) {
      captionsUrl = await this.generateCaptions(id, url, orgId);
    }

    // Apply watermark if requested
    let finalVideoUrl = url;
    if (watermark) {
      finalVideoUrl = await this.applyWatermark(id, url);
    }

    const result: ProcessedVideo = {
      urls: {
        mp4: finalVideoUrl,
        hls: hlsUrl,
        thumb: thumbnailUrl,
        ...(captionsUrl && { captions: captionsUrl }),
      },
      metadata: {
        duration,
        fileSize: generationResult.metadata.fileSize,
        resolution: generationResult.metadata.resolution,
      },
    };

    logger.info('Video processing completed', { videoId: id, orgId });
    return result;
  }

  /**
   * Create mock video file for MVP
   */
  private static async createMockVideo(videoId: string, durationSec: number, orgId: string = 'default'): Promise<string> {
    // For MVP, we'll create a placeholder video
    // This is used as fallback when Veo3 generation fails

    const mockVideoBuffer = Buffer.from('MOCK_VIDEO_DATA_' + videoId);

    try {
      // Store mock video in GCS
      const key = `generated/${orgId}/${videoId}/video.mp4`;
      const videoUrl = await GCSService.uploadProcessedFile(
        mockVideoBuffer,
        key,
        'video/mp4',
        {
          'video-id': videoId,
          'type': 'mock',
          'source': 'fallback',
          'org-id': orgId,
          'duration': durationSec.toString(),
        }
      );

      logger.info('Mock video created in GCS', {
        videoId,
        videoUrl,
        duration: durationSec,
        size: mockVideoBuffer.length
      });

      return videoUrl;

    } catch (error) {
      logger.error('Failed to create mock video', { error, videoId });
      // Return expected GCS URL even if creation fails
      return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME || 'frame-brew-videos'}/generated/${orgId}/${videoId}/video.mp4`;
    }
  }

  /**
   * Generate thumbnail from video
   */
  private static async generateThumbnail(videoId: string, videoUrl: string, orgId: string = 'default'): Promise<string> {
    await this.simulateProcessing(1000, 'Thumbnail generation');

    try {
      // For MVP, create a mock thumbnail
      const mockThumbnailBuffer = Buffer.from('MOCK_THUMBNAIL_DATA_' + videoId);

      // Store thumbnail in GCS
      const key = `generated/${orgId}/${videoId}/thumbnail.jpg`;
      const thumbnailUrl = await GCSService.uploadProcessedFile(
        mockThumbnailBuffer,
        key,
        'image/jpeg',
        {
          'video-id': videoId,
          'type': 'thumbnail',
          'source': 'ai-generated',
          'org-id': orgId,
        }
      );

      logger.info('Thumbnail generated and stored in GCS', {
        videoId,
        thumbnailUrl,
        size: mockThumbnailBuffer.length
      });

      return thumbnailUrl;

    } catch (error) {
      logger.error('Failed to generate thumbnail', { error, videoId });
      // Return expected GCS path pattern even if failed
      return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME || 'frame-brew-videos'}/generated/${orgId}/${videoId}/thumbnail.jpg`;
    }
  }

  /**
   * Generate HLS streaming format
   */
  private static async generateHLS(videoId: string, videoUrl: string, orgId: string = 'default'): Promise<string> {
    await this.simulateProcessing(2000, 'HLS generation');

    try {
      // For MVP, create a mock HLS playlist
      const mockPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
segment_0.ts
#EXTINF:10.0,
segment_1.ts
#EXT-X-ENDLIST`;

      // Store HLS playlist in GCS
      const key = `generated/${orgId}/${videoId}/playlist.m3u8`;
      const hlsUrl = await GCSService.uploadProcessedFile(
        Buffer.from(mockPlaylist),
        key,
        'application/x-mpegURL',
        {
          'video-id': videoId,
          'type': 'hls',
          'source': 'ai-generated',
          'org-id': orgId,
        }
      );

      return hlsUrl;
    } catch (error) {
      logger.error('Failed to generate HLS', { error, videoId });
      // Return expected GCS path pattern even if failed
      return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME || 'frame-brew-videos'}/generated/${orgId}/${videoId}/playlist.m3u8`;
    }
  }

  /**
   * Generate captions/subtitles
   */
  private static async generateCaptions(videoId: string, videoUrl: string, orgId: string = 'default'): Promise<string> {
    await this.simulateProcessing(1500, 'Caption generation');

    // Create mock captions
    const mockCaptions = `WEBVTT

00:00:00.000 --> 00:00:05.000
Generated video content starts here.

00:00:05.000 --> 00:00:10.000
This is a mock caption for the generated video.

00:00:10.000 --> 00:00:15.000
AI-generated content continues...`;

    try {
      // Store captions in GCS
      const key = `generated/${orgId}/${videoId}/captions.vtt`;
      const captionsUrl = await GCSService.uploadProcessedFile(
        Buffer.from(mockCaptions, 'utf8'),
        key,
        'text/vtt',
        {
          'video-id': videoId,
          'type': 'captions',
          'source': 'ai-generated',
          'org-id': orgId,
          'language': 'en',
        }
      );

      logger.info('Captions generated and stored in GCS', {
        videoId,
        captionsUrl,
        size: mockCaptions.length
      });

      return captionsUrl;

    } catch (error) {
      logger.error('Failed to generate captions', { error, videoId });
      // Return expected GCS path pattern even if failed
      return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME || 'frame-brew-videos'}/generated/${orgId}/${videoId}/captions.vtt`;
    }
  }

  /**
   * Apply watermark to video
   */
  private static async applyWatermark(videoId: string, videoUrl: string): Promise<string> {
    await this.simulateProcessing(2000, 'Watermark application');

    // For MVP, return the same URL (watermark would be applied in real implementation)
    return videoUrl;
  }

  /**
   * Simulate processing time with progress logging
   */
  private static async simulateProcessing(durationMs: number, operation: string): Promise<void> {
    const steps = 5;
    const stepDuration = durationMs / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      const progress = (i / steps) * 100;
      logger.debug(`${operation} progress: ${progress.toFixed(0)}%`);
    }
  }

  /**
   * Estimate Veo3 generation time based on parameters
   */
  static estimateGenerationTime(
    model: 'stable' | 'fast' = 'fast', 
    resolution: '720p' | '1080p' = '720p'
  ): number {
    // Veo3 Fast: 11 seconds to 6 minutes
    // Veo3 Stable: typically longer
    
    let baseTimeSeconds = model === 'fast' ? 60 : 120; // 1-2 minutes base
    
    // Higher resolution takes longer
    if (resolution === '1080p') {
      baseTimeSeconds *= 1.5;
    }

    // Add some variance (±30%)
    const variance = baseTimeSeconds * 0.3;
    const randomVariance = (Math.random() - 0.5) * 2 * variance;
    
    return Math.max(Math.round(baseTimeSeconds + randomVariance), 11); // Minimum 11 seconds
  }

  /**
   * Check if Veo3 service is available
   */
  static async checkAvailability(): Promise<boolean> {
    try {
      // Check if GEMINI_API_KEY is configured
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-google-gemini-api-key-here') {
        logger.warn('Veo3 service not available: GEMINI_API_KEY not configured');
        return false;
      }
      
      // TODO: Add actual Veo3 service health check
      return true;
    } catch (error) {
      logger.error('Veo3 service availability check failed', { error });
      return false;
    }
  }

  /**
   * Get Veo3 service status and quotas
   */
  static async getServiceStatus(): Promise<{
    available: boolean;
    quotaRemaining?: number;
    estimatedWaitTime?: number;
    modelStatus: {
      stable: boolean;
      fast: boolean;
    };
  }> {
    try {
      const available = await this.checkAvailability();
      
      return {
        available,
        modelStatus: {
          stable: available,
          fast: available
        },
        // TODO: Implement actual quota checking via Veo3 API
        quotaRemaining: available ? 100 : 0,
        estimatedWaitTime: available ? this.estimateGenerationTime('fast') : undefined
      };
    } catch (error) {
      logger.error('Failed to get Veo3 service status', { error });
      return {
        available: false,
        modelStatus: {
          stable: false,
          fast: false
        }
      };
    }
  }
}