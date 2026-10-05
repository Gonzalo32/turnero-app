import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Modelo de Odontólogo / Profesional (Mongoose ORM).
 *
 * Regla AGENTS.md §17: Los profesionales se identifican por _id, nunca por su nombre.
 * Regla AGENTS.md §53: Eliminación lógica (activo: false).
 * Regla AGENTS.md §54: Nunca almacenar passwords en texto plano (bcrypt).
 */
export interface IProfessional extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  dni?: string;
  birthDate?: Date;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  colorTag?: string;
  notes?: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

const ProfessionalSchema = new Schema<IProfessional>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    dni: { type: String, trim: true },
    birthDate: { type: Date },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, select: false },
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

// Pre-save hook: Encriptar contraseña si fue modificada o provista
ProfessionalSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Método para verificar contraseña
ProfessionalSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Índices eficientes (AGENTS.md §48)
ProfessionalSchema.index({ active: 1, lastName: 1 });
ProfessionalSchema.index({ email: 1 }, { unique: true, sparse: true });
ProfessionalSchema.index({ dni: 1 }, { unique: true, sparse: true });

export const Professional = mongoose.model<IProfessional>('Professional', ProfessionalSchema);
