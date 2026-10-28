import { Component, inject, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { professionalFullName } from '../queue/models/queue.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnDestroy {
  private session = inject(SessionService);
  private router = inject(Router);

  readonly professional = this.session.professional;
  readonly office = this.session.office;

  /** Estado de visibilidad de la barra lateral (persiste preferencia local) */
  readonly isSidebarHidden = signal<boolean>(
    typeof localStorage !== 'undefined' &&
      (localStorage.getItem('sidebar_hidden') === 'true' || localStorage.getItem('sidebar_collapsed') === 'true')
  );

  /** Alias para retrocompatibilidad */
  readonly isCollapsed = this.isSidebarHidden;

  /** Controla si el botón flotante para restaurar la barra está visible */
  readonly showRestoreBtn = signal<boolean>(false);

  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  toggleSidebar(): void {
    const next = !this.isSidebarHidden();
    this.isSidebarHidden.set(next);
    if (!next) {
      this.clearRestoreTimer();
      this.showRestoreBtn.set(false);
    }
    try {
      localStorage.setItem('sidebar_hidden', String(next));
      localStorage.removeItem('sidebar_collapsed');
    } catch {}
  }

  restoreSidebar(): void {
    this.isSidebarHidden.set(false);
    this.clearRestoreTimer();
    this.showRestoreBtn.set(false);
    try {
      localStorage.setItem('sidebar_hidden', 'false');
      localStorage.removeItem('sidebar_collapsed');
    } catch {}
  }

  onEdgeHover(): void {
    if (!this.isSidebarHidden()) return;
    this.showRestoreBtn.set(true);
    this.resetHideTimer(3500);
  }

  onEdgeLeave(): void {
    if (!this.hideTimeoutId) {
      this.resetHideTimer(2500);
    }
  }

  onRestoreBtnEnter(): void {
    this.clearRestoreTimer();
  }

  onRestoreBtnLeave(): void {
    this.resetHideTimer(2500);
  }

  private resetHideTimer(ms: number): void {
    this.clearRestoreTimer();
    this.hideTimeoutId = setTimeout(() => {
      this.showRestoreBtn.set(false);
      this.hideTimeoutId = null;
    }, ms);
  }

  private clearRestoreTimer(): void {
    if (this.hideTimeoutId) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }
  }

  ngOnDestroy(): void {
    this.clearRestoreTimer();
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
