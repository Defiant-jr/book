const DEFAULT_GOOGLE_CALENDAR_ID = 'primary';
const configuredGoogleCalendarId = String(process.env.GOOGLE_CALENDAR_ID || '').trim();

const googleCalendarConfig = {
  accessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
  clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_TASKS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_TASKS_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  calendarId: configuredGoogleCalendarId || DEFAULT_GOOGLE_CALENDAR_ID,
  calendarName: process.env.GOOGLE_CALENDAR_NAME,
  timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'America/Sao_Paulo'
};

let cachedGoogleCalendarAccessToken = null;
let cachedGoogleCalendarAccessTokenExpiresAt = 0;
let cachedGoogleCalendarAuthError = null;
let cachedGoogleCalendarAuthErrorExpiresAt = 0;
let cachedGoogleCalendarId = null;
let cachedGoogleCalendarList = null;
let cachedGoogleCalendarListExpiresAt = 0;

const encodeCalendarId = (calendarId) => encodeURIComponent(calendarId).replace(/%40/g, '@');
const calendarEventsPathFor = (calendarId) => `calendars/${encodeCalendarId(calendarId)}/events`;

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
      cachedGoogleCalendarAuthError = new Error('GOOGLE_CALENDAR_REFRESH_TOKEN invalido, expirado, revogado ou gerado para outro OAuth Client. Gere um novo refresh token no OAuth Playground usando o mesmo GOOGLE_CALENDAR_CLIENT_ID/SECRET e os escopos https://www.googleapis.com/auth/calendar e https://www.googleapis.com/auth/calendar.events.');
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
      throw new Error('Token sem permissao para Google Calendar. Gere um GOOGLE_CALENDAR_REFRESH_TOKEN com os escopos https://www.googleapis.com/auth/calendar e https://www.googleapis.com/auth/calendar.events.');
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

const recurrenceFrequencies = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY'
};

const normalizeRecurrenceFrequency = (value) =>
  recurrenceFrequencies[String(value || '').toLowerCase()] || null;

const buildDateTime = (date, time) => `${date}T${time}:00`;
const hasValidTimeRange = (startTime, endTime) => startTime < endTime;

const normalizeCalendarName = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR');

const isWritableCalendar = (calendar) => ['owner', 'writer'].includes(calendar?.accessRole);

const mapGoogleCalendar = (calendar) => ({
  id: calendar.id,
  summary: calendar.summary || calendar.id,
  description: calendar.description || '',
  backgroundColor: calendar.backgroundColor || null,
  foregroundColor: calendar.foregroundColor || null,
  accessRole: calendar.accessRole || 'reader',
  primary: Boolean(calendar.primary),
  selected: calendar.selected !== false,
  canWrite: isWritableCalendar(calendar)
});

const listAvailableGoogleCalendars = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && cachedGoogleCalendarList && cachedGoogleCalendarListExpiresAt > now) {
    return cachedGoogleCalendarList;
  }

  const calendars = [];
  let pageToken = null;
  do {
    const payload = await googleCalendarRequest('users/me/calendarList', {
      searchParams: {
        maxResults: 250,
        minAccessRole: 'reader',
        showDeleted: false,
        showHidden: true,
        pageToken
      }
    });
    calendars.push(...(payload?.items || []).map(mapGoogleCalendar));
    pageToken = payload?.nextPageToken || null;
  } while (pageToken);

  cachedGoogleCalendarList = calendars;
  cachedGoogleCalendarListExpiresAt = now + 60000;
  return calendars;
};

const findOrCreateGoogleCalendarByName = async (calendarName) => {
  const normalizedCalendarName = normalizeCalendarName(calendarName);
  if (!normalizedCalendarName) {
    return googleCalendarConfig.calendarId;
  }
  if (cachedGoogleCalendarId) {
    return cachedGoogleCalendarId;
  }

  const calendarList = await listAvailableGoogleCalendars();
  const matchingCalendars = calendarList.filter(
    (calendar) => normalizeCalendarName(calendar.summary) === normalizedCalendarName
  );
  const writableCalendar = matchingCalendars.find(isWritableCalendar);

  if (writableCalendar?.id) {
    cachedGoogleCalendarId = writableCalendar.id;
    return cachedGoogleCalendarId;
  }

  const createdCalendar = await googleCalendarRequest('calendars', {
    method: 'POST',
    body: {
      summary: calendarName.trim(),
      timeZone: googleCalendarConfig.timeZone
    }
  });

  cachedGoogleCalendarId = createdCalendar.id;
  cachedGoogleCalendarList = null;
  cachedGoogleCalendarListExpiresAt = 0;
  return cachedGoogleCalendarId;
};

const hasExplicitGoogleCalendarId = () => Boolean(configuredGoogleCalendarId);

const getTargetGoogleCalendarId = async () => {
  if (hasExplicitGoogleCalendarId()) {
    return googleCalendarConfig.calendarId;
  }
  if (googleCalendarConfig.calendarName) {
    return findOrCreateGoogleCalendarByName(googleCalendarConfig.calendarName);
  }
  return googleCalendarConfig.calendarId;
};

const getCalendarById = async (calendarId) => {
  const calendars = await listAvailableGoogleCalendars();
  return calendars.find((calendar) => calendar.id === calendarId) || {
    id: calendarId,
    summary: calendarId,
    accessRole: 'owner',
    canWrite: true
  };
};

const mapGoogleCalendarEvent = (event, calendar = {}) => {
  const startValue = event?.start?.dateTime || (event?.start?.date ? `${event.start.date}T00:00:00` : '');
  const endValue = event?.end?.dateTime || (event?.end?.date ? `${event.end.date}T23:59:00` : '');

  return {
    id: event.id,
    recurringEventId: event.recurringEventId || null,
    originalStartTime: event.originalStartTime?.dateTime || event.originalStartTime?.date || null,
    key: `${calendar.id || googleCalendarConfig.calendarId}:${event.id}`,
    calendarId: calendar.id || googleCalendarConfig.calendarId,
    calendarSummary: calendar.summary || '',
    calendarColor: calendar.backgroundColor || null,
    calendarAccessRole: calendar.accessRole || 'reader',
    canEdit: isWritableCalendar(calendar),
    title: event.summary || '',
    notes: event.description || '',
    date: startValue.slice(0, 10),
    startTime: startValue.slice(11, 16) || '00:00',
    endTime: endValue.slice(11, 16) || '23:59',
    category: 'administrativo',
    completed: event.extendedProperties?.private?.bookCompleted === 'true',
    updated: event.updated || null,
    htmlLink: event.htmlLink || null
  };
};

const buildCalendarEventPayload = ({
  title,
  notes,
  date,
  startTime,
  endTime,
  recurrenceFrequency,
  recurrenceEndDate
}) => ({
  summary: title,
  description: notes || undefined,
  start: {
    dateTime: buildDateTime(date, startTime),
    timeZone: googleCalendarConfig.timeZone
  },
  end: {
    dateTime: buildDateTime(date, endTime),
    timeZone: googleCalendarConfig.timeZone
  },
  ...(recurrenceFrequency && recurrenceEndDate
    ? {
        recurrence: [
          'RRULE:FREQ='
            + recurrenceFrequency
            + ';UNTIL='
            + recurrenceEndDate.replaceAll('-', '')
            + 'T235959Z'
        ]
      }
    : {})
});

const calendarEventsPath = async () => calendarEventsPathFor(await getTargetGoogleCalendarId());

const getCalendarIdFromRequest = async (req) => {
  const calendarId = String(req.body?.calendarId || req.query?.calendarId || '').trim();
  return calendarId || getTargetGoogleCalendarId();
};

export const registerGoogleCalendarRoutes = (app) => {
  app.get('/api/google-calendar/events', async (_req, res) => {
    try {
      const now = new Date();
      const timeMin = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
      const timeMax = new Date(Date.UTC(now.getUTCFullYear() + 2, 11, 31, 23, 59, 59)).toISOString();
      const calendars = await listAvailableGoogleCalendars();
      const warnings = [];

      const eventGroups = await Promise.all(calendars.map(async (calendar) => {
        try {
          const payload = await googleCalendarRequest(calendarEventsPathFor(calendar.id), {
            searchParams: {
              singleEvents: true,
              orderBy: 'startTime',
              showDeleted: false,
              maxResults: 2500,
              timeMin,
              timeMax
            }
          });
          return (payload?.items || []).map((event) => mapGoogleCalendarEvent(event, calendar));
        } catch (error) {
          warnings.push({ calendarId: calendar.id, calendarSummary: calendar.summary, message: error.message });
          return [];
        }
      }));

      return res.json({
        success: true,
        calendars,
        warnings,
        events: eventGroups.flat()
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
    const isRecurring = req.body?.isRecurring === true;
    const recurrenceFrequency = isRecurring
      ? normalizeRecurrenceFrequency(req.body?.recurrenceFrequency)
      : null;
    const recurrenceEndDate = isRecurring
      ? normalizeDate(req.body?.recurrenceEndDate)
      : null;

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
    if (isRecurring && (!recurrenceFrequency || !recurrenceEndDate)) {
      return res.status(400).json({
        success: false,
        message: 'Informe Periodicidade e Data de Termino da recorrencia.'
      });
    }
    if (isRecurring && recurrenceEndDate < date) {
      return res.status(400).json({
        success: false,
        message: 'Data de Termino deve ser igual ou posterior a Data inicial.'
      });
    }

    try {
      const calendarId = await getTargetGoogleCalendarId();
      const calendar = hasExplicitGoogleCalendarId()
        ? { id: calendarId, summary: calendarId, accessRole: 'owner' }
        : await getCalendarById(calendarId);
      const event = await googleCalendarRequest(calendarEventsPathFor(calendarId), {
        method: 'POST',
        body: buildCalendarEventPayload({
          title,
          notes,
          date,
          startTime,
          endTime,
          recurrenceFrequency,
          recurrenceEndDate
        })
      });

      return res.status(201).json({
        success: true,
        event: mapGoogleCalendarEvent(event, calendar)
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
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'completed')) {
      try {
        const calendarId = await getCalendarIdFromRequest(req);
        const calendar = { id: calendarId, summary: calendarId, accessRole: 'owner' };
        const eventPath = `${calendarEventsPathFor(calendarId)}/${encodeURIComponent(req.params.eventId)}`;
        const currentEvent = await googleCalendarRequest(eventPath);
        const event = await googleCalendarRequest(eventPath, {
          method: 'PATCH',
          body: {
            extendedProperties: {
              ...(currentEvent.extendedProperties || {}),
              private: {
                ...(currentEvent.extendedProperties?.private || {}),
                bookCompleted: req.body.completed === true ? 'true' : 'false'
              }
            }
          }
        });

        return res.json({ success: true, event: mapGoogleCalendarEvent(event, calendar) });
      } catch (error) {
        console.error('[server] Google Calendar completion update failed', error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Erro ao atualizar a conclusão do compromisso.'
        });
      }
    }

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
      const calendarId = await getCalendarIdFromRequest(req);
      const calendar = { id: calendarId, summary: calendarId, accessRole: 'owner' };
      const event = await googleCalendarRequest(`${calendarEventsPathFor(calendarId)}/${encodeURIComponent(req.params.eventId)}`, {
        method: 'PATCH',
        body: buildCalendarEventPayload({ title, notes, date, startTime, endTime })
      });

      return res.json({
        success: true,
        event: mapGoogleCalendarEvent(event, calendar)
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
      const calendarId = await getCalendarIdFromRequest(req);
      const scope = String(req.query?.scope || 'event');

      if (scope === 'following') {
        const instanceStart = String(req.query?.instanceStart || '').trim();
        const instanceStartDate = new Date(instanceStart);
        if (!instanceStart || Number.isNaN(instanceStartDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Data da ocorrência recorrente inválida.'
          });
        }

        const eventPath = `${calendarEventsPathFor(calendarId)}/${encodeURIComponent(req.params.eventId)}`;
        const recurringEvent = await googleCalendarRequest(eventPath);
        const seriesStartValue = recurringEvent?.start?.dateTime || recurringEvent?.start?.date;
        const seriesStartDate = new Date(seriesStartValue);

        if (!seriesStartValue || Number.isNaN(seriesStartDate.getTime()) || instanceStartDate <= seriesStartDate) {
          await googleCalendarRequest(eventPath, { method: 'DELETE' });
        } else {
          const untilDate = new Date(instanceStartDate.getTime() - 1000);
          const until = untilDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
          let updatedRule = false;
          const recurrence = (recurringEvent.recurrence || []).map((rule) => {
            if (!rule.startsWith('RRULE:')) return rule;
            updatedRule = true;
            const withoutEnd = rule
              .replace(/;UNTIL=[^;]+/i, '')
              .replace(/;COUNT=\d+/i, '');
            return `${withoutEnd};UNTIL=${until}`;
          });

          if (!updatedRule) {
            return res.status(400).json({
              success: false,
              message: 'A recorrência não possui uma regra compatível para excluir os próximos eventos.'
            });
          }

          await googleCalendarRequest(eventPath, {
            method: 'PATCH',
            body: { recurrence }
          });
        }

        return res.json({ success: true });
      }

      await googleCalendarRequest(`${calendarEventsPathFor(calendarId)}/${encodeURIComponent(req.params.eventId)}`, {
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



