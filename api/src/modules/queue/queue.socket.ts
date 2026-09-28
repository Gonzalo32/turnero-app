import { Server as SocketIOServer } from 'socket.io';
import { IQueueEntry } from './queue.model';
import { QUEUE_EVENTS } from './queue.types';
import { logger } from '../../utils/logger';

/**
 * Eventos Socket.IO para el módulo queue.
 *
 * Regla (AGENTS.md §22): Socket.IO notifica DESPUÉS de que MongoDB confirma la persistencia.
 * Regla (AGENTS.md §23): Socket.IO comunica, MongoDB almacena.
 * Regla (AGENTS.md §26): Nombres de eventos claros y consistentes.
 */

let io: SocketIOServer | null = null;

export function initQueueSocket(socketServer: SocketIOServer): void {
  io = socketServer;

  io.on('connection', (socket) => {
    logger.info(`[Socket] Cliente conectado: ${socket.id}`);

    /**
     * El cliente puede unirse a una sala por profesionalId.
     * Así solo recibe eventos relevantes para su profesional.
     */
    socket.on('queue:join-professional', (professionalId: string) => {
      socket.join(`professional:${professionalId}`);
      logger.debug(`[Socket] ${socket.id} se unió a sala professional:${professionalId}`);
    });

    socket.on('queue:leave-professional', (professionalId: string) => {
      socket.leave(`professional:${professionalId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Cliente desconectado: ${socket.id}`);
    });
  });
}

/** Emite que un paciente fue agregado a la cola */
export function emitPatientAdded(entry: IQueueEntry): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  // Emitir al profesional específico y al room global
  io.to(`professional:${entry.professionalId}`).emit(QUEUE_EVENTS.PATIENT_ADDED, payload);
  io.emit(QUEUE_EVENTS.PATIENT_ADDED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_ADDED} emitido: ${entry._id}`);
}

/** Emite que un paciente fue llamado */
export function emitPatientCalled(entry: IQueueEntry): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  io.to(`professional:${entry.professionalId}`).emit(QUEUE_EVENTS.PATIENT_CALLED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_CALLED} emitido: ${entry._id}`);
}

/** Emite que un paciente inició atención */
export function emitPatientStarted(entry: IQueueEntry): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  io.to(`professional:${entry.professionalId}`).emit(QUEUE_EVENTS.PATIENT_STARTED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_STARTED} emitido: ${entry._id}`);
}

/** Emite que un paciente completó su atención */
export function emitPatientCompleted(entry: IQueueEntry): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  io.to(`professional:${entry.professionalId}`).emit(QUEUE_EVENTS.PATIENT_COMPLETED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_COMPLETED} emitido: ${entry._id}`);
}

/** Emite que una entrada fue cancelada */
export function emitPatientCancelled(entry: IQueueEntry): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  io.to(`professional:${entry.professionalId}`).emit(QUEUE_EVENTS.PATIENT_CANCELLED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_CANCELLED} emitido: ${entry._id}`);
}

/**
 * Sanitiza la entrada antes de emitirla por socket.
 * Principio de mínima exposición (AGENTS.md §58):
 * no enviar más datos de los necesarios para actualizar la UI.
 */
function sanitizeEntry(entry: IQueueEntry): object {
  return {
    _id: entry._id,
    patientFirstName: entry.patientFirstName,
    patientLastName: entry.patientLastName,
    professionalId: entry.professionalId,
    status: entry.status,
    joinedAt: entry.joinedAt,
    calledAt: entry.calledAt,
    attentionStartedAt: entry.attentionStartedAt,
    completedAt: entry.completedAt,
    cancelledAt: entry.cancelledAt,
  };
}
