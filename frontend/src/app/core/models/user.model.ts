import { Professional } from '../../features/queue/models/queue.model';

export type Role = 'admin' | 'odontologo' | 'secretaria';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  odontologo: 'Odontólogo/a',
  secretaria: 'Secretaría',
};

export interface Sede {
  _id: string;
  name: string;
  address?: string;
  offices: string[];
  active?: boolean;
}

/** Usuario del sistema (GET /auth/me, /users). sedeId/professionalId vienen populados. */
export interface AppUser {
  _id: string;
  keycloakId: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  sedeId?: Sede | null;
  professionalId?: Professional | null;
  active: boolean;
}
