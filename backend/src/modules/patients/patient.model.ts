import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Paciente del sistema: solo identidad (AGENTS.md §11, §12).
 * El estado en la cola y el historial de visitas viven en QueueEntry.
 *
 * Documentos anteriores pueden conservar campos viejos (estado, visitas, domicilio...);
 * el esquema los ignora y se dejan en la base para permitir rollback.
 */
export interface IPatient extends Document {
  _id: Types.ObjectId;
  dni: string;
  nombre: string;
  apellido: string;
  /** Sistema de origen (ej: "totem") y su ID, cuando corresponde */
  sourceSystem?: string;
  sourcePatientId?: string;
  createdAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    dni: { type: String, required: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    sourceSystem: { type: String },
    sourcePatientId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

PatientSchema.index({ dni: 1 });

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
