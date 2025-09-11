# Frame Brew - AI-Powered Video Management Platform

 
A full-stack video management platform built with React, Node.js, and TypeScript in a production-ready monorepo architecture.

## 🏗️ Architecture

```
frame-brew/
├── apps/
│   ├── frontend/          # React + TypeScript + Vite
│   └── backend/           # Node.js + Express + TypeScript
├── packages/
│   └── shared-types/      # Common TypeScript definitions
└── package.json           # Root workspace configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation
```bash
# Install all dependencies
npm install

# Build shared types
npm run build:shared

# Initialize database (backend)
cd apps/backend
npm run migrate
npm run seed
```

### Development
```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:frontend  # Frontend on http://localhost:8080
npm run dev:backend   # Backend on http://localhost:3001
```

### Demo Credentials
- **Email**: demo@framebrew.com
- **Password**: demo123

## 📱 Frontend Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **State Management**: Zustand with persistence
- **Data Fetching**: TanStack Query
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Server-Sent Events (SSE)

### Key Features
- 🎨 Modern responsive UI with dark/light mode
- 📊 Video analytics dashboard with charts
- 🎬 Video management (upload, generate, organize)
- 📁 Project and template organization
- 🔄 Real-time status updates
- 📱 Mobile-responsive design

## 🔧 Backend Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Prisma
- **Authentication**: JWT with bcrypt
- **File Storage**: AWS S3 integration
- **Job Queue**: Bull Queue + Redis
- **Real-time**: Server-Sent Events
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting

### API Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/videos` - Video management
- `GET /api/projects` - Project organization
- `GET /api/templates` - Template management
- `POST /api/generation/create` - AI video generation
- `GET /api/events` - Real-time SSE connection

## 🗄️ Database Schema

### Core Models
- **Users**: Authentication and user management
- **Organizations**: Multi-tenant organization structure
- **Videos**: Video metadata, URLs, scores, and status
- **Projects**: Video organization and grouping
- **Templates**: Reusable generation templates
- **Generation Jobs**: AI video generation tracking

### Features
- Multi-tenant organization support
- Video scoring and analytics
- Real-time job progress tracking
- File metadata and processing status

## 🔐 Authentication & Security

- **JWT Tokens**: Access + refresh token strategy
- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: Configurable limits per endpoint
- **CORS**: Environment-specific origin configuration
- **Helmet**: Security headers and protection
- **Input Validation**: Zod schema validation

## 📦 Package Management

Uses npm workspaces for efficient monorepo management:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

### Benefits
- Shared dependencies across packages
- Type-safe imports between apps
- Consistent development environment
- Optimized builds and deployments

## 🧪 Development Scripts

```bash
# Development
npm run dev                # Start both frontend and backend
npm run dev:frontend      # Start frontend only
npm run dev:backend       # Start backend only

# Building
npm run build             # Build all packages
npm run build:frontend    # Build frontend
npm run build:backend     # Build backend
npm run build:shared      # Build shared types

# Database
npm run migrate           # Run database migrations
npm run seed              # Seed database with demo data

# Linting & Testing
npm run lint              # Lint all packages
npm run test              # Run all tests
```

## 🌐 Production Deployment

### Environment Configuration
Copy `.env.production` and update:
- Database connection string
- JWT secrets (use strong random values)
- AWS S3 credentials
- Redis connection
- CORS origins
- Monitoring setup

### Build Process
```bash
# Build for production
npm run build

# Database migrations
cd apps/backend
npm run migrate

# Start production servers
npm run start
```

### Recommended Infrastructure
- **Frontend**: Static hosting (Vercel, Netlify, CloudFlare)
- **Backend**: Container deployment (Docker + Kubernetes)
- **Database**: Managed PostgreSQL (AWS RDS, Google Cloud SQL)
- **Storage**: AWS S3 or compatible object storage
- **Cache**: Redis cluster for sessions and job queue
- **CDN**: CloudFlare or AWS CloudFront

## 🔄 Real-time Features

### Server-Sent Events (SSE)
- **Connection**: `GET /api/events?token=<jwt_token>`
- **Events**: Video status updates, job progress, completion notifications
- **Management**: Automatic reconnection, heartbeat, cleanup

### Event Types
- `video_status_update`: Video processing status changes
- `job_progress`: Generation job progress updates
- `job_complete`: Job completion notifications
- `heartbeat`: Connection keep-alive

## 🎬 Video Processing Pipeline

1. **Upload/Generation**: Video creation or file upload
2. **Queued**: Job added to processing queue
3. **Running**: AI generation or processing started  
4. **Transcoding**: Video format conversion
5. **Scoring**: AI analysis and scoring
6. **Ready**: Video available for viewing

## 🔍 Monitoring & Debugging

### Logging
- **Development**: Console + file logging
- **Production**: Structured JSON logging
- **Levels**: error, warn, info, debug
- **Request tracking**: HTTP request/response logging

### Health Checks
- `GET /health`: Application and database status
- Database connectivity verification
- Service status reporting

## 🛠️ Development Tips

### Adding New Features
1. Add shared types to `packages/shared-types`
2. Implement backend API endpoints
3. Update frontend API client
4. Add UI components and pages
5. Test end-to-end functionality

### Database Changes
1. Update Prisma schema
2. Generate migration: `npx prisma migrate dev`
3. Update seed script if needed
4. Regenerate Prisma client: `npx prisma generate`

### Type Safety
- All API contracts defined in shared types
- Frontend and backend use same type definitions
- Compile-time type checking across the stack

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and ensure they pass
5. Submit a pull request

## 📞 Support

- **Issues**: GitHub Issues
- **Documentation**: See `/docs` folder
- **API Docs**: Available at `/api/docs` when running