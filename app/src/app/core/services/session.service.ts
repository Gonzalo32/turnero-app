import { Injectable, signal } from '@angular/core';
import { Professional } from '../../features/queue/models/queue.model';

/**
 * Mantiene la sesión del profesional activo durante la navegación.
 * Al hacer login se guarda aquí; el dashboard lo consume.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly professional = signal<Professional | null>(null);
  readonly office = signal<string>('');

  login(professional: Professional, office: string): void {
    this.professional.set(professional);
    this.office.set(office);
    localStorage.setItem('session_prof_id', professional._id);
    localStorage.setItem('session_office', office);
  }

  logout(): void {
    this.professional.set(null);
    this.office.set('');
    localStorage.removeItem('session_prof_id');
    localStorage.removeItem('session_office');
  }

  get isLoggedIn(): boolean {
    return this.professional() !== null;
  }
}
