import { Injectable, signal } from '@angular/core';
import { Professional } from '../../features/queue/models/queue.model';

/**
 * Mantiene la sesión del profesional activo durante la navegación.
 * Al hacer login se guarda aquí; el dashboard lo consume.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly professional = signal<Professional | null>(this.getSavedProfessional());
  readonly office = signal<string>(this.getSavedOffice());

  private getSavedProfessional(): Professional | null {
    try {
      let saved = sessionStorage.getItem('session_professional');
      if (!saved) {
        saved = localStorage.getItem('session_professional');
        if (saved) {
          sessionStorage.setItem('session_professional', saved);
          const profId = localStorage.getItem('session_prof_id');
          if (profId) sessionStorage.setItem('session_prof_id', profId);
          localStorage.removeItem('session_professional');
          localStorage.removeItem('session_prof_id');
        }
      }
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private getSavedOffice(): string {
    let saved = sessionStorage.getItem('session_office');
    if (!saved) {
      saved = localStorage.getItem('session_office');
      if (saved) {
        sessionStorage.setItem('session_office', saved);
        localStorage.removeItem('session_office');
      }
    }
    return saved || '';
  }

  login(professional: Professional, office: string): void {
    this.professional.set(professional);
    this.office.set(office);
    sessionStorage.setItem('session_professional', JSON.stringify(professional));
    sessionStorage.setItem('session_prof_id', professional._id);
    sessionStorage.setItem('session_office', office);
    localStorage.removeItem('session_professional');
    localStorage.removeItem('session_prof_id');
    localStorage.removeItem('session_office');
  }

  logout(): void {
    const currentId = this.professional()?._id;
    this.professional.set(null);
    this.office.set('');
    sessionStorage.removeItem('session_professional');
    sessionStorage.removeItem('session_prof_id');
    sessionStorage.removeItem('session_office');
    if (!currentId || localStorage.getItem('session_prof_id') === currentId) {
      localStorage.removeItem('session_professional');
      localStorage.removeItem('session_prof_id');
      localStorage.removeItem('session_office');
    }
  }

  get isLoggedIn(): boolean {
    return this.professional() !== null;
  }
}
