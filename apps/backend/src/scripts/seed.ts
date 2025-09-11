import { db } from '../shared/database';
import { AuthService } from '../shared/utils/auth';

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Create demo organization
    const org = await db.organization.create({
      data: {
        id: 'org_demo',
        name: 'Demo Organization',
        settings: JSON.stringify({
          theme: 'dark',
          notifications: true
        })
      }
    });
    console.log('✅ Created demo organization');

    // Create demo user
    const hashedPassword = await AuthService.hashPassword('demo123');
    const user = await db.user.create({
      data: {
        id: 'user_demo',
        email: 'demo@framebrew.com',
        name: 'Demo User',
        password: hashedPassword,
        role: 'ADMIN',
        orgId: org.id
      }
    });
    console.log('✅ Created demo user (email: demo@framebrew.com, password: demo123)');

    // Create demo projects
    const projects = await Promise.all([
      db.project.create({
        data: {
          id: 'proj_marketing',
          name: 'Marketing Campaign',
          description: 'Social media marketing videos',
          orgId: org.id
        }
      }),
      db.project.create({
        data: {
          id: 'proj_product',
          name: 'Product Demos',
          description: 'Product demonstration videos',
          orgId: org.id
        }
      }),
      db.project.create({
        data: {
          id: 'proj_training',
          name: 'Training Content',
          description: 'Educational and training videos',
          orgId: org.id
        }
      })
    ]);
    console.log('✅ Created demo projects');

    // Create demo templates
    const templates = await Promise.all([
      db.template.create({
        data: {
          id: 'tpl_product_showcase',
          name: 'Product Showcase',
          prompt: 'Create an engaging product demonstration video that highlights key features and benefits. Use dynamic transitions and clear explanations.',
          stylePreset: 'modern',
          orgId: org.id
        }
      }),
      db.template.create({
        data: {
          id: 'tpl_tutorial',
          name: 'Tutorial Style',
          prompt: 'Create a step-by-step tutorial video that is easy to follow and educational. Include clear instructions and visual aids.',
          stylePreset: 'educational',
          orgId: org.id
        }
      }),
      db.template.create({
        data: {
          id: 'tpl_social_media',
          name: 'Social Media Post',
          prompt: 'Create a short, engaging video perfect for social media platforms. Keep it punchy with strong visual appeal.',
          stylePreset: 'social',
          orgId: org.id
        }
      })
    ]);
    console.log('✅ Created demo templates');

    // Create demo videos
    const videos = await Promise.all([
      db.video.create({
        data: {
          id: 'vid_demo_1',
          title: 'Summer Sale Announcement',
          description: 'Promotional video for summer sale campaign',
          orgId: org.id,
          projectId: projects[0].id,
          status: 'ready',
          sourceType: 'generated',
          durationSec: 30,
          aspect: '9:16',
          urls: JSON.stringify({
            mp4: '/demo-videos/summer-sale.mp4',
            thumb: '/demo-videos/summer-sale-thumb.jpg',
            hls: '/demo-videos/summer-sale.m3u8'
          }),
          score: JSON.stringify({
            overall: 85,
            hook: 90,
            pacing: 80,
            clarity: 85,
            brandSafety: 95,
            durationFit: 90,
            visualQoe: 75,
            audioQoe: 80
          }),
          feedbackSummary: 'Strong opening hook with clear messaging. Consider improving visual quality for better engagement.',
          version: 1
        }
      }),
      db.video.create({
        data: {
          id: 'vid_demo_2',
          title: 'Product Feature Demo',
          description: 'Demonstration of new product features',
          orgId: org.id,
          projectId: projects[1].id,
          status: 'scoring',
          sourceType: 'generated',
          durationSec: 45,
          aspect: '16:9',
          urls: JSON.stringify({
            mp4: '/demo-videos/product-demo.mp4',
            thumb: '/demo-videos/product-demo-thumb.jpg'
          }),
          version: 1
        }
      }),
      db.video.create({
        data: {
          id: 'vid_demo_3',
          title: 'How to Use Our App',
          description: 'Step-by-step tutorial for new users',
          orgId: org.id,
          projectId: projects[2].id,
          status: 'ready',
          sourceType: 'uploaded',
          durationSec: 120,
          aspect: '16:9',
          urls: JSON.stringify({
            mp4: '/demo-videos/tutorial.mp4',
            thumb: '/demo-videos/tutorial-thumb.jpg',
            captions: '/demo-videos/tutorial-captions.vtt'
          }),
          score: JSON.stringify({
            overall: 92,
            hook: 88,
            pacing: 95,
            clarity: 90,
            brandSafety: 98,
            durationFit: 85,
            visualQoe: 90,
            audioQoe: 94
          }),
          feedbackSummary: 'Excellent educational content with great pacing and clear instructions.',
          version: 1
        }
      }),
      db.video.create({
        data: {
          id: 'vid_demo_4',
          title: 'Brand Introduction',
          description: 'Company brand introduction video',
          orgId: org.id,
          projectId: projects[0].id,
          status: 'failed',
          sourceType: 'generated',
          durationSec: 60,
          aspect: '9:16',
          urls: JSON.stringify({}),
          version: 1
        }
      })
    ]);
    console.log('✅ Created demo videos');

    // Create demo generation jobs
    await Promise.all([
      db.generationJob.create({
        data: {
          id: 'job_demo_1',
          videoId: videos[1].id,
          prompt: 'Create a professional product demonstration showcasing our latest features',
          stylePreset: 'modern',
          status: 'running',
          progress: 65
        }
      }),
      db.generationJob.create({
        data: {
          id: 'job_demo_2',
          videoId: videos[3].id,
          prompt: 'Create an engaging brand introduction video',
          stylePreset: 'corporate',
          status: 'failed',
          progress: 0,
          error: 'Processing timeout - please try again'
        }
      })
    ]);
    console.log('✅ Created demo generation jobs');

    console.log('🎉 Database seed completed successfully!');
    console.log('📧 Demo credentials: demo@framebrew.com / demo123');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });