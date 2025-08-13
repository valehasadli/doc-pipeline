# Local Development Setup

## Hybrid Local/Docker Architecture

This project uses a hybrid approach for optimal development experience:

- **Express App**: Runs locally (better debugging, faster ESLint/TypeScript)
- **Services**: Run in Docker (MongoDB, Redis, MongoDB Express)
- **Tests**: Can run locally or in Docker
- **Linting**: Runs locally (zero tolerance, enterprise-grade)

## Quick Start

### 1. Start Docker Services Only
```bash
npm run docker:services
```
This starts MongoDB, Redis, and MongoDB Express in Docker.

### 2. Start Local Express App
```bash
npm run start:dev
```
This starts the Express app locally, connecting to Docker services.

### 3. Alternative: Combined Start
```bash
npm run dev:local
```
This starts both Docker services and local Express app.

## Environment Configuration

### Local Development Environment Variables
Create a `.env` file in the project root with:

```env
# Application
NODE_ENV=development
PORT=3000

# Database connections (Docker services exposed to localhost)
MONGODB_URI=mongodb://localhost:27017/document-pipeline
REDIS_URL=redis://localhost:6379

# Optional: Package version
npm_package_version=1.0.0
```

### Service Endpoints

- **Express App**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Readiness Check**: http://localhost:3000/ready
- **Ping**: http://localhost:3000/ping
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **MongoDB Express**: http://localhost:8081

## Development Commands

### Local Development
```bash
npm run start:dev          # Start Express app locally
npm run docker:services    # Start only Docker services
npm run dev:local          # Start both services and app
```

### Testing
```bash
npm test                   # Run tests locally
npm run test:watch         # Run tests in watch mode
npm run docker:test        # Run tests in Docker
```

### Linting & Formatting
```bash
npm run lint               # Lint code (zero tolerance)
npm run lint:fix           # Fix auto-fixable lint issues
npm run format             # Format code with Prettier
npm run type-check         # TypeScript type checking
```

### Docker Services Management
```bash
npm run docker:services    # Start services only
npm run docker:up          # Start all containers (including app)
npm run docker:down        # Stop all containers
npm run docker:logs        # View container logs
```

## Pre-commit Hooks

Husky pre-commit hooks run locally and enforce:
- ✅ Zero ESLint errors/warnings
- ✅ All tests pass
- ✅ TypeScript type checking
- ✅ Code formatting

## Troubleshooting

### Connection Issues
- Ensure Docker services are running: `docker ps`
- Check service logs: `npm run docker:logs`
- Verify ports are not in use: `lsof -i :3000,27017,6379`

### ESLint Issues
- Run locally, not in Docker: `npm run lint`
- Fix auto-fixable issues: `npm run lint:fix`
- Check TypeScript errors: `npm run type-check`

## Architecture Benefits

✅ **Fast Development**: Local Express app with hot reload
✅ **Reliable Services**: Containerized MongoDB/Redis
✅ **Enterprise Linting**: Zero tolerance, runs locally
✅ **Flexible Testing**: Local or Docker-based
✅ **Production Parity**: Docker services match production
