import { Component, OnInit, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfessionalsService } from '../../services/professionals.service';
import { Professional, DENTAL_SPECIALTIES, CreateProfessionalDto } from '../../models/professional.model';

@Component({
  selector: 'app-professional-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './professional-form-modal.component.html',
  styleUrl: './professional-form-modal.component.scss'
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

  readonly specialties = DENTAL_SPECIALTIES;

  /** Colores predefinidos de Senza para identificar profesionales en turnero / agenda */
  readonly presetColors = [
    { label: 'Senza Mauve', value: '#866385' },
    { label: 'Púrpura Profundo', value: '#6a3260' },
    { label: 'Verde Esmeralda', value: '#059669' },
    { label: 'Azul Índigo', value: '#4f46e5' },
    { label: 'Turquesa Mar', value: '#0891b2' },
    { label: 'Ámbar Cálido', value: '#d97706' },
    { label: 'Rosa Magenta', value: '#db2777' },
  ];

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
      dni: [prof?.dni || '', [Validators.pattern(/^[0-9]{7,9}$/)]],
      licenseNumber: [prof?.licenseNumber || ''],
      birthDate: [prof?.birthDate ? prof.birthDate.substring(0, 10) : ''],
      email: [prof?.email || '', [Validators.email]],
      phone: [prof?.phone || ''],
      address: [prof?.address || ''],
      specialty: [prof?.specialty || 'Odontología General', [Validators.required]],
      colorTag: [prof?.colorTag || '#866385'],
      notes: [prof?.notes || ''],
      password: ['', isEdit ? [] : [Validators.minLength(6)]],
      confirmPassword: ['']
    });
  }

  isEditMode(): boolean {
    return !!this.professional();
  }

  selectColor(color: string): void {
    this.form.patchValue({ colorTag: color });
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

    // Validación de coincidencia de contraseña si se ingresó
    if (val.password && val.password !== val.confirmPassword) {
      this.errorMessage.set('Las contraseñas ingresadas no coinciden');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const dto: CreateProfessionalDto = {
      firstName: val.firstName.trim(),
      lastName: val.lastName.trim(),
      licenseNumber: val.licenseNumber?.trim() || undefined,
      dni: val.dni?.trim() || undefined,
      birthDate: val.birthDate || undefined,
      email: val.email?.trim() || undefined,
      password: val.password || undefined,
      phone: val.phone?.trim() || undefined,
      address: val.address?.trim() || undefined,
      specialty: val.specialty,
      colorTag: val.colorTag,
      notes: val.notes?.trim() || undefined,
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
