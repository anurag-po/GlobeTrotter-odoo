import { AppError } from '../../shared/errors/app-error.js';

export const PasswordRules = {
  validate(password: string): void {
    if (!password || password.length < 8) {
      throw AppError.validation('Password must be at least 8 characters long');
    }
    if (!/[a-zA-Z]/.test(password)) {
      throw AppError.validation('Password must contain at least one letter');
    }
    if (!/\d/.test(password)) {
      throw AppError.validation('Password must contain at least one digit');
    }
  },
};
