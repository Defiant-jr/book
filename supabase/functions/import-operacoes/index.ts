import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import { corsHeaders } from './cors.ts';

const OPERACOES_SHEET_ID =
  Deno.env.get('GOOGLE_SHEET_OPERACOES_ID') ??
  '1v4G3GGE6DgwUc18LsbgfTuv-MhlA38KQgjCrZFiXGdk';

const parseDate = (dateString: string | null | undefined): string | null => {
  if (!dateString || typeof dateString !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return null;
  }
  const [day, month, year] = dateString.split('/');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().split('T')[0];
};

const parseCurrency = (value: string | null | undefined): number => {
  if (typeof value !== 'string' || !value) return 0;
  const normalized = value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
};

const normalizeHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return (
    candidates
      .map((candidate) => normalizedHeaders.indexOf(normalizeHeader(candidate)))
      .find((idx) => idx !== -1) ?? -1
  );
};

const buildPgClient = () => {
  const databaseUrl = Deno.env.get('DATABASE_URL');
  if (databaseUrl) {
    return new Client(databaseUrl);
  }

  const hostname = Deno.env.get('PGHOST');
  const user = Deno.env.get('PGUSER');
  const password = Deno.env.get('PGPASSWORD');
  const database = Deno.env.get('PGDATABASE');
  const port = Number(Deno.env.get('PGPORT') ?? '5432');
  const sslMode = Deno.env.get('PGSSLMODE');

  if (!hostname || !user || !password || !database) {
    throw new Error('Credenciais do Postgres ausentes.');
  }

  return new Client({
    hostname,
    port,
    user,
    password,
    database,
    tls: sslMode === 'require' ? { enabled: true, enforce: true } : undefined,
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('Chave da API do Google ausente.');
    }

    const operacoesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OPERACOES_SHEET_ID}/values/'Operacoes'!A:Q?key=${GOOGLE_API_KEY}`;
    const response = await fetch(operacoesUrl);
    if (!response.ok) {
      throw new Error(`Erro ao buscar operações: ${await response.text()}`);
    }

    const operacoesData = await response.json();
    const operacoes: Array<{
      cpdataimp: string | null;
      cpresponsavel: string | null;
      cpaluno: string | null;
      cpvalor: number;
    }> = [];

    if (operacoesData.values && operacoesData.values.length > 1) {
      const headers: string[] = operacoesData.values[0].map((h: string) => h.trim());
      const rows: string[][] = operacoesData.values.slice(1);

      const colMap = {
        dataBaixa: findHeaderIndex(headers, ['Data da Baixa']),
        responsavel: findHeaderIndex(headers, ['Responsável Financeiro', 'Responsavel Financeiro']),
        aluno: findHeaderIndex(headers, ['Aluno']),
        recebido: findHeaderIndex(headers, ['Recebido']),
      };

      for (const row of rows) {
        const cpdataimp = colMap.dataBaixa >= 0 ? parseDate(row[colMap.dataBaixa]) : null;
        const cpresponsavel =
          colMap.responsavel >= 0 ? (row[colMap.responsavel] || '').trim() : '';
        const cpaluno = colMap.aluno >= 0 ? (row[colMap.aluno] || '').trim() : '';
        const cpvalor = colMap.recebido >= 0 ? parseCurrency(row[colMap.recebido]) : 0;

        if (!cpdataimp && !cpresponsavel && !cpaluno && cpvalor === 0) {
          continue;
        }

        operacoes.push({
          cpdataimp,
          cpresponsavel: cpresponsavel || null,
          cpaluno: cpaluno || null,
          cpvalor,
        });
      }
    }

    const client = buildPgClient();
    await client.connect();

    let inseridos = 0;
    try {
      await client.queryArray('BEGIN');
      for (const operacao of operacoes) {
        await client.queryArray(
          'INSERT INTO "tbOperacoes" (cpdataimp, cpresponsavel, cpaluno, cpvalor) VALUES ($1, $2, $3, $4)',
          [operacao.cpdataimp, operacao.cpresponsavel, operacao.cpaluno, operacao.cpvalor],
        );
        inseridos += 1;
      }
      await client.queryArray('COMMIT');
    } catch (error) {
      await client.queryArray('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }

    return new Response(
      JSON.stringify({
        message: `Importação concluída. ${inseridos} operações inseridas.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
