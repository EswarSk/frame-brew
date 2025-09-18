#!/usr/bin/env node
/**
 * Script to fix video URLs in database from string format to object format
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma client with the correct database path
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:' + path.join(__dirname, 'apps/backend/prisma/dev.db')
    }
  }
});

async function fixVideoUrls() {
  try {
    console.log('🔍 Checking for videos with incorrect URL format...');
    
    // Get all videos that have status READY
    const videos = await prisma.video.findMany({
      where: {
        status: 'READY'
      },
      select: {
        id: true,
        title: true,
        urls: true,
        status: true
      }
    });

    console.log(`Found ${videos.length} READY videos`);

    for (const video of videos) {
      console.log(`\n📹 Video: ${video.title} (${video.id})`);
      console.log(`   Status: ${video.status}`);
      console.log(`   Current URLs: ${video.urls}`);

      // Check if URLs is a string (broken format)
      if (video.urls && typeof video.urls === 'string') {
        try {
          const parsedUrls = JSON.parse(video.urls);
          
          // If it's a string URL, convert to proper object format
          if (typeof parsedUrls === 'string') {
            console.log(`   ❌ Broken format detected: ${parsedUrls}`);
            
            const fixedUrls = {
              mp4: parsedUrls
            };
            
            // Update the video record
            await prisma.video.update({
              where: { id: video.id },
              data: {
                urls: JSON.stringify(fixedUrls)
              }
            });
            
            console.log(`   ✅ Fixed to: ${JSON.stringify(fixedUrls)}`);
          } else if (parsedUrls.mp4) {
            console.log(`   ✅ Already in correct format`);
          } else {
            console.log(`   ⚠️  Unknown format: ${video.urls}`);
          }
        } catch (error) {
          console.log(`   ❌ Invalid JSON: ${error.message}`);
        }
      }
    }

    console.log('\n🎉 Video URL fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing video URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixVideoUrls();