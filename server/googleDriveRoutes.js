import { Readable } from 'node:stream';
import express from 'express';

const googleDriveConfig = {
  accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
  clientId:
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID ||
    process.env.GOOGLE_TASKS_CLIENT_ID,
  clientSecret:
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
    process.env.GOOGLE_TASKS_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '1VmyjEz2hO1XJi9J7Ysi_wjYPzI7eLmE0'
};

const GOOGLE_NATIVE_EXPORTS = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx'
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx'
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx'
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    extension: '.pdf'
  }
};

let cachedGoogleDriveAccessToken = null;
let cachedGoogleDriveAccessTokenExpiresAt = 0;

const getGoogleDriveAccessToken = async () => {
  if (googleDriveConfig.accessToken) {
    return googleDriveConfig.accessToken;
  }

  const now = Date.now();
  if (cachedGoogleDriveAccessToken && cachedGoogleDriveAccessTokenExpiresAt > now + 60000) {
    return cachedGoogleDriveAccessToken;
  }

  if (!googleDriveConfig.clientId || !googleDriveConfig.clientSecret || !googleDriveConfig.refreshToken) {
    throw new Error(
      'Google Drive nao configurado. Preencha GOOGLE_DRIVE_REFRESH_TOKEN na configuracao do servidor.'
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleDriveConfig.clientId,
      client_secret: googleDriveConfig.clientSecret,
      refresh_token: googleDriveConfig.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || 'Falha ao autenticar no Google Drive.');
  }

  cachedGoogleDriveAccessToken = payload.access_token;
  cachedGoogleDriveAccessTokenExpiresAt = now + Number(payload.expires_in || 3600) * 1000;
  return cachedGoogleDriveAccessToken;
};

const googleDriveRequest = async (url, options = {}) => {
  const accessToken = await getGoogleDriveAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers
    }
  });
};

const readGoogleError = async (response, fallback) => {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message || fallback;
};

const safeDownloadName = (name) =>
  String(name || 'arquivo').replace(/[\r\n"]/g, '').replace(/[\\/]/g, '-');

const appendExtension = (name, extension) =>
  String(name).toLowerCase().endsWith(extension) ? name : `${name}${extension}`;

const getGoogleDriveMetadata = async (fileId, fields = 'id,name,mimeType,parents,trashed,webViewLink') => {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('supportsAllDrives', 'true');
  const response = await googleDriveRequest(url);
  if (!response.ok) {
    throw new Error(await readGoogleError(response, 'Pasta nao encontrada no Google Drive.'));
  }
  return response.json();
};

const ensureItemWithinConfiguredRoot = async (itemId) => {
  const targetId = String(itemId || googleDriveConfig.folderId).trim();
  let current = await getGoogleDriveMetadata(targetId);
  const target = current;

  if (target.trashed) {
    throw new Error('O item selecionado nao esta disponivel.');
  }

  for (let depth = 0; depth < 50; depth += 1) {
    if (current.id === googleDriveConfig.folderId) {
      return target;
    }

    const parentId = current.parents?.[0];
    if (!parentId) break;
    current = await getGoogleDriveMetadata(parentId);
  }

  throw new Error('A navegacao deve permanecer dentro da pasta CRM.');
};

const ensureFolderWithinConfiguredRoot = async (folderId) => {
  const folder = await ensureItemWithinConfiguredRoot(folderId);
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('A pasta selecionada nao esta disponivel.');
  }
  return folder;
};

const ensureFolderIsNotInsideItem = async (folder, item) => {
  if (item.mimeType !== 'application/vnd.google-apps.folder') return;

  let current = folder;
  for (let depth = 0; depth < 50; depth += 1) {
    if (current.id === item.id) {
      throw new Error('Uma pasta nao pode ser movida para dentro dela mesma.');
    }
    if (current.id === googleDriveConfig.folderId) return;

    const parentId = current.parents?.[0];
    if (!parentId) return;
    current = await getGoogleDriveMetadata(parentId);
  }
};

export const registerGoogleDriveRoutes = (app) => {
  app.get('/api/google-drive/files', async (req, res) => {
    try {
      const folder = await ensureFolderWithinConfiguredRoot(req.query.folderId);
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${folder.id}' in parents and trashed = false`);
      url.searchParams.set(
        'fields',
        'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink),nextPageToken'
      );
      url.searchParams.set('orderBy', 'folder,name');
      url.searchParams.set('pageSize', '1000');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');

      const response = await googleDriveRequest(url);
      if (!response.ok) {
        throw new Error(await readGoogleError(response, 'Erro ao listar arquivos do Google Drive.'));
      }

      const payload = await response.json();
      return res.json({
        success: true,
        folder: {
          id: folder.id,
          name: folder.id === googleDriveConfig.folderId ? 'CRM' : folder.name,
          webViewLink: folder.webViewLink
        },
        files: payload.files || []
      });
    } catch (error) {
      console.error('[server] Google Drive list failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao carregar arquivos do Google Drive.'
      });
    }
  });

  app.post('/api/google-drive/folders', async (req, res) => {
    const folderName = String(req.body?.name || '').trim();
    if (!folderName) {
      return res.status(400).json({ success: false, message: 'Informe o nome da pasta.' });
    }

    try {
      const parentFolder = await ensureFolderWithinConfiguredRoot(req.body?.parentId);
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('fields', 'id,name,mimeType,modifiedTime,webViewLink,iconLink');

      const response = await googleDriveRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolder.id]
        })
      });
      if (!response.ok) {
        throw new Error(await readGoogleError(response, 'Erro ao criar pasta no Google Drive.'));
      }

      return res.status(201).json({ success: true, folder: await response.json() });
    } catch (error) {
      console.error('[server] Google Drive folder creation failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar pasta no Google Drive.'
      });
    }
  });

  app.post(
    '/api/google-drive/files',
    express.raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req, res) => {
      const encodedName = String(req.get('x-file-name') || '');
      const fileName = decodeURIComponent(encodedName).trim();
      const mimeType = String(req.get('x-file-type') || 'application/octet-stream');
      const parentFolderId = String(req.get('x-parent-folder-id') || googleDriveConfig.folderId);

      if (!fileName || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, message: 'Selecione um arquivo para upload.' });
      }

      try {
        const parentFolder = await ensureFolderWithinConfiguredRoot(parentFolderId);
        const boundary = `book_plus_${Date.now().toString(16)}`;
        const metadata = JSON.stringify({
          name: fileName,
          parents: [parentFolder.id]
        });
        const prefix = Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
            `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
        );
        const suffix = Buffer.from(`\r\n--${boundary}--`);
        const body = Buffer.concat([prefix, req.body, suffix]);
        const url = new URL('https://www.googleapis.com/upload/drive/v3/files');
        url.searchParams.set('uploadType', 'multipart');
        url.searchParams.set('supportsAllDrives', 'true');
        url.searchParams.set('fields', 'id,name,mimeType,size,modifiedTime,webViewLink,iconLink');

        const response = await googleDriveRequest(url, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body
        });
        if (!response.ok) {
          throw new Error(await readGoogleError(response, 'Erro ao enviar arquivo ao Google Drive.'));
        }

        return res.status(201).json({ success: true, file: await response.json() });
      } catch (error) {
        console.error('[server] Google Drive upload failed', error);
        return res.status(500).json({
          success: false,
          message: error.message || 'Erro ao enviar arquivo ao Google Drive.'
        });
      }
    }
  );

  app.get('/api/google-drive/files/:fileId/download', async (req, res) => {
    try {
      const fileId = encodeURIComponent(req.params.fileId);
      const metadataUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
      metadataUrl.searchParams.set('fields', 'id,name,mimeType');
      metadataUrl.searchParams.set('supportsAllDrives', 'true');
      const metadataResponse = await googleDriveRequest(metadataUrl);

      if (!metadataResponse.ok) {
        throw new Error(
          await readGoogleError(metadataResponse, 'Arquivo nao encontrado no Google Drive.')
        );
      }

      const metadata = await metadataResponse.json();
      const exportConfig = GOOGLE_NATIVE_EXPORTS[metadata.mimeType];
      let downloadUrl;
      let downloadName = metadata.name;

      if (exportConfig) {
        downloadUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/export`);
        downloadUrl.searchParams.set('mimeType', exportConfig.mimeType);
        downloadName = appendExtension(downloadName, exportConfig.extension);
      } else {
        downloadUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
        downloadUrl.searchParams.set('alt', 'media');
        downloadUrl.searchParams.set('supportsAllDrives', 'true');
      }

      const downloadResponse = await googleDriveRequest(downloadUrl);
      if (!downloadResponse.ok || !downloadResponse.body) {
        throw new Error(
          await readGoogleError(downloadResponse, 'Erro ao baixar arquivo do Google Drive.')
        );
      }

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeDownloadName(downloadName)}"; filename*=UTF-8''${encodeURIComponent(
          downloadName
        )}`
      );
      res.setHeader(
        'Content-Type',
        downloadResponse.headers.get('content-type') || 'application/octet-stream'
      );

      return Readable.fromWeb(downloadResponse.body).pipe(res);
    } catch (error) {
      console.error('[server] Google Drive download failed', error);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: error.message || 'Erro ao baixar arquivo do Google Drive.'
        });
      }
      return res.end();
    }
  });

  app.patch('/api/google-drive/files/:fileId/move', async (req, res) => {
    try {
      const item = await ensureItemWithinConfiguredRoot(req.params.fileId);
      if (item.id === googleDriveConfig.folderId) {
        return res.status(400).json({
          success: false,
          message: 'A pasta raiz do CRM nao pode ser movida.'
        });
      }

      const destination = await ensureFolderWithinConfiguredRoot(req.body?.destinationFolderId);
      if (item.parents?.includes(destination.id)) {
        return res.status(400).json({
          success: false,
          message: 'O item ja esta nesta pasta.'
        });
      }
      await ensureFolderIsNotInsideItem(destination, item);

      const url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}`
      );
      url.searchParams.set('addParents', destination.id);
      if (item.parents?.length) {
        url.searchParams.set('removeParents', item.parents.join(','));
      }
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set(
        'fields',
        'id,name,mimeType,size,modifiedTime,parents,webViewLink,iconLink'
      );

      const response = await googleDriveRequest(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        throw new Error(await readGoogleError(response, 'Erro ao mover item no Google Drive.'));
      }

      return res.json({ success: true, item: await response.json() });
    } catch (error) {
      console.error('[server] Google Drive move failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao mover item no Google Drive.'
      });
    }
  });

  app.delete('/api/google-drive/files/:fileId', async (req, res) => {
    try {
      const item = await ensureItemWithinConfiguredRoot(req.params.fileId);
      if (item.id === googleDriveConfig.folderId) {
        return res.status(400).json({
          success: false,
          message: 'A pasta raiz do CRM nao pode ser excluida.'
        });
      }

      const url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}`
      );
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('fields', 'id,name,trashed');
      const response = await googleDriveRequest(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true })
      });

      if (!response.ok) {
        throw new Error(await readGoogleError(response, 'Erro ao excluir item do Google Drive.'));
      }

      return res.json({ success: true, item: await response.json() });
    } catch (error) {
      console.error('[server] Google Drive trash failed', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao excluir item do Google Drive.'
      });
    }
  });
};
