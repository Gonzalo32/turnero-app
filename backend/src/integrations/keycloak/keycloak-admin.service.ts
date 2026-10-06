import { config } from '../../config/env';
import { createError } from '../../middlewares/error.middleware';
import { Role, ROLES } from '../../modules/users/user.model';

/**
 * Cliente mínimo de la Admin REST API de Keycloak.
 * Usa el service account del cliente confidencial `turnero-backend` (client_credentials).
 */
const { url, realm, adminClientId, adminClientSecret } = config.keycloak;
const adminBase = `${url}/admin/realms/${realm}`;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) return cachedToken.value;
  const res = await fetch(`${url}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: adminClientId,
      client_secret: adminClientSecret,
    }),
  });
  if (!res.ok) throw createError('No se pudo autenticar contra Keycloak', 502, 'KEYCLOAK_ERROR');
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function kc(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${adminBase}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 409) throw createError('El usuario o email ya existe en Keycloak', 409, 'USER_ALREADY_EXISTS');
  if (!res.ok) {
    throw createError(`Keycloak respondió ${res.status} en ${init.method ?? 'GET'} ${path}`, 502, 'KEYCLOAK_ERROR');
  }
  return res;
}

export interface KeycloakUserInput {
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
}

export const keycloakAdmin = {
  /** Crea el usuario con contraseña temporal y devuelve su id (sub). */
  async createUser(input: KeycloakUserInput, temporaryPassword: string): Promise<string> {
    const res = await kc('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        enabled: true,
        emailVerified: !!input.email,
        credentials: [{ type: 'password', value: temporaryPassword, temporary: true }],
      }),
    });
    const id = res.headers.get('location')?.split('/').pop();
    if (!id) throw createError('Keycloak no devolvió el id del usuario', 502, 'KEYCLOAK_ERROR');
    return id;
  },

  async updateUser(id: string, input: Partial<KeycloakUserInput>): Promise<void> {
    await kc(`/users/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await kc(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    if (!enabled) await kc(`/users/${id}/logout`, { method: 'POST' });
  },

  async resetPassword(id: string, password: string): Promise<void> {
    await kc(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: password, temporary: true }),
    });
  },

  /** Deja al usuario con exactamente un rol de la app (quita los demás de ROLES). */
  async setRealmRole(id: string, role: Role): Promise<void> {
    const all = (await (await kc('/roles')).json()) as { id: string; name: string }[];
    const appRoles = all.filter((r) => (ROLES as readonly string[]).includes(r.name));
    const target = appRoles.find((r) => r.name === role);
    if (!target) throw createError(`El rol ${role} no existe en Keycloak`, 500, 'KEYCLOAK_ERROR');
    const others = appRoles.filter((r) => r.name !== role);
    if (others.length) {
      await kc(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: JSON.stringify(others) });
    }
    await kc(`/users/${id}/role-mappings/realm`, { method: 'POST', body: JSON.stringify([target]) });
  },

  async deleteUser(id: string): Promise<void> {
    await kc(`/users/${id}`, { method: 'DELETE' });
  },
};
