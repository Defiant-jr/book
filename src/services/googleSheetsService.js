import { supabase } from '@/lib/customSupabaseClient';

const IMPORT_ENDPOINT = '/api/google-sheets/import';
const MIN_IGNORE_VALUE = 0.01;

const normalizeText = (value) => (value == null ? '' : String(value).trim());

const parseCurrencyPtBr = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/[\sR$]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDatePtBr = (value) => {
  const text = normalizeText(value);
  if (!text) return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const shouldIgnoreValue = (value) => {
  const parsed = parseCurrencyPtBr(value);
  if (parsed == null) return true;
  return parsed <= MIN_IGNORE_VALUE;
};

const mapRecebimentosToLancamentos = (values) => {
  if (!Array.isArray(values) || values.length <= 1) return [];

  return values.slice(1).reduce((acc, row) => {
    if (!Array.isArray(row)) return acc;

    const sacado = normalizeText(row[0]);
    const cpfCnpj = normalizeText(row[1]);
    const contato = normalizeText(row[2]);
    const aluno = normalizeText(row[3]);
    const dataVencimento = parseDatePtBr(row[4]);
    const dataBaixa = parseDatePtBr(row[5]);
    const categoria = normalizeText(row[11]);
    const descricao = normalizeText(row[12]);
    const parcela = normalizeText(row[13]);
    const valorOriginal = parseCurrencyPtBr(row[14]);
    const valorDescPontual = parseCurrencyPtBr(row[16]);
    const valorAberto = parseCurrencyPtBr(row[18]);
    const unidade = normalizeText(row[21]);

    if (!dataVencimento || shouldIgnoreValue(valorOriginal)) {
      return acc;
    }

    const obsParts = [categoria, parcela].filter(Boolean);
    const obs = obsParts.length ? obsParts.join(' / ') : null;

    acc.push({
      data: dataVencimento,
      tipo: 'Entrada',
      cliente_fornecedor: sacado,
      descricao,
      valor: valorOriginal,
      status: dataBaixa ? 'Pago' : 'A Vencer',
      unidade: unidade || null,
      obs,
      datapag: dataBaixa,
      contato: contato || null,
      aluno: aluno || null,
      valor_aberto: valorAberto,
      parcela: parcela || null,
      desc_pontual: valorDescPontual,
      cpf_cnpj: cpfCnpj || null
    });

    return acc;
  }, []);
};

const mapPagamentosToLancamentos = (values) => {
  if (!Array.isArray(values) || values.length <= 1) return [];

  return values.slice(1).reduce((acc, row) => {
    if (!Array.isArray(row)) return acc;

    const fornecedor = normalizeText(row[0]);
    const parcela = normalizeText(row[1]);
    const dataVencimento = parseDatePtBr(row[2]);
    const valor = parseCurrencyPtBr(row[3]);
    const unidade = normalizeText(row[4]);
    const dataBaixa = parseDatePtBr(row[5]);

    if (!dataVencimento || shouldIgnoreValue(valor)) {
      return acc;
    }

    acc.push({
      data: dataVencimento,
      tipo: 'Saida',
      cliente_fornecedor: fornecedor,
      descricao: fornecedor,
      valor,
      status: dataBaixa ? 'Pago' : 'A Vencer',
      unidade: unidade || null,
      obs: parcela || null,
      datapag: dataBaixa,
      contato: null,
      aluno: null,
      valor_aberto: null,
      parcela: parcela || null,
      desc_pontual: null,
      cpf_cnpj: null
    });

    return acc;
  }, []);
};

const insertLancamentosInChunks = async (entries) => {
  const chunkSize = 500;
  for (let index = 0; index < entries.length; index += chunkSize) {
    const slice = entries.slice(index, index + chunkSize);
    const { error } = await supabase.from('lancamentos').insert(slice);
    if (error) {
      throw new Error(error.message || 'Erro ao inserir lancamentos.');
    }
  }
};

export const importGoogleSheetsData = async () => {
  try {
    const response = await fetch(IMPORT_ENDPOINT, { method: 'POST' });
    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message || `Erro ao solicitar importacao de dados (status ${response.status})`;
      throw new Error(message);
    }

    if (!payload?.success) {
      throw new Error(payload?.message || 'Importacao de dados falhou');
    }

    const pagamentosValues = payload?.pagamentos ?? [];
    const recebimentosValues = payload?.recebimentos ?? [];
    const pagamentos = mapPagamentosToLancamentos(pagamentosValues);
    const recebimentos = mapRecebimentosToLancamentos(recebimentosValues);
    const entries = [...recebimentos, ...pagamentos];

    const { error: deleteError } = await supabase
      .from('lancamentos')
      .delete()
      .not('id', 'is', null);
    if (deleteError) {
      throw new Error(deleteError.message || 'Erro ao limpar lancamentos.');
    }

    if (entries.length) {
      await insertLancamentosInChunks(entries);
    }

    return {
      pagamentos: pagamentos.length,
      recebimentos: recebimentos.length,
      success: true,
      message: `Importacao concluida. ${entries.length} registros processados.`
    };
  } catch (error) {
    console.error('Erro na importacao:', error);
    return {
      success: false,
      message: `Erro na importacao: ${error.message}`
    };
  }
};
