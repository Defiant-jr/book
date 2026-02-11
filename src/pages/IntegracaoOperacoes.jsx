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

const HEADER_ROW_INDEX = 3;
const DATA_START_INDEX = 4;
const CHUNK_SIZE = 500;

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
    // Excel serial date (days since 1899-12-30)
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
  'data de vencimento',
  'data da baixa',
  'responsavel financeiro',
  'aluno',
  'valor original',
  'recebido',
];

const findHeaderRow = (rows) => {
  const maxScan = Math.min(rows.length, 10);
  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < maxScan; i += 1) {
    const headerIndex = buildHeaderIndex(rows[i]);
    const score = REQUIRED_HEADERS.filter((header) => headerIndex[header] != null).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
    if (bestScore === REQUIRED_HEADERS.length) break;
  }
  return bestIndex;
};

const chunkArray = (entries, size) => {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
};

const IntegracaoOperacoes = () => {
  const INTEGRACAO_REF = 62200;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [rowsCount, setRowsCount] = useState(0);

  const unidade = useMemo(() => {
    if (!file?.name) return '';
    return file.name.trim() === 'Extrato Angra.xlsx' ? 'CNA Angra dos Reis' : 'CNA Mangaratiba';
  }, [file]);

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
        } catch (secondaryError) {
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
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });
    return { rows, sheetName: firstSheet };
  };

  const mapRowsToOperacoes = (rows, headerIndex, unidadeLabel, dataStartIndex) => {
    const dataRows = rows.slice(dataStartIndex);

    const idxDataVenc = headerIndex['data de vencimento'];
    const idxDataBaixa = headerIndex['data da baixa'];
    const idxResponsavel = headerIndex['responsavel financeiro'];
    const idxAluno = headerIndex['aluno'];
    const idxValorOriginal = headerIndex['valor original'];
    const idxRecebido = headerIndex['recebido'];

    const entries = [];
    for (const row of dataRows) {
      if (!Array.isArray(row) || row.length === 0) continue;

      const dataVenc = parseDatePtBr(row[idxDataVenc]);
      const dataBaixa = parseDatePtBr(row[idxDataBaixa]);
      const responsavel = normalizeText(row[idxResponsavel]) || null;
      const aluno = normalizeText(row[idxAluno]) || null;
      const valor = parseCurrencyPtBr(row[idxValorOriginal]);
      const valorPago = parseCurrencyPtBr(row[idxRecebido]);

      if (!dataVenc || valor == null) {
        const hasAnyValue = [dataBaixa, responsavel, aluno, valorPago]
          .some((value) => value != null && value !== '');
        if (!hasAnyValue) continue;
        if (!dataVenc || valor == null) continue;
      }

      entries.push({
        data_venc: dataVenc,
        data_pago: dataBaixa,
        responsavel,
        aluno,
        valor,
        valor_pago: valorPago,
        unidade: unidadeLabel || null,
      });
    }

    return entries;
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'Selecione uma planilha', description: 'Escolha um arquivo Excel para importar.' });
      return;
    }

    setImporting(true);
    try {
      const { rows, sheetName: loadedSheet } = await loadWorkbookRowsFromBuffer(fileBuffer);
      setSheetName(loadedSheet);

      if (!rows || rows.length <= DATA_START_INDEX) {
        throw new Error('A planilha não contém linhas de dados a partir da 5ª linha.');
      }

      const detectedHeaderIndex = findHeaderRow(rows);
      const headerRowIndex = detectedHeaderIndex >= 0 ? detectedHeaderIndex : HEADER_ROW_INDEX;
      const headerRow = rows[headerRowIndex];
      const headerIndex = buildHeaderIndex(headerRow);
      const missing = REQUIRED_HEADERS.filter((header) => headerIndex[header] == null);
      if (missing.length) {
        throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
      }

      const dataStartIndex = Math.max(headerRowIndex + 1, DATA_START_INDEX);
      const unidadeLabel = file?.name?.trim() === 'Extrato Angra.xlsx' ? 'CNA Angra dos Reis' : 'CNA Mangaratiba';
      const entries = mapRowsToOperacoes(rows, headerIndex, unidadeLabel, dataStartIndex);
      setRowsCount(entries.length);

      if (!entries.length) {
        throw new Error('Nenhum registro válido foi encontrado na planilha.');
      }

      const shouldClearTable = file?.name?.trim() === 'Extrato Angra.xlsx';
      if (shouldClearTable) {
        const { error: deleteError } = await supabase
          .from('operacoes')
          .delete()
          .not('id', 'is', null);
        if (deleteError) {
          throw new Error(deleteError.message || 'Erro ao limpar operacoes.');
        }
      }

      const chunks = chunkArray(entries, CHUNK_SIZE);
      for (const chunk of chunks) {
        const { error } = await supabase.from('operacoes').insert(chunk);
        if (error) {
          throw new Error(error.message || 'Erro ao inserir operações.');
        }
      }

      toast({
        title: 'Importação concluída',
        description: `${entries.length} operações importadas para ${unidadeLabel}.`,
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
        <title>Integração Operações - SysFina</title>
        <meta name="description" content="Importação de operações via planilha Excel." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/operacional/integracao')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">Operações</h1>
            <span className="text-sm text-gray-300">Importe uma planilha Excel para popular a tabela operacoes.</span>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {INTEGRACAO_REF}
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-white">Importação de planilha</CardTitle>
          <span className="text-xs text-gray-400">Os dados começam na 5ª linha. Cabeçalhos na 4ª linha.</span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-300" htmlFor="operacoes-file">
              Selecione o arquivo Excel
            </label>
            <input
              id="operacoes-file"
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
                Planilha: {sheetName} • Unidade: {unidade || '-'}
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
            <div>Campos esperados: Data de Vencimento, Data da Baixa, Responsável Financeiro, Aluno, Valor Original, Recebido.</div>
            <div>Unidade: "Extrato Angra.xlsx" → CNA Angra dos Reis, "Extrato Manga.xlsx" → CNA Mangaratiba.</div>
            <div>Limpeza: apenas "Extrato Angra.xlsx" apaga os dados antes de importar.</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default IntegracaoOperacoes;
