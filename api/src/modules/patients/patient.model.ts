import mongoose, { Schema, Document } from 'mongoose';

/**
 * Modelo de Paciente idéntico al del tótem (odonto-app).
 * Mantiene exactamente las mismas variables y tipos para preservar la integridad de datos.
 */
export interface IPatient extends Document {
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  fechaNacimiento?: string;
  obraSocial?: string;
  numeroAfiliado?: string;
  profesional?: string;
  localidad?: string;
  domicilio?: string;
  observacion: any[];
  createdAt: Date;
}

export const PatientSchema = new Schema<IPatient>(
  {
    dni: { type: String, required: true },
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    telefono: { type: String },
    fechaNacimiento: { type: String },
    obraSocial: { type: String },
    numeroAfiliado: { type: String },
    profesional: { type: String },
    localidad: { type: String },
    domicilio: { type: String },
    observacion: { type: Array, default: [] } as any,
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  }
);

PatientSchema.index({ dni: 1 });

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
