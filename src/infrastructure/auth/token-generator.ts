import { createHash, randomBytes } from 'node:crypto';

export const TokenGenerator = {
  generateToken(): string {
    return randomBytes(32).toString('hex');
  },

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  },
};
