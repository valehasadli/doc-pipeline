import { IFileStorageProvider, IFileMetadata } from '../interfaces/IFileStorageProvider';

/**
 * AWS S3 storage provider placeholder
 * This is a stub implementation that throws errors for all operations.
 * TODO: Implement when S3 integration is needed in the future.
 */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
export class S3FileStorageProvider implements IFileStorageProvider {
  constructor(_config: {
    bucketName: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  }) {
    throw new Error('S3FileStorageProvider is not implemented. Use LocalFileStorageProvider instead.');
  }

  public async upload(_fileBuffer: Buffer, _filePath: string, _metadata?: IFileMetadata): Promise<string> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async download(_filePath: string): Promise<Buffer> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async delete(_filePath: string): Promise<void> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async exists(_filePath: string): Promise<boolean> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async getUrl(_filePath: string, _expiresIn?: number): Promise<string> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async move(_sourcePath: string, _destinationPath: string): Promise<void> {
    throw new Error('S3FileStorageProvider is not implemented');
  }

  public async getMetadata(_filePath: string): Promise<IFileMetadata> {
    throw new Error('S3FileStorageProvider is not implemented');
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
