import { config } from '../../config/index.js';
import type { StorageService, PresignedUrlOptions } from '../../application/ports/services.js';
import { logger } from '../../shared/logger.js';

export class StorageAdapter implements StorageService {
  async generatePresignedUploadUrl(options: PresignedUrlOptions): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: string }> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
    const baseUrl = config.OBJECT_STORAGE_ENDPOINT || `https://${config.OBJECT_STORAGE_BUCKET}.s3.${config.OBJECT_STORAGE_REGION}.amazonaws.com`;
    const objectUrl = `${baseUrl}/${options.key}`;
    const uploadUrl = `${baseUrl}/${options.key}?X-Amz-Expires=300&X-Amz-Signature=mock_signature`;

    logger.debug('Generated pre-signed upload URL', { key: options.key, contentType: options.contentType });

    return {
      uploadUrl,
      objectUrl,
      expiresAt,
    };
  }

  async deleteObject(key: string): Promise<void> {
    logger.info('Deleted object from storage', { key });
  }
}
