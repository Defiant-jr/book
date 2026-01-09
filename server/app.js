import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const { Client } = pg;

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

const normalizeHeader = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const findHeaderIndex = (headers, candidates) => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return (
    candidates
      .map((candidate) => normalizedHeaders.indexOf(normalizeHeader(candidate)))
      .find((idx) => idx !== -1) ?? -1
  );
};

const buildPgClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Client({
      connectionString,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
    });
  }

  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  const port = Number.parseInt(process.env.PGPORT ?? '5432', 10);

  if (!host || !user || !password || !database) {
    throw new Error('Postgres credentials are not configured.');
  }

  return new Client({
    host,
    user,
    password,
    database,
    port,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
  });
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

const getGoogleSheetsConfig = () => ({
  apiKey: process.env.GOOGLE_API_KEY,
  pagamentosSheetId: process.env.GOOGLE_SHEET_PAGAMENTOS_ID,
  recebimentosSheetId: process.env.GOOGLE_SHEET_RECEBIMENTOS_ID,
  operacoesSheetId: process.env.GOOGLE_SHEET_OPERACOES_ID
});

const buildMissingConfigMessage = (config, requiredKeys) => {
  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length === 0) {
    return 'Google Sheets integration is not configured.';
  }
  if ((process.env.NODE_ENV ?? 'production') === 'production') {
    return 'Google Sheets integration is not configured.';
  }
  return `Google Sheets integration is not configured. Missing: ${missing.join(', ')}`;
};

const buildPagamentos = (values, today) => {
  if (!Array.isArray(values) || values.length <= 1) {
    return [];
  }

  const pagamentos = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (!Array.isArray(row) || row.length < 4) {
      continue;
    }

    const valor = parseCurrency(row[3]);
    if (valor === 0) {
      continue;
    }

    const vencimentoDate = parseDate(row[2]);
    if (!vencimentoDate) {
      continue;
    }

    pagamentos.push({
      id: `pag_${index}`,
      fornecedor: row[0] ?? '',
      parcela: row[1] ?? '',
      vencimento: toIsoDate(vencimentoDate),
      valor,
      tipo: 'pagar',
      status: vencimentoDate < today ? 'vencido' : 'aberto'
    });
  }

  return pagamentos;
};

const buildRecebimentos = (values, today) => {
  if (!Array.isArray(values) || values.length <= 1) {
    return [];
  }

  const recebimentos = [];

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    if (!Array.isArray(row) || row.length < 3) {
      continue;
    }

    const valor = parseCurrency(row[2]);
    if (valor === 0) {
      continue;
    }

    const vencimentoDate = parseDate(row[1]);
    if (!vencimentoDate) {
      continue;
    }

    recebimentos.push({
      id: `rec_${index}`,
      cliente: row[0] ?? '',
      vencimento: toIsoDate(vencimentoDate),
      valor,
      tipo: 'receber',
      status: vencimentoDate < today ? 'atrasado' : 'aberto'
    });
  }

  return recebimentos;
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
    const googleSheetsConfig = getGoogleSheetsConfig();
    if (
      !googleSheetsConfig.apiKey ||
      !googleSheetsConfig.pagamentosSheetId ||
      !googleSheetsConfig.recebimentosSheetId
    ) {
      return res.status(500).json({
        success: false,
        message: buildMissingConfigMessage(googleSheetsConfig, [
          'apiKey',
          'pagamentosSheetId',
          'recebimentosSheetId'
        ])
      });
    }

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const [pagamentosData, recebimentosData] = await Promise.all([
        fetchSheetRange(googleSheetsConfig.pagamentosSheetId, 'A:D', googleSheetsConfig.apiKey),
        fetchSheetRange(googleSheetsConfig.recebimentosSheetId, 'A:C', googleSheetsConfig.apiKey)
      ]);

      const pagamentos = buildPagamentos(pagamentosData.values, today);
      const recebimentos = buildRecebimentos(recebimentosData.values, today);

      return res.json({
        success: true,
        message: 'Dados importados com sucesso!',
        pagamentos,
        recebimentos
      });
    } catch (error) {
      console.error('[server] Google Sheets import failed', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao importar dados das planilhas.'
      });
    }
  });

  app.post('/api/operacoes/import', async (_req, res) => {
    const googleSheetsConfig = getGoogleSheetsConfig();
    if (!googleSheetsConfig.apiKey || !googleSheetsConfig.operacoesSheetId) {
      return res.status(500).json({
        success: false,
        message: buildMissingConfigMessage(googleSheetsConfig, ['apiKey', 'operacoesSheetId'])
      });
    }

    let client;
    try {
      const operacoesData = await fetchSheetRange(
        googleSheetsConfig.operacoesSheetId,
        "'Operacoes'!A:Q",
        googleSheetsConfig.apiKey
      );

      const operacoes = [];
      if (Array.isArray(operacoesData.values) && operacoesData.values.length > 1) {
        const headers = operacoesData.values[0].map((value) => (value ?? '').toString().trim());
        const rows = operacoesData.values.slice(1);
        const colMap = {
          dataBaixa: findHeaderIndex(headers, ['Data da Baixa']),
          responsavel: findHeaderIndex(headers, ['Responsável Financeiro', 'Responsavel Financeiro']),
          aluno: findHeaderIndex(headers, ['Aluno']),
          recebido: findHeaderIndex(headers, ['Recebido'])
        };

        for (const row of rows) {
          const dataBaixa = colMap.dataBaixa >= 0 ? parseDate(row[colMap.dataBaixa]) : null;
          const cpdataimp = toIsoDate(dataBaixa);
          const cpresponsavel =
            colMap.responsavel >= 0 ? (row[colMap.responsavel] || '').toString().trim() : '';
          const cpaluno = colMap.aluno >= 0 ? (row[colMap.aluno] || '').toString().trim() : '';
          const cpvalor = colMap.recebido >= 0 ? parseCurrency(row[colMap.recebido]) : 0;

          if (!cpdataimp && !cpresponsavel && !cpaluno && cpvalor === 0) {
            continue;
          }

          operacoes.push({
            cpdataimp: cpdataimp || null,
            cpresponsavel: cpresponsavel || null,
            cpaluno: cpaluno || null,
            cpvalor
          });
        }
      }

      client = buildPgClient();
      await client.connect();
      await client.query('BEGIN');

      let inseridos = 0;
      for (const operacao of operacoes) {
        await client.query(
          'INSERT INTO "tbOperacoes" (cpdataimp, cpresponsavel, cpaluno, cpvalor) VALUES ($1, $2, $3, $4)',
          [operacao.cpdataimp, operacao.cpresponsavel, operacao.cpaluno, operacao.cpvalor]
        );
        inseridos += 1;
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: `Importação concluída. ${inseridos} operações inseridas.`
      });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
      }
      console.error('[server] Operacoes import failed', error);
      return res.status(500).json({
        success: false,
        message: error?.message || 'Erro ao importar dados das operações.'
      });
    } finally {
      if (client) {
        await client.end();
      }
    }
  });

  if (!withFrontend) {
    return { app };
  }

  const isProd = (process.env.NODE_ENV ?? 'production') === 'production';

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
