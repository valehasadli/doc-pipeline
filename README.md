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

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Docker and Docker Compose

### 1. Install Dependencies
```bash
git clone <repository-url>
cd <your_project_name>
npm install
```

### 2. Start Services
```bash
npm run docker:services  # Start MongoDB & Redis
```

### 3. Start Application
```bash
npm run start:dev  # Start with hot reload
```

### 4. Test the API
```bash
# Upload a document
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@document.pdf"

# Check status
curl http://localhost:3000/api/documents/{documentId}

# List documents
curl http://localhost:3000/api/documents
```

## 📖 API Endpoints

### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data
```
Upload PDF, DOC, DOCX, PNG, JPG, TXT files (max 10MB)

### Get Document Status
```http
GET /api/documents/{documentId}
```
Get processing status and results

### List Documents
```http
GET /api/documents?status=completed&limit=10
```
List documents with optional filtering

### Cancel Processing
```http
POST /api/documents/{documentId}/cancel
```
Cancel document processing

### Retry Failed Document
```http
POST /api/documents/{documentId}/retry
```
Retry failed document processing

### Health Check
```http
GET /health
```
System health and service status

## 🧪 Development

### Run Tests
```bash
npm test                 # All 180 tests
npm run test:watch      # Watch mode
```

### Code Quality
```bash
npm run lint            # Check linting
npm run type-check      # TypeScript validation
```

### Docker Commands
```bash
npm run docker:services # Start MongoDB & Redis only
npm run docker:up       # Full environment
npm run docker:down     # Stop all services
```
