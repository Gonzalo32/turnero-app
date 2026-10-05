import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/**
 * Protege el dashboard. La sesión de Keycloak ya está garantizada (onLoad: 'login-required');
 * acá se exige que el usuario esté habilitado en el sistema y haya elegido consultorio.
 */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  try {
    await session.loadUser();
  } catch {
    return router.parseUrl('/login');
  }
  return session.hasWorkspace ? true : router.parseUrl('/login');
};

/** Solo deja pasar a los roles indicados (además de authGuard en el padre). */
export function roleGuard(...roles: string[]): CanActivateFn {
  return async () => {
    const session = inject(SessionService);
    const user = await session.loadUser().catch(() => null);
    return user && roles.includes(user.role) ? true : inject(Router).parseUrl('/dashboard');
  };
}
