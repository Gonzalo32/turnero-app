import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { AppUser, Role, Sede } from '../../../core/models/user.model';

export interface UserFormDto {
  username?: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  sedeId?: string;
  professionalId?: string;
  createProfessional?: boolean;
  password?: string;
}

/** HTTP del panel de administración (usuarios y sedes). Errores → Error con el mensaje del backend. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private async call<T>(req: Observable<ApiResponse<T>>): Promise<T> {
    try {
      return (await firstValueFrom(req)).data as T;
    } catch (err: any) {
      throw new Error(err?.error?.message || 'Error de comunicación con el servidor');
    }
  }

  listUsers() { return this.call(this.http.get<ApiResponse<AppUser[]>>(`${this.api}/users`)); }
  createUser(dto: UserFormDto) { return this.call(this.http.post<ApiResponse<AppUser>>(`${this.api}/users`, dto)); }
  updateUser(id: string, dto: UserFormDto) { return this.call(this.http.put<ApiResponse<AppUser>>(`${this.api}/users/${id}`, dto)); }
  setUserActive(id: string, active: boolean) {
    return this.call(this.http.patch<ApiResponse<AppUser>>(`${this.api}/users/${id}/active`, { active }));
  }
  resetPassword(id: string, password: string) {
    return this.call(this.http.post<ApiResponse<null>>(`${this.api}/users/${id}/reset-password`, { password }));
  }

  listSedes(all = false) { return this.call(this.http.get<ApiResponse<Sede[]>>(`${this.api}/sedes${all ? '?all=true' : ''}`)); }
  createSede(dto: Partial<Sede>) { return this.call(this.http.post<ApiResponse<Sede>>(`${this.api}/sedes`, dto)); }
  updateSede(id: string, dto: Partial<Sede>) { return this.call(this.http.put<ApiResponse<Sede>>(`${this.api}/sedes/${id}`, dto)); }
}
