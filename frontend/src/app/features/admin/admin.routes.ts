import { Component } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/** Contenedor con pestañas del panel de administración */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterModule],
  template: `
    <nav class="admin-tabs">
      <a routerLink="usuarios" routerLinkActive="active">Usuarios</a>
      <a routerLink="sedes" routerLinkActive="active">Sedes</a>
    </nav>
    <router-outlet />
  `,
  styles: [`
    .admin-tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e5e7eb; }
    .admin-tabs a { padding: .6rem 1rem; color: #6b7280; text-decoration: none; font-weight: 600; border-bottom: 2px solid transparent; }
    .admin-tabs a.active { color: var(--color-brand-purple); border-bottom-color: var(--color-brand-purple); }
  `]
})
export class AdminShellComponent {}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
      {
        path: 'usuarios',
        loadComponent: () => import('./components/users-list/users-list.component').then(m => m.UsersListComponent)
      },
      {
        path: 'sedes',
        loadComponent: () => import('./components/sedes-list/sedes-list.component').then(m => m.SedesListComponent)
      }
    ]
  }
];
