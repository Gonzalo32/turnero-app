import { Component, OnInit, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfessionalsService } from '../../services/professionals.service';
import { Professional, CreateProfessionalDto } from '../../models/professional.model';

@Component({
  selector: 'app-professional-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './professional-form-modal.component.html'
})
export class ProfessionalFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private professionalsService = inject(ProfessionalsService);

  /** Si se pasa un profesional, es modo edición; si es null, es modo creación */
  readonly professional = input<Professional | null>(null);

  /** Evento al cerrar el modal */
  readonly closed = output<void>();

  /** Evento al guardar exitosamente */
  readonly saved = output<Professional>();

  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  form!: FormGroup;

  ngOnInit(): void {
    const isEdit = !!this.professional();
    const prof = this.professional();

    this.form = this.fb.group({
      firstName: [prof?.firstName || '', [Validators.required, Validators.minLength(2)]],
      lastName: [prof?.lastName || '', [Validators.required, Validators.minLength(2)]],
      licenseNumber: [prof?.licenseNumber || '', [Validators.required]],
      email: [prof?.email || '', [Validators.required, Validators.email]],
      password: ['', isEdit ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)]],
      dni: [prof?.dni || '', [Validators.pattern(/^[0-9]{7,9}$/)]],
      birthDate: [prof?.birthDate ? prof.birthDate.substring(0, 10) : ''],
      phone: [prof?.phone || ''],
      address: [prof?.address || '']
    });
  }

  isEditMode(): boolean {
    return !!this.professional();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;

    this.saving.set(true);
    this.errorMessage.set(null);

    const dto: CreateProfessionalDto = {
      firstName: val.firstName.trim(),
      lastName: val.lastName.trim(),
      licenseNumber: val.licenseNumber.trim(),
      email: val.email.trim(),
      password: val.password ? val.password : undefined,
      dni: val.dni?.trim() || undefined,
      birthDate: val.birthDate || undefined,
      phone: val.phone?.trim() || undefined,
      address: val.address?.trim() || undefined
    };

    try {
      let result: Professional;
      if (this.isEditMode()) {
        const id = this.professional()!._id;
        result = await this.professionalsService.updateProfessional(id, dto);
      } else {
        result = await this.professionalsService.createProfessional(dto);
      }

      this.saved.emit(result);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Error al guardar el profesional');
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    this.closed.emit();
  }
}
