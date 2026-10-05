/**
 * Estados centralizados de la cola (AGENTS.md §15).
 * Espejo del enum QueueStatus del backend.
 */
export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_ATTENTION = 'IN_ATTENTION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Fuente de origen de una entrada de cola */
export enum QueueSource {
  TOTEM = 'totem',
  MANUAL = 'manual',
}

/**
 * Entrada de la cola de espera — espejo de QueueEntryPublic del backend.
 */
export interface QueueEntry {
  _id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance: string;
  professionalId: string;
  status: QueueStatus;
  /** Número de visita del paciente */
  visitNumber: number;

  joinedAt: string;
  calledAt?: string;
  attentionStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

/** Profesional del sistema */
export interface Professional {
  _id: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  active: boolean;
}

/** Nombre completo del profesional */
export function professionalFullName(p: Professional): string {
  return `${p.firstName} ${p.lastName}`;
}

/** Nombres de eventos Socket.IO — espejo de QUEUE_EVENTS del backend */
export const QUEUE_EVENTS = {
  PATIENT_ADDED: 'queue:patient-added',
  PATIENT_CALLED: 'queue:patient-called',
  PATIENT_STARTED: 'queue:patient-started',
  PATIENT_COMPLETED: 'queue:patient-completed',
  PATIENT_CANCELLED: 'queue:patient-cancelled',
} as const;

/** DTO para agregar un paciente a la cola manualmente */
export interface AddToQueueDto {
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance?: string;
  professionalId: string;
}
