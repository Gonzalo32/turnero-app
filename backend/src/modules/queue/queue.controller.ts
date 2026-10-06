import { Request, Response, NextFunction } from 'express';
import { queueService } from './queue.service';
import { QueueSource, CreateQueueEntryDto } from './queue.types';
import { IQueueEntry } from './queue.model';
import { toPublicEntry } from './queue.socket';
import { QueueEntry } from './queue.model';
import { canAccessProfessional } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';
import { Types } from 'mongoose';

async function assertProfessionalAccess(req: Request, professionalId: string | undefined): Promise<void> {
  if (!professionalId || !(await canAccessProfessional(req.user!, professionalId))) {
    throw createError('No tenés acceso a la cola de este profesional', 403, 'FORBIDDEN');
  }
}

/** Middleware para /:id/* — la entrada debe pertenecer a un profesional al que el usuario accede */
export async function requireEntryAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params['id'];
    const entry = Types.ObjectId.isValid(id) ? await QueueEntry.findById(id).select('professionalId').lean() : null;
    if (entry) await assertProfessionalAccess(req, entry.professionalId.toString());
    next(); // si no existe, el service responde 400/404
  } catch (err) {
    next(err);
  }
}

/**
 * Controller del módulo queue.
 * Responsabilidades: leer params/body, llamar service, formatear respuesta HTTP.
 * NO contiene lógica de negocio (AGENTS.md §32). Los eventos los emite el service.
 *
 * Formato de respuesta uniforme (AGENTS.md §43): { success, data, message, code? }
 */

/** Adapta una transición de estado (:id → entrada actualizada) a un handler Express */
function transition(action: (id: string) => Promise<IQueueEntry>, message: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = await action(req.params['id']);
      res.json({ success: true, data: toPublicEntry(entry), message });
    } catch (err) {
      next(err);
    }
  };
}

/** GET /api/v1/queue */
export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    let professionalId = req.query['professionalId'] as string | undefined;
    // Odontólogo: siempre su propia cola. Otros (salvo admin) deben indicar un profesional permitido.
    if (!professionalId && user.roles.includes('odontologo')) professionalId = user.professionalId;
    if (professionalId || !user.roles.includes('admin')) await assertProfessionalAccess(req, professionalId);
    const entries = await queueService.getActiveQueue(professionalId);
    res.json({ success: true, data: entries.map(toPublicEntry), message: null });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/queue — alta manual */
export async function addToQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await assertProfessionalAccess(req, req.body.professionalId);
    const dto: CreateQueueEntryDto = {
      patientFirstName: req.body.patientFirstName,
      patientLastName: req.body.patientLastName,
      patientDni: req.body.patientDni,
      healthInsurance: req.body.healthInsurance,
      professionalId: req.body.professionalId,
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
export const callPatient = transition((id) => queueService.callPatient(id), 'Paciente llamado');
/** PATCH /api/v1/queue/:id/start */
export const startAttention = transition((id) => queueService.startAttention(id), 'Atención iniciada');
/** PATCH /api/v1/queue/:id/complete */
export const completeAttention = transition((id) => queueService.completeAttention(id), 'Atención completada');
/** PATCH /api/v1/queue/:id/cancel */
export const cancelEntry = transition((id) => queueService.cancelEntry(id), 'Entrada cancelada');
