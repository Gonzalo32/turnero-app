import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfessionalsService } from '../../services/professionals.service';
import { Professional } from '../../models/professional.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { TableColumn, TableAction } from '../../../../shared/components/data-table/data-table.model';
import { ProfessionalFormModalComponent } from '../professional-form-modal/professional-form-modal.component';

@Component({
  selector: 'app-professionals-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, ProfessionalFormModalComponent],
  templateUrl: './professionals-list.component.html',
  styleUrl: './professionals-list.component.scss'
})
export class ProfessionalsListComponent implements OnInit {
  private professionalsService = inject(ProfessionalsService);

  readonly professionals = this.professionalsService.professionals;
  readonly loading = this.professionalsService.loading;
  readonly error = this.professionalsService.error;

  /** Control del modal de formulario */
  readonly isModalOpen = signal<boolean>(false);
  readonly editingProfessional = signal<Professional | null>(null);

  /** Control del modal de confirmación de baja lógica */
  readonly deletingProfessional = signal<Professional | null>(null);
  readonly deleting = signal<boolean>(false);
  readonly deleteError = signal<string | null>(null);

  /** Mensaje de éxito tras guardar o desactivar */
  readonly successMessage = signal<string | null>(null);

  /** Acciones al final de cada fila (editar y eliminar lógico) */
  readonly actions: TableAction<Professional>[] = [
    {
      id: 'edit',
      label: 'Editar odontólogo',
      icon: 'edit'
    },
    {
      id: 'delete',
      label: 'Eliminar odontólogo',
      icon: 'delete',
      variant: 'danger'
    }
  ];

  /** Configuración de columnas para la tabla genérica (sin prefijo Dr/a. ni autocompletado de matrícula) */
  readonly columns: TableColumn<Professional>[] = [
    {
      key: 'lastName',
      header: 'Odontólogo',
      type: 'avatar',
      width: '28%',
      format: (_, row) => `${row.lastName}, ${row.firstName}`
    },
    {
      key: 'licenseNumber',
      header: 'Matrícula',
      type: 'text',
      width: '16%',
      format: (val) => (val ? String(val).trim() : 'Sin matrícula')
    },
    {
      key: 'phone',
      header: 'Teléfono',
      type: 'text',
      width: '18%',
      format: (val) => (val ? String(val).trim() : '—')
    },
    {
      key: 'email',
      header: 'Correo',
      type: 'text',
      width: '24%',
      format: (val) => (val ? String(val).trim() : '—')
    },
    {
      key: 'active',
      header: 'Estado',
      type: 'badge',
      width: '14%',
      align: 'center',
      format: (val) => (val ? 'Activo' : 'Inactivo'),
      badgeClass: (val) => (val ? 'badge-active' : 'badge-inactive')
    }
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.professionalsService.loadProfessionals();
  }

  onCreateProfessional(): void {
    this.editingProfessional.set(null);
    this.isModalOpen.set(true);
  }

  onAction(event: { action: string; row: Professional }): void {
    if (event.action === 'edit') {
      this.editingProfessional.set(event.row);
      this.isModalOpen.set(true);
    } else if (event.action === 'delete') {
      this.deleteError.set(null);
      this.deletingProfessional.set(event.row);
    }
  }

  onDeleteCancel(): void {
    if (this.deleting()) return;
    this.deletingProfessional.set(null);
    this.deleteError.set(null);
  }

  async onDeleteConfirm(): Promise<void> {
    const prof = this.deletingProfessional();
    if (!prof || this.deleting()) return;

    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.professionalsService.deactivateProfessional(prof._id);
      this.deletingProfessional.set(null);
      this.showSuccess(`Odontólogo ${prof.lastName}, ${prof.firstName} eliminado exitosamente.`);
    } catch (err: any) {
      this.deleteError.set(err?.message || 'No se pudo eliminar el odontólogo');
    } finally {
      this.deleting.set(false);
    }
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.editingProfessional.set(null);
  }

  onProfessionalSaved(prof: Professional): void {
    const isEdit = !!this.editingProfessional();
    this.isModalOpen.set(false);
    this.editingProfessional.set(null);

    const actionText = isEdit ? 'actualizado' : 'creado';
    this.showSuccess(`Odontólogo ${prof.lastName}, ${prof.firstName} ${actionText} exitosamente.`);
  }

  private showSuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4500);
  }

  onRowSelected(prof: Professional): void {
    // Al hacer click en la fila, también permite ver/editar al profesional
    this.editingProfessional.set(prof);
    this.isModalOpen.set(true);
  }
}
