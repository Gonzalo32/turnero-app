import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { isDev } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Middleware centralizado de manejo de errores.
 * - Nunca expone stack traces en producción.
 * - Nunca expone credenciales ni detalles internos.
 * - Formato uniforme: { success: false, data: null, message, code }
 */
export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Error interno del servidor';
  const code = err.code ?? 'INTERNAL_ERROR';

  logger.error(`[${code}] ${message}`, isDev ? err.stack : '');

  res.status(statusCode).json({
    success: false,
    data: null,
    message,
    code,
  });
}

/**
 * Helper para crear errores con statusCode y code.
 */
export function createError(message: string, statusCode: number, code: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
