import mongoose, { Schema, Document, Types } from 'mongoose';

/** Roles de realm en Keycloak. Agregar uno nuevo = crearlo en Keycloak + sumarlo acá. */
export const ROLES = ['admin', 'odontologo', 'secretaria'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Usuario del sistema, vinculado 1:1 con un usuario de Keycloak (keycloakId = claim `sub`).
 * Keycloak guarda credenciales y es la fuente de verdad de los roles; `role` es una copia
 * para listar/filtrar en el panel de administración.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  keycloakId: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  sedeId?: Types.ObjectId;
  professionalId?: Types.ObjectId;
  active: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    keycloakId: { type: String, required: true, unique: true },
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    email: { type: String, trim: true, lowercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    sedeId: { type: Schema.Types.ObjectId, ref: 'Sede' },
    professionalId: { type: Schema.Types.ObjectId, ref: 'Professional' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

UserSchema.index({ professionalId: 1 }, { unique: true, partialFilterExpression: { professionalId: { $exists: true } } });
UserSchema.index({ sedeId: 1, role: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
