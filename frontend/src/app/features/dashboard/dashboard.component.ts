import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { professionalFullName } from '../queue/models/queue.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private session = inject(SessionService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private router = inject(Router);

  private offSessionDisplaced: (() => void) | null = null;
  private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

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

  ngOnInit(): void {
    this.socketService.connect();

    this.offSessionDisplaced = this.socketService.on<{
      office: string;
      newProfessionalId: string;
      displacedProfessionalIds: string[];
      replacedByName: string;
    }>('auth:session-displaced', (payload) => {
      const currentProf = this.professional();
      const currentOffice = this.office();
      if (!currentProf) return;

      const isDisplacedById = payload.displacedProfessionalIds?.includes(currentProf._id);
      const isSameOfficeTakenByOther =
        Boolean(currentOffice) &&
        payload.office === currentOffice &&
        payload.newProfessionalId !== currentProf._id;

      if (isDisplacedById || isSameOfficeTakenByOther) {
        this.handleForcedLogout();
      }
    });

    // Verificación periódica de respaldo por si el socket estuvo desconectado durante el relevo
    this.sessionCheckInterval = setInterval(() => {
      this.verifySessionStillActive();
    }, 10000);
  }

  ngOnDestroy(): void {
    this.clearRestoreTimer();
    if (this.offSessionDisplaced) {
      this.offSessionDisplaced();
      this.offSessionDisplaced = null;
    }
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  private async verifySessionStillActive(): Promise<void> {
    const currentProf = this.professional();
    const currentOffice = this.office();
    if (!currentProf || !currentOffice) return;

    try {
      const res = await firstValueFrom(this.authService.getProfessionalSession(currentProf._id));
      if (res.success && res.data) {
        if (!res.data.active || (res.data.office ?? '') !== currentOffice) {
          this.handleForcedLogout();
        }
      }
    } catch {
      // Ignorar errores transitorios de red
    }
  }

  private handleForcedLogout(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    this.session.logout();
    this.socketService.disconnect();
    this.router.navigate(['/login']);
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
    const profId = this.professional()?._id;
    if (profId) {
      this.authService.logout(profId).subscribe({ error: () => {} });
    }
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
