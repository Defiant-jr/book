import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { registerAuthRoutes, hashPassword, verifyPassword } from './authRoutes.js';

test('password hashes validate without storing the original password', async () => {
  const hash = await hashPassword('secret-test');
  assert.match(hash, /^scrypt:/);
  assert.equal(await verifyPassword('secret-test', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.equal(await verifyPassword('secret-test', 'scrypt:invalid'), false);
  assert.equal(await verifyPassword('secret-test', 'secret-test'), true);
});

async function setup(t, findUser) {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app, { findUser });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  return (path, body, cookie) => fetch(`${base}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('usuarios login, session and logout; password never returned', async t => {
  const request = await setup(t, async usuario => usuario === 'teste' ? { usuario, senha: 'secret-test' } : null);
  assert.equal((await request('session')).status, 401);
  const login = await request('login', { usuario: ' teste ', senha: 'secret-test' });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  const cookie = header.split(';')[0];
  const body = await login.json();
  assert.equal(body.user.usuario, 'teste');
  assert.equal(JSON.stringify(body).includes('secret-test'), false);
  assert.equal((await request('session', undefined, cookie)).status, 200);
  assert.equal((await request('logout', {}, cookie)).status, 200);
  assert.equal((await request('session', undefined, cookie)).status, 401);
});

test('invalid credentials, invalid body and forged sessions are rejected', async t => {
  const request = await setup(t, async usuario => usuario === 'teste' ? { usuario, senha: 'correct' } : null);
  for (const body of [{ usuario: 'teste', senha: 'wrong' }, { usuario: 'missing', senha: 'correct' }]) {
    const response = await request('login', body);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await request('login', { usuario: {}, senha: 'x' })).status, 400);
  assert.equal((await request('session', undefined, 'book_session=forged')).status, 401);
});

test('database failures do not expose internals', async t => {
  const request = await setup(t, async () => { throw new Error('private database details'); });
  const response = await request('login', { usuario: 'teste', senha: 'x' });
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private database details'), false);
});

test('repeated failed attempts are limited', async t => {
  const request = await setup(t, async () => null);
  for (let i = 0; i < 10; i++) assert.equal((await request('login', { usuario: 'teste', senha: 'x' })).status, 401);
  assert.equal((await request('login', { usuario: 'teste', senha: 'x' })).status, 429);
});
