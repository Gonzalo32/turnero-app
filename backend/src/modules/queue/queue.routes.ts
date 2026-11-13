import { Router } from 'express';
import {
  getQueue,
  addToQueue,
  callPatient,
  startAttention,
  completeAttention,
  cancelEntry,
} from './queue.controller';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '../professionals/professional.model';

/**
 * Rutas del módulo queue.
 * Prefijo: /api/v1/queue (versionado según AGENTS.md §42)
 */
const router = Router();

// Toda la cola requiere sesión; la pertenencia de cada entrada la valida el service.
router.use(requireAuth);

/** Obtener cola activa (opcionalmente por profesional) */
router.get('/', getQueue);

/** Agregar paciente a la cola (alta manual: solo admin; el tótem usa su propia ruta) */
router.post('/', requireRole(UserRole.ADMIN), addToQueue);

/** Llamar paciente (WAITING → CALLED) */
router.patch('/:id/call', callPatient);

/** Iniciar atención (CALLED → IN_ATTENTION) */
router.patch('/:id/start', startAttention);

/** Completar atención (→ COMPLETED) */
router.patch('/:id/complete', completeAttention);

/** Cancelar entrada (→ CANCELLED) */
router.patch('/:id/cancel', cancelEntry);

export default router;
