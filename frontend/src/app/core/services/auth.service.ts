import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Professional } from '../../features/queue/models/queue.model';

export interface LoginCredentials {
  email: string;
  password: string;
  office: string;
  force?: boolean;
}

export interface OfficeConflict {
  office: string;
  occupiedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

export interface LoginResult {
  user?: Professional;
  conflict?: OfficeConflict;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  /**
   * Envía credenciales (correo, contraseña y consultorio) al backend.
   * Regla AGENTS.md §40: Los componentes consumen la API a través de servicios.
   */
  login(credentials: LoginCredentials): Observable<ApiResponse<LoginResult>> {
    return this.http.post<ApiResponse<LoginResult>>(
      `${environment.apiUrl}/auth/login`,
      credentials
    );
  }

  /**
   * Notifica al backend el cierre de sesión para liberar el consultorio ocupado.
   */
  logout(professionalId: string): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(
      `${environment.apiUrl}/auth/logout`,
      { professionalId }
    );
  }

  /**
   * Obtiene el estado actual del profesional desde el backend para verificar si su consultorio sigue asignado.
   */
  getProfessionalSession(professionalId: string): Observable<ApiResponse<Professional>> {
    return this.http.get<ApiResponse<Professional>>(
      `${environment.apiUrl}/professionals/${encodeURIComponent(professionalId)}`
    );
  }
}
