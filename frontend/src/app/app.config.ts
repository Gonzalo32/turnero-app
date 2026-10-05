import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { KeycloakBearerInterceptor, KeycloakService } from 'keycloak-angular';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

/** Toda la app requiere sesión: si no hay, Keycloak redirige a su pantalla de login (OIDC + PKCE). */
function initKeycloak(keycloak: KeycloakService) {
  return () =>
    keycloak.init({
      config: environment.keycloak,
      initOptions: { onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false },
      // Solo adjuntar el token a nuestra API
      shouldAddToken: (req) => req.url.startsWith(environment.apiUrl),
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    KeycloakService,
    { provide: APP_INITIALIZER, useFactory: initKeycloak, multi: true, deps: [KeycloakService] },
    { provide: HTTP_INTERCEPTORS, useClass: KeycloakBearerInterceptor, multi: true },
  ]
};
