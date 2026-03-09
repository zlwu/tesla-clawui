import type { AppError } from '@tesla-openclaw/shared';

export class AppException extends Error {
  public readonly statusCode: number;
  public readonly payload: AppError;

  public constructor(statusCode: number, payload: AppError) {
    super(payload.message);
    this.name = 'AppException';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export const toErrorResponse = (error: AppError) => ({
  ok: false as const,
  error,
});
