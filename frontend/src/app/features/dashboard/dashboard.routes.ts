import { Routes } from '@angular/router';
import { authGuard, adminGuard } from '../../core/guards/auth.guard';

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
        canActivate: [adminGuard],
        loadChildren: () =>
          import('../professionals/professionals.routes').then(m => m.PROFESSIONALS_ROUTES)
      },
      {
        path: 'turnero',
        loadChildren: () =>
          import('../turnero/turnero.routes').then(m => m.TURNERO_ROUTES)
      }
    ]
  }
];
