import { Router } from 'express';
import {
  getProfessionals,
  getProfessionalById,
  createProfessional,
  updateProfessional,
  deactivateProfessional
} from './professional.controller';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from './professional.model';

const router = Router();
const adminOnly = requireRole(UserRole.ADMIN);

router.use(requireAuth);

/** GET /api/v1/professionals — Lista profesionales activos (datos completos solo para admin) */
router.get('/', getProfessionals);

/** GET /api/v1/professionals/:id — Detalle de un profesional */
router.get('/:id', adminOnly, getProfessionalById);

/** POST /api/v1/professionals — Crear nuevo odontólogo */
router.post('/', adminOnly, createProfessional);

/** PUT /api/v1/professionals/:id — Actualizar datos de un odontólogo */
router.put('/:id', adminOnly, updateProfessional);

/** DELETE /api/v1/professionals/:id — Desactivación lógica (soft delete) */
router.delete('/:id', adminOnly, deactivateProfessional);

export default router;
