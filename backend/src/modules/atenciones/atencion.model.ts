import mongoose, { Schema, Document, Types } from 'mongoose';
import { QueueStatus, QueueSource } from '../queue/queue.types';
import { IPaciente } from '../patients/patient.model';

/**
 * Atención (colección 'atenciones'): UNA visita de un paciente a un profesional.
 * Es la cola de espera del sistema (AGENTS.md §14) y su historial de visitas.
 */
export interface IAtencion extends Document {
  _id: Types.ObjectId;
  /** ObjectId, o el paciente cuando la consulta hace populate */
  patientId: Types.ObjectId | IPaciente;
  /** Referencia al profesional por ID (nunca por nombre) */
  professionalId: Types.ObjectId;
  /** Llegada a la cola; criterio de orden (AGENTS.md §16) */
  fecha: Date;
  estado: QueueStatus;
  /** Consultorio asignado */
  consultorio?: string;
  /** Obra social al momento de la visita (puede cambiar entre visitas, AGENTS.md §52) */
  obraSocial: string;
  /** Número de visita del paciente (histórico, se fija al crear la atención) */
  numeroVisita: number;
  origen: QueueSource;
  /** ID del registro en el sistema de origen (ej: _id del tótem), para idempotencia (AGENTS.md §25) */
  idOrigen?: string;
  /** Timestamps de cada transición de estado */
  llamadoAt?: Date;
  inicioAtencionAt?: Date;
  finalizadoAt?: Date;
  canceladoAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AtencionSchema = new Schema<IAtencion>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Paciente', required: true },
    professionalId: { type: Schema.Types.ObjectId, ref: 'Professional', required: true },
    fecha: { type: Date, default: Date.now },
    estado: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },
    consultorio: { type: String, trim: true },
    obraSocial: { type: String, default: 'Particular', trim: true },
    numeroVisita: { type: Number, default: 1 },
    origen: {
      type: String,
      enum: Object.values(QueueSource),
      default: QueueSource.MANUAL,
    },
    idOrigen: { type: String },
    llamadoAt: { type: Date },
    inicioAtencionAt: { type: Date },
    finalizadoAt: { type: Date },
    canceladoAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

// Índices para consultas frecuentes (AGENTS.md §48)
AtencionSchema.index({ professionalId: 1, estado: 1, fecha: 1 }); // cola activa
AtencionSchema.index({ patientId: 1, estado: 1 });                // ¿ya está en la cola?
AtencionSchema.index({ idOrigen: 1 }, { sparse: true });
AtencionSchema.index({ fecha: -1, estado: 1 });                   // reportes por fecha

export const Atencion = mongoose.model<IAtencion>('Atencion', AtencionSchema, 'atenciones');
