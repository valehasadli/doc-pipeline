import multer from 'multer';

/**
 * Multer configuration for file uploads
 * Handles file type validation and upload constraints at presentation layer
 */
const localStoragePath = process.env['LOCAL_STORAGE_PATH'] ?? 'uploads/';
const maxFileSize = parseInt(process.env['MAX_FILE_SIZE'] ?? '10485760', 10);

export const uploadMiddleware = multer({
  dest: localStoragePath,
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    // Accept common document types (consolidated from use case validation)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and text documents are allowed.'));
    }
  }
});
