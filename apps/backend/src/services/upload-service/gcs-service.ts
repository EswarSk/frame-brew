import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils/logger';

// Configure Google Cloud Storage
let storage: Storage;
const initializeStorage = () => {
  if (!storage) {
    const projectId = process.env.GCS_PROJECT_ID;
    const keyFile = process.env.GCS_KEY_FILE;

    if (projectId && keyFile) {
      storage = new Storage({
        projectId,
        keyFilename: keyFile,
      });
    } else if (projectId) {
      // Use Application Default Credentials
      storage = new Storage({ projectId });
    } else {
      // Will be handled by development mode checks
      storage = new Storage();
    }
  }
  return storage;
};

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'frame-brew-videos';

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

interface SignedUrlParams {
  fileName: string;
  fileSize: number;
  mimeType: string;
  orgId: string;
}

interface SignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  uploadId: string;
  expiresIn: number;
}

interface StorageUsage {
  totalSize: number;
  fileCount: number;
  files: Array<{ key: string; size: number; lastModified: Date }>;
}

export class GCSService {
  /**
   * Upload video file directly to Google Cloud Storage
   */
  static async uploadVideo(params: UploadVideoParams): Promise<UploadResult> {
    const { file, fileName, originalName, mimeType, orgId } = params;
    const uploadId = uuidv4();

    // Generate GCS key with organization structure
    const key = `uploads/${orgId}/${uploadId}/${fileName}`;

    // Development mode: Save file locally and return local URLs
    if (!process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Saving file locally', {
        key,
        fileSize: file.length,
        mimeType,
        originalName,
      });

      try {
        // Import necessary modules for file operations
        const fs = require('fs').promises;
        const path = require('path');

        // Create the full file path (remove 'uploads/' prefix from key since we're in uploads directory)
        const relativePath = key.replace('uploads/', '');
        const fullPath = path.join(process.cwd(), 'uploads', relativePath);
        const dirPath = path.dirname(fullPath);

        // Create directory structure if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });

        // Write file to local storage
        await fs.writeFile(fullPath, file);

        logger.info('File saved locally', {
          fullPath,
          key,
          relativePath,
        });

        return {
          url: `http://localhost:3001/uploads/${relativePath}`,
          key,
          uploadId,
        };
      } catch (error) {
        logger.error('Failed to save file locally', { error: error.message, key });
        throw new Error(`Failed to save file locally: ${error.message}`);
      }
    }

    logger.info('Starting GCS upload', {
      key,
      fileSize: file.length,
      mimeType,
      originalName,
    });

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const fileObj = bucket.file(key);

      // Upload the file
      await fileObj.save(file, {
        metadata: {
          contentType: mimeType,
          metadata: {
            'original-name': originalName,
            'upload-id': uploadId,
            'org-id': orgId,
            'uploaded-at': new Date().toISOString(),
          },
        },
        resumable: false,
      });


      // Generate a read URL for accessing the uploaded file
      const [readUrl] = await fileObj.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour for read access
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;

      logger.info('GCS upload completed', {
        key,
        publicUrl,
        readUrl,
      });

      return {
        url: readUrl,
        key,
        uploadId,
      };
    } catch (error) {
      logger.error('GCS upload failed', { error, key, uploadId });
      throw new Error(`Failed to upload video to GCS: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for direct browser uploads
   */
  static async generateSignedUrl(params: SignedUrlParams): Promise<SignedUrlResult> {
    const { fileName, fileSize, mimeType, orgId } = params;
    const uploadId = uuidv4();
    const key = `uploads/${orgId}/${uploadId}/${fileName}`;

    logger.info('Generating signed URL', {
      key,
      fileSize,
      mimeType,
      orgId,
    });

    // Development mode: Return mock URLs
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      const expiresIn = 60 * 15; // 15 minutes

      logger.info('Development mode: Returning mock signed URLs', {
        key,
        fileSize,
        mimeType,
        orgId,
      });

      return {
        uploadUrl: `http://localhost:3001/uploads/${key}`,
        fileUrl: `http://localhost:3001/uploads/${key}`,
        key,
        uploadId,
        expiresIn,
      };
    }

    try {
      const expiresIn = 60 * 15; // 15 minutes
      const expires = Date.now() + expiresIn * 1000;

      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const file = bucket.file(key);

      // Generate a v4 signed URL for uploading
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires,
        contentType: mimeType,
        extensionHeaders: {
          'x-goog-meta-upload-id': uploadId,
          'x-goog-meta-org-id': orgId,
          'x-goog-meta-created-at': new Date().toISOString(),
        },
      });

      const fileUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;

      logger.info('Signed URL generated', {
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
      logger.error('Failed to generate signed URL', { error, key });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Upload file to specific GCS path (for processed outputs)
   */
  static async uploadProcessedFile(
    file: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    logger.info('Uploading processed file', { key, mimeType });

    // Development mode: Save file locally and return local URL
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Saving processed file locally', {
        key,
        fileSize: file.length,
        mimeType,
        metadata,
      });

      try {
        const fs = require('fs').promises;
        const path = require('path');

        // Create the full file path
        const fullPath = path.join(process.cwd(), 'uploads', key);
        const dirPath = path.dirname(fullPath);

        // Create directory structure if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });

        // Write file to local storage
        await fs.writeFile(fullPath, file);

        logger.info('Processed file saved locally', { fullPath, key });

        return `http://localhost:3001/uploads/${key}`;
      } catch (error) {
        logger.error('Failed to save processed file locally', { error: error.message, key });
        throw new Error(`Failed to save processed file locally: ${error.message}`);
      }
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const fileObj = bucket.file(key);

      await fileObj.save(file, {
        metadata: {
          contentType: mimeType,
          metadata: {
            'processed': 'true',
            'processed-at': new Date().toISOString(),
            ...metadata,
          },
        },
        resumable: false,
      });

      // Make file publicly readable
      await fileObj.makePublic();

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;

      logger.info('Processed file uploaded', {
        key,
        publicUrl,
      });

      return publicUrl;
    } catch (error) {
      logger.error('Failed to upload processed file', { error, key });
      throw new Error(`Failed to upload processed file: ${error.message}`);
    }
  }

  /**
   * Copy file within GCS bucket (useful for creating variants)
   */
  static async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    logger.info('Copying GCS file', { sourceKey, destinationKey });

    // Development mode: Copy file locally
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Copying file locally', {
        sourceKey,
        destinationKey,
      });

      try {
        const fs = require('fs').promises;
        const path = require('path');

        // Create source and destination paths
        const sourcePath = path.join(process.cwd(), 'uploads', sourceKey);
        const destinationPath = path.join(process.cwd(), 'uploads', destinationKey);
        const destDirPath = path.dirname(destinationPath);

        // Create destination directory if it doesn't exist
        await fs.mkdir(destDirPath, { recursive: true });

        // Copy file
        await fs.copyFile(sourcePath, destinationPath);

        logger.info('File copied locally', { sourcePath, destinationPath });

        return `http://localhost:3001/uploads/${destinationKey}`;
      } catch (error) {
        logger.error('Failed to copy file locally', { error: error.message, sourceKey, destinationKey });
        throw new Error(`Failed to copy file locally: ${error.message}`);
      }
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const sourceFile = bucket.file(sourceKey);
      const destinationFile = bucket.file(destinationKey);

      await sourceFile.copy(destinationFile);

      const fileUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destinationKey}`;

      logger.info('File copied successfully', { sourceKey, destinationKey });
      return fileUrl;
    } catch (error) {
      logger.error('Failed to copy file', { error, sourceKey, destinationKey });
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * Delete file from GCS
   */
  static async deleteFile(key: string): Promise<void> {
    logger.info('Deleting GCS file', { key });

    // Development mode: Skip GCS operations
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Skipping GCS file deletion', { key });
      return;
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const file = bucket.file(key);

      await file.delete();

      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('Failed to delete file', { error, key });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<any> {
    // Development mode: Return mock metadata
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Returning mock file metadata', { key });
      return {
        name: key,
        size: 1024 * 1024, // 1MB mock size
        updated: new Date(),
        contentType: 'application/octet-stream',
      };
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const file = bucket.file(key);

      const [metadata] = await file.getMetadata();

      return {
        name: metadata.name,
        size: parseInt(String(metadata.size || '0')),
        updated: new Date(metadata.updated || Date.now()),
        contentType: metadata.contentType,
        metadata: metadata.metadata,
      };
    } catch (error) {
      logger.error('Failed to get file metadata', { error, key });
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Generate download URL for private files
   */
  static generateDownloadUrl(key: string, expiresIn: number = 3600): string {
    // Development mode: Return local URL
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      return `http://localhost:3001/uploads/${key}`;
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);
      const file = bucket.file(key);

      const expires = Date.now() + expiresIn * 1000;

      // For now, return public URL (can be made private with signed URLs)
      return `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;
    } catch (error) {
      logger.error('Failed to generate download URL', { error, key });
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * List files in a prefix/directory
   */
  static async listFiles(prefix: string, maxResults: number = 100): Promise<any[]> {
    // Development mode: Return empty array
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Returning empty file list', { prefix });
      return [];
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);

      const [files] = await bucket.getFiles({
        prefix,
        maxResults,
      });

      return files.map(file => ({
        name: file.name,
        size: parseInt(String(file.metadata.size || '0')),
        updated: new Date(file.metadata.updated || Date.now()),
        contentType: file.metadata.contentType,
      }));
    } catch (error) {
      logger.error('Failed to list files', { error, prefix });
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Check if GCS service is available
   */
  static async checkAvailability(): Promise<boolean> {
    // In development mode, GCS is considered available (mock mode)
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: GCS availability check returning true (mock mode)');
      return true;
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);

      // Try to check if bucket exists
      const [exists] = await bucket.exists();
      if (!exists) {
        logger.warn('GCS bucket does not exist', { bucketName: BUCKET_NAME });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('GCS availability check failed', { error });
      return false;
    }
  }

  /**
   * Get storage usage for organization
   */
  static async getStorageUsage(orgId: string): Promise<StorageUsage> {
    // Development mode: Return mock usage
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Returning mock storage usage', { orgId });
      return {
        totalSize: 1024 * 1024 * 100, // 100MB mock
        fileCount: 10,
        files: [],
      };
    }

    try {
      const prefix = `uploads/${orgId}/`;
      const files = await this.listFiles(prefix, 1000);

      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      const fileCount = files.length;

      const fileDetails = files.map(file => ({
        key: file.name || '',
        size: file.size || 0,
        lastModified: file.updated || new Date(),
      }));

      return {
        totalSize,
        fileCount,
        files: fileDetails,
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
    // Development mode: Return 0 (no cleanup)
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Skipping cleanup', { daysOld });
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const files = await this.listFiles('uploads/', 1000);
      const oldFiles = files.filter(file =>
        file.updated && file.updated < cutoffDate
      );

      if (oldFiles.length === 0) {
        return 0;
      }

      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);

      // Delete files in batches
      const deletePromises = oldFiles.map(file =>
        bucket.file(file.name).delete()
      );

      await Promise.all(deletePromises);
      const deletedCount = oldFiles.length;

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

  /**
   * Create bucket if it doesn't exist (for setup)
   */
  static async createBucketIfNotExists(): Promise<boolean> {
    if (process.env.NODE_ENV === 'development' || !process.env.GCS_PROJECT_ID) {
      logger.info('Development mode: Skipping bucket creation');
      return true;
    }

    try {
      const gcs = initializeStorage();
      const bucket = gcs.bucket(BUCKET_NAME);

      const [exists] = await bucket.exists();
      if (exists) {
        logger.info('GCS bucket already exists', { bucketName: BUCKET_NAME });
        return true;
      }

      // Create bucket with appropriate settings
      await gcs.createBucket(BUCKET_NAME, {
        location: process.env.GCS_REGION || 'US-CENTRAL1',
        storageClass: 'STANDARD',
        versioning: {
          enabled: false,
        },
        cors: [{
          origin: ['*'],
          method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
          responseHeader: ['Content-Type'],
          maxAgeSeconds: 3600,
        }],
      });

      logger.info('GCS bucket created successfully', { bucketName: BUCKET_NAME });
      return true;
    } catch (error) {
      logger.error('Failed to create GCS bucket', { error, bucketName: BUCKET_NAME });
      return false;
    }
  }
}