import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Professional } from '../../features/queue/models/queue.model';
import { AppUser, Role } from '../models/user.model';

/**
 * Sesión del usuario. La autenticación la resuelve Keycloak; acá vive:
 * - `user`: el usuario del sistema (GET /auth/me) con su rol, sede y profesional vinculado.
 * - `professional`: el profesional cuya cola se está viendo (propio o elegido por la secretaria).
 * - `office`: el consultorio elegido al ingresar.
 * Solo la selección (profesional/consultorio) se guarda en localStorage; nunca credenciales.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private keycloak = inject(KeycloakService);

  readonly user = signal<AppUser | null>(null);
  readonly professional = signal<Professional | null>(this.read('session_professional'));
  readonly office = signal<string>(localStorage.getItem('session_office') || '');

  private read<T>(key: string): T | null {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /** Carga el usuario actual una sola vez. Lanza el error HTTP si no está habilitado. */
  async loadUser(): Promise<AppUser> {
    const current = this.user();
    if (current) return current;
    const res = await firstValueFrom(this.http.get<ApiResponse<AppUser>>(`${environment.apiUrl}/auth/me`));
    this.user.set(res.data);
    return res.data!;
  }

  hasRole(role: Role): boolean {
    return this.user()?.role === role;
  }

  selectWorkspace(professional: Professional | null, office: string): void {
    this.professional.set(professional);
    this.office.set(office);
    if (professional) localStorage.setItem('session_professional', JSON.stringify(professional));
    else localStorage.removeItem('session_professional');
    localStorage.setItem('session_office', office);
  }

  get hasWorkspace(): boolean {
    return this.office() !== '';
  }

  logout(): void {
    localStorage.removeItem('session_professional');
    localStorage.removeItem('session_office');
    this.keycloak.logout(window.location.origin);
  }
}
