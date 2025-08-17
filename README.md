# Document Processing Pipeline

🚀 **Enterprise-grade document processing pipeline** built with TypeScript, Express, and Domain-Driven Design (DDD). Features robust file upload, OCR simulation, validation, and persistence with queue-based processing.

## ✨ Features

- 📄 **Document Upload & Processing** - Multi-format file upload with automatic processing
- 🔍 **OCR Simulation** - Text extraction simulation with configurable delays
- ✅ **Document Validation** - Comprehensive validation pipeline
- 💾 **File Storage** - Abstracted storage layer (Local/S3) with retry mechanisms
- 🔄 **Queue Processing** - Background job processing with BullMQ
- 📊 **Real-time Status** - Track document processing status in real-time
- 🚫 **Cancellation Support** - Cancel processing jobs at any stage
- 🔁 **Retry Logic** - Automatic retry for failed operations with exponential backoff
- 🏥 **Health Monitoring** - Comprehensive health checks and monitoring
- 🧪 **100% Test Coverage** - 180 passing tests with zero lint errors

## 📖 API Documentation

### 📤 Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data
```

**Request Body:**
```bash
# Form data fields
file: <binary-file>              # Required: PDF, DOC, DOCX, PNG, JPG, TXT (max 10MB)
metadata: {"description": "..."}  # Optional: JSON string with document metadata
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@document.pdf" \
  -F 'metadata={"description":"Invoice for Q1 2024"}'
```

**Response (201):**
```json
{
  "id": "doc-abc123",
  "status": "uploaded",
  "message": "Document uploaded successfully and queued for processing",
  "metadata": {
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 📋 Get Document Status
```http
GET /api/documents/{documentId}
```

**Example:**
```bash
curl http://localhost:3000/api/documents/doc-abc123
```

**Response (200):**
```json
{
  "id": "doc-abc123",
  "status": "processing_ocr",
  "filePath": "/uploads/permanent/doc-abc123.pdf",
  "metadata": {
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:00:00.000Z"
  },
  "ocrResult": {
    "extractedText": "Sample document content...",
    "confidence": 0.95,
    "extractedAt": "2024-01-15T10:01:30.000Z"
  },
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:01:30.000Z"
}
```

### 📜 List Documents
```http
GET /api/documents
```

**Query Parameters:**
- `status` - Filter by status: `uploaded`, `processing_ocr`, `completed`, `failed`, etc.
- `limit` - Number of documents to return (default: 50, max: 100)
- `offset` - Number of documents to skip (default: 0)

**Example:**
```bash
curl "http://localhost:3000/api/documents?status=completed&limit=10&offset=0"
```

**Response (200):**
```json
{
  "documents": [
    {
      "id": "doc-abc123",
      "status": "completed",
      "metadata": {
        "fileName": "document.pdf",
        "fileSize": 1048576,
        "mimeType": "application/pdf"
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:05:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### 🚫 Cancel Document Processing
```http
POST /api/documents/{documentId}/cancel
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/documents/doc-abc123/cancel
```

**Response (200):**
```json
{
  "id": "doc-abc123",
  "status": "cancelled",
  "message": "Document processing cancelled successfully"
}
```

### 🔁 Retry Failed Document
```http
POST /api/documents/{documentId}/retry
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/documents/doc-abc123/retry
```

**Response (200):**
```json
{
  "id": "doc-abc123",
  "status": "queued",
  "message": "Document queued for retry processing"
}
```

### 📊 Processing Statistics
```http
GET /api/documents/stats/summary
```

**Example:**
```bash
curl http://localhost:3000/api/documents/stats/summary
```

**Response (200):**
```json
{
  "total": 250,
  "byStatus": {
    "uploaded": 5,
    "queued": 3,
    "processing_ocr": 2,
    "processing_validation": 1,
    "processing_persistence": 1,
    "completed": 220,
    "failed": 15,
    "cancelled": 3
  },
  "averageProcessingTime": 45000,
  "successRate": 88.0,
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

### 🏥 Health Check Endpoints
```http
GET /health        # Comprehensive system health
GET /ready         # Service readiness check
GET /ping          # Simple liveness probe
```

**Health Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "mongodb": { "status": "up", "responseTime": 5 },
    "redis": { "status": "up", "responseTime": 2 },
    "queue": { "status": "up", "activeJobs": 3, "waitingJobs": 1 }
  }
}
```

### ❌ Error Responses

**400 Bad Request:**
```json
{
  "error": "Validation Error",
  "message": "File size exceeds maximum limit of 10MB",
  "details": {
    "field": "file",
    "received": 15728640,
    "maximum": 10485760
  }
}
```

**404 Not Found:**
```json
{
  "error": "Document Not Found",
  "message": "Document with ID 'doc-invalid' does not exist"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred during processing",
  "requestId": "req-xyz789"
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Docker and Docker Compose
- 4GB+ available RAM

### 1. Clone and Install
```bash
git clone <repository-url>
cd tech-task-indicium
npm install
```

### 2. Start Services
```bash
# Start MongoDB, Redis, and admin tools
npm run docker:services
```

### 3. Start the Application
```bash
# Start the Express app with hot reload
npm run start:dev
```

### 4. Test the API
**Upload a Document:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@/path/to/your/document.pdf" \
  -F "metadata={\"description\":\"Test document\"}"
```

**Check Document Status:**
```bash
curl http://localhost:3000/api/documents/{documentId}
```

**List All Documents:**
```bash
curl http://localhost:3000/api/documents
```

### 5. Monitor Processing
- **Health Dashboard**: http://localhost:3000/health
- **MongoDB Admin**: http://localhost:8081
- **Redis Admin**: http://localhost:8082

## ⚙️ Configuration

### Environment Variables
```bash
# Processing Configuration
OCR_SIMULATION_DELAY_MS=5000        # OCR processing delay (default: 5s)
VALIDATION_SIMULATION_DELAY_MS=3000  # Validation delay (default: 3s)
PERSISTENCE_SIMULATION_DELAY_MS=2000 # Persistence delay (default: 2s)

# Storage Configuration
LOCAL_STORAGE_PATH=uploads/          # Local storage directory
MAX_FILE_SIZE=10485760              # Max file size (10MB)
STORAGE_PROVIDER=local              # Storage provider (local/s3)

# Queue Configuration
REDIS_URL=redis://localhost:6379    # Redis connection
QUEUE_CONCURRENCY=5                 # Concurrent job processing

# Database
MONGODB_URI=mongodb://localhost:27017/document-pipeline
```

### Supported File Types
- **Documents**: PDF, DOC, DOCX
- **Images**: PNG, JPG, JPEG, GIF
- **Text**: TXT, RTF
- **Maximum Size**: 10MB per file

## 🏗️ Architecture

### Domain-Driven Design Structure
```
src/modules/document-processing/
├── domain/
│   ├── entities/          # Document entity with business logic
│   ├── enums/            # Document status and types
│   └── value-objects/    # Immutable value objects
├── application/
│   ├── services/         # Application services
│   └── use-cases/        # Business use cases
├── infrastructure/
│   ├── storage/          # File storage abstraction
│   ├── processors/       # OCR, validation, persistence
│   ├── repositories/     # Data access layer
│   └── queue/           # Background job processing
└── presentation/
    └── controllers/      # HTTP API endpoints
```

### Processing Pipeline
```
📤 Upload → 🔄 Queue → 🔍 OCR → ✅ Validate → 💾 Persist → ✅ Complete
                ↓         ↓        ↓         ↓
              🚫 Cancel  🚫 Cancel 🚫 Cancel 🚫 Cancel
```

## 🧪 Development & Testing

### Run Tests
```bash
npm test                    # Run all 180 tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Code Quality
```bash
npm run lint               # Check linting (0 errors)
npm run lint:fix           # Auto-fix issues
npm run type-check         # TypeScript validation
npm run validate           # Full validation pipeline
```

### Development Commands
```bash
npm run start:dev          # Hot reload development
npm run docker:services    # Start only services
npm run docker:up          # Full Docker environment
npm run docker:down        # Stop all services
```

## 🚀 Production Deployment

### Docker Production Build
```bash
# Build production image
npm run docker:build

# Run with production environment
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://prod-mongo:27017/docs \
  -e REDIS_URL=redis://prod-redis:6379 \
  document-pipeline
```

### Environment Setup
1. **MongoDB**: Persistent storage with replica sets
2. **Redis**: Queue and caching layer
3. **File Storage**: Configure S3 or persistent volumes
4. **Monitoring**: Health checks and logging
5. **Scaling**: Horizontal scaling with load balancers

## 🔍 Troubleshooting

**App won't start?**
- Make sure Docker services are running: `npm run docker:services`
- Check if ports 3000, 27017, 6379 are available
- Verify Node.js version: `node --version` (requires 18+)

**Tests failing?**
- Run `npm run lint` to check for code issues
- Make sure all dependencies are installed: `npm install`
- Check MongoDB/Redis connections in Docker

**Docker issues?**
- Stop all services: `npm run docker:down`
- Start fresh: `npm run docker:services`
- Check Docker daemon is running

**File upload errors?**
- Verify file size is under 10MB
- Check supported file types: PDF, DOC, DOCX, PNG, JPG, TXT
- Ensure `uploads/` directory has write permissions

**Processing stuck?**
- Check Redis queue status: http://localhost:8082
- Monitor logs: `docker logs <container-name>`
- Restart services if needed: `npm run docker:down && npm run docker:services`

---

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

For questions or issues:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the comprehensive test suite for usage examples
