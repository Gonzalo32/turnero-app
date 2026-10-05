export const environment = {
  production: true,
  apiUrl: '/api/v1',
  socketUrl: '',
  // TODO: URL pública de Keycloak en producción
  keycloak: { url: '/auth', realm: 'senza', clientId: 'turnero-frontend' },
};
