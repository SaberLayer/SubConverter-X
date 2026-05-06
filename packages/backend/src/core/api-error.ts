import type { Response } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function sendError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
