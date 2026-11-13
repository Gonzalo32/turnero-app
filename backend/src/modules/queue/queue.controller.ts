import { Request, Response, NextFunction } from 'express';
import { queueService } from './queue.service';
import { QueueSource, CreateQueueEntryDto } from './queue.types';
import { IAtencion } from '../atenciones/atencion.model';
import { toPublicEntry, toTvEntry } from './queue.socket';
import type { AuthUser } from '../../middlewares/auth.middleware';

/**
 * Controller del módulo queue.
 * Responsabilidades: leer params/body, llamar service, formatear respuesta HTTP.
 * NO contiene lógica de negocio (AGENTS.md §32). Los eventos los emite el service.
 *
 * Formato de respuesta uniforme (AGENTS.md §43): { success, data, message, code? }
 */

/** Adapta una transición de estado (:id → entrada actualizada) a un handler Express */
function transition(action: (id: string, actor: AuthUser) => Promise<IAtencion>, message: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = await action(req.params['id'], req.user!);
      res.json({ success: true, data: toPublicEntry(entry), message });
    } catch (err) {
      next(err);
    }
  };
}

/** GET /api/v1/queue */
export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.query['professionalId'];
    const professionalId = typeof raw === 'string' && raw ? raw : undefined;
    const entries = await queueService.getActiveQueue(professionalId, req.user!);
    // Sin filtro es la vista general (pantalla de TV): no lleva DNI ni obra social (AGENTS.md §58).
    const data = professionalId ? entries.map(toPublicEntry) : entries.map(toTvEntry);
    res.json({ success: true, data, message: null });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/queue — alta manual */
export async function addToQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: CreateQueueEntryDto = {
      patientFirstName: req.body.patientFirstName,
      patientLastName: req.body.patientLastName,
      patientDni: req.body.patientDni,
      healthInsurance: req.body.healthInsurance,
      professionalId: req.body.professionalId,
      office: req.body.office,
      source: QueueSource.MANUAL,
    };
    const { entry, created } = await queueService.addToQueue(dto);
    res.status(created ? 201 : 200).json({
      success: true,
      data: toPublicEntry(entry),
      message: created ? 'Paciente agregado a la cola' : 'El paciente ya estaba en la cola',
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/queue/:id/call */
export const callPatient = transition((id, actor) => queueService.callPatient(id, actor), 'Paciente llamado');
/** PATCH /api/v1/queue/:id/start */
export const startAttention = transition((id, actor) => queueService.startAttention(id, actor), 'Atención iniciada');
/** PATCH /api/v1/queue/:id/complete */
export const completeAttention = transition((id, actor) => queueService.completeAttention(id, actor), 'Atención completada');
/** PATCH /api/v1/queue/:id/cancel */
export const cancelEntry = transition((id, actor) => queueService.cancelEntry(id, actor), 'Entrada cancelada');
