/**
 * File storage provider interface
 * Abstracts file operations to support multiple storage backends (local, S3, etc.)
 */
export interface IFileStorageProvider {
  /**
   * Upload a file to storage
   * @param fileBuffer - File content as buffer
   * @param filePath - Destination path/key for the file
   * @param metadata - Optional metadata for the file
   * @returns Promise resolving to the stored file path/URL
   */
  upload(fileBuffer: Buffer, filePath: string, metadata?: IFileMetadata): Promise<string>;

  /**
   * Download a file from storage
   * @param filePath - Path/key of the file to download
   * @returns Promise resolving to file content as buffer
   */
  download(filePath: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param filePath - Path/key of the file to delete
   * @returns Promise resolving when deletion is complete
   */
  delete(filePath: string): Promise<void>;

  /**
   * Check if a file exists in storage
   * @param filePath - Path/key of the file to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Get a public URL for accessing the file
   * @param filePath - Path/key of the file
   * @param expiresIn - Optional expiration time for signed URLs (in seconds)
   * @returns Promise resolving to the file URL
   */
  getUrl(filePath: string, expiresIn?: number): Promise<string>;

  /**
   * Move a file from one location to another within storage
   * @param sourcePath - Current path/key of the file
   * @param destinationPath - New path/key for the file
   * @returns Promise resolving when move is complete
   */
  move(sourcePath: string, destinationPath: string): Promise<void>;

  /**
   * Get file metadata
   * @param filePath - Path/key of the file
   * @returns Promise resolving to file metadata
   */
  getMetadata(filePath: string): Promise<IFileMetadata>;
}

/**
 * File metadata interface
 */
export interface IFileMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt?: Date;
  lastModified?: Date;
  contentHash?: string;
  customMetadata?: Record<string, string> | undefined;
}

/**
 * Storage provider configuration
 */
export interface IStorageProviderConfig {
  provider: 'local' | 's3';
  local?: {
    basePath: string;
    tempPath?: string;
    permanentPath?: string;
  };
  s3?: {
    bucketName: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  };
}
