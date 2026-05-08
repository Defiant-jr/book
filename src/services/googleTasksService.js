const TASKS_ENDPOINT = '/api/google-tasks/tasks';

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error('Endpoint do Google Tasks nao retornou JSON. Inicie o sistema com npm run dev ou npm run start para carregar as rotas /api.');
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Erro na integracao com Google Tasks (${response.status})`);
  }
  return payload;
};

export const listGoogleTasks = async () => {
  const response = await fetch(TASKS_ENDPOINT);
  const payload = await parseResponse(response);
  return Array.isArray(payload.tasks) ? payload.tasks : [];
};

export const createGoogleTask = async ({ title, due }) => {
  const response = await fetch(TASKS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, due })
  });
  const payload = await parseResponse(response);
  return payload.task;
};

export const updateGoogleTask = async (taskId, updates) => {
  const response = await fetch(`${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const payload = await parseResponse(response);
  return payload.task;
};

export const deleteGoogleTask = async (taskId) => {
  const response = await fetch(`${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
  await parseResponse(response);
};
