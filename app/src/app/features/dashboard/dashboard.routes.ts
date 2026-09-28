import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard.component').then(m => m.DashboardComponent),
    children: [
      { path: '', redirectTo: 'pacientes', pathMatch: 'full' },
      {
        path: 'pacientes',
        loadChildren: () =>
          import('../queue/queue.routes').then(m => m.QUEUE_ROUTES)
      }
    ]
  }
];
