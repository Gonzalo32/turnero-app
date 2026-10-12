import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Modelo de Paciente (Colección: 'pacientes').
 * Contiene estrictamente los datos filiatorios y personales del paciente.
 * Todo lo relativo a visitas y turnos se gestiona en la colección 'atenciones'.
 */
export interface IPaciente extends Document {
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

  // Virtuals de compatibilidad
  patientFirstName?: string;
  patientLastName?: string;
  patientDni?: string;
  healthInsurance?: string;
}

export const PatientSchema = new Schema<IPaciente>(
  {
    dni: { type: String, required: true, index: true },
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
  },
  {
    versionKey: false,
    timestamps: false,
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

export const Paciente = mongoose.model<IPaciente>('Paciente', PatientSchema, 'pacientes');
export const Patient = Paciente;
export type IPatient = IPaciente;
