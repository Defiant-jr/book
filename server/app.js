import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const googleSheetsConfig = {
  apiKey: process.env.GOOGLE_API_KEY,
  pagamentosSheetId: process.env.GOOGLE_SHEET_PAGAMENTOS_ID,
  recebimentosSheetId: process.env.GOOGLE_SHEET_RECEBIMENTOS_ID
};

const parseDate = (dateString) => {
  if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return null;
  }
  const [day, month, year] = dateString.split('/');
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

const toIsoDate = (date) => (date ? date.toISOString().split('T')[0] : '');

const parseCurrency = (value) => {
  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchSheetRange = async (sheetId, range, apiKey) => {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Sheets request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

export async function createApp(options = {}) {
  const { withFrontend = true } = options;
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/google-sheets/import', async (_req, res) => {
    if (
      !googleSheetsConfig.apiKey ||
      !googleSheetsConfig.pagamentosSheetId ||
      !googleSheetsConfig.recebimentosSheetId
    ) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets integration is not configured.'
      });
    }

    try {
      const [pagamentosData, recebimentosData] = await Promise.all([
        fetchSheetRange(googleSheetsConfig.pagamentosSheetId, 'A:F', googleSheetsConfig.apiKey),
        fetchSheetRange(googleSheetsConfig.recebimentosSheetId, 'A:V', googleSheetsConfig.apiKey)
      ]);

      return res.json({
        success: true,
        message: 'Dados importados com sucesso!',
        pagamentos: pagamentosData.values ?? [],
        recebimentos: recebimentosData.values ?? []
      });
    } catch (error) {
      console.error('[server] Google Sheets import failed', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao importar dados das planilhas.'
      });
    }
  });

  if (!withFrontend) {
    return { app };
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distPath = path.join(projectRoot, 'dist');

    if (!existsSync(path.join(distPath, 'index.html'))) {
      throw new Error('Build não encontrado. Execute "npm run build" antes de iniciar o servidor.');
    }

    app.use(compression());
    app.use(
      '/assets',
      serveStatic(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '1y'
      })
    );
    app.use(
      serveStatic(distPath, {
        index: false
      })
    );

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: projectRoot,
      server: {
        middlewareMode: true
      },
      appType: 'custom'
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.join(projectRoot, 'index.html');
        let template = await fs.readFile(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace?.(error);
        next(error);
      }
    });
  }

  return { app };
}
