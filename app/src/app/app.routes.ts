import { Routes } from '@angular/router';

/**
 * Rutas raíz de la aplicación.
 * Cada feature gestiona sus propias rutas internas en su archivo *.routes.ts.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },

  { path: '**', redirectTo: 'login' }
];
