import { correlationContext } from './correlation.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'jwtSecret',
  'secret',
  'apiKey',
  'storageSecretKey',
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redact);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const logger = {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const ctx = correlationContext.get();
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: ctx?.correlationId,
      userId: ctx?.userId,
      message,
      ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
    };

    const out = JSON.stringify(logEntry);
    if (level === 'error') {
      console.error(out);
    } else if (level === 'warn') {
      console.warn(out);
    } else {
      console.log(out);
    }
  },

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  },

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  },
};
