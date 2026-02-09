import React, { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RATEIO_MODES, calcTurmaCost } from '@/domain/turmaCost';

const formatCurrency = (value) => {
  if (value == null || !Number.isFinite(value)) return '--';
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value) => {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(2)}%`;
};

const toNumber = (value) => {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const sanitized = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const TurmaCostCalculator = () => {
  const [form, setForm] = useState({
    alunosTurma: '10',
    numTurmas: '4',
    precoAluno: '350',
    despesasFixasMensais: '12000',
    horasAulaTurmaMes: '24',
    valorHoraInstrutor: '55',
    fatorEncargos: '1',
    modoRateio: RATEIO_MODES.POR_TURMA,
    totalAlunosMes: '40',
  });

  const parsedInput = useMemo(() => {
    return {
      alunosTurma: Math.trunc(toNumber(form.alunosTurma)),
      numTurmas: Math.trunc(toNumber(form.numTurmas)),
      precoAluno: toNumber(form.precoAluno),
      despesasFixasMensais: toNumber(form.despesasFixasMensais),
      horasAulaTurmaMes: toNumber(form.horasAulaTurmaMes),
      valorHoraInstrutor: toNumber(form.valorHoraInstrutor),
      fatorEncargos: form.fatorEncargos === '' ? null : toNumber(form.fatorEncargos),
      modoRateio: form.modoRateio,
      totalAlunosMes: form.modoRateio === RATEIO_MODES.POR_ALUNO ? toNumber(form.totalAlunosMes) : null,
    };
  }, [form]);

  const result = useMemo(() => calcTurmaCost(parsedInput), [parsedInput]);

  const errorMessage = result.ok
    ? null
    : result.error?.issues?.map((issue) => issue.message).join(' ');

  const data = result.ok ? result.data : null;

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">Calculadora de Custos por Turma</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Alunos por turma</label>
            <Input value={form.alunosTurma} onChange={handleChange('alunosTurma')} inputMode="numeric" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Turmas no mes</label>
            <Input value={form.numTurmas} onChange={handleChange('numTurmas')} inputMode="numeric" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Mensalidade por aluno</label>
            <Input value={form.precoAluno} onChange={handleChange('precoAluno')} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Despesas fixas mensais</label>
            <Input value={form.despesasFixasMensais} onChange={handleChange('despesasFixasMensais')} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Horas/aula por turma (mes)</label>
            <Input value={form.horasAulaTurmaMes} onChange={handleChange('horasAulaTurmaMes')} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Valor hora/aula instrutor</label>
            <Input value={form.valorHoraInstrutor} onChange={handleChange('valorHoraInstrutor')} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Fator de encargos (opcional)</label>
            <Input value={form.fatorEncargos} onChange={handleChange('fatorEncargos')} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Modo de rateio</label>
            <select
              className="h-10 w-full rounded-md border border-white/10 bg-slate-900/60 px-3 text-sm text-white"
              value={form.modoRateio}
              onChange={handleChange('modoRateio')}
            >
              <option value={RATEIO_MODES.POR_TURMA}>Por turma</option>
              <option value={RATEIO_MODES.POR_ALUNO}>Por aluno</option>
            </select>
          </div>
          {form.modoRateio === RATEIO_MODES.POR_ALUNO && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-gray-400">Total alunos no mes</label>
              <Input value={form.totalAlunosMes} onChange={handleChange('totalAlunosMes')} inputMode="numeric" />
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Receita por turma</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.receitaTurma)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Receita total</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.receitaTotal)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Custo instrutor por turma</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.custoInstrutorTurma)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Rateio fixo por turma</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.fixoPorTurma)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Custo total por turma</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.custoTotalTurma)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Custo por aluno</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.custoPorAluno)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Lucro por turma</div>
            <div className="text-lg font-semibold text-white">{formatCurrency(data?.lucroTurma)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Margem</div>
            <div className="text-lg font-semibold text-white">{formatPercent(data?.margem)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TurmaCostCalculator;
