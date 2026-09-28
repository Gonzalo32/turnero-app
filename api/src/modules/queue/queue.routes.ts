import { Router } from 'express';
import {
  getQueue,
  addToQueue,
  callPatient,
  startAttention,
  completeAttention,
  cancelEntry,
} from './queue.controller';

/**
 * Rutas del módulo queue.
 * Prefijo: /api/v1/queue (versionado según AGENTS.md §42)
 */
const router = Router();

/** Obtener cola activa (opcionalmente por profesional) */
router.get('/', getQueue);

/** Agregar paciente a la cola */
router.post('/', addToQueue);

/** Llamar paciente (WAITING → CALLED) */
router.patch('/:id/call', callPatient);

/** Iniciar atención (CALLED → IN_ATTENTION) */
router.patch('/:id/start', startAttention);

/** Completar atención (→ COMPLETED) */
router.patch('/:id/complete', completeAttention);

/** Cancelar entrada (→ CANCELLED) */
router.patch('/:id/cancel', cancelEntry);

export default router;
