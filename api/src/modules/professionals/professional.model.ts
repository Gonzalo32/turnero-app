import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Modelo de Profesional.
 *
 * Regla AGENTS.md §17: Los profesionales se identifican por _id, nunca por nombre.
 * Regla AGENTS.md §49: No hardcodear nombres en el código — usar seed data.
 * Regla AGENTS.md §53: Eliminación lógica (activo: false).
 */
export interface IProfessional extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  active: boolean;
}

const ProfessionalSchema = new Schema<IProfessional>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice para búsquedas frecuentes
ProfessionalSchema.index({ active: 1, lastName: 1 });

export const Professional = mongoose.model<IProfessional>('Professional', ProfessionalSchema);
