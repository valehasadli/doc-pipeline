import mongoose from 'mongoose';

/**
 * MongoDB connection manager
 * Handles database connection lifecycle
 */
export class MongoConnection {
  private static instance: MongoConnection | undefined;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): MongoConnection {
    if (MongoConnection.instance === undefined) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  /**
   * Connect to MongoDB
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const mongoUri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/document-processing';
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });

      this.isConnected = true;
      
      // Handle connection events
      mongoose.connection.on('error', () => {
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
      });

    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await mongoose.disconnect();
    this.isConnected = false;
  }

  /**
   * Check if connected to MongoDB
   */
  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get MongoDB connection health info
   */
  public getHealthInfo(): {
    connected: boolean;
    readyState: number;
    host?: string;
    port?: number;
    name?: string;
  } {
    const connection = mongoose.connection;
    return {
      connected: this.isConnected,
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
    };
  }
}
