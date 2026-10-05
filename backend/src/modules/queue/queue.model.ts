import mongoose, { Schema, Document, Types } from 'mongoose';
import { QueueStatus, QueueSource } from './queue.types';

/**
 * Documento MongoDB de una entrada en la cola de espera.
 *
 * QueueEntry es una entidad PROPIA del sistema — no es "paciente en MongoDB".
 * Representa el estado operativo de un paciente en un momento dado.
 *
 * Regla clave (AGENTS.md §14): No asumir que "paciente en Mongo = paciente esperando".
 */
export interface IQueueEntry extends Document {
  _id: Types.ObjectId;

  /** Datos mínimos del paciente necesarios para mostrar en la cola */
  patientFirstName: string;
  patientLastName: string;
  patientDni: string;
  healthInsurance: string;

  /** Paciente del sistema al que pertenece la entrada */
  patientId: Types.ObjectId;

  /** Número de visita del paciente (histórico, se fija al crear la entrada) */
  visitNumber: number;

  /** Referencia al profesional por ID (nunca por nombre string) */
  professionalId: Types.ObjectId;

  /** Estado actual en la cola */
  status: QueueStatus;

  /** Sistema de origen de la entrada */
  source: QueueSource;

  /**
   * ID del registro original en el sistema fuente (ej: _id del tótem).
   * Permite detectar duplicados e idempotencia (AGENTS.md §25).
   */
  sourceRecordId?: string;

  /** Timestamps de cada transición de estado */
  joinedAt: Date;
  calledAt?: Date;
  attentionStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

const QueueEntrySchema = new Schema<IQueueEntry>(
  {
    patientFirstName: { type: String, required: true, trim: true },
    patientLastName: { type: String, required: true, trim: true },
    patientDni: { type: String, required: true, trim: true },
    healthInsurance: { type: String, default: 'Particular', trim: true },

    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    visitNumber: { type: Number, default: 1 },

    professionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Professional',
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },

    source: {
      type: String,
      enum: Object.values(QueueSource),
      default: QueueSource.MANUAL,
    },

    sourceRecordId: { type: String },

    joinedAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    attentionStartedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índices para consultas frecuentes (AGENTS.md §48)
QueueEntrySchema.index({ professionalId: 1, status: 1, joinedAt: 1 });
QueueEntrySchema.index({ patientId: 1, status: 1 });
QueueEntrySchema.index({ sourceRecordId: 1 }, { sparse: true });

export const QueueEntry = mongoose.model<IQueueEntry>('QueueEntry', QueueEntrySchema);
