import type { UserRepository } from '../ports/repositories.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCodes } from '../../shared/errors/error-codes.js';
import type { UserProps } from '../../domain/entities/user.js';

export function makeGetProfileUseCase(deps: { userRepo: UserRepository }) {
  return async (userId: string): Promise<UserProps> => {
    const user = await deps.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }
    return user.props;
  };
}
