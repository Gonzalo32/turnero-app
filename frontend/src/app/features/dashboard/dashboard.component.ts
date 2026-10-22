import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { professionalFullName } from '../queue/models/queue.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private session = inject(SessionService);
  private router = inject(Router);

  readonly professional = this.session.professional;
  readonly office = this.session.office;

  /** Estado de colapso de la barra lateral (persiste preferencia local) */
  readonly isCollapsed = signal<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem('sidebar_collapsed') === 'true'
  );

  toggleSidebar(): void {
    const next = !this.isCollapsed();
    this.isCollapsed.set(next);
    try {
      localStorage.setItem('sidebar_collapsed', String(next));
    } catch {}
  }

  readonly professionalName = computed(() => {
    const p = this.professional();
    return p ? professionalFullName(p) : '';
  });

  readonly initials = computed(() => {
    const p = this.professional();
    if (!p) return '?';
    return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
  });

  logout(): void {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
