# Document Processing Pipeline

Enterprise-grade document processing pipeline built with **Domain-Driven Design (DDD)** and **Event-Driven Architecture**. Features strict TypeScript, comprehensive testing, and Docker-first development.

## 🏗️ Architecture

### Modular DDD Structure
```
src/
├── modules/
│   ├── shared/                    # Shared module (used by other modules)
│   │   ├── domain/               # Domain layer (entities, value objects, events)
│   │   ├── application/          # Application layer (use cases, services)
│   │   └── infrastructure/       # Infrastructure layer (repositories, external services)
│   ├── document-processing/      # Document processing bounded context
│   │   ├── domain/              # Document domain logic
│   │   ├── application/         # Document use cases
│   │   ├── infrastructure/      # Document persistence & external services
│   │   └── presentation/        # Document API controllers & routes
│   └── health/                  # Health check module
│       ├── application/         # Health check services
│       └── presentation/        # Health check endpoints
└── index.ts                     # Application entry point
```

### Technology Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with enterprise middleware
- **Database**: MongoDB with Mongoose
- **Queue**: BullMQ with Redis
- **Testing**: Jest with Supertest
- **Development**: Docker Compose
- **Validation**: Zod for runtime type checking
- **DI Container**: Inversify for dependency injection

## 🚀 Quick Start (Docker Development)

### Prerequisites
- Docker & Docker Compose
- Git

### Development Workflow

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd tech-task-indicium
   ```

2. **Start development environment**:
   ```bash
   # Start all services (app, MongoDB, Redis, admin tools)
   npm run docker:up
   
   # Or start just the app (for development)
   npm run docker:dev
   ```

3. **Run tests in Docker**:
   ```bash
   # Run all tests once
   npm run docker:test
   
   # Run tests in watch mode
   npm run docker:test:watch
   ```

4. **Access services**:
   - **Application**: http://localhost:3000
   - **Health Check**: http://localhost:3000/health
   - **MongoDB Admin**: http://localhost:8081
   - **Redis Admin**: http://localhost:8082

### Available Docker Commands

```bash
# Development
npm run docker:dev          # Start app in development mode
npm run docker:up           # Start all services in background
npm run docker:down         # Stop all services
npm run docker:logs         # View logs
npm run docker:shell        # Access app container shell

# Testing
npm run docker:test         # Run tests once
npm run docker:test:watch   # Run tests in watch mode

# Building
npm run docker:build        # Build production image
```

## 🧪 Testing Strategy

### Test-Driven Development (TDD)
- **Unit Tests**: Domain logic and services
- **Integration Tests**: API endpoints and database interactions
- **Contract Tests**: Module boundaries and interfaces
- **Coverage**: 80% minimum threshold

### Running Tests
```bash
# In Docker (recommended)
npm run docker:test

# Locally (if needed)
npm test
npm run test:watch
npm run test:coverage
```

## 📊 Health Checks

The application provides comprehensive health monitoring:

### Endpoints
- `GET /health` - Overall system health
- `GET /ready` - Readiness probe (critical services)
- `GET /ping` - Liveness probe (simple ping)

### Example Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "mongodb": { "status": "up", "responseTime": 5 },
    "redis": { "status": "up", "responseTime": 2 },
    "filesystem": { "status": "up", "responseTime": 1 }
  }
}
```

## 🔧 Development Standards

### Code Quality
- **Zero TypeScript errors/warnings**
- **No `any` types allowed**
- **Strict linting with ESLint**
- **Prettier code formatting**
- **100% type safety**

### Import Aliases
```typescript
// Clean imports with aliases
import { AggregateRoot } from '@shared/domain/base/AggregateRoot';
import { DocumentService } from '@document-processing/application/DocumentService';
import { HealthController } from '@health/presentation/HealthController';
```

### Git Workflow (Future)
- Pre-commit hooks with Husky
- Automated linting and testing
- Conventional commits
- Automated versioning

## 🏢 Enterprise Features

### Security
- Helmet.js security headers
- CORS configuration
- Rate limiting
- Input validation
- Environment-based configuration

### Monitoring
- Health check endpoints
- Request logging
- Error tracking
- Performance metrics

### Scalability
- Modular architecture
- Event-driven design
- Queue-based processing
- Docker containerization

## 🛠️ Development Commands

```bash
# Local development (if not using Docker)
npm run start:dev           # Start with hot reload
npm run build              # Build for production
npm run start              # Start production build

# Code quality
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues
npm run format             # Format with Prettier
npm run type-check         # TypeScript type checking
npm run validate           # Run all checks

# Database migrations (future)
npm run migrate:up         # Run migrations
npm run migrate:down       # Rollback migrations
npm run migrate:status     # Check migration status
```

## 📝 Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/document-pipeline
REDIS_URL=redis://localhost:6379

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Processing
OCR_SIMULATION_DELAY=500
MAX_RETRY_ATTEMPTS=3
QUEUE_CONCURRENCY=5
```

## 🚦 Current Status

### ✅ Completed
- [x] Modular DDD architecture setup
- [x] Docker development environment
- [x] Health check module with tests
- [x] Strict TypeScript configuration
- [x] Enterprise-grade tooling setup
- [x] Import aliases configuration
- [x] Basic Express server with middleware

### 🚧 In Progress
- [ ] Document processing module
- [ ] Database migrations
- [ ] Event-driven architecture
- [ ] Queue processing system

### 📋 Planned
- [ ] Git hooks with Husky
- [ ] API documentation
- [ ] Performance monitoring
- [ ] CI/CD pipeline

## 🤝 Contributing

1. Follow TDD approach
2. Maintain 100% type safety
3. Use modular DDD structure
4. Write comprehensive tests
5. Use Docker for development
6. Follow enterprise standards

---

**Built with ❤️ using Enterprise-grade practices**
# doc-pipeline
