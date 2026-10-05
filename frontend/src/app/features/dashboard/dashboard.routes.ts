import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard.component').then(m => m.DashboardComponent),
    children: [
      { path: '', redirectTo: 'pacientes', pathMatch: 'full' },
      {
        path: 'pacientes',
        loadChildren: () =>
          import('../queue/queue.routes').then(m => m.QUEUE_ROUTES)
      },
      {
        path: 'odontologos',
        canActivate: [roleGuard('admin')],
        loadChildren: () =>
          import('../professionals/professionals.routes').then(m => m.PROFESSIONALS_ROUTES)
      },
      {
        path: 'admin',
        canActivate: [roleGuard('admin')],
        loadChildren: () =>
          import('../admin/admin.routes').then(m => m.ADMIN_ROUTES)
      }
    ]
  }
];
