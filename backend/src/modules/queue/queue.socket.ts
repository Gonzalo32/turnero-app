import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import { IAtencion } from '../atenciones/atencion.model';
import { IPaciente } from '../patients/patient.model';
import { QUEUE_EVENTS, QueueEntryPublic } from './queue.types';
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

    socket.on('queue:join-tv', () => {
      socket.join('queue:tv');
      logger.debug(`[Socket] ${socket.id} se unió a sala general queue:tv`);
    });

    socket.on('queue:leave-tv', () => {
      socket.leave('queue:tv');
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Cliente desconectado: ${socket.id}`);
    });
  });
}

/**
 * Datos mínimos de una atención para la pantalla del profesional (AGENTS.md §58).
 * Espera la atención con patientId populado (dni, nombre, apellido).
 */
export function toPublicEntry(a: IAtencion): QueueEntryPublic {
  const p = a.patientId instanceof Types.ObjectId ? undefined : (a.patientId as IPaciente);
  return {
    _id: a._id.toString(),
    patientId: p?._id ?? (a.patientId as Types.ObjectId),
    patientFirstName: p?.nombre ?? '',
    patientLastName: p?.apellido ?? '',
    patientDni: p?.dni ?? '',
    healthInsurance: a.obraSocial,
    professionalId: a.professionalId,
    office: a.consultorio,
    status: a.estado,
    visitNumber: a.numeroVisita,
    joinedAt: a.fecha,
    calledAt: a.llamadoAt,
    attentionStartedAt: a.inicioAtencionAt,
    completedAt: a.finalizadoAt,
    cancelledAt: a.canceladoAt,
  };
}

/** Emite el evento a la sala del profesional dueño de la entrada y a la sala general del turnero de TV */
function emitToProfessional(event: string, entry: IAtencion): void {
  if (!io) return;
  const publicEntry = toPublicEntry(entry);
  const room = `professional:${entry.professionalId.toString()}`;
  io.to(room).emit(event, publicEntry);
  io.to('queue:tv').emit(event, publicEntry);
  logger.debug(`[Socket] ${event} emitido a ${room} y queue:tv`);
}

export const emitPatientAdded = (e: IAtencion) => emitToProfessional(QUEUE_EVENTS.PATIENT_ADDED, e);
export const emitPatientCalled = (e: IAtencion) => emitToProfessional(QUEUE_EVENTS.PATIENT_CALLED, e);
export const emitPatientStarted = (e: IAtencion) => emitToProfessional(QUEUE_EVENTS.PATIENT_STARTED, e);
export const emitPatientCompleted = (e: IAtencion) => emitToProfessional(QUEUE_EVENTS.PATIENT_COMPLETED, e);
export const emitPatientCancelled = (e: IAtencion) => emitToProfessional(QUEUE_EVENTS.PATIENT_CANCELLED, e);
