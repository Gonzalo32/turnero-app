import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Modelo de Odontólogo / Profesional (Mongoose ORM).
 *
 * Regla AGENTS.md §17: Los profesionales se identifican por _id, nunca por su nombre.
 * Regla AGENTS.md §53: Eliminación lógica (activo: false).
 * Credenciales: viven en Keycloak; el vínculo usuario ↔ profesional está en `users.professionalId`.
 */
export interface IProfessional extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  dni?: string;
  birthDate?: Date;
  email?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  colorTag?: string;
  notes?: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProfessionalSchema = new Schema<IProfessional>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    dni: { type: String, trim: true },
    birthDate: { type: Date },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    specialty: { type: String, trim: true, default: 'Odontología General' },
    colorTag: { type: String, trim: true, default: '#866385' },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índices eficientes (AGENTS.md §48)
ProfessionalSchema.index({ active: 1, lastName: 1 });
ProfessionalSchema.index({ email: 1 }, { unique: true, sparse: true });
ProfessionalSchema.index({ dni: 1 }, { unique: true, sparse: true });

export const Professional = mongoose.model<IProfessional>('Professional', ProfessionalSchema);
