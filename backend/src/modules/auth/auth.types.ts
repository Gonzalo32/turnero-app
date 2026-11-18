import type { UserRole } from '../professionals/professional.model';

export interface LoginDto {
  email: string;
  password: string;
  office: string;
  force?: boolean;
}

export interface AuthUserData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  office?: string;
  active: boolean;
  role: UserRole;
}

export interface OfficeConflictData {
  office: string;
  occupiedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

export interface LoginResponseData {
  user?: AuthUserData;
  token?: string;
  conflict?: OfficeConflictData;
}
