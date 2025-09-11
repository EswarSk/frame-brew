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

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }

    this.ai = new GoogleGenAI({});
    this.maxRetries = Number(process.env.VEO3_MAX_RETRIES) || 3;
    this.pollInterval = Number(process.env.VEO3_POLL_INTERVAL) || 10000;
    this.stableModel = process.env.VEO3_MODEL_STABLE || 'veo-3.0-generate-001';
    this.fastModel = process.env.VEO3_MODEL_FAST || 'veo-3.0-fast-generate-001';
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

      // Prepare the generation config
      const config: any = {};

      if (request.aspectRatio) {
        config.aspectRatio = request.aspectRatio;
      }

      if (request.negativePrompt) {
        config.negativePrompt = request.negativePrompt;
      }

      if (request.resolution) {
        config.resolution = request.resolution;
      }

      if (request.image) {
        config.image = request.image;
      }

      // Start the generation using the correct API
      const operation = await this.ai.models.generateVideos({
        model,
        prompt: request.prompt,
        config
      });
      
      if (!operation || !operation.name) {
        throw new Error('No operation returned from Veo3 API');
      }

      logger.info('Veo3 generation started successfully', {
        operationName: operation.name,
        operationId: this.extractOperationId(operation.name)
      });

      return {
        operationName: operation.name,
        operationId: this.extractOperationId(operation.name),
        status: 'PENDING',
        progress: 0
      };

    } catch (error) {
      logger.error('Veo3 generation failed', { error: error.message });
      throw new Error(`Veo3 generation failed: ${error.message}`);
    }
  }

  /**
   * Poll the status of a generation operation
   */
  async pollGenerationStatus(operationName: string): Promise<Veo3GenerationResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.stableModel, // Use stable model for polling
      });

      const operation = await model.getOperation(operationName);

      if (!operation) {
        throw new Error('Operation not found');
      }

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
            error: operation.error.message || 'Generation failed'
          };
        }

        if (operation.response && operation.response.video) {
          logger.info('Veo3 generation completed successfully', { operationName });
          
          return {
            operationName,
            operationId: this.extractOperationId(operationName),
            status: 'COMPLETED',
            progress: 100,
            videoUrl: operation.response.video.uri
          };
        }
      }

      // Operation is still running
      const progress = this.calculateProgress(operation);
      
      logger.debug('Veo3 generation in progress', { 
        operationName,
        progress 
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
        error: error.message 
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
   * Download video from Veo3 URL
   */
  async downloadVideo(videoUrl: string): Promise<Buffer> {
    try {
      logger.info('Downloading video from Veo3', { videoUrl });
      
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      logger.info('Video downloaded successfully', { 
        size: buffer.byteLength,
        sizeKB: Math.round(buffer.byteLength / 1024)
      });
      
      return Buffer.from(buffer);
      
    } catch (error) {
      logger.error('Failed to download video', { 
        videoUrl,
        error: error.message 
      });
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
    // This is a rough estimation - Veo3 doesn't provide exact progress
    // We can improve this based on actual API response structure
    if (operation.metadata && operation.metadata.progressPercent) {
      return operation.metadata.progressPercent;
    }
    
    // Default progress estimation based on time
    const startTime = operation.metadata?.createTime;
    if (startTime) {
      const elapsed = Date.now() - new Date(startTime).getTime();
      const estimatedTotal = 180000; // 3 minutes average
      return Math.min(90, Math.round((elapsed / estimatedTotal) * 100));
    }
    
    return 50; // Default progress if no metadata available
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate generation request parameters
   */
  validateRequest(request: Veo3GenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required and cannot be empty');
    }

    if (request.prompt.length > 2000) {
      throw new Error('Prompt is too long (max 2000 characters)');
    }

    if (request.negativePrompt && request.negativePrompt.length > 1000) {
      throw new Error('Negative prompt is too long (max 1000 characters)');
    }

    if (request.aspectRatio && !['16:9', '9:16'].includes(request.aspectRatio)) {
      throw new Error('Invalid aspect ratio. Must be 16:9 or 9:16');
    }

    if (request.resolution && !['720p', '1080p'].includes(request.resolution)) {
      throw new Error('Invalid resolution. Must be 720p or 1080p');
    }

    if (request.model && !['stable', 'fast'].includes(request.model)) {
      throw new Error('Invalid model. Must be stable or fast');
    }
  }
}

// Export singleton instance
export const veo3Client = new Veo3Client();