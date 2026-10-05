/**
 * Logger frontend — solo emite en development, nunca expone datos sensibles.
 */
export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['__DEV__']) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
};
