import mongoose, { Schema, Document, Types } from 'mongoose';

/** Sede (clínica). Cada usuario pertenece a una; los consultorios se eligen al iniciar sesión. */
export interface ISede extends Document {
  _id: Types.ObjectId;
  name: string;
  address?: string;
  offices: string[];
  active: boolean;
}

const SedeSchema = new Schema<ISede>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, trim: true },
    offices: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const Sede = mongoose.model<ISede>('Sede', SedeSchema);
