import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { isDev } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/** Errores de Mongoose/Mongo que son culpa del request, no del servidor. */
function clientErrorFor(err: AppError): { statusCode: number; message: string; code: string } | null {
  if (err.name === 'CastError' || err.name === 'ValidationError') {
    return { statusCode: 400, message: 'Datos inválidos', code: 'VALIDATION_ERROR' };
  }
  if ((err as { code?: unknown }).code === 11000) {
    return { statusCode: 409, message: 'El registro ya existe', code: 'DUPLICATE_KEY' };
  }
  return null;
}

/**
 * Middleware centralizado de manejo de errores.
 * - Solo los errores creados a propósito (con statusCode) exponen su mensaje al cliente.
 * - Cualquier error inesperado responde un 500 genérico; el detalle queda en el log del servidor.
 * - Formato uniforme: { success: false, data: null, message, code }
 */
export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const known = clientErrorFor(err);
  const statusCode = known?.statusCode ?? err.statusCode ?? 500;
  const expected = known !== null || err.statusCode !== undefined;
  const message = known?.message ?? (expected ? err.message : 'Error interno del servidor');
  const code = known?.code ?? (expected && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR');

  if (statusCode >= 500) logger.error(`[${code}] ${err.message}`, isDev ? err.stack : '');
  else logger.warn(`[${code}] ${message}`);

  res.status(statusCode).json({
    success: false,
    data: null,
    message,
    code: statusCode >= 500 ? 'INTERNAL_ERROR' : code,
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
