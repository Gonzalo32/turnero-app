import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private session = inject(SessionService);

  email = signal('');
  password = signal('');
  selectedOffice = signal('');

  showPassword = signal(false);
  isSubmitting = signal(false);
  errorMsg = signal('');

  readonly offices = Array.from({ length: 12 }, (_, i) => `Consultorio ${i + 1}`);

  /**
   * Los 3 campos (correo, contraseña y consultorio) deben estar completos
   * para habilitar el botón de ingreso.
   */
  readonly canLogin = computed(() =>
    this.email().trim().length > 0 &&
    this.password().trim().length > 0 &&
    this.selectedOffice().trim().length > 0 &&
    !this.isSubmitting()
  );

  ngOnInit(): void {
    if (this.session.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  async login(): Promise<void> {
    if (!this.canLogin()) return;

    this.errorMsg.set('');
    this.isSubmitting.set(true);

    const email = this.email().trim();
    const password = this.password().trim();
    const office = this.selectedOffice().trim();

    try {
      const res = await firstValueFrom(
        this.authService.login({ email, password, office })
      );

      if (res.success && res.data?.user && res.data.token) {
        this.session.login(res.data.user, office, res.data.token);
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMsg.set(res.message || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      const serverMsg = err?.error?.message;
      this.errorMsg.set(
        serverMsg || 'No se pudo conectar con el servidor. Verificá que el backend esté en ejecución.'
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
