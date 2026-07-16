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
test('POST /api/google-calendar/events resolve agenda por nome antes de inserir', async (t) => {
  const previousAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const previousCalendarId = process.env.GOOGLE_CALENDAR_ID;
  const previousCalendarName = process.env.GOOGLE_CALENDAR_NAME;
  const previousFetch = globalThis.fetch;
  const previousConsoleError = console.error;
  const calls = [];

  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = 'test-access-token';
  delete process.env.GOOGLE_CALENDAR_ID;
  process.env.GOOGLE_CALENDAR_NAME = 'Feriados do Brasil';
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/calendar/v3/users/me/calendarList')) {
      return new Response(JSON.stringify({
        items: [
          { id: 'readonly-calendar-id', summary: 'Feriados do Brasil', accessRole: 'reader' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url).endsWith('/calendar/v3/calendars') && options.method === 'POST') {
      return new Response(JSON.stringify({ id: 'created-calendar-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url).includes('/calendar/v3/calendars/created-calendar-id/events') && options.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'event-id',
        summary: 'Teste',
        description: 'Detalhe',
        start: { dateTime: '2026-07-20T09:00:00' },
        end: { dateTime: '2026-07-20T10:00:00' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: { message: `Unexpected ${url}` } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  t.after(() => {
    if (previousAccessToken == null) {
      delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    } else {
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = previousAccessToken;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarName == null) {
      delete process.env.GOOGLE_CALENDAR_NAME;
    } else {
      process.env.GOOGLE_CALENDAR_NAME = previousCalendarName;
    }
    globalThis.fetch = previousFetch;
    console.error = previousConsoleError;
  });
  console.error = () => {};

  const { registerGoogleCalendarRoutes } = await import(`./googleCalendarRoutes.js?calendar-name-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerGoogleCalendarRoutes(app);
  const baseUrl = await listenForTest(app, t);

  const response = await previousFetch(`${baseUrl}/api/google-calendar/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Teste',
      notes: 'Detalhe',
      date: '2026-07-20',
      startTime: '09:00',
      endTime: '10:00'
    })
  });

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.event.id, 'event-id');
  assert.ok(calls.some((call) => call.url.includes('/calendar/v3/users/me/calendarList')));
  assert.ok(calls.some((call) => call.url.endsWith('/calendar/v3/calendars') && call.options.method === 'POST'));
  assert.ok(calls.some((call) => call.url.includes('/calendar/v3/calendars/created-calendar-id/events')));
});
test('POST /api/google-calendar/events prefere GOOGLE_CALENDAR_ID explicito ao nome', async (t) => {
  const previousAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const previousCalendarId = process.env.GOOGLE_CALENDAR_ID;
  const previousCalendarName = process.env.GOOGLE_CALENDAR_NAME;
  const previousFetch = globalThis.fetch;
  const previousConsoleError = console.error;
  const calls = [];

  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = 'test-access-token';
  process.env.GOOGLE_CALENDAR_ID = 'feriados-brasil-calendar-id';
  process.env.GOOGLE_CALENDAR_NAME = 'Feriados do Brasil';
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/calendar/v3/calendars/feriados-brasil-calendar-id/events') && options.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'event-id',
        summary: 'Teste',
        start: { dateTime: '2026-07-20T09:00:00' },
        end: { dateTime: '2026-07-20T10:00:00' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: { message: `Unexpected ${url}` } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  t.after(() => {
    if (previousAccessToken == null) {
      delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    } else {
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = previousAccessToken;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarName == null) {
      delete process.env.GOOGLE_CALENDAR_NAME;
    } else {
      process.env.GOOGLE_CALENDAR_NAME = previousCalendarName;
    }
    globalThis.fetch = previousFetch;
    console.error = previousConsoleError;
  });
  console.error = () => {};

  const { registerGoogleCalendarRoutes } = await import(`./googleCalendarRoutes.js?calendar-id-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerGoogleCalendarRoutes(app);
  const baseUrl = await listenForTest(app, t);

  const response = await previousFetch(`${baseUrl}/api/google-calendar/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Teste',
      date: '2026-07-20',
      startTime: '09:00',
      endTime: '10:00'
    })
  });

  assert.equal(response.status, 201);
  assert.equal(calls.some((call) => call.url.includes('/calendar/v3/users/me/calendarList')), false);
  assert.equal(calls.some((call) => call.url.endsWith('/calendar/v3/calendars') && call.options.method === 'POST'), false);
  assert.ok(calls.some((call) => call.url.includes('/calendar/v3/calendars/feriados-brasil-calendar-id/events')));
});
test('GET /api/google-calendar/events agrega eventos de todas as agendas disponiveis', async (t) => {
  const previousAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const previousCalendarId = process.env.GOOGLE_CALENDAR_ID;
  const previousCalendarName = process.env.GOOGLE_CALENDAR_NAME;
  const previousFetch = globalThis.fetch;
  const previousConsoleError = console.error;

  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = 'test-access-token';
  delete process.env.GOOGLE_CALENDAR_ID;
  delete process.env.GOOGLE_CALENDAR_NAME;

  globalThis.fetch = async (url) => {
    const textUrl = String(url);

    if (textUrl.includes('/calendar/v3/users/me/calendarList')) {
      return new Response(JSON.stringify({
        items: [
          { id: 'primary', summary: 'Jorge', accessRole: 'owner', backgroundColor: '#f6bf26' },
          { id: 'family-calendar-id', summary: 'Family', accessRole: 'reader', backgroundColor: '#33b679' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (textUrl.includes('/calendar/v3/calendars/primary/events')) {
      return new Response(JSON.stringify({
        items: [
          {
            id: 'primary-event',
            summary: 'Reuniao',
            start: { dateTime: '2026-07-20T09:00:00' },
            end: { dateTime: '2026-07-20T10:00:00' }
          }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (textUrl.includes('/calendar/v3/calendars/family-calendar-id/events')) {
      return new Response(JSON.stringify({
        items: [
          {
            id: 'family-event',
            summary: 'Aniversario',
            start: { date: '2026-07-21' },
            end: { date: '2026-07-22' }
          }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: { message: `Unexpected ${url}` } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  t.after(() => {
    if (previousAccessToken == null) {
      delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    } else {
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = previousAccessToken;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarName == null) {
      delete process.env.GOOGLE_CALENDAR_NAME;
    } else {
      process.env.GOOGLE_CALENDAR_NAME = previousCalendarName;
    }
    globalThis.fetch = previousFetch;
    console.error = previousConsoleError;
  });
  console.error = () => {};

  const { registerGoogleCalendarRoutes } = await import(`./googleCalendarRoutes.js?all-calendars-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerGoogleCalendarRoutes(app);
  const baseUrl = await listenForTest(app, t);

  const response = await previousFetch(`${baseUrl}/api/google-calendar/events`);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.calendars.length, 2);
  assert.equal(payload.events.length, 2);
  assert.deepEqual(payload.events.map((event) => event.calendarSummary).sort(), ['Family', 'Jorge']);
  assert.ok(payload.events.every((event) => event.calendarId && event.key));
});
test('POST /api/google-calendar/events usa primary quando GOOGLE_CALENDAR_ID esta configurado como primary', async (t) => {
  const previousAccessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const previousCalendarId = process.env.GOOGLE_CALENDAR_ID;
  const previousCalendarName = process.env.GOOGLE_CALENDAR_NAME;
  const previousFetch = globalThis.fetch;
  const previousConsoleError = console.error;
  const calls = [];

  process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = 'test-access-token';
  process.env.GOOGLE_CALENDAR_ID = 'primary';
  process.env.GOOGLE_CALENDAR_NAME = 'Aniversarios';
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/calendar/v3/calendars/primary/events') && options.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'event-id',
        summary: 'Teste',
        start: { dateTime: '2026-07-20T09:00:00' },
        end: { dateTime: '2026-07-20T10:00:00' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: { message: `Unexpected ${url}` } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  t.after(() => {
    if (previousAccessToken == null) {
      delete process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    } else {
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN = previousAccessToken;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarId == null) {
      delete process.env.GOOGLE_CALENDAR_ID;
    } else {
      process.env.GOOGLE_CALENDAR_ID = previousCalendarId;
    }
    if (previousCalendarName == null) {
      delete process.env.GOOGLE_CALENDAR_NAME;
    } else {
      process.env.GOOGLE_CALENDAR_NAME = previousCalendarName;
    }
    globalThis.fetch = previousFetch;
    console.error = previousConsoleError;
  });
  console.error = () => {};

  const { registerGoogleCalendarRoutes } = await import(`./googleCalendarRoutes.js?primary-id-test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  registerGoogleCalendarRoutes(app);
  const baseUrl = await listenForTest(app, t);

  const response = await previousFetch(`${baseUrl}/api/google-calendar/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Teste',
      date: '2026-07-20',
      startTime: '09:00',
      endTime: '10:00'
    })
  });

  assert.equal(response.status, 201);
  assert.equal(calls.some((call) => call.url.includes('/calendar/v3/users/me/calendarList')), false);
  assert.ok(calls.some((call) => call.url.includes('/calendar/v3/calendars/primary/events')));
});

