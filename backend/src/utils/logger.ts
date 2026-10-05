import { isDev } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger centralizado.
 * - No registra passwords, tokens, MONGODB_URI ni datos completos de pacientes.
 * - En producción omite logs de debug.
 */
function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (level === 'debug' && !isDev) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (level === 'error') {
    console.error(prefix, message, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
};
