import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { createError } from '../../middlewares/error.middleware';

/**
 * Freno a fuerza bruta: 20 intentos fallidos cada 15 minutos por IP.
 * Los logins correctos no cuentan (todo el consultorio suele salir por la misma IP).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(createError('Demasiados intentos. Probá de nuevo en unos minutos.', 429, 'TOO_MANY_REQUESTS')),
});

const router = Router();

router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));

export default router;
