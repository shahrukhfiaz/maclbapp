import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): Response {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    } else {
      logger.warn({ err }, err.message);
    }
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      details: err.details,
    });
  }

  logger.error({ err }, 'Unexpected error');
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
