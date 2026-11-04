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
}

export interface LoginResult {
  user: Professional;
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
}
