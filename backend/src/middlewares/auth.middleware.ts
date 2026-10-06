import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { config } from '../config/env';
import { createError } from './error.middleware';
import { User, IUser, Role, ROLES } from '../modules/users/user.model';
import { logger } from '../utils/logger';

export interface AuthUser {
  id: string;
  keycloakId: string;
  roles: Role[];
  sedeId?: string;
  professionalId?: string;
  /** Vencimiento del access token (epoch, segundos) */
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const { issuer } = config.keycloak;
// Las claves se piden por la URL interna; el `iss` se valida contra la pública.
const jwks = createRemoteJWKSet(
  new URL(`${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`)
);
const FRONTEND_CLIENT_ID = 'turnero-frontend';

interface KeycloakPayload extends JWTPayload {
  azp?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Verifica un access token de Keycloak y resuelve el usuario del sistema.
 * Compartido por HTTP (requireAuth) y Socket.IO (queue.socket.ts).
 */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  let payload: KeycloakPayload;
  try {
    ({ payload } = await jwtVerify<KeycloakPayload>(token, jwks, { issuer }));
  } catch {
    throw createError('Token inválido o vencido', 401, 'UNAUTHORIZED');
  }
  if (payload.azp !== FRONTEND_CLIENT_ID || !payload.sub || !payload.exp) {
    throw createError('Token no emitido para esta aplicación', 401, 'UNAUTHORIZED');
  }

  const roles = (payload.realm_access?.roles ?? []).filter((r): r is Role => (ROLES as readonly string[]).includes(r));

  let user: IUser | null = await User.findOne({ keycloakId: payload.sub });

  // Bootstrap: el primer admin (creado en Keycloak) se da de alta solo al entrar.
  if (!user && roles.includes('admin')) {
    const created = await User.create({
      keycloakId: payload.sub,
      username: payload.preferred_username ?? payload.sub,
      email: payload.email,
      firstName: payload.given_name ?? payload.preferred_username ?? 'Admin',
      lastName: payload.family_name ?? '-',
      role: 'admin',
    });
    logger.info(`[Auth] Usuario admin provisionado: ${created.username}`);
    user = created;
  }

  if (!user) throw createError('Usuario no habilitado en el sistema', 403, 'USER_NOT_PROVISIONED');
  if (!user.active) throw createError('Usuario desactivado', 403, 'USER_INACTIVE');

  return {
    id: user._id.toString(),
    keycloakId: user.keycloakId,
    roles,
    sedeId: user.sedeId?.toString(),
    professionalId: user.professionalId?.toString(),
    exp: payload.exp,
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw createError('Autenticación requerida', 401, 'UNAUTHORIZED');
    req.user = await verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.roles.some((r) => roles.includes(r))) return next();
    next(createError('No tenés permisos para esta acción', 403, 'FORBIDDEN'));
  };
}

/**
 * Regla de alcance sobre la cola de un profesional:
 * admin → todos; odontólogo → solo el suyo; secretaria → los de su sede.
 */
export async function canAccessProfessional(user: AuthUser, professionalId: string): Promise<boolean> {
  if (user.roles.includes('admin')) return true;
  if (user.professionalId === professionalId) return true;
  if (user.roles.includes('secretaria') && user.sedeId && Types.ObjectId.isValid(professionalId)) {
    return !!(await User.exists({ professionalId, sedeId: user.sedeId, active: true }));
  }
  return false;
}
