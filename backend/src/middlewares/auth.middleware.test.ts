// Chequeo mínimo de la barrera de autenticación. No necesita MongoDB:
// todos los casos se resuelven en los middlewares, antes de tocar la base.
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:1/test';
process.env['TOTEM_API_KEY'] = 'test-totem-key';
process.env['JWT_SECRET'] = 'test-jwt-secret';

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { httpServer } from '../app';
import { signToken } from './auth.middleware';
import { UserRole } from '../modules/professionals/professional.model';

let base = '';
const ID = '507f1f77bcf86cd799439011';
const professional = signToken({ id: ID, role: UserRole.PROFESSIONAL });

before(() => new Promise<void>((resolve) => httpServer.listen(0, () => {
  base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/api/v1`;
  resolve();
})));
after(() => { httpServer.close(); httpServer.closeAllConnections(); });

const call = (path: string, token?: string, method = 'GET') =>
  fetch(base + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('sin token: cola y profesionales responden 401', async () => {
  for (const [path, method] of [
    ['/queue', 'GET'], ['/queue', 'POST'], [`/queue/${ID}/call`, 'PATCH'], [`/queue/${ID}/cancel`, 'PATCH'],
    ['/professionals', 'GET'], ['/professionals', 'POST'], [`/professionals/${ID}`, 'PUT'], [`/professionals/${ID}`, 'DELETE'],
  ]) {
    const res = await call(path, undefined, method);
    assert.equal(res.status, 401, `${method} ${path}`);
    assert.equal((await res.json()).code, 'UNAUTHORIZED');
  }
});

test('token adulterado, vencido o firmado con otra clave: 401', async () => {
  const expired = jwt.sign({ role: UserRole.ADMIN }, 'test-jwt-secret', { subject: ID, expiresIn: -10 });
  const otherKey = jwt.sign({ role: UserRole.ADMIN }, 'otra-clave', { subject: ID });
  const unsigned = jwt.sign({ role: UserRole.ADMIN }, '', { subject: ID, algorithm: 'none' });
  for (const token of [professional.slice(0, -2) + 'xx', expired, otherKey, unsigned, 'basura']) {
    assert.equal((await call('/queue', token)).status, 401);
  }
});

test('profesional no puede administrar profesionales ni dar altas manuales: 403', async () => {
  for (const [path, method] of [
    ['/professionals', 'POST'], [`/professionals/${ID}`, 'PUT'], [`/professionals/${ID}`, 'DELETE'],
    [`/professionals/${ID}`, 'GET'], ['/queue', 'POST'],
  ]) {
    assert.equal((await call(path, professional, method)).status, 403, `${method} ${path}`);
  }
});

test('profesional no puede ver la cola de otro: 403', async () => {
  assert.equal((await call('/queue?professionalId=507f1f77bcf86cd799439012', professional)).status, 403);
});

test('integración del tótem sigue exigiendo su clave', async () => {
  assert.equal((await call('/integrations/totem/professionals')).status, 401);
  assert.equal((await call('/integrations/totem/professionals', professional)).status, 401);
});
