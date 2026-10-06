export const environment = {
  production: true,
  apiUrl: '/api/v1',
  socketUrl: '',
  // Keycloak se publica en el subdominio auth. del mismo dominio (deploy/Caddyfile)
  keycloak: { url: `${location.protocol}//auth.${location.host}`, realm: 'senza', clientId: 'turnero-frontend' },
};
