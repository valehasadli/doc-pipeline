import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

import { IFileStorageProvider, IFileMetadata } from '../interfaces/IFileStorageProvider';

/**
 * Local filesystem storage provider implementation
 */
export class LocalFileStorageProvider implements IFileStorageProvider {
  private readonly basePath: string;
  private readonly tempPath: string;
  private readonly permanentPath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.env['LOCAL_STORAGE_PATH'] ?? './uploads';
    this.tempPath = path.join(this.basePath, 'temp');
    this.permanentPath = path.join(this.basePath, 'permanent');
    
    // Ensure directories exist
    this.initializeDirectories().catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize directories:', error);
    });
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(this.tempPath, { recursive: true });
    await fs.mkdir(this.permanentPath, { recursive: true });
  }

  /**
   * Upload file to local storage
   */
  public async upload(fileBuffer: Buffer, filePath: string, metadata?: IFileMetadata): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    const directory = path.dirname(fullPath);
    // Creating directory: ${dirPath}.dirname(fullPath);
    
    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, fileBuffer);
    
    // Write metadata if provided
    if (metadata) {
      const metadataPath = `${fullPath}.meta`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    return fullPath;
  }

  /**
   * Download file from local storage
   */
  public async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    return await fs.readFile(fullPath);
  }

  /**
   * Delete file from local storage
   */
  public async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    const metadataPath = `${fullPath}.meta`;
    
    // Delete main file
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // File might not exist, ignore error
    }
    
    // Delete metadata file if exists
    try {
      await fs.unlink(metadataPath);
    } catch (error) {
      // Metadata might not exist, ignore error
    }
  }

  /**
   * Check if file exists in local storage
   */
  public async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get public URL for local file (file:// protocol)
   */
  public async getUrl(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.basePath, filePath);
    return `file://${fullPath}`;
  }

  /**
   * Move file within local storage
   */
  public async move(sourcePath: string, destinationPath: string): Promise<void> {
    const sourceFullPath = path.join(this.basePath, sourcePath);
    const destFullPath = path.join(this.basePath, destinationPath);
    const destDirectory = path.dirname(destFullPath);
    
    // Ensure destination directory exists
    await fs.mkdir(destDirectory, { recursive: true });
    
    // Move main file
    await fs.rename(sourceFullPath, destFullPath);
    
    // Move metadata file if exists
    const sourceMetaPath = `${sourceFullPath}.meta`;
    const destMetaPath = `${destFullPath}.meta`;
    
    try {
      await fs.access(sourceMetaPath);
      await fs.rename(sourceMetaPath, destMetaPath);
    } catch {
      // Metadata file doesn't exist, ignore
    }
  }

  /**
   * Get file metadata from local storage
   */
  public async getMetadata(filePath: string): Promise<IFileMetadata> {
    const fullPath = path.join(this.basePath, filePath);
    const metadataPath = `${fullPath}.meta`;
    
    // Try to read stored metadata first
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch {
      // Fallback to file stats if no metadata file
      const stats = await fs.stat(fullPath);
      const fileName = path.basename(filePath);
      
      // Generate content hash
      const fileBuffer = await fs.readFile(fullPath);
      const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      return {
        fileName,
        mimeType: this.getMimeTypeFromExtension(fileName),
        fileSize: stats.size,
        uploadedAt: stats.birthtime,
        lastModified: stats.mtime,
        contentHash
      };
    }
  }

  /**
   * Get MIME type from file extension (basic implementation)
   */
  private getMimeTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[ext.slice(1)] ?? 'application/octet-stream';
  }

  /**
   * Get temp directory path
   */
  public getTempPath(): string {
    return this.tempPath;
  }

  /**
   * Get permanent directory path
   */
  public getPermanentPath(): string {
    return this.permanentPath;
  }
}
