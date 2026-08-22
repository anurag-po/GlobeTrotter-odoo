import type { UserRepository } from '../ports/repositories.js';
import type { StorageService, JobService } from '../ports/services.js';
import type { UserProps } from '../../domain/entities/user.js';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  additionalInfo?: string | null;
  photoUrl?: string | null;
  languagePreference?: string;
  notificationPreferences?: Record<string, unknown>;
}

export function makeUpdateProfileUseCase(deps: {
  userRepo: UserRepository;
  storageService?: StorageService;
  jobService?: JobService;
}) {
  return async (userId: string, input: UpdateProfileInput): Promise<UserProps> => {
    const existing = await deps.userRepo.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    // ARCH-032: silently ignore email/username updates
    const updated = await deps.userRepo.update(userId, {
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      phoneNumber: input.phoneNumber !== undefined ? input.phoneNumber : existing.phoneNumber,
      city: input.city !== undefined ? input.city : existing.city,
      country: input.country !== undefined ? input.country : existing.country,
      additionalInfo: input.additionalInfo !== undefined ? input.additionalInfo : existing.additionalInfo,
      photoUrl: input.photoUrl !== undefined ? input.photoUrl : existing.photoUrl,
      languagePreference: input.languagePreference ?? existing.languagePreference,
      notificationPreferences: input.notificationPreferences ?? existing.notificationPreferences,
    });

    return updated.props;
  };
}
