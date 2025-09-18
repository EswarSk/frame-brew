import Bull from 'bull';
import { logger } from '../../shared/utils/logger';
import { db } from '../../shared/database';
import { AIGenerationService } from './ai-service';
import { VideoScoringService } from './scoring-service';

// Redis connection configuration
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  },
};

// Job data interfaces
interface GenerationJobData {
  jobId: string;
  videoId: string;
  prompt: string;
  stylePreset?: string;
  durationSec: number;
  captions?: boolean;
  watermark?: boolean;
  orgId: string;
  // Veo3 specific parameters
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  model?: 'stable' | 'fast';
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

interface PollingJobData {
  jobId: string;
  videoId: string;
  operationName: string;
  operationId: string;
  orgId: string;
}

interface DownloadJobData {
  jobId: string;
  videoId: string;
  videoUrl: string;
  orgId: string;
}

interface ScoringJobData {
  videoId: string;
  orgId: string;
}

// Conditionally create queues - skip Redis in development
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.REDIS_HOST;

let generationQueue: Bull.Queue | null = null;
let pollingQueue: Bull.Queue | null = null;
let downloadQueue: Bull.Queue | null = null;
let scoringQueue: Bull.Queue | null = null;

if (!isDevelopment) {
  try {
    generationQueue = new Bull('video-generation', redisConfig);
    pollingQueue = new Bull('video-polling', redisConfig);
    downloadQueue = new Bull('video-download', redisConfig);
    scoringQueue = new Bull('video-scoring', redisConfig);
    
    logger.info('Bull queues initialized with Redis');
  } catch (error) {
    logger.error('Failed to initialize Bull queues, falling back to development mode', { error: error.message });
  }
} else {
  logger.info('Running in development mode - skipping Redis queue initialization');
}

export class GenerationQueue {
  static async addJob(data: GenerationJobData): Promise<Bull.Job> {
    try {
      // In development, skip Redis and return a mock job
      if (isDevelopment || !generationQueue) {
        logger.info('Mock: Generation job added to queue', { jobId: data.jobId });
        
        // Simulate job processing in the background
        setTimeout(async () => {
          try {
            await this.processMockJob(data);
          } catch (error) {
            logger.error('Mock job processing failed', { error, jobId: data.jobId });
          }
        }, 1000); // Process after 1 second
        
        // Return a mock job object
        return {
          id: data.jobId,
          data,
          opts: {},
          progress: 0,
        } as any;
      }
      
      const job = await generationQueue.add('generate-video', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30 seconds
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      logger.info('Generation job added to queue', { 
        jobId: data.jobId,
        videoId: data.videoId,
        queueJobId: job.id 
      });

      return job;
    } catch (error) {
      logger.error('Failed to add generation job to queue', { error, data });
      throw error;
    }
  }

  private static async processMockJob(data: GenerationJobData): Promise<void> {
    try {
      logger.info('Development: Processing real Veo3 generation job', { jobId: data.jobId });

      // Update job status to running
      await db.generationJob.update({
        where: { id: data.jobId },
        data: { status: 'RUNNING', progress: 10 },
      });

      // Step 1: Start Veo3 generation using real AI service
      await new Promise(resolve => setTimeout(resolve, 1000));
      await db.generationJob.update({
        where: { id: data.jobId },
        data: { progress: 50 },
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await db.generationJob.update({
        where: { id: data.jobId },
        data: { progress: 80 },
      });

      // Generate video using Veo3
      const generationResult = await AIGenerationService.generateVideo({
        prompt: data.prompt,
        stylePreset: data.stylePreset,
        durationSec: data.durationSec,
        aspectRatio: data.aspectRatio,
        negativePrompt: data.negativePrompt,
        resolution: data.resolution,
        model: data.model,
        image: data.image,
      });

      // If generation started successfully, poll directly using Veo3 pattern
      if (generationResult.operationName) {
        await db.generationJob.update({
          where: { id: data.jobId },
          data: {
            operationName: generationResult.operationName,
            operationId: generationResult.operationId,
            status: 'POLLING',
            progress: 20,
          },
        });

        await db.video.update({
          where: { id: data.videoId },
          data: { status: 'POLLING' },
        });

        // Step 2: Poll the operation status until the video is ready (Veo3 pattern)
        let operation = { name: generationResult.operationName, done: false };
        let pollCount = 0;
        const maxPolls = 60; // 10 minutes max
        
        logger.info('Development: Starting Veo3 polling...', { operationName: generationResult.operationName });
        
        while (!operation.done && pollCount < maxPolls) {
          logger.info('Development: Waiting for video generation to complete...', { pollCount, operationName: generationResult.operationName });
          
          // Wait 10 seconds between polls (as per Veo3 documentation)
          await new Promise((resolve) => setTimeout(resolve, 10000));
          
          // Get updated operation status
          const pollResult = await AIGenerationService.pollGenerationStatus(generationResult.operationName);
          operation.done = pollResult.status === 'completed' || pollResult.status === 'failed';
          
          // Update progress
          const progress = 20 + (pollCount / maxPolls) * 60; // 20% to 80%
          await db.generationJob.update({
            where: { id: data.jobId },
            data: { progress: Math.round(progress) },
          });
          
          if (pollResult.status === 'completed' && pollResult.videoUrl) {
            // Step 3: Download the video
            logger.info('Development: Video generation completed, downloading...', { 
              videoFile: typeof pollResult.videoUrl === 'string' ? pollResult.videoUrl : '[File Reference]'
            });
            
            await db.generationJob.update({
              where: { id: data.jobId },
              data: { status: 'DOWNLOADING', progress: 85 },
            });
            
            // Download and store video locally using the file reference (not URL)
            const storedVideoUrl = await AIGenerationService.downloadAndStoreVideo(data.videoId, pollResult.videoUrl);
            
            // Step 4: Process video (generate thumbnails, etc.)
            /*await db.generationJob.update({
              where: { id: data.jobId },
              data: { status: 'TRANSCODING', progress: 90 },
            });
            
            const processedVideo = await AIGenerationService.processVideo({
              id: data.videoId,
              url: storedVideoUrl,
              duration: 8, // Veo3 generates 8-second videos
              status: 'completed',
              metadata: {
                prompt: data.prompt,
                stylePreset: data.stylePreset,
                resolution: data.resolution === '720p' ? '1280x720' : '1920x1080',
                aspectRatio: data.aspectRatio,
                model: data.model,
                negativePrompt: data.negativePrompt,
              },
            }, {
              captions: data.captions,
              watermark: data.watermark,
            });*/
            
            // Step 5: Complete the job
            await db.video.update({
              where: { id: data.videoId },
              data: {
                status: 'READY',
                urls: JSON.stringify({
                  mp4: storedVideoUrl
                }),
                metadata: JSON.stringify({}),
              },
            });
            
            await db.generationJob.update({
              where: { id: data.jobId },
              data: {
                status: 'READY',
                progress: 100,
                completedAt: new Date(),
              },
            });
            
            logger.info('Development: Veo3 video generation completed successfully!', { 
              jobId: data.jobId,
              videoId: data.videoId,
              videoUrl: storedVideoUrl 
            });
            
            return;
          } else if (pollResult.status === 'failed') {
            throw new Error(pollResult.error || 'Veo3 generation failed');
          }
          
          pollCount++;
        }
        
        if (pollCount >= maxPolls) {
          throw new Error('Veo3 generation timed out after 10 minutes');
        }
        
        return;
      }

      // Fallback to mock for testing
      const mockVideoData = {
        urls: {
          mp4: `/api/files/videos/${data.videoId}/video.mp4`,
          thumbnail: `/api/files/videos/${data.videoId}/thumbnail.jpg`,
        },
        metadata: {
          duration: data.durationSec,
          resolution: data.resolution === '720p' ? '1280x720' : '1920x1080',
          fileSize: 5000000,
        },
      };

      // Update video with generated data
      await db.video.update({
        where: { id: data.videoId },
        data: {
          status: 'READY',
          urls: JSON.stringify(mockVideoData.urls),
          metadata: JSON.stringify(mockVideoData.metadata),
        },
      });

      // Complete the job
      await db.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: 'READY',
          progress: 100,
          completedAt: new Date(),
        },
      });

      logger.info('Mock: Generation job completed', { 
        jobId: data.jobId,
        videoId: data.videoId 
      });

    } catch (error) {
      logger.error('Mock job processing failed', { error, jobId: data.jobId });
      
      // Mark job as failed
      await db.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      await db.video.update({
        where: { id: data.videoId },
        data: { status: 'FAILED' },
      });
    }
  }

  static async addPollingJob(data: PollingJobData): Promise<Bull.Job> {
    try {
      // In development, skip Redis and return a mock job
      if (isDevelopment || !generationQueue) {
        logger.info('Mock: Polling job added to queue', { jobId: data.jobId });
        
        // Simulate polling in the background
        setTimeout(async () => {
          try {
            await this.processMockPollingJob(data);
          } catch (error) {
            logger.error('Mock polling job processing failed', { error, jobId: data.jobId });
          }
        }, 2000); // Start polling after 2 seconds
        
        return {
          id: data.jobId + '-polling',
          data,
          opts: {},
          progress: 0,
        } as any;
      }
      
      const job = await pollingQueue.add('poll-generation', data, {
        attempts: 50, // Veo3 can take several minutes
        backoff: {
          type: 'fixed',
          delay: 10000, // Poll every 10 seconds
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      logger.info('Polling job added to queue', { 
        jobId: data.jobId,
        operationName: data.operationName,
        queueJobId: job.id 
      });

      return job;
    } catch (error) {
      logger.error('Failed to add polling job to queue', { error, data });
      throw error;
    }
  }

  private static async processMockPollingJob(data: PollingJobData): Promise<void> {
    try {
      logger.info('Mock: Processing polling job', { jobId: data.jobId });

      // Simulate polling with progress updates
      const pollIntervals = [30, 50, 70, 90];
      
      for (const progress of pollIntervals) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await db.generationJob.update({
          where: { id: data.jobId },
          data: { progress },
        });
      }

      // Simulate completion - create a mock video URL
      const mockVideoUrl = `https://mock-veo3.googleapis.com/video/${data.operationId}.mp4`;
      
      // Add download job
      await this.addDownloadJob({
        jobId: data.jobId,
        videoId: data.videoId,
        videoUrl: mockVideoUrl,
        orgId: data.orgId,
      });

    } catch (error) {
      logger.error('Mock polling job processing failed', { error, jobId: data.jobId });
      
      await db.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Polling failed',
          completedAt: new Date(),
        },
      });

      await db.video.update({
        where: { id: data.videoId },
        data: { status: 'FAILED' },
      });
    }
  }

  static async addDownloadJob(data: DownloadJobData): Promise<Bull.Job> {
    try {
      // In development, skip Redis and return a mock job
      if (isDevelopment || !generationQueue) {
        logger.info('Mock: Download job added to queue', { jobId: data.jobId });
        
        // Simulate download in the background
        setTimeout(async () => {
          try {
            await this.processMockDownloadJob(data);
          } catch (error) {
            logger.error('Mock download job processing failed', { error, jobId: data.jobId });
          }
        }, 1000);
        
        return {
          id: data.jobId + '-download',
          data,
          opts: {},
          progress: 0,
        } as any;
      }
      
      const job = await downloadQueue.add('download-video', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 15000, // 15 seconds
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      logger.info('Download job added to queue', { 
        jobId: data.jobId,
        videoUrl: data.videoUrl,
        queueJobId: job.id 
      });

      return job;
    } catch (error) {
      logger.error('Failed to add download job to queue', { error, data });
      throw error;
    }
  }

  private static async processMockDownloadJob(data: DownloadJobData): Promise<void> {
    try {
      logger.info('Mock: Processing download job', { jobId: data.jobId });

      // Update status to downloading
      await db.generationJob.update({
        where: { id: data.jobId },
        data: { status: 'DOWNLOADING', progress: 95 },
      });

      await db.video.update({
        where: { id: data.videoId },
        data: { status: 'DOWNLOADING' },
      });

      // Simulate download and storage
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful storage - create final URLs
      const finalUrls = {
        mp4: `/api/files/videos/${data.videoId}/video.mp4`,
        thumbnail: `/api/files/videos/${data.videoId}/thumbnail.jpg`,
        hls: `/api/files/videos/${data.videoId}/playlist.m3u8`,
      };

      const metadata = {
        duration: 8, // Veo3 generates 8-second videos
        resolution: '1280x720',
        fileSize: 12000000, // ~12MB
        source: 'veo3',
      };

      // Update video with final data
      await db.video.update({
        where: { id: data.videoId },
        data: {
          status: 'TRANSCODING',
          urls: JSON.stringify(finalUrls),
          metadata: JSON.stringify(metadata),
        },
      });

      // Complete the job
      await db.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: 'READY',
          progress: 100,
          completedAt: new Date(),
        },
      });

      // Add scoring job
      await this.addScoringJob({
        videoId: data.videoId,
        orgId: data.orgId,
      });

      logger.info('Mock: Download job completed', { 
        jobId: data.jobId,
        videoId: data.videoId 
      });

    } catch (error) {
      logger.error('Mock download job processing failed', { error, jobId: data.jobId });
      
      await db.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Download failed',
          completedAt: new Date(),
        },
      });

      await db.video.update({
        where: { id: data.videoId },
        data: { status: 'FAILED' },
      });
    }
  }

  static async addScoringJob(data: ScoringJobData): Promise<Bull.Job> {
    try {
      // In development, skip Redis and process scoring directly
      if (isDevelopment || !scoringQueue) {
        logger.info('Development: Processing scoring job directly', { videoId: data.videoId });
        
        // Process scoring immediately in development
        setTimeout(async () => {
          try {
            await this.processScoring(data);
          } catch (error) {
            logger.error('Development scoring processing failed', { error, videoId: data.videoId });
          }
        }, 1000); // Process after 1 second
        
        // Return a mock job object
        return {
          id: `scoring-${data.videoId}`,
          data,
          opts: {},
          progress: 0,
        } as any;
      }

      const job = await scoringQueue.add('score-video', data, {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000, // 10 seconds
        },
        removeOnComplete: 20,
        removeOnFail: 10,
      });

      logger.info('Scoring job added to queue', { 
        videoId: data.videoId,
        queueJobId: job.id 
      });

      return job;
    } catch (error) {
      logger.error('Failed to add scoring job to queue', { error, data });
      throw error;
    }
  }

  private static async processScoring(data: ScoringJobData): Promise<void> {
    try {
      logger.info('Development: Processing video scoring', { videoId: data.videoId });

      // Use the existing video scoring logic
      const video = await db.video.findUnique({
        where: { id: data.videoId, orgId: data.orgId },
      });

      if (!video || !video.urls) {
        throw new Error('Video not found or has no URLs');
      }

      // Parse URLs from JSON string
      const urls = typeof video.urls === 'string' ? JSON.parse(video.urls) : video.urls;
      
      if (!urls.mp4) {
        throw new Error('Video has no MP4 URL');
      }

      // Score the video using VideoScoringService
      const VideoScoringService = require('./scoring-service');
      const score = await VideoScoringService.scoreVideo(urls.mp4);

      // Update video with new score
      await db.video.update({
        where: { id: data.videoId },
        data: {
          status: 'READY',
          score: JSON.stringify(score),
        },
      });

      logger.info('Development: Video scoring completed', { videoId: data.videoId, score });
    } catch (error) {
      logger.error('Development scoring failed', { error, videoId: data.videoId });
      
      // Set video back to ready status even if scoring fails
      await db.video.update({
        where: { id: data.videoId },
        data: { status: 'READY' },
      });
    }
  }

  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Find and cancel active jobs
      const activeJobs = await generationQueue.getActive();
      const waitingJobs = await generationQueue.getWaiting();
      
      const allJobs = [...activeJobs, ...waitingJobs];
      const jobToCancel = allJobs.find(job => job.data.jobId === jobId);

      if (jobToCancel) {
        await jobToCancel.remove();
        logger.info('Job cancelled from queue', { jobId, queueJobId: jobToCancel.id });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to cancel job', { error, jobId });
      return false;
    }
  }

  static async getQueueStats() {
    try {
      const [genWaiting, genActive, genCompleted, genFailed] = await Promise.all([
        generationQueue.getWaiting(),
        generationQueue.getActive(),
        generationQueue.getCompleted(),
        generationQueue.getFailed(),
      ]);

      const [pollWaiting, pollActive, pollCompleted, pollFailed] = await Promise.all([
        pollingQueue.getWaiting(),
        pollingQueue.getActive(),
        pollingQueue.getCompleted(),
        pollingQueue.getFailed(),
      ]);

      const [downloadWaiting, downloadActive, downloadCompleted, downloadFailed] = await Promise.all([
        downloadQueue.getWaiting(),
        downloadQueue.getActive(),
        downloadQueue.getCompleted(),
        downloadQueue.getFailed(),
      ]);

      const [scoreWaiting, scoreActive, scoreCompleted, scoreFailed] = await Promise.all([
        scoringQueue.getWaiting(),
        scoringQueue.getActive(),
        scoringQueue.getCompleted(),
        scoringQueue.getFailed(),
      ]);

      return {
        generation: {
          waiting: genWaiting.length,
          active: genActive.length,
          completed: genCompleted.length,
          failed: genFailed.length,
        },
        polling: {
          waiting: pollWaiting.length,
          active: pollActive.length,
          completed: pollCompleted.length,
          failed: pollFailed.length,
        },
        download: {
          waiting: downloadWaiting.length,
          active: downloadActive.length,
          completed: downloadCompleted.length,
          failed: downloadFailed.length,
        },
        scoring: {
          waiting: scoreWaiting.length,
          active: scoreActive.length,
          completed: scoreCompleted.length,
          failed: scoreFailed.length,
        },
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      throw error;
    }
  }
}

// Generation Queue Processing - only setup if queues exist
if (generationQueue) {
  generationQueue.process('generate-video', 5, async (job: Bull.Job) => {
  const { jobId, videoId, prompt, stylePreset, durationSec, captions, watermark, orgId } = job.data;
  
  logger.info('Processing generation job', { jobId, videoId });

  try {
    // Update job status to running
    await updateJobStatus(jobId, videoId, 'RUNNING', 0);
    
    // Step 1: Initialize Veo3 generation
    job.progress(10);
    await updateJobStatus(jobId, videoId, 'RUNNING', 10, 'Initializing Veo3 generation...');
    
    const generationResult = await AIGenerationService.generateVideo({
      prompt,
      stylePreset,
      durationSec,
      aspectRatio: job.data.aspectRatio || '16:9',
      negativePrompt: job.data.negativePrompt,
      resolution: job.data.resolution || '720p',
      model: job.data.model || 'fast',
      image: job.data.image,
    });

    if (!generationResult.operationName) {
      throw new Error('Failed to start Veo3 generation');
    }

    // Update job with Veo3 operation details
    job.progress(20);
    await updateJobStatus(jobId, videoId, 'POLLING', 20, 'Veo3 generation started, polling for completion...');
    
    await db.generationJob.update({
      where: { id: jobId },
      data: {
        operationName: generationResult.operationName,
        operationId: generationResult.operationId,
      },
    });

    // Step 2: Poll until completion
    let pollAttempts = 0;
    const maxPolls = 60; // 10 minutes max at 10-second intervals
    let veo3Result;

    while (pollAttempts < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      pollAttempts++;
      
      const progress = 20 + (pollAttempts / maxPolls) * 60; // 20% to 80%
      job.progress(progress);
      await updateJobStatus(jobId, videoId, 'POLLING', progress, `Polling Veo3 (attempt ${pollAttempts}/${maxPolls})...`);

      veo3Result = await AIGenerationService.pollGenerationStatus(generationResult.operationName);
      
      if (veo3Result.status === 'completed' && veo3Result.videoUrl) {
        logger.debug('Veo3 generation completed', { 
          operationName: generationResult.operationName,
          videoFileType: typeof veo3Result.videoUrl
        });
        break;
      } else if (veo3Result.status === 'failed') {
        throw new Error(veo3Result.error || 'Veo3 generation failed');
      }
    }

    if (!veo3Result?.videoUrl) {
      throw new Error('Veo3 generation timed out or failed');
    }

    // Step 3: Download and store video
    job.progress(85);
    await updateJobStatus(jobId, videoId, 'DOWNLOADING', 85, 'Downloading video from Veo3...');
    
    const storedVideoUrl = await AIGenerationService.downloadAndStoreVideo(videoId, veo3Result.videoUrl);

    // Step 4: Process and generate additional assets
    job.progress(90);
    await updateJobStatus(jobId, videoId, 'TRANSCODING', 90, 'Processing video assets...');

    const processedVideo = await AIGenerationService.processVideo({
      id: videoId,
      url: storedVideoUrl,
      duration: 8, // Veo3 generates 8-second videos
      status: 'completed',
      metadata: {
        prompt,
        stylePreset,
        resolution: job.data.resolution === '720p' ? '1280x720' : '1920x1080',
        aspectRatio: job.data.aspectRatio,
        model: job.data.model,
        negativePrompt: job.data.negativePrompt,
      },
    }, {
      captions,
      watermark,
    });

    // Step 5: Score the video
    job.progress(95);
    await updateJobStatus(jobId, videoId, 'SCORING', 95, 'Analyzing video quality...');

    const score = await VideoScoringService.scoreVideo(processedVideo.urls.mp4);

    job.progress(100);

    // Update video record with final results
    await db.$transaction(async (tx) => {
      await tx.video.update({
        where: { id: videoId },
        data: {
          status: 'READY',
          urls: JSON.stringify(processedVideo.urls),
          metadata: JSON.stringify(processedVideo.metadata),
          score: JSON.stringify(score),
        },
      });

      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'READY',
          progress: 100,
          completedAt: new Date(),
        },
      });
    });

    logger.info('Generation job completed successfully', { jobId, videoId });
    return { success: true, videoId, urls: processedVideo.urls };

  } catch (error) {
    logger.error('Generation job failed', { error, jobId, videoId });

    // Update job status to failed
    await db.$transaction(async (tx) => {
      await tx.video.update({
        where: { id: videoId },
        data: { status: 'FAILED' },
      });

      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });
    });

    throw error;
  }
});
}

// Polling Queue Processing
if (pollingQueue) {
  pollingQueue.process('poll-generation', 3, async (job: Bull.Job) => {
  const { jobId, videoId, operationName, operationId, orgId } = job.data;
  
  logger.info('Processing polling job', { jobId, operationName });

  try {
    let pollAttempts = 0;
    const maxPolls = 60; // 10 minutes max
    
    while (pollAttempts < maxPolls) {
      pollAttempts++;
      
      const result = await AIGenerationService.pollGenerationStatus(operationName);
      const progress = 20 + (pollAttempts / maxPolls) * 60; // 20% to 80%
      
      job.progress(progress);
      await updateJobStatus(jobId, videoId, 'POLLING', progress, `Polling Veo3 (${pollAttempts}/${maxPolls})...`);
      
      if (result.status === 'completed' && result.videoUrl) {
        // Generation complete, start download
        await downloadQueue.add('download-video', {
          jobId,
          videoId,
          videoUrl: result.videoUrl,
          orgId,
        });
        
        logger.info('Polling job completed, download queued', { jobId, videoUrl: result.videoUrl });
        return { success: true, videoUrl: result.videoUrl };
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Veo3 generation failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    throw new Error('Veo3 generation timed out');

  } catch (error) {
    logger.error('Polling job failed', { error, jobId, operationName });

    await db.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      await tx.video.update({
        where: { id: videoId },
        data: { status: 'FAILED' },
      });
    });

    throw error;
  }
});
}

// Download Queue Processing
if (downloadQueue) {
  downloadQueue.process('download-video', 3, async (job: Bull.Job) => {
  const { jobId, videoId, videoUrl, orgId } = job.data;
  
  logger.info('Processing download job', { jobId, videoUrl });

  try {
    // Update status to downloading
    job.progress(85);
    await updateJobStatus(jobId, videoId, 'DOWNLOADING', 85, 'Downloading video from Veo3...');
    
    // Download and store video
    const storedVideoUrl = await AIGenerationService.downloadAndStoreVideo(videoId, videoUrl);
    
    // Process and generate additional assets
    job.progress(90);
    await updateJobStatus(jobId, videoId, 'TRANSCODING', 90, 'Processing video assets...');

    const processedVideo = await AIGenerationService.processVideo({
      id: videoId,
      url: storedVideoUrl,
      duration: 8, // Veo3 generates 8-second videos
      status: 'completed',
      metadata: {
        prompt: 'Veo3 generated video',
        resolution: '1280x720',
      },
    }, {
      captions: false, // TODO: Get from job data
      watermark: false, // TODO: Get from job data
    });

    // Update video with processed data
    job.progress(95);
    await updateJobStatus(jobId, videoId, 'SCORING', 95, 'Preparing for scoring...');

    await db.$transaction(async (tx) => {
      await tx.video.update({
        where: { id: videoId },
        data: {
          status: 'TRANSCODING',
          urls: JSON.stringify(processedVideo.urls),
          metadata: JSON.stringify(processedVideo.metadata),
        },
      });

      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          progress: 95,
        },
      });
    });

    // Add scoring job
    await scoringQueue.add('score-video', {
      videoId,
      orgId,
    });

    logger.info('Download job completed, scoring queued', { jobId, videoId });
    return { success: true, videoId, urls: processedVideo.urls };

  } catch (error) {
    logger.error('Download job failed', { error, jobId, videoUrl });

    await db.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      await tx.video.update({
        where: { id: videoId },
        data: { status: 'FAILED' },
      });
    });

    throw error;
  }
});
}

// Scoring Queue Processing
if (scoringQueue) {
  scoringQueue.process('score-video', 3, async (job: Bull.Job) => {
  const { videoId, orgId } = job.data;
  
  logger.info('Processing scoring job', { videoId });

  try {
    const video = await db.video.findUnique({
      where: { id: videoId, orgId },
    });

    if (!video || !video.urls) {
      throw new Error('Video not found or has no URLs');
    }

    // Parse URLs from JSON string
    const urls = typeof video.urls === 'string' ? JSON.parse(video.urls) : video.urls;
    
    if (!urls.mp4) {
      throw new Error('Video has no MP4 URL');
    }

    // Score the video
    const score = await VideoScoringService.scoreVideo(urls.mp4);

    // Update video with new score
    await db.video.update({
      where: { id: videoId },
      data: {
        status: 'READY',
        score: JSON.stringify(score),
      },
    });

    logger.info('Video scoring completed', { videoId, score });
    return { success: true, videoId, score };

  } catch (error) {
    logger.error('Scoring job failed', { error, videoId });

    // Set video back to ready status
    await db.video.update({
      where: { id: videoId },
      data: { status: 'READY' },
    });

    throw error;
  }
});
}

// Helper function to update job status
async function updateJobStatus(
  jobId: string, 
  videoId: string, 
  status: string, 
  progress: number, 
  message?: string
) {
  try {
    await db.$transaction(async (tx) => {
      await tx.generationJob.update({
        where: { id: jobId },
        data: { 
          status: status as any,
          progress 
        },
      });

      await tx.video.update({
        where: { id: videoId },
        data: { status: status as any },
      });
    });

    // Emit SSE event for real-time updates
    // TODO: Implement SSE broadcasting
    logger.debug('Job status updated', { jobId, videoId, status, progress, message });
  } catch (error) {
    logger.error('Failed to update job status', { error, jobId, videoId });
  }
}

// Queue event handlers
if (generationQueue) {
  generationQueue.on('completed', (job, result) => {
  logger.info('Generation job completed', { 
    queueJobId: job.id,
    jobId: job.data.jobId,
    result 
  });
});

  generationQueue.on('failed', (job, err) => {
    logger.error('Generation job failed', { 
      queueJobId: job.id,
      jobId: job.data?.jobId,
      error: err.message 
    });
  });

  generationQueue.on('stalled', (job) => {
    logger.warn('Generation job stalled', { 
      queueJobId: job.id,
      jobId: job.data?.jobId 
    });
  });
}

if (scoringQueue) {
  scoringQueue.on('completed', (job, result) => {
  logger.info('Scoring job completed', { 
    queueJobId: job.id,
    videoId: job.data.videoId,
    result 
  });
});

  scoringQueue.on('failed', (job, err) => {
    logger.error('Scoring job failed', { 
      queueJobId: job.id,
      videoId: job.data?.videoId,
      error: err.message 
    });
  });
}

// Add event handlers for new queues
if (pollingQueue) {
  pollingQueue.on('completed', (job, result) => {
  logger.info('Polling job completed', { 
    queueJobId: job.id,
    jobId: job.data.jobId,
    result 
  });
});

  pollingQueue.on('failed', (job, err) => {
    logger.error('Polling job failed', { 
      queueJobId: job.id,
      jobId: job.data?.jobId,
      error: err.message 
    });
  });
}

if (downloadQueue) {
  downloadQueue.on('completed', (job, result) => {
  logger.info('Download job completed', { 
    queueJobId: job.id,
    jobId: job.data.jobId,
    result 
  });
});

  downloadQueue.on('failed', (job, err) => {
    logger.error('Download job failed', { 
      queueJobId: job.id,
      jobId: job.data?.jobId,
      error: err.message 
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down queues...');
  if (generationQueue) await generationQueue.close();
  if (pollingQueue) await pollingQueue.close();
  if (downloadQueue) await downloadQueue.close();
  if (scoringQueue) await scoringQueue.close();
});

export { generationQueue, pollingQueue, downloadQueue, scoringQueue };