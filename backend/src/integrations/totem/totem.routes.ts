import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../../config/env';
import { createError } from '../../middlewares/error.middleware';
import { totemIntegrationService } from './totem.service';

const router = Router();

/** El tótem se autentica con una clave compartida en el header x-totem-api-key (si está configurada). */
function requireTotemApiKey(req: Request, _res: Response, next: NextFunction): void {
  if (!config.totemApiKey) {
    return next();
  }
  const received = Buffer.from(req.header('x-totem-api-key') ?? '');
  const expected = Buffer.from(config.totemApiKey);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return next(createError('No autorizado', 401, 'UNAUTHORIZED'));
  }
  next();
}

/**
 * POST /api/v1/integrations/totem/patient
 * El tótem llama este endpoint cuando un paciente finaliza el registro.
 */
router.post('/patient', requireTotemApiKey, async (req, res, next) => {
  try {
    const { _id, dni, nombre, apellido } = req.body ?? {};
    if (![_id, dni, nombre, apellido].every((v) => typeof v === 'string' && v.trim())) {
      throw createError('Faltan _id, dni, nombre o apellido', 400, 'INVALID_TOTEM_PAYLOAD');
    }
    await totemIntegrationService.processTotemPatient(req.body);
    res.json({ success: true, data: null, message: 'Paciente procesado' });
  } catch (err) {
    next(err);
  }
});

export default router;
