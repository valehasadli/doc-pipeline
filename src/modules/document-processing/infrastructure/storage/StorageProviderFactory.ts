import { IFileStorageProvider, IStorageProviderConfig } from './interfaces/IFileStorageProvider';
import { LocalFileStorageProvider } from './providers/LocalFileStorageProvider';
import { S3FileStorageProvider } from './providers/S3FileStorageProvider';

/**
 * Factory for creating storage provider instances based on configuration
 */
export class StorageProviderFactory {
  private static instance: IFileStorageProvider | null = null;

  /**
   * Create storage provider based on configuration
   */
  public static create(config?: IStorageProviderConfig): IFileStorageProvider {
    // Use singleton pattern to avoid multiple instances
    if (this.instance) {
      return this.instance;
    }

    const providerType = config?.provider ?? this.getProviderFromEnv();

    switch (providerType) {
      case 'local':
        this.instance = new LocalFileStorageProvider(config?.local?.basePath);
        break;
        
      case 's3':
        if (!config?.s3) {
          throw new Error('S3 configuration is required when using S3 provider');
        }
        this.instance = new S3FileStorageProvider({
          bucketName: config.s3.bucketName,
          region: config.s3.region,
          ...(config.s3.accessKeyId && { accessKeyId: config.s3.accessKeyId }),
          ...(config.s3.secretAccessKey && { secretAccessKey: config.s3.secretAccessKey }),
          ...(config.s3.endpoint && { endpoint: config.s3.endpoint })
        });
        break;
        
      default:
        throw new Error(`Unsupported storage provider: ${providerType}`);
    }

    return this.instance;
  }

  /**
   * Create storage provider from environment variables
   */
  public static createFromEnv(): IFileStorageProvider {
    const providerType = this.getProviderFromEnv();
    
    const config: IStorageProviderConfig = {
      provider: providerType,
      local: {
        basePath: process.env['LOCAL_STORAGE_PATH'] ?? 'uploads/',
        ...(process.env['LOCAL_TEMP_PATH'] && { tempPath: process.env['LOCAL_TEMP_PATH'] }),
        ...(process.env['LOCAL_PERMANENT_PATH'] && { permanentPath: process.env['LOCAL_PERMANENT_PATH'] })
      },
      s3: {
        bucketName: process.env['S3_BUCKET_NAME'] ?? '',
        region: process.env['S3_REGION'] ?? 'us-east-1',
        ...(process.env['AWS_ACCESS_KEY_ID'] && { accessKeyId: process.env['AWS_ACCESS_KEY_ID'] }),
        ...(process.env['AWS_SECRET_ACCESS_KEY'] && { secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] }),
        ...(process.env['S3_ENDPOINT'] && { endpoint: process.env['S3_ENDPOINT'] })
      }
    };

    return this.create(config);
  }

  /**
   * Get provider type from environment variables
   */
  private static getProviderFromEnv(): 'local' | 's3' {
    const provider = process.env['STORAGE_PROVIDER']?.toLowerCase();
    
    if (provider === 's3') {
      return 's3';
    }
    
    return 'local'; // Default to local
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static reset(): void {
    this.instance = null;
  }

  /**
   * Get current instance (if any)
   */
  public static getInstance(): IFileStorageProvider | null {
    return this.instance;
  }
}
