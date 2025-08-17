import { Document } from '@document-processing/domain/entities/Document';
import { DocumentStatus } from '@document-processing/domain/enums/DocumentStatus';
import { IRepository } from '@shared/domain/types/common';

import { DocumentModel, IDocumentDocument } from '../models/DocumentModel';

/**
 * Document repository interface
 * Extends shared repository interface with document-specific methods
 */
export interface IDocumentRepository extends IRepository<Document> {
  findByStatus(status: DocumentStatus): Promise<Document[]>;
  findByStatuses(statuses: DocumentStatus[]): Promise<Document[]>;
  findAll(): Promise<Document[]>;
  exists(id: string): Promise<boolean>;
  getStatistics(): Promise<{
    total: number;
    byStatus: Record<DocumentStatus, number>;
  }>;
}

/**
 * MongoDB implementation of document repository
 */
export class MongoDocumentRepository implements IDocumentRepository {
  /**
   * Save a document to MongoDB
   */
  public async save(document: Document): Promise<void> {
    const persistenceData = document.toPersistenceData();
    
    const documentData = {
      documentId: persistenceData.id,
      filePath: persistenceData.filePath,
      metadata: persistenceData.metadata,
      status: persistenceData.status,
      ocrResult: persistenceData.ocrResult,
      validationResult: persistenceData.validationResult,
      createdAt: persistenceData.createdAt,
      updatedAt: persistenceData.updatedAt
    };

    await DocumentModel.create(documentData);
  }

  /**
   * Find document by ID
   */
  public async findById(id: string): Promise<Document | null> {
    const doc = await DocumentModel.findOne({ documentId: id }).exec();
    
    if (!doc) {
      return null;
    }

    return this.mapToDocument(doc);
  }

  /**
   * Find documents by status
   */
  public async findByStatus(status: DocumentStatus): Promise<Document[]> {
    const docs = await DocumentModel.find({ status }).sort({ createdAt: -1 }).exec();
    
    return docs.map(doc => this.mapToDocument(doc));
  }

  /**
   * Find documents by multiple statuses
   */
  public async findByStatuses(statuses: DocumentStatus[]): Promise<Document[]> {
    const docs = await DocumentModel.find({ status: { $in: statuses } }).sort({ createdAt: -1 }).exec();
    
    return docs.map(doc => this.mapToDocument(doc));
  }

  /**
   * Find all documents
   */
  public async findAll(): Promise<Document[]> {
    const docs = await DocumentModel.find({}).sort({ createdAt: -1 }).exec();
    
    return docs.map(doc => this.mapToDocument(doc));
  }

  /**
   * Update an existing document
   */
  public async update(document: Document): Promise<void> {
    const persistenceData = document.toPersistenceData();
    
    const updateData = {
      filePath: persistenceData.filePath,
      metadata: persistenceData.metadata,
      status: persistenceData.status,
      ocrResult: persistenceData.ocrResult,
      validationResult: persistenceData.validationResult,
      updatedAt: persistenceData.updatedAt
    };

    const result = await DocumentModel.updateOne(
      { documentId: persistenceData.id },
      { $set: updateData }
    ).exec();

    if (result.matchedCount === 0) {
      throw new Error(`Document with ID ${persistenceData.id} not found for update`);
    }
  }

  /**
   * Delete a document by ID
   */
  public async delete(id: string): Promise<void> {
    const result = await DocumentModel.deleteOne({ documentId: id }).exec();
    
    if (result.deletedCount === 0) {
      throw new Error(`Document with ID ${id} not found for deletion`);
    }
  }

  /**
   * Check if document exists
   */
  public async exists(id: string): Promise<boolean> {
    const count = await DocumentModel.countDocuments({ documentId: id }).exec();
    return count > 0;
  }

  /**
   * Map MongoDB document to domain Document entity
   */
  private mapToDocument(doc: IDocumentDocument): Document {
    // Convert Mongoose subdocuments to plain objects to avoid circular references
    const cleanMetadata = {
      fileName: doc.metadata.fileName,
      fileSize: doc.metadata.fileSize,
      mimeType: doc.metadata.mimeType,
      uploadedAt: doc.metadata.uploadedAt
    };

    const document = new Document(
      doc.documentId,
      doc.filePath,
      cleanMetadata,
      doc.status,
      doc.createdAt,
      doc.updatedAt
    );

    // Set OCR result if exists - convert to plain object
    if (doc.ocrResult) {
      const cleanOcrResult = {
        extractedText: doc.ocrResult.extractedText,
        confidence: doc.ocrResult.confidence,
        extractedAt: doc.ocrResult.extractedAt
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).documentOcrResult = cleanOcrResult;
    }

    // Set validation result if exists - convert to plain object
    if (doc.validationResult) {
      const cleanValidationResult = {
        isValid: doc.validationResult.isValid,
        errors: [...doc.validationResult.errors],
        validatedAt: doc.validationResult.validatedAt
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).documentValidationResult = cleanValidationResult;
    }

    return document;
  }

  /**
   * Get repository statistics
   */
  public async getStatistics(): Promise<{
    total: number;
    byStatus: Record<DocumentStatus, number>;
  }> {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];

    const results = await DocumentModel.aggregate(pipeline).exec();
    const total = await DocumentModel.countDocuments().exec();

    const byStatus = Object.values(DocumentStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<DocumentStatus, number>);

    results.forEach((result: { _id: DocumentStatus; count: number }) => {
      byStatus[result._id] = result.count;
    });

    return {
      total,
      byStatus
    };
  }

  /**
   * Find documents with pagination
   */
  public async findWithPagination(
    page: number = 1,
    limit: number = 10,
    status?: DocumentStatus
  ): Promise<{
    documents: Document[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const filter = status !== undefined ? { status } : {};

    const [docs, total] = await Promise.all([
      DocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      DocumentModel.countDocuments(filter).exec()
    ]);

    const documents = docs.map(doc => this.mapToDocument(doc));
    const totalPages = Math.ceil(total / limit);

    return {
      documents,
      total,
      page,
      limit,
      totalPages
    };
  }
}
