import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { ROLE_LABELS } from '../../../core/models/user.model';
import { Professional, professionalFullName } from '../../queue/models/queue.model';
import { SessionService } from '../../../core/services/session.service';

/**
 * Pantalla posterior al login de Keycloak: elegir consultorio (de la sede del usuario)
 * y, si no es odontólogo, el profesional cuya cola se va a gestionar.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly session = inject(SessionService);

  readonly user = this.session.user;
  professionals = signal<Professional[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  selectedProfId = signal('');
  selectedOffice = signal('');

  readonly roleLabels = ROLE_LABELS;
  readonly isDentist = computed(() => this.user()?.role === 'odontologo');
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly offices = computed(() => {
    const offices = this.user()?.sedeId?.offices ?? [];
    return offices.length || !this.isAdmin() ? offices : ['Administración'];
  });

  readonly canLogin = computed(() =>
    this.selectedOffice() !== '' &&
    (this.isDentist() || this.isAdmin() || this.selectedProfId() !== '')
  );

  readonly professionalFullName = professionalFullName;

  async ngOnInit(): Promise<void> {
    try {
      const user = await this.session.loadUser();
      if (user.role === 'odontologo' && !user.professionalId) {
        this.errorMsg.set('Tu usuario no tiene un profesional asignado. Contactá al administrador.');
        return;
      }
      if (user.role !== 'odontologo') {
        const res = await firstValueFrom(
          this.http.get<ApiResponse<Professional[]>>(`${environment.apiUrl}/professionals`)
        );
        this.professionals.set(res.data ?? []);
      }
      if (this.offices().length === 1) this.selectedOffice.set(this.offices()[0]);
    } catch (err) {
      const code = (err as HttpErrorResponse).error?.code;
      this.errorMsg.set(
        code === 'USER_NOT_PROVISIONED' ? 'Tu usuario todavía no está habilitado en el sistema. Contactá al administrador.' :
        code === 'USER_INACTIVE' ? 'Tu usuario está desactivado.' :
        'No se pudo conectar con el servidor. Verificá que el backend esté corriendo.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  login(): void {
    if (!this.canLogin()) return;
    const prof = this.isDentist()
      ? this.user()!.professionalId!
      : this.professionals().find(p => p._id === this.selectedProfId()) ?? null;
    this.session.selectWorkspace(prof, this.selectedOffice());
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.session.logout();
  }

  trackByProfId(_: number, p: Professional): string { return p._id; }
}
