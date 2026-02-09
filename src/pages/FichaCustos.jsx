import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, MinusSquare, PlusSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getLancamentoStatus, normalizeTipo, STATUS } from '@/lib/lancamentoStatus';
import jsPDF from 'jspdf';

const ALUNOS_FIELD_CANDIDATES = [
  'quantidade_alunos',
  'qtd_alunos',
  'quantidade',
  'qtd',
  'alunos',
  'total_alunos',
  'numero_alunos',
];
const RECEITA_FIELD_CANDIDATES = [
  'receita_mes',
  'receita_mensal',
  'receita',
  'valor_mes',
  'valor_mensal',
  'mensalidade',
  'valor',
];
const TURMA_CODE_FIELD_CANDIDATES = [
  'codigo_turma',
  'cod_turma',
  'turma_codigo',
  'codigo',
  'cod',
  'turma',
];
const ALUNO_TURMA_CODE_FIELD_CANDIDATES = [
  'codigo_turma',
  'cod_turma',
  'turma_codigo',
  'turma',
  'codigo',
];
const ALUNO_NOME_FIELD_CANDIDATES = [
  'aluno',
  'nome',
  'nome_aluno',
  'aluno_nome',
];
const ALUNO_RESP_FIELD_CANDIDATES = [
  'responsavel',
  'responsavel_nome',
  'nome_responsavel',
];
const LANCAMENTO_ALUNO_FIELD_CANDIDATES = [
  'aluno',
  'aluno_nome',
  'nome_aluno',
  'cliente_fornecedor',
  'cliente',
];
const UNIDADE_FIELD_CANDIDATES = [
  'unidade',
  'unidade_nome',
  'nome_unidade',
  'unidade_id',
];

const formatLabel = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => {
  if (value == null || !Number.isFinite(value)) return '--';
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const findField = (rows, candidates) =>
  candidates.find((key) => rows.some((row) => row?.[key] != null && row?.[key] !== ''));

const parseDateSafe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const brPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const matchBr = brPattern.exec(raw);
  const normalized = matchBr ? `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}` : raw;
  const parsed = normalized.includes('T') ? new Date(normalized) : new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bcna\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const matchesUnit = (value, target) => {
  if (!value || !target) return false;
  const a = normalizeText(value);
  const b = normalizeText(target);
  return a === b || a.includes(b) || b.includes(a);
};

const getRemainingSemesterMonthsExcludingCurrent = () => {
  const today = new Date();
  const month = today.getMonth();
  if (month <= 5) {
    return Math.max(0, 5 - month);
  }
  return Math.max(0, 11 - month);
};

const FichaCustos = () => {
  const ESTATISTICAS_FICHA_CUSTOS_REF = 72000;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rateios, setRateios] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [parametros, setParametros] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState('CNA Angra dos Reis');
  const [expandedRows, setExpandedRows] = useState({});
  const contentRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [rateioResult, turmasResult, alunosResult, parametrosResult] = await Promise.all([
        supabase.from('rateio').select('*').order('id', { ascending: true }),
        supabase.from('turmas').select('*').order('id', { ascending: true }),
        supabase.from('alunos').select('*').order('id', { ascending: true }),
        supabase.from('parametros').select('*').limit(1).maybeSingle(),
      ]);

      const pageSize = 1000;
      let from = 0;
      const allLancamentos = [];
      let lancamentosError;
      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('lancamentos')
          .select('*')
          .range(from, to);
        if (error) {
          lancamentosError = error;
          break;
        }
        if (data?.length) {
          allLancamentos.push(...data);
        }
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      if (rateioResult.error) {
        toast({
          title: 'Erro ao carregar rateio',
          description: rateioResult.error.message || 'Nao foi possivel buscar os rateios.',
          variant: 'destructive',
        });
      } else {
        setRateios(rateioResult.data || []);
      }

      if (turmasResult.error) {
        toast({
          title: 'Erro ao carregar turmas',
          description: turmasResult.error.message || 'Nao foi possivel buscar as turmas.',
          variant: 'destructive',
        });
      } else {
        setTurmas(turmasResult.data || []);
      }

      if (alunosResult.error) {
        toast({
          title: 'Erro ao carregar alunos',
          description: alunosResult.error.message || 'Nao foi possivel buscar os alunos.',
          variant: 'destructive',
        });
      } else {
        setAlunos(alunosResult.data || []);
      }

      if (parametrosResult.error) {
        toast({
          title: 'Erro ao carregar parametros',
          description: parametrosResult.error.message || 'Nao foi possivel buscar os parametros.',
          variant: 'destructive',
        });
      } else {
        setParametros(parametrosResult.data || null);
      }

      if (lancamentosError) {
        toast({
          title: 'Erro ao carregar lancamentos',
          description: lancamentosError.message || 'Nao foi possivel buscar os lancamentos.',
          variant: 'destructive',
        });
      } else {
        setLancamentos(allLancamentos);
      }

      setLoading(false);
    };

    fetchData();
  }, [toast]);

  const alunosField = useMemo(
    () => findField(turmas, ALUNOS_FIELD_CANDIDATES),
    [turmas],
  );
  const receitaField = useMemo(
    () => findField(turmas, RECEITA_FIELD_CANDIDATES),
    [turmas],
  );
  const turmaCodeField = useMemo(
    () => findField(turmas, TURMA_CODE_FIELD_CANDIDATES),
    [turmas],
  );
  const alunoTurmaCodeField = useMemo(
    () => findField(alunos, ALUNO_TURMA_CODE_FIELD_CANDIDATES),
    [alunos],
  );
  const alunoNomeField = useMemo(
    () => findField(alunos, ALUNO_NOME_FIELD_CANDIDATES),
    [alunos],
  );
  const alunoRespField = useMemo(
    () => findField(alunos, ALUNO_RESP_FIELD_CANDIDATES),
    [alunos],
  );
  const lancamentoAlunoField = useMemo(
    () => findField(lancamentos, LANCAMENTO_ALUNO_FIELD_CANDIDATES),
    [lancamentos],
  );
  const turmaUnitField = useMemo(
    () => findField(turmas, UNIDADE_FIELD_CANDIDATES),
    [turmas],
  );
  const alunoUnitField = useMemo(
    () => findField(alunos, UNIDADE_FIELD_CANDIDATES),
    [alunos],
  );

  const alunosByTurmaCode = useMemo(() => {
    if (!alunoTurmaCodeField) return new Map();
    const map = new Map();
    alunos.forEach((row) => {
      if (alunoUnitField && !matchesUnit(row?.[alunoUnitField], selectedUnit)) return;
      const code = String(row?.[alunoTurmaCodeField] ?? '').trim();
      if (!code) return;
      const list = map.get(code) || [];
      list.push(row);
      map.set(code, list);
    });
    return map;
  }, [alunos, alunoTurmaCodeField, alunoUnitField, selectedUnit]);

  const mediaPagamentoByAluno = useMemo(() => {
    if (!lancamentoAlunoField) return new Map();
    const map = new Map();
    lancamentos.forEach((item) => {
      if (normalizeTipo(item?.tipo) !== 'entrada') return;
      if (!matchesUnit(item?.unidade, selectedUnit)) return;
      const nome = String(item?.[lancamentoAlunoField] ?? '').trim();
      if (!nome) return;
      const valor = toNumber(item?.desc_pontual);
      if (!Number.isFinite(valor)) return;
      const key = normalizeText(nome);
      const entry = map.get(key) || { sum: 0, count: 0 };
      entry.sum += valor;
      entry.count += 1;
      map.set(key, entry);
    });
    return map;
  }, [lancamentos, lancamentoAlunoField, selectedUnit]);

  const toggleRow = (code) => {
    if (!code) return;
    setExpandedRows((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const rateioTotals = useMemo(() => {
    const overall = rateios.reduce((sum, row) => sum + toNumber(row?.valor), 0);
    const byUnit = rateios.reduce((sum, row) => {
      if (row?.unidade && !matchesUnit(row.unidade, selectedUnit)) return sum;
      return sum + toNumber(row?.valor);
    }, 0);
    return { overall, byUnit };
  }, [rateios, selectedUnit]);

  const rateiosByUnit = useMemo(() => {
    return rateios.filter((row) => {
      if (!row?.unidade) return false;
      return matchesUnit(row.unidade, selectedUnit);
    });
  }, [rateios, selectedUnit]);

  const totalAlunos = useMemo(() => {
    if (!alunosField) return 0;
    return turmas.reduce((acc, row) => acc + toNumber(row?.[alunosField]), 0);
  }, [turmas, alunosField]);
  const totalRateio = rateioTotals.overall || 0;
  const totalRateioUnit = rateioTotals.byUnit || 0;
  const totalReceita = useMemo(() => {
    if (!receitaField) return null;
    return turmas.reduce((acc, row) => acc + toNumber(row?.[receitaField]), 0);
  }, [turmas, receitaField]);

  const mesesRestantesSemestre = Math.max(0, getRemainingSemesterMonthsExcludingCurrent());
  const fatMes = useMemo(() => {
    if (!mesesRestantesSemestre) return 0;
    const today = new Date();
    const currentMonth = today.getMonth();
    const year = today.getFullYear();
    const semesterEnd = currentMonth <= 5 ? new Date(year, 6, 0) : new Date(year, 12, 0);
    const start = new Date(year, currentMonth + 1, 1);
    const end = semesterEnd;

    const todayStr = today.toISOString().split('T')[0];
    const total = lancamentos.reduce((acc, item) => {
      if (normalizeTipo(item?.tipo) !== 'entrada') return acc;
      if (!matchesUnit(item?.unidade, selectedUnit)) return acc;
      const vencimento = parseDateSafe(item?.data);
      if (!vencimento || vencimento < start || vencimento > end) return acc;
      const status = getLancamentoStatus(item, todayStr);
      if (status === STATUS.PAGO) return acc;
      const valor = Number(item?.valor) || 0;
      const valorAberto = Number.isFinite(item?.valor_aberto) ? Number(item?.valor_aberto) : valor;
      if (status === STATUS.A_VENCER) {
        const descPontual = Number(item?.desc_pontual);
        return acc + (Number.isFinite(descPontual) ? descPontual : valor);
      }
      if (status === STATUS.ATRASADO) {
        return acc + valorAberto;
      }
      return acc + valor;
    }, 0);

    return total / mesesRestantesSemestre;
  }, [lancamentos, mesesRestantesSemestre, selectedUnit]);

  const availableUnits = useMemo(() => {
    const set = new Set();
    turmas.forEach((row) => {
      const unidade = String(row?.unidade ?? '').trim();
      if (unidade) set.add(unidade);
    });
    return Array.from(set);
  }, [turmas]);

  const turmasByUnit = useMemo(() => {
    return turmas.filter((row) => String(row?.unidade ?? '').trim() === selectedUnit);
  }, [turmas, selectedUnit]);

  const totalAlunosUnit = useMemo(() => {
    if (!alunosField) return 0;
    return turmasByUnit.reduce((acc, row) => acc + toNumber(row?.[alunosField]), 0);
  }, [turmasByUnit, alunosField]);

  const totalTurmasUnit = turmasByUnit.length;
  const horaAulaClt = parametros ? toNumber(parametros.hora_aula_clt) : null;
  const horaAulaCnt = parametros ? toNumber(parametros.hora_aula_cnt) : null;
  const cargaHr = parametros ? toNumber(parametros.carga_hr) : null;
  const hrAulaMes = useMemo(() => {
    if (!cargaHr || !totalTurmasUnit) return null;
    if (selectedUnit === 'CNA Angra dos Reis') {
      if (!horaAulaCnt) return null;
      return (cargaHr * totalTurmasUnit * horaAulaCnt) / 6;
    }
    if (selectedUnit === 'CNA Mangaratiba') {
      if (!horaAulaClt) return null;
      return (cargaHr * totalTurmasUnit * horaAulaClt) / 6;
    }
    return null;
  }, [cargaHr, totalTurmasUnit, horaAulaCnt, horaAulaClt, selectedUnit]);
  const ticketMes = fatMes != null && totalAlunosUnit ? fatMes / totalAlunosUnit : null;
  const custoPorTurma =
    totalTurmasUnit && hrAulaMes != null
      ? (hrAulaMes + totalRateioUnit) / totalTurmasUnit
      : null;
  const custoPorAluno = totalAlunosUnit ? totalRateio / totalAlunosUnit : null;


  const handleGeneratePdf = () => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const gap = 6;
    const totalWidth = pageWidth - margin * 2 - gap * 2;
    const leftWeight = 0.75;
    const midWeight = 0.85;
    const rightWeight = 1.4;
    const weightSum = leftWeight + midWeight + rightWeight;
    const colWidthLeft = (totalWidth * leftWeight) / weightSum;
    const colWidthMid = (totalWidth * midWeight) / weightSum;
    const colWidthRight = (totalWidth * rightWeight) / weightSum;
    const headerHeight = 12;
    const panelHeight = pageHeight - margin * 2 - headerHeight;

    const setText = (size, rgb = [17, 24, 39], weight = 'normal') => {
      pdf.setFont('helvetica', weight);
      pdf.setFontSize(size);
      pdf.setTextColor(...rgb);
    };

    const drawPanel = (x, y, w, h, title) => {
      pdf.setDrawColor(209, 213, 219);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(x, y, w, h, 2, 2);
      pdf.setFillColor(232, 240, 254);
      pdf.rect(x, y, w, 8, 'F');
      setText(9, [15, 23, 42], 'bold');
      pdf.text(title, x + 3, y + 5.8);
    };

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFillColor(235, 242, 255);
    pdf.rect(margin, margin - 2, pageWidth - margin * 2, headerHeight, 'F');
    setText(14, [15, 23, 42], 'bold');
    pdf.text('Ficha de Custos', margin, margin + 4);
    setText(9, [51, 65, 85], 'normal');
    pdf.text(`Unidade: ${selectedUnit}`, margin + 52, margin + 4);
    setText(8, [100, 116, 139], 'normal');
    pdf.text(`Código: ${ESTATISTICAS_FICHA_CUSTOS_REF}`, pageWidth - margin - 30, margin + 4);

    const panelY = margin + headerHeight;
    const leftX = margin;
    const midX = leftX + colWidthLeft + gap;
    const rightX = midX + colWidthMid + gap;

    drawPanel(leftX, panelY, colWidthLeft, panelHeight, 'Rateio');
    drawPanel(midX, panelY, colWidthMid, panelHeight, `Indicadores - ${selectedUnit}`);
    drawPanel(rightX, panelY, colWidthRight, panelHeight, 'Turmas');

    // Left panel content
    let cursorY = panelY + 14;
    setText(8, [15, 23, 42], 'bold');
    rateiosByUnit.forEach((row) => {
      if (cursorY > panelY + panelHeight - 6) return;
      const name = row?.nome ? formatLabel(row.nome) : '--';
      const value = formatCurrency(toNumber(row?.valor));
      pdf.text(name, leftX + 3, cursorY);
      pdf.text(value, leftX + colWidthLeft - 3, cursorY, { align: 'right' });
      cursorY += 5;
    });
    pdf.setDrawColor(229, 231, 235);
    pdf.line(leftX + 3, panelY + panelHeight - 10, leftX + colWidthLeft - 3, panelY + panelHeight - 10);
    setText(9, [15, 23, 42], 'bold');
    pdf.text('Total', leftX + 3, panelY + panelHeight - 4);
    pdf.text(formatCurrency(rateioTotals.byUnit || 0), leftX + colWidthLeft - 3, panelY + panelHeight - 4, { align: 'right' });

    // Middle panel content
    const boxX = midX + 3;
    const boxW = colWidthMid - 6;
    let boxY = panelY + 14;
    const drawInfoBox = (label, value, fill = [248, 250, 252]) => {
      pdf.setDrawColor(214, 225, 245);
      pdf.setFillColor(...fill);
      pdf.roundedRect(boxX, boxY, boxW, 14, 2, 2, 'F');
      setText(7, [100, 116, 139], 'bold');
      pdf.text(label.toUpperCase(), boxX + 3, boxY + 5);
      setText(10, [15, 23, 42], 'bold');
      pdf.text(value, boxX + 3, boxY + 11);
      boxY += 18;
    };
    drawInfoBox('Fat Mês', formatCurrency(fatMes), [237, 242, 255]);
    drawInfoBox('Ticket Mês', formatCurrency(ticketMes), [232, 246, 243]);

    const smallBoxW = (boxW - 3) / 2;
    const drawSmallBox = (label, value, x, y, fill = [248, 250, 252]) => {
      pdf.setDrawColor(214, 225, 245);
      pdf.setFillColor(...fill);
      pdf.roundedRect(x, y, smallBoxW, 12, 2, 2, 'F');
      setText(6, [100, 116, 139], 'bold');
      pdf.text(label.toUpperCase(), x + 2, y + 4.5);
      setText(9, [15, 23, 42], 'bold');
      pdf.text(String(value), x + 2, y + 9.2);
    };
    drawSmallBox('Turmas', totalTurmasUnit, boxX, boxY, [243, 244, 246]);
    drawSmallBox('Alunos', totalAlunosUnit || '--', boxX + smallBoxW + 3, boxY, [243, 244, 246]);
    boxY += 16;
    drawSmallBox('Cst Tur Mês', formatCurrency(custoPorTurma), boxX, boxY, [254, 243, 199]);
    drawSmallBox('Hr/Aula Mês', formatCurrency(hrAulaMes), boxX + smallBoxW + 3, boxY, [254, 243, 199]);
    boxY += 16;
    drawSmallBox('Hr/Aula CLT', formatCurrency(horaAulaClt), boxX, boxY, [255, 241, 242]);
    drawSmallBox('Hr/Aula Cnt', formatCurrency(horaAulaCnt), boxX + smallBoxW + 3, boxY, [255, 241, 242]);

    setText(7, [100, 116, 139], 'normal');
    pdf.text(
      'Indicadores dependem dos campos disponiveis nas tabelas.',
      boxX,
      panelY + panelHeight - 6,
    );

    // Right panel content
    let tableY = panelY + 14;
    setText(7, [100, 116, 139], 'bold');
    pdf.text('TURMA', rightX + 3, tableY);
    pdf.text('ALUNOS', rightX + colWidthRight * 0.4, tableY, { align: 'right' });
    pdf.text('RECEITA', rightX + colWidthRight * 0.65, tableY, { align: 'right' });
    pdf.text('CUSTO', rightX + colWidthRight * 0.82, tableY, { align: 'right' });
    pdf.text('LUCRAT.', rightX + colWidthRight - 3, tableY, { align: 'right' });
    tableY += 5;
    setText(8, [15, 23, 42], 'normal');
    turmasByUnit.forEach((row) => {
      if (tableY > panelY + panelHeight - 10) return;
      const turma = row?.turma ? formatLabel(row.turma) : '--';
      const alunos = alunosField ? toNumber(row?.[alunosField]) : '--';
      const receita = alunosField ? toNumber(row?.[alunosField]) * (ticketMes || 0) : 0;
      const custo = custoPorTurma || 0;
      const lucro = receita - custo;
      pdf.text(turma, rightX + 3, tableY);
      pdf.text(String(alunos), rightX + colWidthRight * 0.4, tableY, { align: 'right' });
      pdf.text(formatCurrency(receita), rightX + colWidthRight * 0.65, tableY, { align: 'right' });
      pdf.text(formatCurrency(custo), rightX + colWidthRight * 0.82, tableY, { align: 'right' });
      pdf.text(formatCurrency(lucro), rightX + colWidthRight - 3, tableY, { align: 'right' });
      tableY += 5;
    });
    pdf.setDrawColor(229, 231, 235);
    pdf.line(rightX + 3, panelY + panelHeight - 10, rightX + colWidthRight - 3, panelY + panelHeight - 10);
    setText(8, [15, 23, 42], 'bold');
    const totalLucro = turmasByUnit.reduce((acc, row) => {
      const alunos = alunosField ? toNumber(row?.[alunosField]) : 0;
      const receita = alunos * (ticketMes || 0);
      const custo = custoPorTurma || 0;
      return acc + (receita - custo);
    }, 0);
    pdf.text('Total alunos:', rightX + 3, panelY + panelHeight - 6);
    pdf.text(String(totalAlunosUnit || '--'), rightX + colWidthRight - 3, panelY + panelHeight - 6, { align: 'right' });
    pdf.text('Total lucro:', rightX + 3, panelY + panelHeight - 2);
    pdf.text(formatCurrency(totalLucro), rightX + colWidthRight - 3, panelY + panelHeight - 2, { align: 'right' });

    pdf.save('ficha_custos.pdf');
  };

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Ficha de Custos - BooK+</title>
        <meta name="description" content="Ficha de custos com rateio, formulas e base de turmas." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="text-left">
            <h1 className="text-3xl font-bold gradient-text">Ficha de Custos</h1>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
            {ESTATISTICAS_FICHA_CUSTOS_REF}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs text-white"
              value={selectedUnit}
              onChange={(event) => setSelectedUnit(event.target.value)}
            >
              {availableUnits.map((unit) => (
                <option key={unit} value={unit} className="text-black">
                  {unit}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={handleGeneratePdf}>
              Gerar PDF
            </Button>
          </div>
        </div>
      </motion.div>

      <div ref={contentRef} className="grid grid-cols-1 gap-6 lg:grid-cols-[0.65fr_0.9fr_1.45fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white pdf-text">Rateio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && <p className="text-sm text-gray-400">Carregando rateio...</p>}
            {!loading && rateiosByUnit.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum rateio encontrado.</p>
            )}
            {!loading && rateiosByUnit.length > 0 && (
              <div className="space-y-2">
                {rateiosByUnit.map((row) => (
                  <div key={row.id ?? row.nome} className="flex justify-between text-sm">
                    <span className="text-gray-300 pdf-text">{row?.nome ? formatLabel(row.nome) : '--'}</span>
                    <span className="text-white pdf-text">{formatCurrency(toNumber(row?.valor))}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-white">
                  <span>Total</span>
                  <span>{formatCurrency(rateioTotals.byUnit || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">{`Indicadores - ${selectedUnit}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 pdf-box">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-400 pdf-muted">Fat Mês</div>
            <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(fatMes)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 pdf-box">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-400 pdf-muted">Ticket Mês</div>
            <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(ticketMes)}</div>
          </div>
            <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Turmas</div>
              <div className="text-lg font-semibold text-white pdf-text">{totalTurmasUnit}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Alunos</div>
              <div className="text-lg font-semibold text-white pdf-text">{totalAlunosUnit || '--'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Cst Tur Mês</div>
              <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(custoPorTurma)}</div>
            </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Hr/Aula Mês</div>
                <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(hrAulaMes)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Hr/Aula CLT</div>
                <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(horaAulaClt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 pdf-box">
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 pdf-muted">Hr/Aula Cnt</div>
                <div className="text-lg font-semibold text-white pdf-text">{formatCurrency(horaAulaCnt)}</div>
              </div>
            </div>
          <p className="text-xs text-gray-400 pdf-muted">
            Alguns indicadores dependem dos campos disponíveis nas tabelas. Ajustaremos as fórmulas conforme os dados.
          </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Turmas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-gray-400">Carregando turmas...</p>}
            {!loading && turmasByUnit.length === 0 && (
              <p className="text-sm text-gray-400">Nenhuma turma encontrada.</p>
            )}
            {!loading && turmasByUnit.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-gray-300 pdf-text">
                  <thead className="text-[10px] uppercase tracking-[0.2em] text-gray-400 pdf-muted">
                    <tr>
                      <th className="py-2 pr-2"></th>
                      <th className="py-2 pr-2">Turma</th>
                      <th className="py-2 text-right">Alunos</th>
                      <th className="py-2 pr-2 text-right">Receita</th>
                      <th className="py-2 pr-2 text-right">Custo</th>
                      <th className="py-2 text-right">Lucratividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turmasByUnit.map((row, index) => {
                      const turmaCode = turmaCodeField ? String(row?.[turmaCodeField] ?? '').trim() : '';
                      const alunosList = turmaCode ? alunosByTurmaCode.get(turmaCode) || [] : [];
                      const receitaMensalTurma = alunosList.reduce((acc, aluno) => {
                        const nome = alunoNomeField ? aluno?.[alunoNomeField] : null;
                        const keyName = nome || 'Aluno';
                        const mediaInfo = mediaPagamentoByAluno.get(normalizeText(keyName));
                        if (!mediaInfo || !mediaInfo.count) return acc;
                        return acc + mediaInfo.sum / mediaInfo.count;
                      }, 0);
                      const canExpand = Boolean(turmaCode && alunoTurmaCodeField);
                      const rowKey = row.id ?? turmaCode ?? row.turma ?? index;

                      const rows = [
                        <tr key={`${rowKey}-main`} className="border-t border-white/5">
                            <td className="py-2 pr-2">
                              {canExpand && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleRow(turmaCode)}
                                  className="h-7 w-7"
                                  aria-label={expandedRows[turmaCode] ? 'Ocultar alunos' : 'Exibir alunos'}
                                >
                                  {expandedRows[turmaCode] ? (
                                    <MinusSquare className="h-4 w-4" />
                                  ) : (
                                    <PlusSquare className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </td>
                            <td className="py-2 pr-2 text-white pdf-text">{row?.turma ? formatLabel(row.turma) : '--'}</td>
                            <td className="py-2 text-right pdf-text">{alunosField ? toNumber(row?.[alunosField]) : '--'}</td>
                            <td className="py-2 pr-2 text-right pdf-text">{formatCurrency(receitaMensalTurma)}</td>
                            <td className="py-2 pr-2 text-right pdf-text">{formatCurrency(custoPorTurma)}</td>
                            <td className="py-2 text-right pdf-text">
                              {formatCurrency(receitaMensalTurma - (custoPorTurma || 0))}
                            </td>
                        </tr>,
                      ];

                      if (canExpand && expandedRows[turmaCode]) {
                        rows.push(
                          <tr key={`${rowKey}-details`} className="bg-slate-900/50">
                            <td colSpan={6} className="p-0">
                              <div className="p-4">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Alunos</div>
                                {alunosList.length > 0 ? (
                                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-200 sm:grid-cols-2 lg:grid-cols-3">
                                    {alunosList.map((aluno, index) => {
                                      const nome = alunoNomeField ? aluno?.[alunoNomeField] : null;
                                      const responsavel = alunoRespField ? aluno?.[alunoRespField] : null;
                                      const alunoKeyName = nome || 'Aluno';
                                      const mediaInfo = mediaPagamentoByAluno.get(normalizeText(alunoKeyName));
                                      const mediaPagamento =
                                        mediaInfo && mediaInfo.count
                                          ? mediaInfo.sum / mediaInfo.count
                                          : null;
                                      const alunoKey = aluno.id ?? nome ?? index;
                                      return (
                                        <div
                                          key={alunoKey}
                                          className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2"
                                        >
                                          <div className="text-white">{alunoKeyName}</div>
                                          {responsavel && (
                                            <div className="text-xs text-gray-400">Resp: {responsavel}</div>
                                          )}
                                          <div className="text-xs text-gray-400">
                                            Mens.: {formatCurrency(mediaPagamento)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-xs text-gray-400">Nenhum aluno encontrado para esta turma.</p>
                                )}
                              </div>
                            </td>
                          </tr>,
                        );
                      }

                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && turmasByUnit.length > 0 && (
              <div className="flex justify-between border-t border-white/10 pt-2 text-xs text-gray-300">
                <div>
                  <span className="text-white font-semibold">Total alunos: </span>
                  <span className="ml-2">{totalAlunosUnit || '--'}</span>
                </div>
                <div>
                  <span className="text-white font-semibold">Total lucratividade: </span>
                  <span className="ml-2">
                    {formatCurrency(
                      turmasByUnit.reduce((acc, row) => {
                        const alunos = alunosField ? toNumber(row?.[alunosField]) : 0;
                        const receita = alunos * (ticketMes || 0);
                        const custo = custoPorTurma || 0;
                        return acc + (receita - custo);
                      }, 0),
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FichaCustos;
