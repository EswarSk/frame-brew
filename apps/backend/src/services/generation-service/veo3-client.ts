import { GoogleGenAI } from "@google/genai";
import { logger } from "../../shared/utils/logger";

export interface Veo3GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  model?: 'stable' | 'fast';
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

export interface Veo3GenerationResponse {
  operationName: string;
  operationId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

export class Veo3Client {
  private ai: GoogleGenAI;
  private maxRetries: number;
  private pollInterval: number;
  private stableModel: string;
  private fastModel: string;
  private storedOperations: Map<string, any>;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.maxRetries = Number(process.env.VEO3_MAX_RETRIES) || 3;
    this.pollInterval = Number(process.env.VEO3_POLL_INTERVAL) || 10000;
    this.stableModel = process.env.VEO3_MODEL_STABLE || 'veo-3.0-generate-001';
    this.fastModel = process.env.VEO3_MODEL_FAST || 'veo-3.0-fast-generate-001';
    this.storedOperations = new Map();
  }

  /**
   * Generate a video using Veo3 API
   */
  async generateVideo(request: Veo3GenerationRequest): Promise<Veo3GenerationResponse> {
    try {
      logger.info('Starting Veo3 video generation', { 
        prompt: request.prompt.substring(0, 100),
        model: request.model,
        aspectRatio: request.aspectRatio,
        resolution: request.resolution
      });

      const model = request.model === 'fast' ? this.fastModel : this.stableModel;

      // Prepare the generation request according to official API
      const generationRequest: any = {
        model,
        prompt: request.prompt
      };

      // Add optional parameters
      if (request.aspectRatio) {
        generationRequest.aspectRatio = request.aspectRatio;
      }

      if (request.negativePrompt) {
        generationRequest.negativePrompt = request.negativePrompt;
      }

      if (request.resolution) {
        generationRequest.resolution = request.resolution;
      }

      if (request.image) {
        generationRequest.image = request.image;
      }

      logger.debug('Veo3 generation request prepared', { generationRequest });

      // Start the generation using the official API pattern
      const operation = await this.ai.models.generateVideos(generationRequest);
      
      if (!operation || !operation.name) {
        throw new Error('No operation returned from Veo3 API');
      }

      logger.info('Veo3 generation started successfully', {
        operationName: operation.name,
        operationId: this.extractOperationId(operation.name)
      });

      // Store the full operation object for later use
      this.storedOperations = this.storedOperations || new Map();
      this.storedOperations.set(operation.name, operation);

      return {
        operationName: operation.name,
        operationId: this.extractOperationId(operation.name),
        status: 'PENDING',
        progress: 0
      };

    } catch (error) {
      logger.error('Veo3 generation failed', { 
        error: error.message,
        stack: error.stack,
        request: {
          model: request.model,
          promptLength: request.prompt?.length,
          aspectRatio: request.aspectRatio
        }
      });
      throw new Error(`Veo3 generation failed: ${error.message}`);
    }
  }

  /**
   * Poll the status of a generation operation using official pattern
   */
  async pollGenerationStatus(operationName: string): Promise<Veo3GenerationResponse> {
    try {
      logger.debug('Polling Veo3 operation status', { operationName });

      // Get the stored operation or create a new reference
      let operation = this.storedOperations.get(operationName);
      if (!operation) {
        operation = { name: operationName };
      }

      // Poll the operation status using the official pattern
      operation = await this.ai.operations.getVideosOperation({ operation });

      if (!operation) {
        throw new Error('Operation not found');
      }

      // Update stored operation
      this.storedOperations.set(operationName, operation);

      logger.debug('Operation status polled', { 
        operationName, 
        done: operation.done,
        hasError: !!operation.error,
        hasResponse: !!operation.response
      });

      // Check if operation is complete
      if (operation.done) {
        if (operation.error) {
          logger.error('Veo3 generation failed', { 
            operationName,
            error: operation.error 
          });
          
          return {
            operationName,
            operationId: this.extractOperationId(operationName),
            status: 'FAILED',
            error: (operation.error as any)?.message || 'Generation failed'
          };
        }

        // Check for generated videos in the response
        if (operation.response && operation.response.generatedVideos && operation.response.generatedVideos.length > 0) {
          const generatedVideo = operation.response.generatedVideos[0];
          logger.info('Veo3 generation completed successfully', { 
            operationName,
            generatedVideoStructure: Object.keys(generatedVideo)
          });
          
          // Store the video file reference for download
          const videoFile = generatedVideo.video;
          
          return {
            operationName,
            operationId: this.extractOperationId(operationName),
            status: 'COMPLETED',
            progress: 100,
            videoUrl: videoFile // This will be a file reference, not a URL
          };
        }
      }

      // Operation is still running
      const progress = this.calculateProgress(operation);
      
      logger.debug('Veo3 generation in progress', { 
        operationName,
        progress,
        metadata: operation.metadata 
      });

      return {
        operationName,
        operationId: this.extractOperationId(operationName),
        status: 'RUNNING',
        progress
      };

    } catch (error) {
      logger.error('Failed to poll Veo3 operation status', { 
        operationName,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to poll operation status: ${error.message}`);
    }
  }

  /**
   * Poll operation until completion with retries
   */
  async waitForCompletion(operationName: string): Promise<Veo3GenerationResponse> {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const result = await this.pollGenerationStatus(operationName);
        
        if (result.status === 'COMPLETED' || result.status === 'FAILED') {
          return result;
        }
        
        // Wait before next poll
        await this.sleep(this.pollInterval);
        
      } catch (error) {
        retries++;
        logger.warn(`Polling retry ${retries}/${this.maxRetries}`, {
          operationName,
          error: error.message
        });
        
        if (retries >= this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await this.sleep(this.pollInterval * Math.pow(2, retries - 1));
      }
    }
    
    throw new Error('Maximum retries exceeded while polling operation');
  }

  /**
   * Download video using Google GenAI Files API (official pattern)
   */
  async downloadVideo(videoFile: any, videoId: string): Promise<Buffer> {
    try {
      logger.info('Downloading video from Veo3 using Files API', { 
        videoId,
        fileType: typeof videoFile,
        fileStructure: videoFile ? Object.keys(videoFile) : null,
        videoFileValue: videoFile
      });
      
      // Check if videoFile is a string URL (fallback)
      if (typeof videoFile === 'string' && videoFile.startsWith('http')) {
        logger.warn('VideoFile is a URL, using fallback fetch method', { videoFile });
        const response = await fetch(videoFile);
        
        if (!response.ok) {
          throw new Error(`Failed to download video via URL: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }
      
      // Use the official Google GenAI Files API pattern (no await!)
      const tempDownloadPath = `/tmp/veo3_${videoId}.mp4`;
      
      logger.debug('Attempting Files API download', { 
        videoFile,
        downloadPath: tempDownloadPath
      });
      
      // Important: Based on official docs, this method doesn't use await
      // and may be synchronous or return immediately
      this.ai.files.download({
        file: videoFile,
        downloadPath: tempDownloadPath
      });
      
      // Wait a short time for file to be written
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if file exists before trying to read it
      const fs = await import('fs').then(m => m.promises);
      
      let fileExists = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Poll for file existence (with exponential backoff)
      while (!fileExists && attempts < maxAttempts) {
        try {
          await fs.access(tempDownloadPath);
          fileExists = true;
        } catch {
          attempts++;
          const waitTime = Math.min(1000 * Math.pow(2, attempts), 5000);
          logger.debug(`File not ready yet, waiting ${waitTime}ms (attempt ${attempts}/${maxAttempts})`, {
            tempDownloadPath
          });
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!fileExists) {
        throw new Error(`Video file was not created after ${maxAttempts} attempts: ${tempDownloadPath}`);
      }
      
      // Read the downloaded file into a buffer
      const buffer = await fs.readFile(tempDownloadPath);
      
      // Clean up temporary file
      try {
        await fs.unlink(tempDownloadPath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file', { 
          tempDownloadPath, 
          error: cleanupError.message 
        });
      }
      
      logger.info('Video downloaded successfully via Files API', { 
        videoId,
        size: buffer.byteLength,
        sizeKB: Math.round(buffer.byteLength / 1024),
        sizeMB: Math.round(buffer.byteLength / (1024 * 1024))
      });
      
     return buffer;
      
    } catch (error) {
      logger.error('Failed to download video via Files API', { 
        videoId,
        videoFile,
        error: error.message,
        stack: error.stack
      });
      
      // If Files API fails and we have a URL, try direct download as fallback
      if (typeof videoFile === 'string' && videoFile.startsWith('http')) {
        logger.info('Attempting fallback URL download', { videoFile });
        try {
          const response = await fetch(videoFile);
          if (!response.ok) {
            throw new Error(`Fallback download failed: ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          return Buffer.from(buffer);
        } catch (fallbackError) {
          logger.error('Fallback download also failed', { 
            error: fallbackError.message 
          });
        }
      }
      
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Extract operation ID from operation name
   */
  private extractOperationId(operationName: string): string {
    // Operation names typically look like: "operations/some-uuid"
    const parts = operationName.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Calculate progress based on operation metadata
   */
  private calculateProgress(operation: any): number {
    try {
      // Check if operation provides explicit progress
      if (operation.metadata && operation.metadata.progressPercent) {
        const progress = Math.min(100, Math.max(0, operation.metadata.progressPercent));
        logger.debug('Using explicit progress from metadata', { progress });
        return progress;
      }
      
      // Estimate progress based on elapsed time
      const startTime = operation.metadata?.createTime;
      if (startTime) {
        const elapsed = Date.now() - new Date(startTime).getTime();
        const estimatedTotal = 300000; // 5 minutes average for Veo3
        const timeBasedProgress = Math.min(90, Math.round((elapsed / estimatedTotal) * 100));
        
        logger.debug('Calculating time-based progress', {
          elapsed: Math.round(elapsed / 1000),
          estimatedTotalSec: estimatedTotal / 1000,
          progress: timeBasedProgress
        });
        
        return timeBasedProgress;
      }
      
      logger.debug('No metadata available for progress calculation, using default');
      return 50; // Default progress if no metadata available
      
    } catch (error) {
      logger.warn('Error calculating progress, using default', { error: error.message });
      return 50;
    }
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    logger.debug(`Waiting ${ms}ms before next operation`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get detailed error information from API responses
   */
  private getDetailedError(error: any): string {
    if (error.response && error.response.data) {
      return `API Error: ${error.response.data.error || error.response.data.message || error.message}`;
    }
    
    if (error.code) {
      return `${error.code}: ${error.message}`;
    }
    
    return error.message || 'Unknown error occurred';
  }

  /**
   * Check if the error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are usually retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Rate limiting errors are retryable
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // Server errors (5xx) are retryable
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    return false;
  }

  /**
   * Clean up stored operations to prevent memory leaks
   */
  cleanupStoredOperations(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleaned = 0;
    for (const [operationName, operation] of this.storedOperations.entries()) {
      const createTime = operation.metadata?.createTime;
      if (createTime) {
        const age = now - new Date(createTime).getTime();
        if (age > maxAge) {
          this.storedOperations.delete(operationName);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old operations from memory`);
    }
  }

  /**
   * Validate generation request parameters
   */
  validateRequest(request: Veo3GenerationRequest): void {
    logger.debug('Validating Veo3 generation request', {
      promptLength: request.prompt?.length,
      hasNegativePrompt: !!request.negativePrompt,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      model: request.model
    });

    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required and cannot be empty');
    }

    if (request.prompt.length > 2000) {
      throw new Error(`Prompt is too long (${request.prompt.length} characters, max 2000)`);
    }

    if (request.negativePrompt && request.negativePrompt.length > 1000) {
      throw new Error(`Negative prompt is too long (${request.negativePrompt.length} characters, max 1000)`);
    }

    if (request.aspectRatio && !['16:9', '9:16'].includes(request.aspectRatio)) {
      throw new Error(`Invalid aspect ratio: ${request.aspectRatio}. Must be 16:9 or 9:16`);
    }

    if (request.resolution && !['720p', '1080p'].includes(request.resolution)) {
      throw new Error(`Invalid resolution: ${request.resolution}. Must be 720p or 1080p`);
    }

    if (request.model && !['stable', 'fast'].includes(request.model)) {
      throw new Error(`Invalid model: ${request.model}. Must be stable or fast`);
    }

    if (request.image) {
      if (!request.image.imageBytes || !request.image.mimeType) {
        throw new Error('Image input requires both imageBytes and mimeType');
      }
      if (!request.image.mimeType.startsWith('image/')) {
        throw new Error(`Invalid image mimeType: ${request.image.mimeType}. Must be an image type`);
      }
    }

    logger.debug('Veo3 request validation passed');
  }
}

// Export singleton instance
export const veo3Client = new Veo3Client();