import mongoose, { Schema, Document, Types } from 'mongoose';
import { QueueStatus } from '../queue/queue.types';

/**
 * Elemento individual dentro del array de atenciones.
 * Representa una consulta específica del paciente con un odontólogo.
 */
export interface IAtencionItem {
  _id: Types.ObjectId;
  professionalId: Types.ObjectId;
  fecha: Date;
  estado: QueueStatus | string;
}

/**
 * Documento principal de la colección 'atenciones'.
 * Cada documento agrupa todas las consultas/atenciones de un paciente.
 * Estructura:
 * _id: ObjectId
 * patientId: ObjectId (ref: 'Paciente')
 * atenciones: Array [ { professionalId, fecha, estado } ]
 */
export interface IAtencionDocument extends Document {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  atenciones: IAtencionItem[];
}

const AtencionItemSchema = new Schema<IAtencionItem>(
  {
    professionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Professional',
      required: true,
      index: true,
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
    estado: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },
  },
  {
    _id: true,
    versionKey: false,
    timestamps: false,
  }
);

export const AtencionSchema = new Schema<IAtencionDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Paciente',
      required: true,
      unique: true,
      index: true,
    },
    atenciones: [AtencionItemSchema],
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Índices para búsquedas y colas en tiempo real
AtencionSchema.index({ 'atenciones.professionalId': 1, 'atenciones.estado': 1 });
AtencionSchema.index({ 'atenciones.fecha': -1 });

export const Atencion = mongoose.model<IAtencionDocument>('Atencion', AtencionSchema, 'atenciones');
