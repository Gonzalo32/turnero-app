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
      const saved = localStorage.getItem('session_professional');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private getSavedOffice(): string {
    return localStorage.getItem('session_office') || '';
  }

  login(professional: Professional, office: string): void {
    this.professional.set(professional);
    this.office.set(office);
    localStorage.setItem('session_professional', JSON.stringify(professional));
    localStorage.setItem('session_prof_id', professional._id);
    localStorage.setItem('session_office', office);
  }

  logout(): void {
    this.professional.set(null);
    this.office.set('');
    localStorage.removeItem('session_professional');
    localStorage.removeItem('session_prof_id');
    localStorage.removeItem('session_office');
  }

  get isLoggedIn(): boolean {
    return this.professional() !== null;
  }
}
