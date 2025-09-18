#!/usr/bin/env node

/**
 * Environment Variables Checker
 * Validates that all required environment variables are set for production
 */

const chalk = require('chalk');

// Required environment variables for production
const REQUIRED_VARS = {
  'DATABASE_URL': {
    description: 'Supabase PostgreSQL connection string',
    example: 'postgresql://postgres:password@host:5432/postgres',
    critical: true
  },
  'REDIS_URL': {
    description: 'Upstash Redis connection string',
    example: 'redis://default:password@host:6379',
    critical: true
  },
  'GCS_PROJECT_ID': {
    description: 'Google Cloud Project ID',
    example: 'your-gcp-project-id',
    critical: true
  },
  'GCS_BUCKET_NAME': {
    description: 'Google Cloud Storage bucket name',
    example: 'framebrew-production',
    critical: true
  },
  'GEMINI_API_KEY': {
    description: 'Google Gemini API key for video generation',
    example: 'your-google-gemini-api-key',
    critical: true
  },
  'JWT_ACCESS_SECRET': {
    description: 'JWT access token secret',
    example: 'your-super-secure-jwt-access-secret',
    critical: true
  },
  'JWT_REFRESH_SECRET': {
    description: 'JWT refresh token secret',
    example: 'your-super-secure-jwt-refresh-secret',
    critical: true
  },
  'CORS_ORIGIN': {
    description: 'Frontend URL for CORS',
    example: 'https://framebrew.vercel.app',
    critical: false
  },
  'GCS_KEY_FILE': {
    description: 'Path to Google Cloud service account key file',
    example: '/var/task/gcs-key.json',
    critical: false
  }
};

function checkEnvironmentVariables() {
  console.log(chalk.blue.bold('\n🔍 Environment Variables Checker\n'));
  console.log(chalk.gray('Checking required environment variables for production...\n'));

  let allGood = true;
  let criticalMissing = false;

  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[varName];
    const isCritical = config.critical;

    if (!value) {
      if (isCritical) {
        console.log(chalk.red(`❌ ${varName} (CRITICAL)`));
        criticalMissing = true;
      } else {
        console.log(chalk.yellow(`⚠️  ${varName} (Optional)`));
      }
      console.log(chalk.gray(`   ${config.description}`));
      console.log(chalk.gray(`   Example: ${config.example}\n`));
      allGood = false;
    } else {
      // Mask sensitive values
      const displayValue = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')
        ? value.substring(0, 8) + '...'
        : value;

      console.log(chalk.green(`✅ ${varName}: ${displayValue}`));
    }
  }

  console.log('\n' + '='.repeat(50));

  if (allGood) {
    console.log(chalk.green.bold('\n🎉 All environment variables are configured!'));
    console.log(chalk.green('Your application is ready for production deployment.\n'));
  } else if (criticalMissing) {
    console.log(chalk.red.bold('\n❌ Critical environment variables are missing!'));
    console.log(chalk.red('Please configure the missing variables before deploying.\n'));

    console.log(chalk.yellow('Quick setup commands:'));
    console.log(chalk.gray('1. Run: ./scripts/setup-infrastructure.sh'));
    console.log(chalk.gray('2. Add variables to Vercel: vercel env add'));
    console.log(chalk.gray('3. Deploy: vercel --prod\n'));

    process.exit(1);
  } else {
    console.log(chalk.yellow.bold('\n⚠️  Some optional variables are missing.'));
    console.log(chalk.yellow('The application will work, but some features may be limited.\n'));
  }

  // Additional checks
  console.log(chalk.blue('\n📋 Additional Checks:'));

  // Check if DATABASE_URL is PostgreSQL
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgresql://')) {
    console.log(chalk.yellow('⚠️  DATABASE_URL should be PostgreSQL for production'));
  } else if (dbUrl) {
    console.log(chalk.green('✅ Database URL is PostgreSQL'));
  }

  // Check if CORS_ORIGIN is HTTPS
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin && !corsOrigin.startsWith('https://')) {
    console.log(chalk.yellow('⚠️  CORS_ORIGIN should be HTTPS for production'));
  } else if (corsOrigin) {
    console.log(chalk.green('✅ CORS origin is HTTPS'));
  }

  console.log();
}

// Check if chalk is available, fallback to plain console if not
try {
  require.resolve('chalk');
} catch (e) {
  // Fallback without colors if chalk is not available
  global.chalk = {
    blue: { bold: (text) => text },
    gray: (text) => text,
    red: (text) => text,
    yellow: (text) => text,
    green: { bold: (text) => text, green: (text) => text },
    blue: (text) => text
  };
}

// Run the checker
if (require.main === module) {
  checkEnvironmentVariables();
}

module.exports = { checkEnvironmentVariables, REQUIRED_VARS };