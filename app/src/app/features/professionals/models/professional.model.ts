/**
 * Modelo de Profesional / Odontólogo en el Frontend.
 * Regla AGENTS.md §17: Los profesionales se identifican por _id, nunca por su nombre.
 */
export interface Professional {
  _id: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  dni?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  colorTag?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** DTO para la creación de un nuevo odontólogo */
export interface CreateProfessionalDto {
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  dni?: string;
  birthDate?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  colorTag?: string;
  notes?: string;
}

/** Especialidades odontológicas sugeridas */
export const DENTAL_SPECIALTIES = [
  'Odontología General',
  'Ortodoncia',
  'Endodoncia',
  'Implantología',
  'Periodoncia',
  'Prótesis Dental',
  'Odontopediatría',
  'Cirugía Maxilofacial',
  'Estética Dental',
] as const;

/** Retorna el nombre completo formateado del profesional */
export function getProfessionalFullName(p: Professional): string {
  return `${p.lastName}, ${p.firstName}`;
}
