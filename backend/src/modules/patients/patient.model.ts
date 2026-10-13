import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Paciente del sistema (AGENTS.md §11, §12).
 * Contiene datos personales y filiatorios sincronizados con el tótem o ingresados manualmente.
 * El estado en la cola y el historial de visitas viven de forma independiente en QueueEntry.
 */
export interface IPatient extends Document {
  _id: Types.ObjectId;
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

  /** Sistema de origen (ej: "totem") y su ID, cuando corresponde */
  sourceSystem?: string;
  sourcePatientId?: string;
  createdAt: Date;

  // Virtuals de compatibilidad
  patientFirstName?: string;
  patientLastName?: string;
  patientDni?: string;
  healthInsurance?: string;
}

const PatientSchema = new Schema<IPatient>(
  {
    dni: { type: String, required: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    fechaNacimiento: { type: String, trim: true },
    obraSocial: { type: String, trim: true },
    numeroAfiliado: { type: String, trim: true },
    profesional: { type: String, trim: true },
    localidad: { type: String, trim: true },
    domicilio: { type: String, trim: true },
    observacion: { type: Array, default: [] } as any,
    sourceSystem: { type: String },
    sourcePatientId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

PatientSchema.virtual('patientFirstName').get(function () {
  return this.nombre;
});
PatientSchema.virtual('patientLastName').get(function () {
  return this.apellido;
});
PatientSchema.virtual('patientDni').get(function () {
  return this.dni;
});
PatientSchema.virtual('healthInsurance').get(function () {
  return this.obraSocial || 'Particular';
});

PatientSchema.index({ dni: 1 });

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
export const Paciente = Patient;
export type IPaciente = IPatient;

