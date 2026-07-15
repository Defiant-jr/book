import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import { createApp } from './app.js';

test('GET /health retorna status ok', async (t) => {
  const { app } = await createApp({ withFrontend: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => server.close());

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Servidor retornou endereço inválido para teste');
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, { status: 'ok' });
});

const listenForTest = async (app, t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => server.close());

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Servidor retornou endereço inválido para teste');
  }

  return `http://127.0.0.1:${address.port}`;
};

test('POST /api/google-calendar/events valida campos obrigatorios', async (t) => {
  const { app } = await createApp({ withFrontend: false });
  const baseUrl = await listenForTest(app, t);

  const response = await fetch(`${baseUrl}/api/google-calendar/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '' })
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Informe Titulo, Data, Hora Inicio e Hora Fim.');
});

test('GET /api/google-calendar/events explica token sem escopo de Calendar', async (t) => {
  const previousAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  const previousConsoleError = console.error;

  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = 'test-access-token';
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      error: {
        message: 'Request had insufficient authentication scopes.'
      }
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });

  t.after(() => {
    if (previousAccessToken == null) {
      delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    } else {
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = previousAccessToken;
    }
    globalThis.fetch = previousFetch;
    console.error = previousConsoleError;
  });
  console.error = () => {};

  const { registerGoogleCalendarRoutes } = await import(`./googleCalendarRoutes.js?scope-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerGoogleCalendarRoutes(app);
  const baseUrl = await listenForTest(app, t);

  const response = await previousFetch(`${baseUrl}/api/google-calendar/events`);

  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.match(payload.message, /Token sem permissao para Google Calendar/);
  assert.match(payload.message, /calendar\.events/);
});
