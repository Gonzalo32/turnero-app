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

  /** Mensaje de éxito tras guardar */
  readonly successMessage = signal<string | null>(null);

  /** Acciones al final de cada fila (lápiz para editar) */
  readonly actions: TableAction<Professional>[] = [
    {
      id: 'edit',
      label: 'Editar odontólogo',
      icon: 'edit'
    }
  ];

  /** Configuración de columnas para la tabla genérica (sin prefijo Dr/a.) */
  readonly columns: TableColumn<Professional>[] = [
    {
      key: 'lastName',
      header: 'Odontólogo',
      type: 'avatar',
      width: '35%',
      format: (_, row) => `${row.lastName}, ${row.firstName}`
    },
    {
      key: 'specialty',
      header: 'Especialidad',
      type: 'text',
      width: '25%',
      format: (val) => val || 'Odontología General'
    },
    {
      key: 'licenseNumber',
      header: 'Matrícula',
      type: 'text',
      width: '20%',
      format: (val) => {
        if (!val) return 'Sin matrícula';
        const str = String(val).trim();
        return /^(MN|MP)/i.test(str) ? str : `MN ${str}`;
      }
    },
    {
      key: 'active',
      header: 'Estado',
      type: 'badge',
      width: '15%',
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
    this.successMessage.set(`Odontólogo ${prof.lastName}, ${prof.firstName} ${actionText} exitosamente.`);
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
