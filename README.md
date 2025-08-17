# Document Processing Pipeline

A TypeScript Express app with health check endpoints. Currently in foundation setup phase.

## 🚦 Current State

**What's Working Right Now:**
- ✅ Express server with health check endpoints
- ✅ MongoDB and Redis services in Docker
- ✅ Zero lint errors/warnings (enterprise-grade code quality)
- ✅ All tests passing
- ✅ Hybrid development environment (local app + Docker services)

**What's NOT Built Yet:**
- ❌ Document processing features
- ❌ File upload endpoints
- ❌ OCR simulation
- ❌ Queue processing

## 🚀 How to Test the App

### 1. Start the Services (Required First)
```bash
# Start MongoDB, Redis, and admin tools in Docker
npm run docker:services
```

### 2. Configure Processing Delays (Optional)
Set environment variables to control simulation delays:
```bash
# For fast testing (default: 1 minute each)
export OCR_SIMULATION_DELAY_MS=1000          # 1 second
export VALIDATION_SIMULATION_DELAY_MS=1000   # 1 second

# For manual testing with longer delays
export OCR_SIMULATION_DELAY_MS=60000         # 1 minute
export VALIDATION_SIMULATION_DELAY_MS=60000  # 1 minute
```

### 3. Start the App Locally
```bash
# Start the Express app on your machine
npm run start:dev
```

### 3. Test the Endpoints
Open these URLs in your browser or use curl:

**Health Check Endpoints:**
- http://localhost:3000/health - Full system health
- http://localhost:3000/ready - Service readiness check  
- http://localhost:3000/ping - Simple alive check

**Admin Tools:**
- http://localhost:8081 - MongoDB admin interface
- http://localhost:8082 - Redis admin interface

### 4. Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### 5. Check Code Quality
```bash
# Check for lint errors (should be zero)
npm run lint

# Check TypeScript types
npm run type-check
```

## 📋 Available Commands

### Development
```bash
npm run start:dev           # Start app locally with hot reload
npm run docker:services     # Start only Docker services (MongoDB, Redis)
npm run dev:local          # Start services + app together
```

### Docker Services
```bash
npm run docker:up          # Start all Docker services
npm run docker:down        # Stop all Docker services
```

### Code Quality
```bash
npm run lint               # Check for lint errors
npm run lint:fix           # Auto-fix lint issues
npm run type-check         # Check TypeScript types
npm run test               # Run tests
```

## 🏗️ Project Structure

```
src/
├── modules/
│   ├── health/                   # Health check endpoints (✅ Working)
│   ├── shared/                   # Shared utilities (✅ Working)
│   └── document-processing/      # Document features (❌ Not built yet)
└── index.ts                      # App entry point (✅ Working)
```

## 🔧 Environment Setup

The app uses a **hybrid environment**:
- **Express app**: Runs locally on your machine
- **Services**: Run in Docker (MongoDB, Redis, admin tools)

**Why hybrid?** Easier development and debugging while keeping services isolated.

## 🧪 What You Can Test

### Health Endpoints
1. **GET /health** - Shows system status and service health
2. **GET /ready** - Checks if services are ready
3. **GET /ping** - Simple ping response

### Example Health Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "mongodb": { "status": "up", "responseTime": 5 },
    "redis": { "status": "up", "responseTime": 2 }
  }
}
```

## 🚧 Next Steps

To continue building the document processing features:

1. **Document Upload API** - File upload endpoints
2. **OCR Simulation** - Mock document text extraction  
3. **Queue Processing** - Background job processing
4. **Database Models** - Document storage schemas
5. **Validation** - Input validation and error handling

## 🔍 Troubleshooting

**App won't start?**
- Make sure Docker services are running: `npm run docker:services`
- Check if ports 3000, 27017, 6379 are available

**Tests failing?**
- Run `npm run lint` to check for code issues
- Make sure all dependencies are installed: `npm install`

**Docker issues?**
- Stop all services: `npm run docker:down`
- Start fresh: `npm run docker:services`
