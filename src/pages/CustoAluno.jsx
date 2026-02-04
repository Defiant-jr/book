import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getLancamentoStatus, STATUS } from '@/lib/lancamentoStatus';
import { getValorConsiderado } from '@/lib/lancamentoValor';

const ALUNOS_FIELD_CANDIDATES = [
  'quantidade_alunos',
  'qtd_alunos',
  'quantidade',
  'qtd',
  'alunos',
  'total_alunos',
  'numero_alunos',
];

const UNIDADE_FIELD_CANDIDATES = ['unidade', 'cidade', 'polo', 'municipio', 'local', 'unidade_nome'];

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const brPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  let normalizedValue = raw;
  const matchBr = brPattern.exec(value);
  if (matchBr) {
    const [, day, month, year] = matchBr;
    normalizedValue = `${year}-${month}-${day}`;
  }
  const date = normalizedValue.includes('T')
    ? new Date(normalizedValue)
    : new Date(`${normalizedValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCurrentSemesterRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (month <= 5) {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 6, 0),
    };
  }
  return {
    start: new Date(year, 6, 1),
    end: new Date(year, 12, 0),
  };
};

const getRemainingSemesterMonthsExcludingCurrent = () => {
  const today = new Date();
  const month = today.getMonth();
  if (month <= 5) {
    return Math.max(0, 5 - month);
  }
  return Math.max(0, 11 - month);
};

const getCurrentMonthRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  };
};

const getNextMonthRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return {
    start: new Date(year, month + 1, 1),
    end: new Date(year, month + 2, 0),
  };
};

const getNextTwoMonthRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return {
    start: new Date(year, month + 2, 1),
    end: new Date(year, month + 3, 0),
  };
};

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatRatio = (numerator, denominator) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return '—';
  }
  return (numerator / denominator).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const safeDivide = (value, divisor) => {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) return null;
  return value / divisor;
};

const formatMonthYear = (date) => {
  const label = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatMaybeCurrency = (value) => (value == null ? '—' : formatCurrency(value));

const findField = (rows, candidates) =>
  candidates.find((key) => rows.some((row) => row?.[key] != null && row?.[key] !== ''));

const CustoAluno = () => {
  const ESTATISTICAS_ADM_FIN_REF = 71000;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(true);

  useEffect(() => {
    const fetchTurmas = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('turmas').select('*');
      setLoading(false);

      if (error) {
        toast({
          title: 'Erro ao carregar estatisticas',
          description: error.message || 'Nao foi possivel buscar os dados de turmas.',
          variant: 'destructive',
        });
        return;
      }

      setTurmas(data || []);
    };

    fetchTurmas();
  }, [toast]);

  useEffect(() => {
    const fetchLancamentos = async () => {
      setLoadingLancamentos(true);
      try {
        const pageSize = 1000;
        let from = 0;
        const allLancamentos = [];
        while (true) {
          const to = from + pageSize - 1;
          const { data, error } = await supabase.from('lancamentos').select('*').range(from, to);
          if (error) {
            toast({
              title: 'Erro ao carregar estatisticas',
              description: error.message || 'Nao foi possivel buscar os lancamentos.',
              variant: 'destructive',
            });
            return;
          }
          if (data?.length) {
            allLancamentos.push(...data);
          }
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        setLancamentos(allLancamentos);
      } finally {
        setLoadingLancamentos(false);
      }
    };

    fetchLancamentos();
  }, [toast]);

  const {
    totalAlunos,
    totalMangaratiba,
    totalAngra,
    totalTurmas,
    turmasMangaratiba,
    turmasAngra,
    alunosField,
    unidadeField,
  } = useMemo(() => {
    const alunosKey = findField(turmas, ALUNOS_FIELD_CANDIDATES);
    const unidadeKey = findField(turmas, UNIDADE_FIELD_CANDIDATES);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;
    let totalTurmasLocal = turmas.length;
    let turmasMang = 0;
    let turmasAng = 0;

    turmas.forEach((row) => {
      const value = alunosKey ? toNumber(row?.[alunosKey]) : 0;
      total += value;

      const unidadeValue = unidadeKey ? String(row?.[unidadeKey] ?? '').toLowerCase() : '';
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += value;
        turmasMang += 1;
      }
      if (unidadeValue.includes('angra')) {
        angra += value;
        turmasAng += 1;
      }
    });

    return {
      totalAlunos: total,
      totalMangaratiba: mangaratiba,
      totalAngra: angra,
      totalTurmas: totalTurmasLocal,
      turmasMangaratiba: turmasMang,
      turmasAngra: turmasAng,
      alunosField: alunosKey,
      unidadeField: unidadeKey,
    };
  }, [turmas]);

  const {
    valorSemestreTotal,
    valorSemestreMangaratiba,
    valorSemestreAngra,
  } = useMemo(() => {
    const { start, end } = getCurrentSemesterRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'entrada') return;
      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      if (isAberto && (dataLancamento < start || dataLancamento > end)) return;

      const valorBase = isAtrasado
        ? toNumber(lancamento?.valor)
        : toNumber(lancamento?.desc_pontual);

      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
    });

    return {
      valorSemestreTotal: total,
      valorSemestreMangaratiba: mangaratiba,
      valorSemestreAngra: angra,
    };
  }, [lancamentos]);

  const {
    valorMesMaisTotal,
    valorMesMaisMangaratiba,
    valorMesMaisAngra,
    mesLabelMais,
  } = useMemo(() => {
    const { start, end } = getNextMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'entrada') return;
      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento || dataLancamento < start || dataLancamento > end) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      const valorBase = isAtrasado
        ? toNumber(lancamento?.valor)
        : toNumber(lancamento?.desc_pontual);

      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
    });

    return {
      valorMesMaisTotal: total,
      valorMesMaisMangaratiba: mangaratiba,
      valorMesMaisAngra: angra,
      mesLabelMais: label,
    };
  }, [lancamentos]);

  const {
    valorMesMais2Total,
    valorMesMais2Mangaratiba,
    valorMesMais2Angra,
    mesLabelMais2,
  } = useMemo(() => {
    const { start, end } = getNextTwoMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'entrada') return;
      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento || dataLancamento < start || dataLancamento > end) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      const valorBase = isAtrasado
        ? toNumber(lancamento?.valor)
        : toNumber(lancamento?.desc_pontual);

      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
    });

    return {
      valorMesMais2Total: total,
      valorMesMais2Mangaratiba: mangaratiba,
      valorMesMais2Angra: angra,
      mesLabelMais2: label,
    };
  }, [lancamentos]);

  const {
    valorMesTotal,
    valorMesMangaratiba,
    valorMesAngra,
    mesLabelAtual,
  } = useMemo(() => {
    const { start, end } = getCurrentMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'entrada') return;
      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      if (isAberto && (dataLancamento < start || dataLancamento > end)) return;

      const valorBase = isAtrasado
        ? toNumber(lancamento?.valor)
        : toNumber(lancamento?.desc_pontual);

      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
    });

    return {
      valorMesTotal: total,
      valorMesMangaratiba: mangaratiba,
      valorMesAngra: angra,
      mesLabelAtual: label,
    };
  }, [lancamentos]);

  const {
    despesaMesTotal,
    despesaMesMangaratiba,
    despesaMesAngra,
    despesaMesCasa,
    despesaMesLabel,
  } = useMemo(() => {
    const { start, end } = getCurrentMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const todayStr = new Date().toISOString().split('T')[0];
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;
    let casa = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'saida') return;

      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      if (isAberto && (dataLancamento < start || dataLancamento > end)) return;

      const valorBase = toNumber(getValorConsiderado(lancamento, todayStr));
      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
      if (unidadeValue.includes('casa')) {
        casa += valorBase;
      }
    });

    return {
      despesaMesTotal: total,
      despesaMesMangaratiba: mangaratiba,
      despesaMesAngra: angra,
      despesaMesCasa: casa,
      despesaMesLabel: label,
    };
  }, [lancamentos]);

  const {
    despesaMesMaisTotal,
    despesaMesMaisMangaratiba,
    despesaMesMaisAngra,
    despesaMesMaisCasa,
    despesaMesMaisLabel,
  } = useMemo(() => {
    const { start, end } = getNextMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const todayStr = new Date().toISOString().split('T')[0];
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;
    let casa = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'saida') return;

      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento || dataLancamento < start || dataLancamento > end) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      const valorBase = toNumber(getValorConsiderado(lancamento, todayStr));
      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
      if (unidadeValue.includes('casa')) {
        casa += valorBase;
      }
    });

    return {
      despesaMesMaisTotal: total,
      despesaMesMaisMangaratiba: mangaratiba,
      despesaMesMaisAngra: angra,
      despesaMesMaisCasa: casa,
      despesaMesMaisLabel: label,
    };
  }, [lancamentos]);

  const {
    despesaMesMais2Total,
    despesaMesMais2Mangaratiba,
    despesaMesMais2Angra,
    despesaMesMais2Casa,
    despesaMesMais2Label,
  } = useMemo(() => {
    const { start, end } = getNextTwoMonthRange();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const todayStr = new Date().toISOString().split('T')[0];
    const label = formatMonthYear(start);

    let total = 0;
    let mangaratiba = 0;
    let angra = 0;
    let casa = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'saida') return;

      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento || dataLancamento < start || dataLancamento > end) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      const valorBase = toNumber(getValorConsiderado(lancamento, todayStr));
      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      total += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        mangaratiba += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        angra += valorBase;
      }
      if (unidadeValue.includes('casa')) {
        casa += valorBase;
      }
    });

    return {
      despesaMesMais2Total: total,
      despesaMesMais2Mangaratiba: mangaratiba,
      despesaMesMais2Angra: angra,
      despesaMesMais2Casa: casa,
      despesaMesMais2Label: label,
    };
  }, [lancamentos]);

  const {
    ticketMedioTotal,
    ticketMedioMangaratiba,
    ticketMedioAngra,
  } = useMemo(() => {
    const { start: semestreStart, end: semestreEnd } = getCurrentSemesterRange();
    const { start: mesStart, end: mesEnd } = getCurrentMonthRange();
    semestreStart.setHours(0, 0, 0, 0);
    semestreEnd.setHours(23, 59, 59, 999);
    mesStart.setHours(0, 0, 0, 0);
    mesEnd.setHours(23, 59, 59, 999);

    const mesesRestantes = getRemainingSemesterMonthsExcludingCurrent();

    let totalReceber = 0;
    let totalMang = 0;
    let totalAng = 0;

    lancamentos.forEach((lancamento) => {
      const tipoValue = String(lancamento?.tipo ?? '').toLowerCase();
      if (tipoValue !== 'entrada') return;

      const dataLancamento = normalizeDate(lancamento?.data);
      if (!dataLancamento) return;

      if (dataLancamento < semestreStart || dataLancamento > semestreEnd) return;
      if (dataLancamento >= mesStart && dataLancamento <= mesEnd) return;

      const status = getLancamentoStatus(lancamento);
      const isAtrasado = status === STATUS.ATRASADO;
      const isAberto = status === STATUS.A_VENCER;
      if (!isAtrasado && !isAberto) return;

      const valorBase = isAtrasado
        ? toNumber(lancamento?.valor)
        : toNumber(lancamento?.desc_pontual);

      const unidadeValue = String(lancamento?.unidade ?? '').toLowerCase();

      totalReceber += valorBase;
      if (unidadeValue.includes('mangaratiba')) {
        totalMang += valorBase;
      }
      if (unidadeValue.includes('angra')) {
        totalAng += valorBase;
      }
    });

    const ticketTotal = safeDivide(safeDivide(totalReceber, mesesRestantes), totalAlunos);
    const ticketMang = safeDivide(safeDivide(totalMang, mesesRestantes), totalMangaratiba);
    const ticketAng = safeDivide(safeDivide(totalAng, mesesRestantes), totalAngra);

    return {
      ticketMedioTotal: ticketTotal,
      ticketMedioMangaratiba: ticketMang,
      ticketMedioAngra: ticketAng,
    };
  }, [lancamentos, totalAlunos, totalMangaratiba, totalAngra]);

  const hasData = turmas.length > 0;
  const isLoading = loading || loadingLancamentos;
  const missingFields = [];
  if (hasData && !alunosField) missingFields.push('quantidade de alunos');
  if (hasData && !unidadeField) missingFields.push('unidade/cidade');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Visão ADM/FIN - BooK+</title>
        <meta name="description" content="Indicadores de Visão ADM/FIN e recebiveis." />
      </Helmet>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Painel</span>
            <h1 className="text-3xl font-bold gradient-text">Visão ADM/FIN</h1>
            <span className="text-sm text-gray-300">Indicadores consolidados da operacao.</span>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {ESTATISTICAS_ADM_FIN_REF}
        </div>
      </div>

      <Card className="glass-card min-h-[32vh]">
        <CardContent className="space-y-6 pt-4">
          {isLoading && <p className="text-gray-300">Buscando dados das turmas e lancamentos...</p>}

          {!isLoading && !hasData && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-gray-300">
              Nenhuma turma encontrada na base.
            </div>
          )}

          {!isLoading && hasData && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">Total de alunos</h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-2xl font-normal text-white">
                        {`${totalAlunos} / ${formatRatio(totalAlunos, totalTurmas)}`}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-blue-200">
                        {`${totalMangaratiba} / ${formatRatio(totalMangaratiba, turmasMangaratiba)}`}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-blue-200">
                        {`${totalAngra} / ${formatRatio(totalAngra, turmasAngra)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">Valor Total Semestre</h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorSemestreTotal)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorSemestreMangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorSemestreAngra)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Valor Total Mensal - {mesLabelAtual}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesTotal)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesAngra)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Valor Total Mensal - {mesLabelMais}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMaisTotal)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMaisMangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMaisAngra)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Valor Total Mensal - {mesLabelMais2}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMais2Total)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMais2Mangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatCurrency(valorMesMais2Angra)}
                      </p>
                    </div>
                  </div>

                </div>

                <div className="space-y-2 md:pl-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">Total de turmas</h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-white">{totalTurmas}</p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-blue-200">{turmasMangaratiba}</p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-blue-200">{turmasAngra}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">Ticket Medio</h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatMaybeCurrency(ticketMedioTotal)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatMaybeCurrency(ticketMedioMangaratiba)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-green-200">
                        {formatMaybeCurrency(ticketMedioAngra)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Despesa Mensal - {despesaMesLabel}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-4">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesTotal)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesAngra)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Casa</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesCasa)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Despesa Mensal - {despesaMesMaisLabel}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-4">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMaisTotal)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMaisMangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMaisAngra)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Casa</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMaisCasa)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="rounded-xl bg-white/10 p-2 text-gray-200">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold">
                        Despesa Mensal - {despesaMesMais2Label}
                      </h3>
                    </div>
                  </div>
                  <div className="grid w-full gap-1 md:grid-cols-4">
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Total geral</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMais2Total)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Mangaratiba</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMais2Mangaratiba)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Angra Dos Reis</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMais2Angra)}
                      </p>
                    </div>
                    <div className="min-h-[56px] rounded-2xl border border-white/10 bg-slate-900/60 p-1.5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Casa</p>
                      <p className="mt-0.5 text-xl font-normal text-red-400">
                        {formatCurrency(despesaMesMais2Casa)}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {missingFields.length > 0 && (
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                  Campos nao encontrados para: {missingFields.join(', ')}. Verifique o nome das colunas na tabela
                  turmas.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CustoAluno;

