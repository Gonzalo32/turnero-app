import { Server as SocketIOServer } from 'socket.io';
import { IQueueEntry } from './queue.model';
import { QUEUE_EVENTS, QueueEntryPublic } from './queue.types';
import { logger } from '../../utils/logger';
import { verifyAccessToken, canAccessProfessional, AuthUser } from '../../middlewares/auth.middleware';

let io: SocketIOServer | null = null;

export function initQueueSocket(socketServer: SocketIOServer): void {
  io = socketServer;

  // Autenticación del handshake: el cliente envía { auth: { token } } con su access token de Keycloak
  io.use(async (socket, next) => {
    try {
      socket.data.user = await verifyAccessToken(String(socket.handshake.auth?.['token'] ?? ''));
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket] Cliente conectado: ${socket.id}`);
    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);

    // El token solo se valida en el handshake: al vencer se corta y el cliente reconecta con uno nuevo.
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, user.exp * 1000 - Date.now()));
    socket.on('disconnect', () => clearTimeout(expiry));

    socket.on('queue:join-professional', async (professionalId: string) => {
      if (!(await canAccessProfessional(user, String(professionalId)).catch(() => false))) {
        logger.warn(`[Socket] ${socket.id} sin acceso a professional:${professionalId}`);
        return;
      }
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

/** Corta las conexiones en vivo de un usuario (p. ej. al desactivarlo) */
export function disconnectUserSockets(userId: string): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

/** Datos mínimos de una entrada para la pantalla del profesional (AGENTS.md §58) */
export function toPublicEntry(e: IQueueEntry): QueueEntryPublic {
  return {
    _id: e._id.toString(),
    patientId: e.patientId,
    patientFirstName: e.patientFirstName,
    patientLastName: e.patientLastName,
    patientDni: e.patientDni,
    healthInsurance: e.healthInsurance,
    professionalId: e.professionalId,
    status: e.status,
    visitNumber: e.visitNumber,
    joinedAt: e.joinedAt,
    calledAt: e.calledAt,
    attentionStartedAt: e.attentionStartedAt,
    completedAt: e.completedAt,
    cancelledAt: e.cancelledAt,
  };
}

/** Emite el evento solo a la sala del profesional dueño de la entrada */
function emitToProfessional(event: string, entry: IQueueEntry): void {
  if (!io) return;
  const room = `professional:${entry.professionalId.toString()}`;
  io.to(room).emit(event, toPublicEntry(entry));
  logger.debug(`[Socket] ${event} emitido a ${room}`);
}

export const emitPatientAdded = (e: IQueueEntry) => emitToProfessional(QUEUE_EVENTS.PATIENT_ADDED, e);
export const emitPatientCalled = (e: IQueueEntry) => emitToProfessional(QUEUE_EVENTS.PATIENT_CALLED, e);
export const emitPatientStarted = (e: IQueueEntry) => emitToProfessional(QUEUE_EVENTS.PATIENT_STARTED, e);
export const emitPatientCompleted = (e: IQueueEntry) => emitToProfessional(QUEUE_EVENTS.PATIENT_COMPLETED, e);
export const emitPatientCancelled = (e: IQueueEntry) => emitToProfessional(QUEUE_EVENTS.PATIENT_CANCELLED, e);
