import { Router } from 'express';
import {
  getProfessionals,
  getProfessionalById,
  createProfessional,
  updateProfessional
} from './professional.controller';

const router = Router();

/** GET /api/v1/professionals — Lista profesionales activos */
router.get('/', getProfessionals);

/** GET /api/v1/professionals/:id — Detalle de un profesional */
router.get('/:id', getProfessionalById);

/** POST /api/v1/professionals — Crear nuevo odontólogo */
router.post('/', createProfessional);

/** PUT /api/v1/professionals/:id — Actualizar datos de un odontólogo */
router.put('/:id', updateProfessional);

export default router;
