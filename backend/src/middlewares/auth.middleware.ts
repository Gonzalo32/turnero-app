import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { createError } from './error.middleware';
import { UserRole } from '../modules/professionals/professional.model';

/** Usuario autenticado, extraído del JWT. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifica un JWT y devuelve el usuario. Lo usan el middleware HTTP y el handshake de Socket.IO.
 * ponytail: no consulta la base en cada request; un usuario desactivado conserva acceso hasta
 * que vence su token (JWT_EXPIRES_IN). Agregar chequeo en DB o lista de revocación si hace falta.
 */
export function verifyToken(token: unknown): AuthUser {
  try {
    if (typeof token !== 'string') throw new Error('token ausente');
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const role = payload['role'] as UserRole;
    if (!payload.sub || !Object.values(UserRole).includes(role)) throw new Error('payload inválido');
    return { id: payload.sub, role };
  } catch {
    throw createError('Sesión inválida o expirada', 401, 'UNAUTHORIZED');
  }
}

/** Exige `Authorization: Bearer <jwt>` válido y deja el usuario en req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    req.user = verifyToken(scheme === 'Bearer' ? token : undefined);
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige que el usuario autenticado tenga alguno de los roles indicados. Usar después de requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createError('No tenés permisos para esta acción', 403, 'FORBIDDEN'));
    }
    next();
  };
}
