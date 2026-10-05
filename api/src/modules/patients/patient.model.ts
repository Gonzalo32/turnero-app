import mongoose, { Schema, Document, Types } from 'mongoose';
import { QueueStatus } from '../queue/queue.types';

export interface IVisita {
  numeroVisita: number;
  fecha: Date;
  fechaStr?: string;
  profesional?: string;
  profesionalId?: Types.ObjectId;
  obraSocial?: string;
  estado: QueueStatus | string;
  atendidoAt?: Date;
}

export interface ICambioProfesional {
  fecha: Date;
  fechaStr?: string;
  profesionalAnterior: string;
  profesionalNuevo: string;
}

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
  createdAt: Date;

  // Turnero
  profesionalId?: Types.ObjectId;
  estado: QueueStatus;
  status: QueueStatus;
  joinedAt: Date;
  calledAt?: Date;
  attentionStartedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Historial de visitas y cambios
  totalVisitas: number;
  visitas: IVisita[];
  cambiosProfesional: ICambioProfesional[];

  // Virtuals
  patientFirstName?: string;
  patientLastName?: string;
  patientDni?: string;
  healthInsurance?: string;
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

    // Turnero
    profesionalId: { type: Schema.Types.ObjectId, ref: 'Professional' },
    estado: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },
    status: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },
    joinedAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    attentionStartedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },

    // Historial
    totalVisitas: { type: Number, default: 1 },
    visitas: { type: Array, default: [] } as any,
    cambiosProfesional: { type: Array, default: [] } as any,
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
PatientSchema.index({ profesionalId: 1, estado: 1, joinedAt: 1 });

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
