import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const HEADER_ROW_INDEX = 6;
const DATA_START_INDEX = 7;
const CHUNK_SIZE = 500;
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

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDatePtBr = (value) => {
  if (value == null) return null;

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return formatDate(date);
  }

  let text = normalizeText(value);
  if (!text) return null;

  text = text.replace(/[.\-]/g, '/').replace(/[^\d/]/g, '');
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric)) {
      return parseDatePtBr(numeric);
    }
  }

  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (!match) return null;

  const dayNum = Number.parseInt(match[1], 10);
  const monthNum = Number.parseInt(match[2], 10);
  const year = match[3];
  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum)) return null;
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return null;

  const day = String(dayNum).padStart(2, '0');
  const month = String(monthNum).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeHeaderKey = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildHeaderIndex = (headerRow) => {
  if (!Array.isArray(headerRow)) return {};
  return headerRow.reduce((acc, value, index) => {
    const key = normalizeHeaderKey(value);
    if (key) acc[key] = index;
    return acc;
  }, {});
};

const REQUIRED_HEADERS = [
  'sacado',
  'cpf/cnpj',
  'contato',
  'aluno',
  'data de vencimento',
  'data da baixa',
  'categoria',
  'descricao',
  'parcela',
  'valor original',
  'valor com desc. pont.',
  'em aberto (vencido)',
];

const chunkArray = (entries, size) => {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
};

const resolveUnitAndCleanup = (fileName) => {
  const normalized = normalizeText(fileName).toLowerCase();
  if (normalized === 'receber angra.xlsx') {
    return { unidade: 'CNA Angra dos Reis', shouldClearEntradas: true };
  }
  if (normalized === 'receber manga.xlsx') {
    return { unidade: 'CNA Mangaratiba', shouldClearEntradas: false };
  }
  return null;
};

const mapRowsToLancamentos = (rows, headerIndex, unidadeLabel, dataStartIndex) => {
  const dataRows = rows.slice(dataStartIndex);

  const idxSacado = headerIndex.sacado;
  const idxCpfCnpj = headerIndex['cpf/cnpj'];
  const idxContato = headerIndex.contato;
  const idxAluno = headerIndex.aluno;
  const idxDataVenc = headerIndex['data de vencimento'];
  const idxDataBaixa = headerIndex['data da baixa'];
  const idxCategoria = headerIndex.categoria;
  const idxDescricao = headerIndex.descricao;
  const idxParcela = headerIndex.parcela;
  const idxValorOriginal = headerIndex['valor original'];
  const idxValorDescPontual = headerIndex['valor com desc. pont.'];
  const idxValorAberto = headerIndex['em aberto (vencido)'];

  const entries = [];
  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const dataVenc = parseDatePtBr(row[idxDataVenc]);
    const dataBaixa = parseDatePtBr(row[idxDataBaixa]);
    const valorOriginal = parseCurrencyPtBr(row[idxValorOriginal]);

    if (!dataVenc || valorOriginal == null || valorOriginal <= MIN_IGNORE_VALUE) {
      continue;
    }

    const categoria = normalizeText(row[idxCategoria]);
    const parcela = normalizeText(row[idxParcela]);
    const sacado = normalizeText(row[idxSacado]);
    const descricaoRaw = normalizeText(row[idxDescricao]);
    const descricao = descricaoRaw || sacado || 'Sem descricao';
    const obsParts = [categoria, parcela].filter(Boolean);
    const obs = obsParts.length ? obsParts.join(' / ') : null;

      entries.push({
        data: dataVenc,
        tipo: 'Entrada',
        cliente_fornecedor: sacado || 'N/A',
        descricao,
      valor: valorOriginal,
      status: dataBaixa ? 'Pago' : 'A Vencer',
      unidade: unidadeLabel,
      obs,
      datapag: dataBaixa,
      contato: normalizeText(row[idxContato]) || null,
      aluno: normalizeText(row[idxAluno]) || null,
      valor_aberto: parseCurrencyPtBr(row[idxValorAberto]),
      parcela: parcela || null,
      desc_pontual: parseCurrencyPtBr(row[idxValorDescPontual]),
      cpf_cnpj: normalizeText(row[idxCpfCnpj]) || null,
    });
  }

  return entries;
};

const IntegracaoReceberXlsx = () => {
  const INTEGRACAO_REF = 62300;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [rowsCount, setRowsCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const unidadeInfo = useMemo(() => resolveUnitAndCleanup(file?.name || ''), [file]);

  const readFileBuffer = (selectedFile) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(selectedFile);
  });

  const readFileBinary = (selectedFile) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsBinaryString(selectedFile);
  });

  const handleFileChange = async (event) => {
    const [selected] = event.target.files || [];
    setFile(selected || null);
    setSheetName('');
    setRowsCount(0);
    setFileBuffer(null);
    if (!selected) return;

    try {
      let buffer;
      if (typeof selected.arrayBuffer === 'function') {
        buffer = await selected.arrayBuffer();
      } else {
        buffer = await readFileBuffer(selected);
      }
      setFileBuffer(buffer);
    } catch (error) {
      const message = error?.message || '';
      if (/permission|read|not readable/i.test(message)) {
        try {
          const buffer = await readFileBinary(selected);
          setFileBuffer(buffer);
        } catch {
          toast({
            title: 'Erro ao ler o arquivo',
            description: 'Não foi possível ler o arquivo. Tente salvar a planilha em outra pasta e selecione novamente.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Erro ao ler o arquivo',
          description: 'Falha ao carregar a planilha. Selecione novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  const loadWorkbookRowsFromBuffer = async (buffer) => {
    if (!buffer) {
      throw new Error('Arquivo não carregado. Selecione a planilha novamente.');
    }
    const readMode = buffer instanceof ArrayBuffer ? 'array' : 'binary';
    const workbook = XLSX.read(buffer, { type: readMode, cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      throw new Error('Nenhuma planilha encontrada no arquivo.');
    }
    const sheet = workbook.Sheets[firstSheet];
    // Preserva linhas em branco para manter o índice físico da planilha:
    // cabeçalho na 7ª linha e dados a partir da 8ª.
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null });
    return { rows, sheetName: firstSheet };
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'Selecione uma planilha', description: 'Escolha um arquivo Excel para importar.' });
      return;
    }

    const unitConfig = resolveUnitAndCleanup(file.name);
    if (!unitConfig) {
      toast({
        title: 'Nome de arquivo inválido',
        description: 'Use apenas "Receber Angra.xlsx" ou "Receber Manga.xlsx".',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      const { rows, sheetName: loadedSheet } = await loadWorkbookRowsFromBuffer(fileBuffer);
      setSheetName(loadedSheet);

      if (!rows || rows.length <= DATA_START_INDEX) {
        throw new Error('A planilha não contém linhas de dados a partir da 8ª linha.');
      }

      const headerRowIndex = HEADER_ROW_INDEX;
      const headerRow = rows[headerRowIndex];
      const headerIndex = buildHeaderIndex(headerRow);
      const missing = REQUIRED_HEADERS.filter((header) => headerIndex[header] == null);
      if (missing.length) {
        throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
      }

      const dataStartIndex = DATA_START_INDEX;
      const entries = mapRowsToLancamentos(rows, headerIndex, unitConfig.unidade, dataStartIndex);
      setRowsCount(entries.length);

      if (!entries.length) {
        throw new Error('Nenhum registro válido foi encontrado na planilha.');
      }

      if (unitConfig.shouldClearEntradas) {
        const { error: deleteError } = await supabase
          .from('lancamentos')
          .delete()
          .eq('tipo', 'Entrada');
        if (deleteError) {
          throw new Error(deleteError.message || 'Erro ao limpar lançamentos de Entrada.');
        }
      }

      const chunks = chunkArray(entries, CHUNK_SIZE);
      for (const chunk of chunks) {
        const { error } = await supabase.from('lancamentos').insert(chunk);
        if (error) {
          throw new Error(error.message || 'Erro ao inserir lançamentos.');
        }
      }

      toast({
        title: 'Importação concluída',
        description: `${entries.length} lançamentos de Entrada importados para ${unitConfig.unidade}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao importar',
        description: error.message || 'Falha ao processar a planilha.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Integração A Receber (xlsx) - SysFina</title>
        <meta name="description" content="Importação de A Receber via planilha Excel." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/operacional/integracao')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">A Receber (xlsx)</h1>
            <span className="text-sm text-gray-300">Importe uma planilha Excel para popular a tabela lancamentos (Entradas).</span>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {INTEGRACAO_REF}
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-white">Importação de planilha</CardTitle>
          <span className="text-xs text-gray-400">Os dados começam na 8ª linha. Cabeçalhos na 7ª linha.</span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-300" htmlFor="areceber-xlsx-file">
              Selecione o arquivo Excel
            </label>
            <input
              id="areceber-xlsx-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-200 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
            />
            {file && (
              <div className="text-xs text-gray-400">
                Arquivo selecionado: {file.name}
              </div>
            )}
            {sheetName && (
              <div className="text-xs text-gray-400">
                Planilha: {sheetName} • Unidade: {unidadeInfo?.unidade || '-'}
              </div>
            )}
            {rowsCount > 0 && (
              <div className="text-xs text-gray-400">
                Registros prontos para importar: {rowsCount}
              </div>
            )}
          </div>

          <Button onClick={handleImport} disabled={importing} className="w-full" variant="secondary">
            {importing ? 'Importando...' : 'Importar planilha'}
            <UploadCloud className="w-4 h-4 ml-2" />
          </Button>

          <div className="text-xs text-gray-400 space-y-1">
            <div>Campos esperados: Sacado, CPF/CNPJ, Contato, Aluno, Data de Vencimento, Data da Baixa, Categoria, Descrição, Parcela, Valor Original, Valor com Desc. Pont., Em aberto (Vencido).</div>
            <div>Formato: datas em DD/MM/AAAA e valores em R$ 0.000,00.</div>
            <div>Unidade: "Receber Angra.xlsx" → CNA Angra dos Reis, "Receber Manga.xlsx" → CNA Mangaratiba.</div>
            <div>Limpeza: apenas "Receber Angra.xlsx" apaga dados anteriores de lançamentos com tipo "Entrada".</div>
            <div>Filtro: valores R$ 0,00 e R$ 0,01 são ignorados na importação.</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default IntegracaoReceberXlsx;
