import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { TableAction, TableColumn } from '../../../../shared/components/data-table/data-table.model';
import { AdminService } from '../../services/admin.service';
import { Sede } from '../../../../core/models/user.model';

/** ABM de sedes. Los consultorios se cargan como lista separada por comas. */
@Component({
  selector: 'app-sedes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  template: `
    <div class="section-header">
      <div class="section-title-group">
        <h2 class="section-title">Sedes</h2>
        <p class="section-sub">Clínicas y sus consultorios</p>
      </div>
    </div>

    <div class="error-banner" *ngIf="error()">
      <span>{{ error() }}</span>
      <button class="btn-retry" (click)="error.set(null)">×</button>
    </div>

    <form class="success-banner" style="flex-wrap:wrap;gap:.5rem" (submit)="$event.preventDefault(); save()">
      <strong>{{ editing() ? 'Editar sede' : 'Nueva sede' }}</strong>
      <input [(ngModel)]="name" name="name" placeholder="Nombre" required />
      <input [(ngModel)]="address" name="address" placeholder="Dirección" />
      <input [(ngModel)]="offices" name="offices" placeholder="Consultorio 1, Consultorio 2, ..." style="flex:1;min-width:220px" />
      <button class="btn-primary-add" type="submit" [disabled]="!name.trim()">{{ editing() ? 'Guardar' : 'Agregar' }}</button>
      <button class="btn-refresh" type="button" *ngIf="editing()" (click)="reset()" title="Cancelar">×</button>
    </form>

    <app-data-table
      [columns]="columns"
      [data]="sedes()"
      [actions]="actions"
      [loading]="loading()"
      countLabel="sedes"
      emptyMessage="No hay sedes cargadas"
      (actionClick)="onAction($event)"
      (rowClick)="edit($event)"
    />
  `,
  styleUrl: '../../../professionals/components/professionals-list/professionals-list.component.scss'
})
export class SedesListComponent implements OnInit {
  private admin = inject(AdminService);

  readonly sedes = signal<Sede[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<Sede | null>(null);

  name = '';
  address = '';
  offices = '';

  readonly actions: TableAction<Sede>[] = [
    { id: 'edit', label: 'Editar sede', icon: 'edit' },
    { id: 'toggle', label: 'Alta/Baja', variant: 'danger' },
  ];

  readonly columns: TableColumn<Sede>[] = [
    { key: 'name', header: 'Sede', width: '25%' },
    { key: 'address', header: 'Dirección', width: '25%', format: (v) => v || '—' },
    { key: 'offices', header: 'Consultorios', width: '35%', format: (v: string[]) => v?.join(', ') || '—' },
    {
      key: 'active', header: 'Estado', type: 'badge', width: '10%', align: 'center',
      format: (v) => (v ? 'Activa' : 'Inactiva'), badgeClass: (v) => (v ? 'badge-active' : 'badge-inactive')
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.sedes.set(await this.admin.listSedes(true));
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  edit(sede: Sede): void {
    this.editing.set(sede);
    this.name = sede.name;
    this.address = sede.address ?? '';
    this.offices = sede.offices.join(', ');
  }

  reset(): void {
    this.editing.set(null);
    this.name = this.address = this.offices = '';
  }

  async save(): Promise<void> {
    const dto = { name: this.name.trim(), address: this.address.trim(), offices: this.offices.split(',').map(o => o.trim()).filter(Boolean) };
    try {
      const current = this.editing();
      if (current) await this.admin.updateSede(current._id, dto);
      else await this.admin.createSede(dto);
      this.reset();
      await this.load();
    } catch (err: any) {
      this.error.set(err.message);
    }
  }

  async onAction({ action, row }: { action: string; row: Sede }): Promise<void> {
    if (action === 'edit') return this.edit(row);
    try {
      await this.admin.updateSede(row._id, { active: !row.active });
      await this.load();
    } catch (err: any) {
      this.error.set(err.message);
    }
  }
}
