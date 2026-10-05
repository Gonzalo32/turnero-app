import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { professionalFullName } from '../queue/models/queue.model';
import { ROLE_LABELS } from '../../core/models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private session = inject(SessionService);

  readonly user = this.session.user;
  readonly office = this.session.office;
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  /** Tooltip: usuario, rol, consultorio y profesional cuya cola se ve */
  readonly badgeTitle = computed(() => {
    const u = this.user();
    if (!u) return '';
    const p = this.session.professional();
    return [`${u.firstName} ${u.lastName}`, ROLE_LABELS[u.role], this.office(), p ? `Cola: ${professionalFullName(p)}` : '']
      .filter(Boolean).join(' — ');
  });

  readonly initials = computed(() => {
    const u = this.user();
    return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '?';
  });

  logout(): void {
    this.session.logout();
  }
}
