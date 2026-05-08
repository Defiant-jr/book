const googleTasksConfig = {
  accessToken: process.env.GOOGLE_TASKS_ACCESS_TOKEN,
  clientId: process.env.GOOGLE_TASKS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_TASKS_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_TASKS_REFRESH_TOKEN,
  taskListId: process.env.GOOGLE_TASKS_LIST_ID || '@default'
};

let cachedGoogleTasksAccessToken = null;
let cachedGoogleTasksAccessTokenExpiresAt = 0;

const encodeTaskListId = (taskListId) => encodeURIComponent(taskListId).replace(/%40/g, '@');

const getGoogleTasksAccessToken = async () => {
  if (googleTasksConfig.accessToken) {
    return googleTasksConfig.accessToken;
  }

  const now = Date.now();
  if (cachedGoogleTasksAccessToken && cachedGoogleTasksAccessTokenExpiresAt > now + 60000) {
    return cachedGoogleTasksAccessToken;
  }

  if (!googleTasksConfig.clientId || !googleTasksConfig.clientSecret || !googleTasksConfig.refreshToken) {
    throw new Error('Google Tasks nao configurado. Preencha GOOGLE_TASKS_CLIENT_ID, GOOGLE_TASKS_CLIENT_SECRET e GOOGLE_TASKS_REFRESH_TOKEN no .env.local.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleTasksConfig.clientId,
      client_secret: googleTasksConfig.clientSecret,
      refresh_token: googleTasksConfig.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || 'Failed to refresh Google Tasks access token.');
  }

  cachedGoogleTasksAccessToken = payload.access_token;
  cachedGoogleTasksAccessTokenExpiresAt = now + Number(payload.expires_in || 3600) * 1000;
  return cachedGoogleTasksAccessToken;
};

const googleTasksRequest = async (pathname, options = {}) => {
  const accessToken = await getGoogleTasksAccessToken();
  const url = new URL(`https://tasks.googleapis.com/tasks/v1/${pathname}`);

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
    throw new Error(payload?.error?.message || `Google Tasks request failed: ${response.status}`);
  }
  return payload;
};

const normalizeTaskDate = (value) => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return `${text}T00:00:00.000Z`;
};

const mapGoogleTask = (task) => ({
  id: task.id,
  tarefa: task.title || '',
  data: task.due || null,
  concluida: task.status === 'completed' ? 'S' : 'N',
  status: task.status || 'needsAction',
  updated: task.updated || null
});

const taskListPath = () => `lists/${encodeTaskListId(googleTasksConfig.taskListId)}/tasks`;

export const registerGoogleTasksRoutes = (app) => {
  app.get('/api/google-tasks/tasks', async (_req, res) => {
    try {
      const payload = await googleTasksRequest(taskListPath(), {
        searchParams: {
          showCompleted: true,
          showDeleted: false,
          showHidden: true,
          maxResults: 100
        }
      });

      return res.json({
        success: true,
        tasks: (payload?.items || []).map(mapGoogleTask)
      });
    } catch (error) {
      console.error('[server] Google Tasks list failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao carregar tarefas do Google Tasks.'
      });
    }
  });

  app.post('/api/google-tasks/tasks', async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const due = normalizeTaskDate(req.body?.due);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Informe a descricao da tarefa.'
      });
    }

    try {
      const task = await googleTasksRequest(taskListPath(), {
        method: 'POST',
        body: {
          title,
          ...(due ? { due } : {})
        }
      });

      return res.status(201).json({
        success: true,
        task: mapGoogleTask(task)
      });
    } catch (error) {
      console.error('[server] Google Tasks create failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar tarefa no Google Tasks.'
      });
    }
  });

  app.patch('/api/google-tasks/tasks/:taskId', async (req, res) => {
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
      const title = String(req.body.title || '').trim();
      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Informe a descricao da tarefa.'
        });
      }
      updates.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'due')) {
      updates.due = normalizeTaskDate(req.body.due);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
      updates.status = req.body.status === 'completed' ? 'completed' : 'needsAction';
    }

    try {
      const task = await googleTasksRequest(`${taskListPath()}/${encodeURIComponent(req.params.taskId)}`, {
        method: 'PATCH',
        body: updates
      });

      return res.json({
        success: true,
        task: mapGoogleTask(task)
      });
    } catch (error) {
      console.error('[server] Google Tasks update failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar tarefa no Google Tasks.'
      });
    }
  });

  app.delete('/api/google-tasks/tasks/:taskId', async (req, res) => {
    try {
      await googleTasksRequest(`${taskListPath()}/${encodeURIComponent(req.params.taskId)}`, {
        method: 'DELETE'
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('[server] Google Tasks delete failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao remover tarefa no Google Tasks.'
      });
    }
  });
};
