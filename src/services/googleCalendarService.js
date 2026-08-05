const CALENDAR_ENDPOINT = '/api/google-calendar/events';
const EVENTS_CACHE_MS = 15000;

let eventsCache = null;
let calendarsCache = null;
let eventsCacheExpiresAt = 0;
let eventsRequestPromise = null;

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error('Endpoint do Google Calendar nao retornou JSON. Inicie o sistema com npm run dev ou npm run start para carregar as rotas /api.');
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Erro na integracao com Google Calendar (${response.status})`);
  }
  return payload;
};

export const listGoogleCalendarEvents = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && eventsCache && eventsCacheExpiresAt > now) {
    return eventsCache;
  }
  if (!force && eventsRequestPromise) {
    return eventsRequestPromise;
  }

  eventsRequestPromise = (async () => {
    const response = await fetch(CALENDAR_ENDPOINT);
    const payload = await parseResponse(response);
    const events = Array.isArray(payload.events) ? payload.events : [];
    calendarsCache = Array.isArray(payload.calendars) ? payload.calendars : [];
    eventsCache = events;
    eventsCacheExpiresAt = Date.now() + EVENTS_CACHE_MS;
    return events;
  })();

  try {
    return await eventsRequestPromise;
  } finally {
    eventsRequestPromise = null;
  }
};

const clearEventsCache = () => {
  eventsCache = null;
  calendarsCache = null;
  eventsCacheExpiresAt = 0;
};

export const createGoogleCalendarEvent = async ({
  title,
  notes,
  date,
  startTime,
  endTime,
  isRecurring = false,
  recurrenceFrequency = '',
  recurrenceEndDate = '',
}) => {
  const response = await fetch(CALENDAR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      notes,
      date,
      startTime,
      endTime,
      isRecurring,
      recurrenceFrequency,
      recurrenceEndDate,
    })
  });
  const payload = await parseResponse(response);
  clearEventsCache();
  return payload.event;
};

export const updateGoogleCalendarEvent = async (eventId, updates) => {
  const response = await fetch(`${CALENDAR_ENDPOINT}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const payload = await parseResponse(response);
  clearEventsCache();
  return payload.event;
};

export const setGoogleCalendarEventCompleted = async (eventId, completed, { calendarId } = {}) => {
  const searchParams = new URLSearchParams();
  if (calendarId) searchParams.set('calendarId', calendarId);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await fetch(`${CALENDAR_ENDPOINT}/${encodeURIComponent(eventId)}${query}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  const payload = await parseResponse(response);
  clearEventsCache();
  return payload.event;
};

export const deleteGoogleCalendarEvent = async (eventId, { calendarId, scope, instanceStart } = {}) => {
  const searchParams = new URLSearchParams();
  if (calendarId) searchParams.set('calendarId', calendarId);
  if (scope) searchParams.set('scope', scope);
  if (instanceStart) searchParams.set('instanceStart', instanceStart);
  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const response = await fetch(`${CALENDAR_ENDPOINT}/${encodeURIComponent(eventId)}${query}`, {
    method: 'DELETE'
  });
  await parseResponse(response);
  clearEventsCache();
};

export const listGoogleCalendarCalendars = () => calendarsCache || [];
