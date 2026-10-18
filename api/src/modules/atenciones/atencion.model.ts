import mongoose, { Schema, Document, Types } from 'mongoose';
import { QueueStatus } from '../queue/queue.types';

/**
 * Documento individual de la colección 'atenciones'.
 * Cada documento representa UNA consulta / turno específico de un paciente.
 * Estructura:
 * _id: ObjectId
 * patientId: ObjectId (ref: 'Paciente')
 * professionalId: ObjectId (ref: 'Professional')
 * fecha: Date
 * estado: QueueStatus ('WAITING', 'CALLED', 'IN_ATTENTION', 'COMPLETED', 'CANCELLED')
 * createdAt: Date
 * updatedAt: Date
 */
export interface IAtencionDocument extends Document {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  professionalId: Types.ObjectId;
  fecha: Date;
  estado: QueueStatus | string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Tipo de compatibilidad por si se requiere importar IAtencionItem
export type IAtencionItem = IAtencionDocument;

export const AtencionSchema = new Schema<IAtencionDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Paciente',
      required: true,
      index: true,
    },
    professionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Professional',
      required: true,
      index: true,
    },
    fecha: {
      type: Date,
      default: Date.now,
      index: true,
    },
    estado: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índices para optimizar turnero en tiempo real, reportes y búsquedas
AtencionSchema.index({ professionalId: 1, estado: 1, fecha: 1 });
AtencionSchema.index({ fecha: -1, estado: 1 });
AtencionSchema.index({ patientId: 1, fecha: -1 });

export const Atencion = mongoose.model<IAtencionDocument>('Atencion', AtencionSchema, 'atenciones');

