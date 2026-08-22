import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import type { UserRole } from '../../domain/entities/user.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export const JwtService = {
  signAccessToken(userId: string, role: UserRole): string {
    const payload: JwtPayload = {
      sub: userId,
      role,
    };
    return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
      expiresIn: `${config.JWT_ACCESS_TTL_MINUTES}m`,
    });
  },

  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
      if (!decoded.sub || !decoded.role) {
        throw AppError.unauthenticated('Invalid token payload');
      }
      return decoded;
    } catch {
      throw AppError.unauthenticated('Invalid or expired access token');
    }
  },
};
