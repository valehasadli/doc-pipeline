import 'reflect-metadata';
import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoConnection } from '../src/modules/document-processing/infrastructure/database/connection/MongoConnection';
import { DocumentModel } from '../src/modules/document-processing/infrastructure/database/models/DocumentModel';

async function migrateDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await MongoConnection.getInstance().connect();
    console.log('✅ MongoDB connected');

    // Create collections and indexes
    console.log('📋 Creating collections and indexes...');
    
    // This will create the collection and apply indexes
    await DocumentModel.createCollection();
    console.log('✅ Documents collection created');

    // Create some sample data to verify everything works
    console.log('📝 Creating sample document...');
    const sampleDoc = new DocumentModel({
      documentId: 'sample-doc-001',
      filePath: '/uploads/sample.pdf',
      status: 'completed',
      metadata: {
        fileName: 'sample-document.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date()
      },
      ocrResult: {
        extractedText: 'This is a sample document for testing purposes.',
        confidence: 0.95,
        extractedAt: new Date()
      },
      validationResult: {
        isValid: true,
        errors: [],
        validatedAt: new Date()
      },
      processingStages: {
        ocr: { status: 'completed', completedAt: new Date() },
        validation: { status: 'completed', completedAt: new Date() },
        persistence: { status: 'completed', completedAt: new Date() }
      }
    });

    await sampleDoc.save();
    console.log('✅ Sample document created');

    // Verify collections exist
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log('📊 Collections in database:', collections?.map((c: any) => c.name));

    // Count documents
    const docCount = await DocumentModel.countDocuments();
    console.log(`📈 Total documents: ${docCount}`);

    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await MongoConnection.getInstance().disconnect();
    console.log('🔌 MongoDB disconnected');
    process.exit(0);
  }
}

// Run migration
migrateDatabase();
