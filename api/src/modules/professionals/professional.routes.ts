import { Router } from 'express';
import { getProfessionals, getProfessionalById } from './professional.controller';

const router = Router();

/** GET /api/v1/professionals — Lista profesionales activos */
router.get('/', getProfessionals);

/** GET /api/v1/professionals/:id — Detalle de un profesional */
router.get('/:id', getProfessionalById);

export default router;
