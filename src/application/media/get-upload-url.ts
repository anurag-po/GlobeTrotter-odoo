import type { StorageService } from '../ports/services.js';
import { generateUuid } from '../../shared/utils/uuid.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface UploadUrlInput {
  contentType: string;
  purpose: 'profile' | 'cover' | 'attachment';
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function makeGetUploadUrlUseCase(deps: { storageService: StorageService }) {
  return async (
    userId: string,
    input: UploadUrlInput
  ): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: string }> => {
    if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
      throw AppError.validation('Invalid content type. Allowed formats: image/jpeg, image/png, image/webp');
    }

    const ext = input.contentType.split('/')[1] || 'jpg';
    const key = `${userId}/${generateUuid()}.${ext}`;
    const maxSizeBytes = input.purpose === 'attachment' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;

    return deps.storageService.generatePresignedUploadUrl({
      key,
      contentType: input.contentType,
      maxSizeBytes,
    });
  };
}
