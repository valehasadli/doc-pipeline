import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

import { IDocumentMetadata, IOCRResult, IValidationResult } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';

/**
 * MongoDB document schema interface
 */
export interface IDocumentDocument extends MongoDocument {
  documentId: string;
  filePath: string;
  metadata: IDocumentMetadata;
  status: DocumentStatus;
  ocrResult?: IOCRResult;
  validationResult?: IValidationResult;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata schema
 */
const MetadataSchema = new Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, required: true }
}, { _id: false });

/**
 * OCR result schema
 */
const OCRResultSchema = new Schema({
  extractedText: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  extractedAt: { type: Date, required: true }
}, { _id: false });

/**
 * Validation result schema
 */
const ValidationResultSchema = new Schema({
  isValid: { type: Boolean, required: true },
  errors: [{ type: String }],
  validatedAt: { type: Date, required: true }
}, { _id: false });

/**
 * Document schema
 */
const DocumentSchema = new Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  filePath: {
    type: String,
    required: true
  },
  metadata: {
    type: MetadataSchema,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(DocumentStatus),
    required: true,
    index: true
  },
  ocrResult: {
    type: OCRResultSchema,
    required: false
  },
  validationResult: {
    type: ValidationResultSchema,
    required: false
  }
}, {
  timestamps: true,
  collection: 'documents'
});

// Indexes for better query performance
DocumentSchema.index({ documentId: 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ createdAt: -1 });
DocumentSchema.index({ 'metadata.fileName': 1 });
DocumentSchema.index({ 'metadata.mimeType': 1 });

// Compound indexes
DocumentSchema.index({ status: 1, createdAt: -1 });
DocumentSchema.index({ documentId: 1, status: 1 });

export const DocumentModel = mongoose.model<IDocumentDocument>('Document', DocumentSchema);
