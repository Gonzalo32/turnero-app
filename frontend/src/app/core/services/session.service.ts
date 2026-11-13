import { Injectable, computed, signal } from '@angular/core';
import { Professional } from '../../features/queue/models/queue.model';

/** Lee el vencimiento (exp) de un JWT. No valida la firma: eso lo hace el backend en cada request. */
function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Mantiene la sesión del profesional activo durante la navegación.
 * Al hacer login se guarda aquí; el dashboard lo consume.
 *
 * ponytail: el JWT vive en localStorage (legible por JS). Si aparece riesgo de XSS,
 * pasar a cookie httpOnly + SameSite.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly professional = signal<Professional | null>(this.getSavedProfessional());
  readonly office = signal<string>(localStorage.getItem('session_office') || '');
  readonly token = signal<string>(localStorage.getItem('session_token') || '');

  /** Solo para mostrar u ocultar pantallas; el permiso real lo decide el backend. */
  readonly isAdmin = computed(() => this.professional()?.role === 'ADMIN');

  private getSavedProfessional(): Professional | null {
    try {
      const saved = localStorage.getItem('session_professional');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  login(professional: Professional, office: string, token: string): void {
    this.professional.set(professional);
    this.office.set(office);
    this.token.set(token);
    localStorage.setItem('session_professional', JSON.stringify(professional));
    localStorage.setItem('session_prof_id', professional._id);
    localStorage.setItem('session_office', office);
    localStorage.setItem('session_token', token);
  }

  logout(): void {
    this.professional.set(null);
    this.office.set('');
    this.token.set('');
    localStorage.removeItem('session_professional');
    localStorage.removeItem('session_prof_id');
    localStorage.removeItem('session_office');
    localStorage.removeItem('session_token');
  }

  /** Hay sesión solo si existe un token sin vencer (las sesiones previas a KAN-7 no tienen token). */
  get isLoggedIn(): boolean {
    return this.professional() !== null && tokenExpiresAt(this.token()) > Date.now();
  }
}
