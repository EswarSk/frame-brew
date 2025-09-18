import { GCSService } from '../services/upload-service/gcs-service';
import { logger } from '../shared/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupGCS() {
  try {
    logger.info('Starting GCS setup...');

    // Check if GCS is properly configured
    if (!process.env.GCS_PROJECT_ID) {
      logger.error('GCS_PROJECT_ID environment variable is not set');
      logger.info('Please set the following environment variables:');
      logger.info('- GCS_PROJECT_ID: Your Google Cloud Project ID');
      logger.info('- GCS_BUCKET_NAME: Your GCS bucket name (optional, defaults to frame-brew-videos)');
      logger.info('- GCS_KEY_FILE: Path to your service account key file (optional for ADC)');
      logger.info('- GCS_REGION: GCS region (optional, defaults to us-central1)');
      process.exit(1);
    }

    // Check GCS availability
    logger.info('Checking GCS availability...');
    const isAvailable = await GCSService.checkAvailability();

    if (!isAvailable) {
      logger.error('GCS is not available. Please check your configuration and credentials.');
      process.exit(1);
    }

    logger.info('GCS is available ✓');

    // Create bucket if it doesn't exist
    logger.info('Creating GCS bucket if it doesn\'t exist...');
    const bucketCreated = await GCSService.createBucketIfNotExists();

    if (bucketCreated) {
      logger.info('GCS bucket is ready ✓');
    } else {
      logger.error('Failed to create or verify GCS bucket');
      process.exit(1);
    }

    // Test upload functionality
    logger.info('Testing upload functionality...');
    try {
      const testBuffer = Buffer.from('GCS test file content');
      const testKey = 'test/setup-test.txt';

      const uploadUrl = await GCSService.uploadProcessedFile(
        testBuffer,
        testKey,
        'text/plain',
        {
          'test': 'true',
          'created-by': 'setup-script',
        }
      );

      logger.info('Test upload successful ✓', { uploadUrl });

      // Clean up test file
      try {
        await GCSService.deleteFile(testKey);
        logger.info('Test file cleaned up ✓');
      } catch (cleanupError) {
        logger.warn('Failed to clean up test file (this is okay)', { error: cleanupError.message });
      }

    } catch (uploadError) {
      logger.error('Test upload failed', { error: uploadError.message });
      process.exit(1);
    }

    logger.info('🎉 GCS setup completed successfully!');
    logger.info('');
    logger.info('Your Frame Brew application is now configured to use Google Cloud Storage:');
    logger.info(`- Project ID: ${process.env.GCS_PROJECT_ID}`);
    logger.info(`- Bucket Name: ${process.env.GCS_BUCKET_NAME || 'frame-brew-videos'}`);
    logger.info(`- Region: ${process.env.GCS_REGION || 'us-central1'}`);
    logger.info('');
    logger.info('File storage operations:');
    logger.info('✓ User uploaded videos → GCS');
    logger.info('✓ AI-generated videos (Veo3) → GCS');
    logger.info('✓ Processed videos (thumbnails, optimized versions) → GCS');
    logger.info('✓ Audio files and captions → GCS');
    logger.info('✓ All images and media assets → GCS');
    logger.info('');
    logger.info('Development mode: Files are stored locally when GCS_PROJECT_ID is not set');

  } catch (error) {
    logger.error('GCS setup failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupGCS();
}

export { setupGCS };