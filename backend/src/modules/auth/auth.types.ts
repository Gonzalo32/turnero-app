export interface LoginDto {
  email: string;
  password: string;
  office: string;
}

export interface AuthUserData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  office?: string;
  active: boolean;
}

export interface LoginResponseData {
  user: AuthUserData;
}
