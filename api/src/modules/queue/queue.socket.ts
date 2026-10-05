import { Server as SocketIOServer } from 'socket.io';
import { IPatient } from '../patients/patient.model';
import { QUEUE_EVENTS } from './queue.types';
import { logger } from '../../utils/logger';

let io: SocketIOServer | null = null;

export function initQueueSocket(socketServer: SocketIOServer): void {
  io = socketServer;

  io.on('connection', (socket) => {
    logger.info(`[Socket] Cliente conectado: ${socket.id}`);

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

export function emitPatientAdded(entry: IPatient | any): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  if (entry.profesionalId || entry.professionalId) {
    const profId = (entry.profesionalId || entry.professionalId).toString();
    io.to(`professional:${profId}`).emit(QUEUE_EVENTS.PATIENT_ADDED, payload);
  }
  io.emit(QUEUE_EVENTS.PATIENT_ADDED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_ADDED} emitido: ${entry._id}`);
}

export function emitPatientCalled(entry: IPatient | any): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  if (entry.profesionalId || entry.professionalId) {
    const profId = (entry.profesionalId || entry.professionalId).toString();
    io.to(`professional:${profId}`).emit(QUEUE_EVENTS.PATIENT_CALLED, payload);
  }
  io.emit(QUEUE_EVENTS.PATIENT_CALLED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_CALLED} emitido: ${entry._id}`);
}

export function emitPatientStarted(entry: IPatient | any): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  if (entry.profesionalId || entry.professionalId) {
    const profId = (entry.profesionalId || entry.professionalId).toString();
    io.to(`professional:${profId}`).emit(QUEUE_EVENTS.PATIENT_STARTED, payload);
  }
  io.emit(QUEUE_EVENTS.PATIENT_STARTED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_STARTED} emitido: ${entry._id}`);
}

export function emitPatientCompleted(entry: IPatient | any): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  if (entry.profesionalId || entry.professionalId) {
    const profId = (entry.profesionalId || entry.professionalId).toString();
    io.to(`professional:${profId}`).emit(QUEUE_EVENTS.PATIENT_COMPLETED, payload);
  }
  io.emit(QUEUE_EVENTS.PATIENT_COMPLETED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_COMPLETED} emitido: ${entry._id}`);
}

export function emitPatientCancelled(entry: IPatient | any): void {
  if (!io) return;
  const payload = sanitizeEntry(entry);
  if (entry.profesionalId || entry.professionalId) {
    const profId = (entry.profesionalId || entry.professionalId).toString();
    io.to(`professional:${profId}`).emit(QUEUE_EVENTS.PATIENT_CANCELLED, payload);
  }
  io.emit(QUEUE_EVENTS.PATIENT_CANCELLED, payload);
  logger.debug(`[Socket] ${QUEUE_EVENTS.PATIENT_CANCELLED} emitido: ${entry._id}`);
}

function sanitizeEntry(entry: IPatient | any): object {
  const p = entry.toObject ? entry.toObject() : entry;
  const nombre = p.nombre || p.patientFirstName || '';
  const apellido = p.apellido || p.patientLastName || '';
  const dni = p.dni || p.patientDni || '';
  const obraSocial = p.obraSocial || p.healthInsurance || 'Particular';
  const profId = p.profesionalId || p.professionalId;
  const estado = p.estado || p.status || 'WAITING';

  return {
    _id: p._id,
    dni,
    nombre,
    apellido,
    obraSocial,
    profesional: p.profesional,
    profesionalId: profId,
    estado,
    status: estado,
    totalVisitas: p.totalVisitas || 1,
    cambiosProfesional: p.cambiosProfesional || [],
    visitas: p.visitas || [],
    // Compatibilidad
    patientFirstName: nombre,
    patientLastName: apellido,
    patientDni: dni,
    healthInsurance: obraSocial,
    professionalId: profId,
    joinedAt: p.joinedAt || p.createdAt,
    calledAt: p.calledAt,
    attentionStartedAt: p.attentionStartedAt,
    completedAt: p.completedAt,
    cancelledAt: p.cancelledAt,
  };
}
