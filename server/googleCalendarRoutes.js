const googleCalendarConfig = {
  accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
  clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_TASKS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_TASKS_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'America/Sao_Paulo'
};

let cachedGoogleCalendarAccessToken = null;
let cachedGoogleCalendarAccessTokenExpiresAt = 0;
let cachedGoogleCalendarAuthError = null;
let cachedGoogleCalendarAuthErrorExpiresAt = 0;

const encodeCalendarId = (calendarId) => encodeURIComponent(calendarId).replace(/%40/g, '@');

const getGoogleCalendarAccessToken = async () => {
  if (googleCalendarConfig.accessToken) {
    return googleCalendarConfig.accessToken;
  }

  const now = Date.now();
  if (cachedGoogleCalendarAccessToken && cachedGoogleCalendarAccessTokenExpiresAt > now + 60000) {
    return cachedGoogleCalendarAccessToken;
  }
  if (cachedGoogleCalendarAuthError && cachedGoogleCalendarAuthErrorExpiresAt > now) {
    throw cachedGoogleCalendarAuthError;
  }

  if (!googleCalendarConfig.clientId || !googleCalendarConfig.clientSecret || !googleCalendarConfig.refreshToken) {
    throw new Error('Google Calendar nao configurado. Preencha GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET e GOOGLE_CALENDAR_REFRESH_TOKEN no .env.local. Se usar o mesmo OAuth Client das tarefas, copie GOOGLE_TASKS_CLIENT_ID e GOOGLE_TASKS_CLIENT_SECRET para as variaveis GOOGLE_CALENDAR_* e gere um refresh token com escopo de Calendar.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleCalendarConfig.clientId,
      client_secret: googleCalendarConfig.clientSecret,
      refresh_token: googleCalendarConfig.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    if (payload?.error === 'invalid_grant') {
      cachedGoogleCalendarAuthError = new Error('GOOGLE_CALENDAR_REFRESH_TOKEN invalido, expirado, revogado ou gerado para outro OAuth Client. Gere um novo refresh token no OAuth Playground usando o mesmo GOOGLE_CALENDAR_CLIENT_ID/SECRET e o escopo https://www.googleapis.com/auth/calendar.events.');
      cachedGoogleCalendarAuthErrorExpiresAt = now + 30000;
      throw cachedGoogleCalendarAuthError;
    }
    cachedGoogleCalendarAuthError = new Error(payload?.error_description || 'Failed to refresh Google Calendar access token.');
    cachedGoogleCalendarAuthErrorExpiresAt = now + 30000;
    throw cachedGoogleCalendarAuthError;
  }

  cachedGoogleCalendarAccessToken = payload.access_token;
  cachedGoogleCalendarAccessTokenExpiresAt = now + Number(payload.expires_in || 3600) * 1000;
  cachedGoogleCalendarAuthError = null;
  cachedGoogleCalendarAuthErrorExpiresAt = 0;
  return cachedGoogleCalendarAccessToken;
};

const googleCalendarRequest = async (pathname, options = {}) => {
  const accessToken = await getGoogleCalendarAccessToken();
  const url = new URL(`https://www.googleapis.com/calendar/v3/${pathname}`);

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Google Calendar request failed: ${response.status}`;
    if (/insufficient authentication scopes/i.test(message)) {
      throw new Error('Token sem permissao para Google Calendar. Gere um GOOGLE_CALENDAR_REFRESH_TOKEN com o escopo https://www.googleapis.com/auth/calendar.events.');
    }
    throw new Error(message);
  }
  return payload;
};

const normalizeDate = (value) => {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const normalizeTime = (value) => {
  const text = String(value || '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(text) ? text : null;
};

const buildDateTime = (date, time) => `${date}T${time}:00`;

const hasValidTimeRange = (startTime, endTime) => startTime < endTime;

const mapGoogleCalendarEvent = (event) => {
  const startValue = event?.start?.dateTime || (event?.start?.date ? `${event.start.date}T00:00:00` : '');
  const endValue = event?.end?.dateTime || (event?.end?.date ? `${event.end.date}T23:59:00` : '');

  return {
    id: event.id,
    title: event.summary || '',
    notes: event.description || '',
    date: startValue.slice(0, 10),
    startTime: startValue.slice(11, 16) || '00:00',
    endTime: endValue.slice(11, 16) || '23:59',
    category: 'administrativo',
    updated: event.updated || null,
    htmlLink: event.htmlLink || null
  };
};

const buildCalendarEventPayload = ({ title, notes, date, startTime, endTime }) => ({
  summary: title,
  description: notes || undefined,
  start: {
    dateTime: buildDateTime(date, startTime),
    timeZone: googleCalendarConfig.timeZone
  },
  end: {
    dateTime: buildDateTime(date, endTime),
    timeZone: googleCalendarConfig.timeZone
  }
});

const calendarEventsPath = () => `calendars/${encodeCalendarId(googleCalendarConfig.calendarId)}/events`;

export const registerGoogleCalendarRoutes = (app) => {
  app.get('/api/google-calendar/events', async (_req, res) => {
    try {
      const now = new Date();
      const timeMin = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
      const timeMax = new Date(Date.UTC(now.getUTCFullYear() + 2, 11, 31, 23, 59, 59)).toISOString();

      const payload = await googleCalendarRequest(calendarEventsPath(), {
        searchParams: {
          singleEvents: true,
          orderBy: 'startTime',
          showDeleted: false,
          maxResults: 2500,
          timeMin,
          timeMax
        }
      });

      return res.json({
        success: true,
        events: (payload?.items || []).map(mapGoogleCalendarEvent)
      });
    } catch (error) {
      console.error('[server] Google Calendar list failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao carregar compromissos do Google Calendar.'
      });
    }
  });

  app.post('/api/google-calendar/events', async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const date = normalizeDate(req.body?.date);
    const startTime = normalizeTime(req.body?.startTime);
    const endTime = normalizeTime(req.body?.endTime);

    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Informe Titulo, Data, Hora Inicio e Hora Fim.'
      });
    }
    if (!hasValidTimeRange(startTime, endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Hora Fim deve ser maior que Hora Inicio.'
      });
    }

    try {
      const event = await googleCalendarRequest(calendarEventsPath(), {
        method: 'POST',
        body: buildCalendarEventPayload({ title, notes, date, startTime, endTime })
      });

      return res.status(201).json({
        success: true,
        event: mapGoogleCalendarEvent(event)
      });
    } catch (error) {
      console.error('[server] Google Calendar create failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar compromisso no Google Calendar.'
      });
    }
  });

  app.patch('/api/google-calendar/events/:eventId', async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const date = normalizeDate(req.body?.date);
    const startTime = normalizeTime(req.body?.startTime);
    const endTime = normalizeTime(req.body?.endTime);

    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Informe Titulo, Data, Hora Inicio e Hora Fim.'
      });
    }
    if (!hasValidTimeRange(startTime, endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Hora Fim deve ser maior que Hora Inicio.'
      });
    }

    try {
      const event = await googleCalendarRequest(`${calendarEventsPath()}/${encodeURIComponent(req.params.eventId)}`, {
        method: 'PATCH',
        body: buildCalendarEventPayload({ title, notes, date, startTime, endTime })
      });

      return res.json({
        success: true,
        event: mapGoogleCalendarEvent(event)
      });
    } catch (error) {
      console.error('[server] Google Calendar update failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar compromisso no Google Calendar.'
      });
    }
  });

  app.delete('/api/google-calendar/events/:eventId', async (req, res) => {
    try {
      await googleCalendarRequest(`${calendarEventsPath()}/${encodeURIComponent(req.params.eventId)}`, {
        method: 'DELETE'
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('[server] Google Calendar delete failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao remover compromisso do Google Calendar.'
      });
    }
  });
};
