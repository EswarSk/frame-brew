import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils/logger';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'frame-brew-videos';

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

export class UploadService {
  /**
   * Upload video file directly to S3
   */
  static async uploadVideo(params: UploadVideoParams): Promise<UploadResult> {
    const { file, fileName, originalName, mimeType, orgId } = params;
    const uploadId = uuidv4();
    
    // Generate S3 key with organization structure
    const key = `uploads/${orgId}/${uploadId}/${fileName}`;
    
    logger.info('Starting S3 upload', {
      key,
      fileSize: file.length,
      mimeType,
      originalName,
    });

    try {
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: mimeType,
        Metadata: {
          'original-name': originalName,
          'upload-id': uploadId,
          'org-id': orgId,
          'uploaded-at': new Date().toISOString(),
        },
        // Set appropriate storage class
        StorageClass: 'STANDARD',
        // Enable server-side encryption
        ServerSideEncryption: 'AES256',
      };

      const result = await s3.upload(uploadParams).promise();

      logger.info('S3 upload completed', {
        key,
        location: result.Location,
        uploadId,
      });

      return {
        url: result.Location,
        key: result.Key,
        uploadId,
      };
    } catch (error) {
      logger.error('S3 upload failed', { error, key, uploadId });
      throw new Error(`Failed to upload video to S3: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for direct browser uploads
   */
  static async generatePresignedUrl(params: PresignedUrlParams): Promise<PresignedUrlResult> {
    const { fileName, fileSize, mimeType, orgId } = params;
    const uploadId = uuidv4();
    const key = `uploads/${orgId}/${uploadId}/${fileName}`;
    
    logger.info('Generating presigned URL', {
      key,
      fileSize,
      mimeType,
      orgId,
    });

    try {
      const expiresIn = 60 * 15; // 15 minutes
      
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: mimeType,
        Expires: expiresIn,
        Conditions: [
          ['content-length-range', 0, fileSize],
          ['eq', '$Content-Type', mimeType],
        ],
        Metadata: {
          'upload-id': uploadId,
          'org-id': orgId,
          'created-at': new Date().toISOString(),
        },
      };

      const uploadUrl = s3.getSignedUrl('putObject', uploadParams);
      const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      logger.info('Presigned URL generated', {
        key,
        uploadId,
        expiresIn,
      });

      return {
        uploadUrl,
        fileUrl,
        key,
        uploadId,
        expiresIn,
      };
    } catch (error) {
      logger.error('Failed to generate presigned URL', { error, key });
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Upload file to specific S3 path (for processed outputs)
   */
  static async uploadProcessedFile(
    file: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    logger.info('Uploading processed file', { key, mimeType });

    try {
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: mimeType,
        Metadata: {
          'processed': 'true',
          'processed-at': new Date().toISOString(),
          ...metadata,
        },
        StorageClass: 'STANDARD',
        ServerSideEncryption: 'AES256',
      };

      const result = await s3.upload(uploadParams).promise();
      
      logger.info('Processed file uploaded', { 
        key, 
        location: result.Location 
      });

      return result.Location;
    } catch (error) {
      logger.error('Failed to upload processed file', { error, key });
      throw new Error(`Failed to upload processed file: ${error.message}`);
    }
  }

  /**
   * Copy file within S3 bucket (useful for creating variants)
   */
  static async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    logger.info('Copying S3 file', { sourceKey, destinationKey });

    try {
      const copyParams = {
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${sourceKey}`,
        Key: destinationKey,
        MetadataDirective: 'COPY',
      };

      await s3.copyObject(copyParams).promise();
      
      const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${destinationKey}`;
      
      logger.info('File copied successfully', { sourceKey, destinationKey });
      return fileUrl;
    } catch (error) {
      logger.error('Failed to copy file', { error, sourceKey, destinationKey });
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    logger.info('Deleting S3 file', { key });

    try {
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: key,
      }).promise();

      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('Failed to delete file', { error, key });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const result = await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: key,
      }).promise();

      return result;
    } catch (error) {
      logger.error('Failed to get file metadata', { error, key });
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Generate download URL for private files
   */
  static generateDownloadUrl(key: string, expiresIn: number = 3600): string {
    try {
      return s3.getSignedUrl('getObject', {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: expiresIn,
      });
    } catch (error) {
      logger.error('Failed to generate download URL', { error, key });
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * List files in a prefix/directory
   */
  static async listFiles(prefix: string, maxKeys: number = 100): Promise<AWS.S3.Object[]> {
    try {
      const result = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }).promise();

      return result.Contents || [];
    } catch (error) {
      logger.error('Failed to list files', { error, prefix });
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Check if S3 service is available
   */
  static async checkAvailability(): Promise<boolean> {
    try {
      await s3.listBuckets().promise();
      return true;
    } catch (error) {
      logger.error('S3 availability check failed', { error });
      return false;
    }
  }

  /**
   * Get storage usage for organization
   */
  static async getStorageUsage(orgId: string): Promise<{
    totalSize: number;
    fileCount: number;
    files: Array<{ key: string; size: number; lastModified: Date }>;
  }> {
    try {
      const prefix = `uploads/${orgId}/`;
      const objects = await this.listFiles(prefix, 1000);

      const totalSize = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      const fileCount = objects.length;
      
      const files = objects.map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));

      return {
        totalSize,
        fileCount,
        files,
      };
    } catch (error) {
      logger.error('Failed to get storage usage', { error, orgId });
      throw new Error(`Failed to get storage usage: ${error.message}`);
    }
  }

  /**
   * Cleanup old uploads (for maintenance)
   */
  static async cleanupOldUploads(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const objects = await this.listFiles('uploads/', 1000);
      const oldObjects = objects.filter(obj => 
        obj.LastModified && obj.LastModified < cutoffDate
      );

      if (oldObjects.length === 0) {
        return 0;
      }

      // Delete objects in batches
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: oldObjects.map(obj => ({ Key: obj.Key! })),
        },
      };

      const result = await s3.deleteObjects(deleteParams).promise();
      const deletedCount = result.Deleted?.length || 0;

      logger.info('Cleanup completed', { 
        deletedCount,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error('Cleanup failed', { error, daysOld });
      throw new Error(`Failed to cleanup old uploads: ${error.message}`);
    }
  }
}