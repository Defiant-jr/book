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

const normalizeName = (value) =>
  normalizeText(value)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeColumnName = (value) =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeCellValue = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  return value;
};

const chunkArray = (entries, size) => {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
};

const resolveImportMode = ({ fileName, sheetName }) => {
  const names = [fileName, sheetName].map(normalizeName);
  if (names.includes('turmas angra')) {
    return { label: 'Turmas Angra', unidade: 'CNA Angra dos Reis', shouldClearTable: true };
  }
  if (names.includes('turmas manga')) {
    return { label: 'Turmas Manga', unidade: 'CNA Mangaratiba', shouldClearTable: false };
  }
  return null;
};

const buildHeaderIndex = (headerRow) => {
  if (!Array.isArray(headerRow)) return {};
  return headerRow.reduce((acc, header, index) => {
    const key = normalizeColumnName(header);
    if (key) acc[key] = index;
    return acc;
  }, {});
};

const REQUIRED_HEADERS = ['codigo_da_turma', 'status_da_turma', 'total_de_alunos'];

const mapRowsToTurmas = (rows, headerIndex, mode) => {
  const dataRows = rows.slice(DATA_START_INDEX);
  const entries = [];

  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length === 0) continue;

    const turma = normalizeCellValue(row[headerIndex.codigo_da_turma]);
    const status = normalizeCellValue(row[headerIndex.status_da_turma]);
    const alunos = normalizeCellValue(row[headerIndex.total_de_alunos]);

    const hasValue = [turma, status, alunos].some((value) => value != null && value !== '');
    if (!hasValue) continue;

    entries.push({
      turma,
      status,
      alunos,
      unidade: mode.unidade,
    });
  }

  return entries;
};

const IntegracaoTurmas = () => {
  const INTEGRACAO_REF = 62300;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [rowsCount, setRowsCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const importMode = useMemo(
    () => resolveImportMode({ fileName: file?.name || '', sheetName }),
    [file, sheetName],
  );

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
            description: 'Nao foi possivel ler o arquivo. Tente salvar a planilha em outra pasta e selecione novamente.',
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
      throw new Error('Arquivo nao carregado. Selecione a planilha novamente.');
    }

    const readMode = buffer instanceof ArrayBuffer ? 'array' : 'binary';
    const workbook = XLSX.read(buffer, { type: readMode, cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      throw new Error('Nenhuma planilha encontrada no arquivo.');
    }

    const sheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null });
    return { rows, sheetName: firstSheet };
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

      const mode = resolveImportMode({ fileName: file.name, sheetName: loadedSheet });
      if (!mode) {
        throw new Error('Use uma planilha chamada "Turmas Angra" ou "Turmas Manga".');
      }

      if (!rows || rows.length <= DATA_START_INDEX) {
        throw new Error('A planilha nao contem linhas de dados a partir da 5a linha.');
      }

      const headerIndex = buildHeaderIndex(rows[HEADER_ROW_INDEX]);
      if (!Object.keys(headerIndex).length) {
        throw new Error('A linha 4 nao contem cabecalhos validos.');
      }

      const missing = REQUIRED_HEADERS.filter((header) => headerIndex[header] == null);
      if (missing.length) {
        throw new Error(`Campos obrigatorios ausentes: ${missing.join(', ')}`);
      }

      const entries = mapRowsToTurmas(rows, headerIndex, mode);
      setRowsCount(entries.length);

      if (!entries.length) {
        throw new Error('Nenhum registro valido foi encontrado na planilha.');
      }

      if (mode.shouldClearTable) {
        const { error: deleteError } = await supabase
          .from('turmas')
          .delete()
          .not('id', 'is', null);
        if (deleteError) {
          throw new Error(deleteError.message || 'Erro ao limpar turmas.');
        }
      }

      const chunks = chunkArray(entries, CHUNK_SIZE);
      for (const chunk of chunks) {
        const { error } = await supabase.from('turmas').insert(chunk);
        if (error) {
          throw new Error(error.message || 'Erro ao inserir turmas.');
        }
      }

      toast({
        title: 'Importacao concluida',
        description: `${entries.length} turmas importadas de ${mode.label}.`,
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
        <title>Integracao Turmas - SysFina</title>
        <meta name="description" content="Importacao de turmas via planilha Excel." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/operacional/integracao')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">Turmas</h1>
            <span className="text-sm text-gray-300">Importe uma planilha Excel para popular a tabela turmas.</span>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {INTEGRACAO_REF}
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-white">Importacao de planilha</CardTitle>
          <span className="text-xs text-gray-400">Cabecalho na 4a linha. Dados a partir da 5a linha.</span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-300" htmlFor="turmas-file">
              Selecione o arquivo Excel
            </label>
            <input
              id="turmas-file"
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
                Planilha: {sheetName} - Modo: {importMode?.label || '-'}
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
            <div>Mapeamento: Codigo da Turma -> turma, Status da Turma -> status, Total de Alunos -> alunos.</div>
            <div>Use uma planilha chamada "Turmas Angra" ou "Turmas Manga".</div>
            <div>"Turmas Angra" apaga todo o conteudo da tabela turmas antes de importar.</div>
            <div>"Turmas Manga" somente adiciona os registros.</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default IntegracaoTurmas;
