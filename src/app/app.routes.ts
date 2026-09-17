import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'turnero', pathMatch: 'full' },
  {
    path: 'turnero',
    loadComponent: () => import('./features/turnero/turnero.component')
      .then(m => m.TurneroComponent)
  }
];
