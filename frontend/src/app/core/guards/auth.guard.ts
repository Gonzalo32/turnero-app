import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/**
 * Guard para proteger las rutas del dashboard.
 * Si el usuario no tiene una sesión activa, lo redirige al login.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isLoggedIn) {
    return true;
  }

  session.logout();
  router.navigate(['/login']);
  return false;
};

/**
 * Pantallas de administración. Es solo navegación: la API rechaza con 403
 * cualquier operación de administración de un usuario que no sea ADMIN.
 */
export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isAdmin()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
