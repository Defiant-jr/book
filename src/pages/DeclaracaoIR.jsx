import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, FileDown, Loader2, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const DECLARACAO_IR_REF = 81100;
const HEADER_ROW_INDEX = 6;
const DATA_START_INDEX = 7;

const COMPANY_PROFILES = {
  default: {
    razaoSocial: 'JE Curso de Idiomas LTDA',
    cnpj: '47.291.916/0001-01',
    endereco: 'Rua José Elias Rabha, 280 - lj 107, Parque das Palmeiras - Angra dos Reis/RJ - CEP: 23.906-510',
    cidadeAssinatura: 'Angra dos Reis',
    assinatura: 'JE Curso de Idiomas LTDA',
  },
  ejMangaratiba: {
    razaoSocial: 'EJ Curso de Idiomas LTDA',
    cnpj: '39.974.447/0001-05',
    endereco: 'Rua Arthur Pires,453 - Centro - Mangaratiba/RJ CEP: 23.860-000',
    cidadeAssinatura: 'Mangaratiba',
    assinatura: 'EJ Curso de Idiomas LTDA',
  },
};

const COMPANY_BY_D4_VALUE = {
  'JE CURSO DE IDIOMAS LTDA - 472.919.160-00101': COMPANY_PROFILES.default,
  'EJ CURSO DE IDIOMAS LTDA - 399.744.470-00105': COMPANY_PROFILES.ejMangaratiba,
};

const normalizeText = (value) => (value == null ? '' : String(value).trim());

const normalizeHeaderKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildHeaderIndex = (headerRow) => {
  if (!Array.isArray(headerRow)) return {};
  return headerRow.reduce((acc, value, index) => {
    const key = normalizeHeaderKey(value);
    if (key) acc[key] = index;
    return acc;
  }, {});
};

const parseCurrencyPtBr = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/[\sR$]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseExcelDate = (value) => {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  const text = normalizeText(value).replace(/[.\-]/g, '/');
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (!day || !month || !year) return null;

  return new Date(Date.UTC(year, month - 1, day));
};

const formatDateBr = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const formatCurrency = (value) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const REQUIRED_HEADERS = [
  'sacado',
  'aluno',
  'data da baixa',
  'descricao',
  'parcela',
  'valor original',
  'valor com desc. pont.',
];

const sanitizeFileName = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const resolveCompanyProfileFromCell = (value) => COMPANY_BY_D4_VALUE[normalizeText(value)] || COMPANY_PROFILES.default;

const loadWorkbookRowsFromBuffer = (buffer) => {
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
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
  });

  const d4Value = sheet?.D4?.w ?? sheet?.D4?.v ?? null;

  return { rows, sheetName: firstSheet, companyProfile: resolveCompanyProfileFromCell(d4Value) };
};

const buildDeclarations = (rows, headerIndex) => {
  const idxResponsavel = headerIndex.sacado;
  const idxAluno = headerIndex.aluno;
  const idxDataBaixa = headerIndex['data da baixa'];
  const idxDescricao = headerIndex.descricao;
  const idxParcela = headerIndex.parcela;
  const idxValorOriginal = headerIndex['valor original'];
  const idxValorDescPontual = headerIndex['valor com desc. pont.'];

  const declarationsMap = new Map();
  const dataRows = rows.slice(DATA_START_INDEX);

  dataRows.forEach((row) => {
    if (!Array.isArray(row) || row.length === 0) return;

    const paymentDate = parseExcelDate(row[idxDataBaixa]);
    if (!paymentDate) return;

    const responsavel = normalizeText(row[idxResponsavel]) || 'Responsável não informado';
    const aluno = normalizeText(row[idxAluno]) || 'Aluno não informado';
    const valorDescPontual = parseCurrencyPtBr(row[idxValorDescPontual]);
    const valorOriginal = parseCurrencyPtBr(row[idxValorOriginal]);
    const valorPago = valorDescPontual && valorDescPontual > 0 ? valorDescPontual : valorOriginal;
    if (valorPago == null || valorPago <= 0) return;

    const descricao = normalizeText(row[idxDescricao]) || 'Mensalidade';
    const parcela = normalizeText(row[idxParcela]);
    const ano = String(paymentDate.getUTCFullYear());
    const key = `${ano}::${aluno.toLowerCase()}::${responsavel.toLowerCase()}`;

    if (!declarationsMap.has(key)) {
      declarationsMap.set(key, {
        id: key,
        ano,
        aluno,
        responsavel,
        pagamentos: [],
        totalPago: 0,
      });
    }

    const declaration = declarationsMap.get(key);
    declaration.pagamentos.push({
      dataPagamento: paymentDate,
      valorPago,
      descricao: parcela ? `${descricao} / ${parcela}` : descricao,
    });
    declaration.totalPago += valorPago;
  });

  return Array.from(declarationsMap.values())
    .map((declaration) => ({
      ...declaration,
      pagamentos: declaration.pagamentos.sort((a, b) => a.dataPagamento - b.dataPagamento),
    }))
    .sort((a, b) => {
      if (a.ano !== b.ano) return b.ano.localeCompare(a.ano);
      return a.aluno.localeCompare(b.aluno, 'pt-BR');
    });
};

const DeclaracaoIR = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [selectedYear, setSelectedYear] = useState('todos');
  const [selectedDeclarationId, setSelectedDeclarationId] = useState('');
  const [companyProfile, setCompanyProfile] = useState(COMPANY_PROFILES.default);

  const readFileBuffer = (selectedFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
      reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(selectedFile);
    });

  const readFileBinary = (selectedFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
      reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
      reader.onload = () => resolve(reader.result);
      reader.readAsBinaryString(selectedFile);
    });

  const handleFileChange = async (event) => {
    const [selected] = event.target.files || [];
    setFile(selected || null);
    setFileBuffer(null);
    setSheetName('');
    setDeclarations([]);
    setSelectedYear('todos');
    setSelectedDeclarationId('');
    setCompanyProfile(COMPANY_PROFILES.default);
    setReportGenerated(false);
    if (!selected) return;

    try {
      const buffer = typeof selected.arrayBuffer === 'function' ? await selected.arrayBuffer() : await readFileBuffer(selected);
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
            description: 'Não foi possível ler a planilha. Tente selecionar o arquivo novamente.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Erro ao ler o arquivo',
          description: 'Falha ao carregar a planilha.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleGenerateReport = async () => {
    if (!fileBuffer) {
      toast({
        title: 'Selecione uma planilha',
        description: 'Escolha um arquivo Excel antes de gerar o relatório.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { rows, sheetName: loadedSheetName, companyProfile: loadedCompanyProfile } = loadWorkbookRowsFromBuffer(fileBuffer);
      setSheetName(loadedSheetName);
      setCompanyProfile(loadedCompanyProfile);

      if (!rows || rows.length <= DATA_START_INDEX) {
        throw new Error('A planilha não contém dados a partir da 8ª linha.');
      }

      const headerIndex = buildHeaderIndex(rows[HEADER_ROW_INDEX]);
      const missing = REQUIRED_HEADERS.filter((header) => headerIndex[header] == null);
      if (missing.length) {
        throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
      }

      const parsedDeclarations = buildDeclarations(rows, headerIndex);
      if (!parsedDeclarations.length) {
        throw new Error('Nenhum pagamento com Data da Baixa válida foi encontrado na planilha.');
      }

      setDeclarations(parsedDeclarations);
      setReportGenerated(true);
      toast({
        title: 'Relatório gerado',
        description: `${parsedDeclarations.length} declarações foram montadas a partir da planilha.`,
      });
    } catch (error) {
      setDeclarations([]);
      setCompanyProfile(COMPANY_PROFILES.default);
      setReportGenerated(false);
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message || 'Falha ao processar a planilha.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const availableYears = useMemo(() => [...new Set(declarations.map((item) => item.ano))], [declarations]);

  const filteredDeclarations = useMemo(() => {
    if (selectedYear === 'todos') return declarations;
    return declarations.filter((item) => item.ano === selectedYear);
  }, [declarations, selectedYear]);

  useEffect(() => {
    if (!filteredDeclarations.length) {
      setSelectedDeclarationId('');
      return;
    }

    const exists = filteredDeclarations.some((item) => item.id === selectedDeclarationId);
    if (!exists) {
      setSelectedDeclarationId(filteredDeclarations[0].id);
    }
  }, [filteredDeclarations, selectedDeclarationId]);

  const selectedDeclaration = useMemo(
    () => filteredDeclarations.find((item) => item.id === selectedDeclarationId) || null,
    [filteredDeclarations, selectedDeclarationId],
  );

  const generatePDF = () => {
    if (!selectedDeclaration) {
      toast({
        title: 'Selecione uma declaração',
        description: 'Gere o relatório e escolha um aluno para exportar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 42;
    const top = 46;
    const contentWidth = pageWidth - marginX * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(companyProfile.razaoSocial, pageWidth / 2, top, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`CNPJ: ${companyProfile.cnpj}`, pageWidth / 2, top + 18, { align: 'center' });
    doc.text(companyProfile.endereco, pageWidth / 2, top + 34, { align: 'center', maxWidth: contentWidth });

    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.line(marginX, top + 50, pageWidth - marginX, top + 50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DECLARAÇÃO', pageWidth / 2, top + 84, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const bodyText = `Declaramos que ${selectedDeclaration.aluno}, filho(a) de ${selectedDeclaration.responsavel}, realizou o curso de Idiomas (Inglês), no ano letivo de ${selectedDeclaration.ano}, tendo pago o parcelamento conforme relacionado abaixo:`;
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth);
    doc.text(bodyLines, marginX, top + 124);

    const tableStartY = top + 146 + bodyLines.length * 14;
    doc.autoTable({
      startY: tableStartY,
      margin: { left: marginX, right: marginX },
      head: [['Data do Pagamento', 'Valor Pago', 'Descrição']],
      body: selectedDeclaration.pagamentos.map((item) => [
        formatDateBr(item.dataPagamento),
        formatCurrency(item.valorPago),
        item.descricao,
      ]),
      foot: [['Total', formatCurrency(selectedDeclaration.totalPago), '']],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 10,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        cellPadding: 6,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [250, 250, 250],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 130 },
        1: { halign: 'right', cellWidth: 120 },
        2: { cellWidth: 'auto' },
      },
    });

    let currentY = (doc.lastAutoTable?.finalY || tableStartY) + 34;
    if (currentY > pageHeight - 120) {
      doc.addPage();
      currentY = 90;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(`${companyProfile.cidadeAssinatura}, ${new Date().toLocaleDateString('pt-BR')}.`, pageWidth - marginX, currentY, { align: 'right' });

    currentY += 84;
    doc.line(pageWidth / 2 - 120, currentY, pageWidth / 2 + 120, currentY);
    doc.text(companyProfile.assinatura, pageWidth / 2, currentY + 18, { align: 'center' });

    const fileName = `declaracao-ir-${sanitizeFileName(selectedDeclaration.aluno)}-${selectedDeclaration.ano || 'ano'}.pdf`;
    doc.save(fileName);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Declaração IR - BooK+</title>
        <meta name="description" content="Leitura de planilha Excel para emissão de declaração IR de alunos." />
      </Helmet>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/relatorios')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Declaração IR</h1>
            <p className="text-gray-400">Importe um arquivo xlsx e gere a declaração individual por aluno.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-[10px] font-medium text-gray-400 lg:text-xs">{DECLARACAO_IR_REF}</div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={handleGenerateReport} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Processando...' : 'Gerar Relatório'}
            </Button>
            <Button
              onClick={generatePDF}
              disabled={!selectedDeclaration || loading}
              variant="outline"
              className="border-blue-500 text-blue-300 hover:bg-blue-500/10"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-white">Leitura da planilha</CardTitle>
          <span className="text-xs text-gray-400">Cabeçalhos na 7ª linha e dados a partir da 8ª linha.</span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-300" htmlFor="declaracao-ir-file">
              Selecione o arquivo Excel
            </label>
            <input
              id="declaracao-ir-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-200 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs text-gray-400 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Arquivo</div>
              <div className="mt-1 text-sm text-gray-200">{file?.name || '-'}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Planilha</div>
              <div className="mt-1 text-sm text-gray-200">{sheetName || '-'}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Declarações</div>
              <div className="mt-1 text-sm text-gray-200">{reportGenerated ? declarations.length : '-'}</div>
            </div>
          </div>

          <Button onClick={handleGenerateReport} disabled={loading || !fileBuffer} className="w-full" variant="secondary">
            {loading ? 'Processando planilha...' : 'Ler arquivo xlsx'}
            <UploadCloud className="ml-2 h-4 w-4" />
          </Button>

          <div className="space-y-1 text-xs text-gray-400">
            <div>Campos esperados: Sacado, Aluno, Data da Baixa, Descrição, Parcela, Valor Original e Valor com Desc. Pont.</div>
            <div>Somente linhas com Data da Baixa válida entram na declaração.</div>
            <div>O agrupamento é feito por ano do pagamento, aluno e responsável.</div>
          </div>
        </CardContent>
      </Card>

      {reportGenerated && (
        <>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Seleção da declaração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Ano</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Selecione o ano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Aluno</label>
                  <Select value={selectedDeclarationId} onValueChange={setSelectedDeclarationId}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Selecione a declaração" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDeclarations.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {`${item.aluno} • ${item.ano}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDeclaration && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white">Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-white/10 bg-white p-6 text-slate-900">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{companyProfile.razaoSocial}</div>
                    <div className="text-sm">CNPJ: {companyProfile.cnpj}</div>
                    <div className="mt-1 text-sm">{companyProfile.endereco}</div>
                  </div>

                  <div className="mt-6 text-center text-xl font-bold tracking-[0.3em]">DECLARAÇÃO</div>

                  <p className="mt-8 text-justify text-sm leading-7">
                    Declaramos que <strong>{selectedDeclaration.aluno}</strong>, filho(a) de{' '}
                    <strong>{selectedDeclaration.responsavel}</strong>, realizou o curso de Idiomas (Inglês), no ano
                    letivo de <strong>{selectedDeclaration.ano}</strong>, tendo pago o parcelamento conforme
                    relacionado abaixo:
                  </p>

                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full border border-slate-300 text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border border-slate-300 px-3 py-2 text-center font-semibold">Data do Pagamento</th>
                          <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Valor Pago</th>
                          <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDeclaration.pagamentos.map((item, index) => (
                          <tr key={`${item.descricao}-${index}`}>
                            <td className="border border-slate-300 px-3 py-2 text-center">{formatDateBr(item.dataPagamento)}</td>
                            <td className="border border-slate-300 px-3 py-2 text-right">{formatCurrency(item.valorPago)}</td>
                            <td className="border border-slate-300 px-3 py-2">{item.descricao}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="border border-slate-300 px-3 py-2">Total</td>
                          <td className="border border-slate-300 px-3 py-2 text-right">{formatCurrency(selectedDeclaration.totalPago)}</td>
                          <td className="border border-slate-300 px-3 py-2" />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-16 text-right text-sm">{companyProfile.cidadeAssinatura}, {new Date().toLocaleDateString('pt-BR')}.</div>
                  <div className="mx-auto mt-16 w-72 border-t border-slate-500 pt-3 text-center text-sm">
                    {companyProfile.assinatura}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
};

export default DeclaracaoIR;
