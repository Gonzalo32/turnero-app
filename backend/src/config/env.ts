import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Variables de entorno tipadas y validadas al inicio del servidor.
 * Falla rápido si falta alguna variable crítica.
 */
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Variable de entorno requerida no encontrada: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4300',
  mongodbUri: requireEnv('MONGODB_URI'),
  totemApiKey: requireEnv('TOTEM_API_KEY'),
  totemMongodbUri: process.env['TOTEM_MONGODB_URI'] ?? '',
  keycloak: {
    url: process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
    realm: process.env['KEYCLOAK_REALM'] ?? 'senza',
    adminClientId: process.env['KEYCLOAK_ADMIN_CLIENT_ID'] ?? 'turnero-backend',
    adminClientSecret: requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET'),
  },
} as const;

export const isDev = config.nodeEnv === 'development';
