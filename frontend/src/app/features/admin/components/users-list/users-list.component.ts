import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { TableAction, TableColumn } from '../../../../shared/components/data-table/data-table.model';
import { AdminService } from '../../services/admin.service';
import { AppUser, ROLE_LABELS, Role, Sede } from '../../../../core/models/user.model';
import { UserFormModalComponent } from '../user-form-modal/user-form-modal.component';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, UserFormModalComponent],
  templateUrl: './users-list.component.html',
  styleUrl: '../../../professionals/components/professionals-list/professionals-list.component.scss'
})
export class UsersListComponent implements OnInit {
  private admin = inject(AdminService);

  readonly users = signal<AppUser[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly roleFilter = signal<Role | ''>('');
  readonly filteredUsers = computed(() => {
    const role = this.roleFilter();
    return role ? this.users().filter(u => u.role === role) : this.users();
  });

  readonly isModalOpen = signal(false);
  readonly editingUser = signal<AppUser | null>(null);

  readonly roles = Object.entries(ROLE_LABELS) as [Role, string][];

  readonly actions: TableAction<AppUser>[] = [
    { id: 'edit', label: 'Editar usuario', icon: 'edit' },
    { id: 'reset', label: 'Clave' },
    { id: 'toggle', label: 'Alta/Baja', variant: 'danger' },
  ];

  readonly columns: TableColumn<AppUser>[] = [
    { key: 'lastName', header: 'Usuario', type: 'avatar', width: '28%', format: (_, u) => `${u.lastName}, ${u.firstName}` },
    { key: 'username', header: 'Login', width: '14%' },
    { key: 'role', header: 'Rol', type: 'badge', width: '14%', format: (r: Role) => ROLE_LABELS[r] ?? r, badgeClass: () => 'badge-purple' },
    { key: 'sedeId', header: 'Sede', width: '14%', format: (s) => s?.name ?? '—' },
    {
      key: 'professionalId', header: 'Profesional', width: '16%',
      format: (p) => (p ? `${p.lastName}, ${p.firstName}` : '—')
    },
    {
      key: 'active', header: 'Estado', type: 'badge', width: '10%', align: 'center',
      format: (v) => (v ? 'Activo' : 'Inactivo'), badgeClass: (v) => (v ? 'badge-active' : 'badge-inactive')
    },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [users, sedes] = await Promise.all([this.admin.listUsers(), this.admin.listSedes()]);
      this.users.set(users);
      this.sedes.set(sedes);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  openModal(user: AppUser | null): void {
    this.editingUser.set(user);
    this.isModalOpen.set(true);
  }

  async onAction({ action, row }: { action: string; row: AppUser }): Promise<void> {
    try {
      if (action === 'edit') return this.openModal(row);
      if (action === 'reset') {
        const pwd = prompt(`Nueva contraseña temporal para ${row.username} (mín. 8 caracteres). Deberá cambiarla al ingresar:`);
        if (!pwd) return;
        await this.admin.resetPassword(row._id, pwd);
        this.flash(`Contraseña temporal asignada a ${row.username}.`);
      }
      if (action === 'toggle') {
        const verb = row.active ? 'desactivar' : 'activar';
        if (!confirm(`¿Seguro que querés ${verb} a ${row.username}?`)) return;
        await this.admin.setUserActive(row._id, !row.active);
        this.flash(`Usuario ${row.username} ${row.active ? 'desactivado' : 'activado'}.`);
        await this.loadData();
      }
    } catch (err: any) {
      this.error.set(err.message);
    }
  }

  async onSaved(user: AppUser): Promise<void> {
    const isEdit = !!this.editingUser();
    this.isModalOpen.set(false);
    this.flash(`Usuario ${user.username} ${isEdit ? 'actualizado' : 'creado'}.`);
    await this.loadData();
  }

  private flash(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4500);
  }
}
