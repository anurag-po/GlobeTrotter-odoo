import type { AppError } from '../errors/app-error.js';

export type Result<T, E = AppError> =
  | { ok: true; value: T; error?: never }
  | { ok: false; error: E; value?: never };

export const Ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const Err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
