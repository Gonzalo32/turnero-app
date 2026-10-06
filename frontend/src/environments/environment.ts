export const environment = {
  production: false,
  /** URL base de la API versionada (AGENTS.md §42) */
  apiUrl: 'http://localhost:3001/api/v1',
  /** URL del servidor Socket.IO */
  socketUrl: 'http://localhost:3001',
  keycloak: { url: 'http://localhost:8080', realm: 'senza', clientId: 'turnero-frontend' },
};
