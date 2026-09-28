import { Types } from 'mongoose';

/**
 * Estados posibles de una entrada en la cola de espera.
 * CENTRALIZADO: usar siempre este enum, nunca strings arbitrarios.
 */
export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_ATTENTION = 'IN_ATTENTION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Fuentes de origen de una entrada en la cola */
export enum QueueSource {
  TOTEM = 'totem',
  MANUAL = 'manual',
}

/** DTO para crear una nueva entrada en la cola */
export interface CreateQueueEntryDto {
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance?: string;
  professionalId: string;
  source?: QueueSource;
  sourceRecordId?: string;
}

/** Respuesta pública de una entrada de cola (lo que se expone al frontend) */
export interface QueueEntryPublic {
  _id: string;
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance: string;
  professionalId: Types.ObjectId | string;
  status: QueueStatus;
  source: QueueSource;
  sourceRecordId?: string;
  joinedAt: Date;
  calledAt?: Date;
  attentionStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

/** Nombres de eventos Socket.IO para la cola */
export const QUEUE_EVENTS = {
  PATIENT_ADDED: 'queue:patient-added',
  PATIENT_CALLED: 'queue:patient-called',
  PATIENT_STARTED: 'queue:patient-started',
  PATIENT_COMPLETED: 'queue:patient-completed',
  PATIENT_CANCELLED: 'queue:patient-cancelled',
} as const;
