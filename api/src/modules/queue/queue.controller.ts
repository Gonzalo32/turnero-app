import { Request, Response, NextFunction } from 'express';
import { queueService } from './queue.service';
import { QueueSource, CreateQueueEntryDto } from './queue.types';
import {
  emitPatientAdded,
  emitPatientCalled,
  emitPatientStarted,
  emitPatientCompleted,
  emitPatientCancelled,
} from './queue.socket';

/**
 * Controller del módulo queue.
 * Responsabilidades: leer params/body, llamar service, formatear respuesta HTTP.
 * NO contiene lógica de negocio (AGENTS.md §32).
 *
 * Formato de respuesta uniforme (AGENTS.md §43): { success, data, message, code? }
 */

/** GET /api/v1/queue */
export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const professionalId = req.query['professionalId'] as string | undefined;
    const entries = await queueService.getActiveQueue(professionalId);
    res.json({ success: true, data: entries, message: null });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/queue */
export async function addToQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: CreateQueueEntryDto = {
      patientFirstName: req.body.patientFirstName,
      patientLastName: req.body.patientLastName,
      patientDni: req.body.patientDni,
      healthInsurance: req.body.healthInsurance,
      professionalId: req.body.professionalId,
      source: req.body.source ?? QueueSource.MANUAL,
      sourceRecordId: req.body.sourceRecordId,
    };

    // 1. Persistir en MongoDB (AGENTS.md §22)
    const entry = await queueService.addToQueue(dto);

    // 2. DESPUÉS de confirmar persistencia, emitir evento Socket.IO
    emitPatientAdded(entry);

    res.status(201).json({ success: true, data: entry, message: 'Paciente agregado a la cola' });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/queue/:id/call */
export async function callPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await queueService.callPatient(req.params['id']);
    emitPatientCalled(entry);
    res.json({ success: true, data: entry, message: 'Paciente llamado' });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/queue/:id/start */
export async function startAttention(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await queueService.startAttention(req.params['id']);
    emitPatientStarted(entry);
    res.json({ success: true, data: entry, message: 'Atención iniciada' });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/queue/:id/complete */
export async function completeAttention(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await queueService.completeAttention(req.params['id']);
    emitPatientCompleted(entry);
    res.json({ success: true, data: entry, message: 'Atención completada' });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/queue/:id/cancel */
export async function cancelEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await queueService.cancelEntry(req.params['id']);
    emitPatientCancelled(entry);
    res.json({ success: true, data: entry, message: 'Entrada cancelada' });
  } catch (err) {
    next(err);
  }
}
