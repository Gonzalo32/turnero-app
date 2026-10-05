import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Envuelve un handler async con el formato uniforme { success, data, message } (AGENTS.md §43). */
export function handle(fn: (req: Request) => Promise<unknown>, message: string | null = null, status = 200): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json({ success: true, data: (await fn(req)) ?? null, message });
    } catch (err) {
      next(err);
    }
  };
}
