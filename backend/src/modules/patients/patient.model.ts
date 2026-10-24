import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Paciente del sistema (colección 'pacientes').
 * Datos filiatorios y personales; las visitas y el estado en la cola viven en 'atenciones'.
 *
 * El _id lo genera este sistema; el _id del tótem se guarda en sourcePatientId (AGENTS.md §11).
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
  localidad?: string;
  domicilio?: string;
  observacion: string[];
  /** Sistema de origen (ej: "totem") y su ID, cuando corresponde */
  sourceSystem?: string;
  sourcePatientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos opcionales del paciente que puede aportar el origen (ej: formulario del tótem) */
export type PacienteDetalle = Partial<Pick<IPaciente,
  'telefono' | 'fechaNacimiento' | 'numeroAfiliado' | 'localidad' | 'domicilio' | 'observacion'>>;

const PacienteSchema = new Schema<IPaciente>(
  {
    dni: { type: String, required: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    telefono: { type: String, trim: true },
    fechaNacimiento: { type: String, trim: true },
    obraSocial: { type: String, trim: true },
    numeroAfiliado: { type: String, trim: true },
    localidad: { type: String, trim: true },
    domicilio: { type: String, trim: true },
    observacion: { type: [String], default: [] },
    sourceSystem: { type: String },
    sourcePatientId: { type: String },
  },
  { timestamps: true, versionKey: false }
);

PacienteSchema.index({ dni: 1 });

export const Paciente = mongoose.model<IPaciente>('Paciente', PacienteSchema, 'pacientes');
