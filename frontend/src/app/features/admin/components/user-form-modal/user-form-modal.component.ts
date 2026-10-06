import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService, UserFormDto } from '../../services/admin.service';
import { ProfessionalsService } from '../../../professionals/services/professionals.service';
import { AppUser, ROLE_LABELS, Role, Sede } from '../../../../core/models/user.model';

/** Valor especial del selector de profesional: crear uno nuevo con los nombres del usuario */
const NEW_PROFESSIONAL = '__new__';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form-modal.component.html',
  styleUrl: '../../../professionals/components/professional-form-modal/professional-form-modal.component.scss'
})
export class UserFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private admin = inject(AdminService);
  private professionalsService = inject(ProfessionalsService);

  readonly user = input<AppUser | null>(null);
  readonly sedes = input<Sede[]>([]);
  readonly closed = output<void>();
  readonly saved = output<AppUser>();

  readonly professionals = this.professionalsService.professionals;
  readonly roles = Object.entries(ROLE_LABELS) as [Role, string][];
  readonly NEW_PROFESSIONAL = NEW_PROFESSIONAL;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  form!: FormGroup;

  ngOnInit(): void {
    const u = this.user();
    this.professionalsService.loadProfessionals();
    this.form = this.fb.group({
      username: [{ value: u?.username ?? '', disabled: !!u }, [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,}$/i)]],
      email: [u?.email ?? '', [Validators.email]],
      firstName: [u?.firstName ?? '', [Validators.required]],
      lastName: [u?.lastName ?? '', [Validators.required]],
      role: [u?.role ?? 'odontologo', [Validators.required]],
      sedeId: [u?.sedeId?._id ?? ''],
      professionalId: [u?.professionalId?._id ?? ''],
      password: ['', u ? [] : [Validators.required, Validators.minLength(8)]],
    });
  }

  isEditMode(): boolean {
    return !!this.user();
  }

  get role(): Role {
    return this.form.get('role')?.value;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (this.role !== 'admin' && !v.sedeId) {
      this.errorMessage.set('Elegí la sede del usuario');
      return;
    }
    if (this.role === 'odontologo' && !v.professionalId) {
      this.errorMessage.set('Un odontólogo debe estar vinculado a un profesional');
      return;
    }

    const createProfessional = v.professionalId === NEW_PROFESSIONAL;
    const dto: UserFormDto = {
      email: v.email?.trim() || undefined,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      role: v.role,
      sedeId: v.sedeId || undefined,
      // '' desvincula (p.ej. si dejó de ser odontólogo)
      professionalId: this.role === 'odontologo' && !createProfessional ? v.professionalId : '',
    };

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const result = this.isEditMode()
        ? await this.admin.updateUser(this.user()!._id, dto)
        : await this.admin.createUser({ ...dto, username: v.username.trim(), password: v.password, createProfessional });
      this.saved.emit(result);
    } catch (err: any) {
      this.errorMessage.set(err.message);
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    this.closed.emit();
  }
}
