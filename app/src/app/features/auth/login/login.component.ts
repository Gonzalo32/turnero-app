import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Professional, professionalFullName } from '../../queue/models/queue.model';
import { SessionService } from '../../../core/services/session.service';

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
  private session = inject(SessionService);

  professionals = signal<Professional[]>([]);
  loadingProfessionals = signal(true);
  errorMsg = signal('');

  selectedProfId = signal('');
  selectedOffice = signal('');

  readonly offices = Array.from({ length: 9 }, (_, i) => `Consultorio ${i + 1}`);

  readonly canLogin = computed(() =>
    this.selectedProfId() !== '' && this.selectedOffice() !== ''
  );

  readonly professionalFullName = professionalFullName;

  async ngOnInit(): Promise<void> {
    if (this.session.isLoggedIn) {
      this.router.navigate(['/dashboard/pacientes']);
      return;
    }

    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Professional[]>>(`${environment.apiUrl}/professionals`)
      );
      if (res.success && res.data) {
        this.professionals.set(res.data);
      }
    } catch {
      this.errorMsg.set('No se pudo conectar con el servidor. Verificá que el backend esté corriendo.');
    } finally {
      this.loadingProfessionals.set(false);
    }
  }

  login(): void {
    if (!this.canLogin()) return;

    const prof = this.professionals().find(p => p._id === this.selectedProfId());
    if (!prof) return;

    this.session.login(prof, this.selectedOffice());
    this.router.navigate(['/dashboard']);
  }

  trackByProfId(_: number, p: Professional): string { return p._id; }
}
