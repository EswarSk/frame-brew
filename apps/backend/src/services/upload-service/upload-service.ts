import { GCSService } from './gcs-service';
import { logger } from '../../shared/utils/logger';

// Re-export types for backward compatibility
interface UploadVideoParams {
  file: Buffer;
  fileName: string;
  originalName: string;
  mimeType: string;
  orgId: string;
}

interface UploadResult {
  url: string;
  key: string;
  uploadId: string;
}

interface PresignedUrlParams {
  fileName: string;
  fileSize: number;
  mimeType: string;
  orgId: string;
}

interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  uploadId: string;
  expiresIn: number;
}

/**
 * UploadService - Now powered by Google Cloud Storage
 *
 * This service maintains backward compatibility with the original cloud storage interface
 * while using Google Cloud Storage as the backend storage provider.
 */
export class UploadService {
  /**
   * Upload video file directly to storage
   */
  static async uploadVideo(params: UploadVideoParams): Promise<UploadResult> {
    logger.debug('UploadService.uploadVideo called (using GCS backend)', {
      fileName: params.fileName,
      originalName: params.originalName,
      mimeType: params.mimeType,
      orgId: params.orgId,
      fileSize: params.file.length,
    });

    return await GCSService.uploadVideo(params);
  }

  /**
   * Generate presigned URL for direct browser uploads
   */
  static async generatePresignedUrl(params: PresignedUrlParams): Promise<PresignedUrlResult> {
    logger.debug('UploadService.generatePresignedUrl called (using GCS backend)', {
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      orgId: params.orgId,
    });

    return await GCSService.generateSignedUrl(params);
  }

  /**
   * Upload file to specific storage path (for processed outputs)
   */
  static async uploadProcessedFile(
    file: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    logger.debug('UploadService.uploadProcessedFile called (using GCS backend)', {
      key,
      mimeType,
      fileSize: file.length,
      metadata,
    });

    return await GCSService.uploadProcessedFile(file, key, mimeType, metadata);
  }

  /**
   * Copy file within storage bucket (useful for creating variants)
   */
  static async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    logger.debug('UploadService.copyFile called (using GCS backend)', {
      sourceKey,
      destinationKey,
    });

    return await GCSService.copyFile(sourceKey, destinationKey);
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(key: string): Promise<void> {
    logger.debug('UploadService.deleteFile called (using GCS backend)', { key });

    return await GCSService.deleteFile(key);
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<any> {
    logger.debug('UploadService.getFileMetadata called (using GCS backend)', { key });

    return await GCSService.getFileMetadata(key);
  }

  /**
   * Generate download URL for private files
   */
  static generateDownloadUrl(key: string, expiresIn: number = 3600): string {
    logger.debug('UploadService.generateDownloadUrl called (using GCS backend)', {
      key,
      expiresIn,
    });

    return GCSService.generateDownloadUrl(key, expiresIn);
  }

  /**
   * List files in a prefix/directory
   */
  static async listFiles(prefix: string, maxKeys: number = 100): Promise<any[]> {
    logger.debug('UploadService.listFiles called (using GCS backend)', {
      prefix,
      maxKeys,
    });

    return await GCSService.listFiles(prefix, maxKeys);
  }

  /**
   * Check if storage service is available
   */
  static async checkAvailability(): Promise<boolean> {
    logger.debug('UploadService.checkAvailability called (using GCS backend)');

    return await GCSService.checkAvailability();
  }

  /**
   * Get storage usage for organization
   */
  static async getStorageUsage(orgId: string): Promise<{
    totalSize: number;
    fileCount: number;
    files: Array<{ key: string; size: number; lastModified: Date }>;
  }> {
    logger.debug('UploadService.getStorageUsage called (using GCS backend)', { orgId });

    return await GCSService.getStorageUsage(orgId);
  }

  /**
   * Cleanup old uploads (for maintenance)
   */
  static async cleanupOldUploads(daysOld: number = 30): Promise<number> {
    logger.debug('UploadService.cleanupOldUploads called (using GCS backend)', { daysOld });

    return await GCSService.cleanupOldUploads(daysOld);
  }

  /**
   * Initialize storage bucket (GCS-specific helper)
   */
  static async initializeBucket(): Promise<boolean> {
    logger.info('Initializing GCS bucket');

    return await GCSService.createBucketIfNotExists();
  }
}

// Legacy exports for backward compatibility
export { UploadVideoParams, UploadResult, PresignedUrlParams, PresignedUrlResult };