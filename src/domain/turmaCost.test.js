import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RATEIO_MODES, calcTurmaCost } from './turmaCost.js';

describe('calcTurmaCost', () => {
  it('calcula custos no modo por_turma', () => {
    const result = calcTurmaCost({
      alunosTurma: 10,
      numTurmas: 4,
      precoAluno: 350,
      despesasFixasMensais: 12000,
      horasAulaTurmaMes: 24,
      valorHoraInstrutor: 55,
      fatorEncargos: 1,
      modoRateio: RATEIO_MODES.POR_TURMA,
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.receitaTurma, 3500);
    assert.equal(result.data.receitaTotal, 14000);
    assert.equal(result.data.horaReal, 55);
    assert.equal(result.data.custoInstrutorTurma, 1320);
    assert.equal(result.data.fixoPorTurma, 3000);
    assert.equal(result.data.custoTotalTurma, 4320);
    assert.equal(result.data.custoPorAluno, 432);
    assert.equal(result.data.lucroTurma, -820);
    assert.ok(Math.abs(result.data.margem + 0.23428571428571426) < 1e-9);
  });

  it('calcula custos no modo por_aluno', () => {
    const result = calcTurmaCost({
      alunosTurma: 12,
      numTurmas: 3,
      precoAluno: 300,
      despesasFixasMensais: 9000,
      horasAulaTurmaMes: 20,
      valorHoraInstrutor: 60,
      fatorEncargos: 1,
      modoRateio: RATEIO_MODES.POR_ALUNO,
      totalAlunosMes: 36,
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.fixoPorTurma, 3000);
    assert.equal(result.data.custoInstrutorTurma, 1200);
    assert.equal(result.data.custoTotalTurma, 4200);
  });

  it('valida valores negativos', () => {
    const result = calcTurmaCost({
      alunosTurma: 10,
      numTurmas: 4,
      precoAluno: -10,
      despesasFixasMensais: 12000,
      horasAulaTurmaMes: 24,
      valorHoraInstrutor: 55,
      fatorEncargos: 1,
      modoRateio: RATEIO_MODES.POR_TURMA,
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.issues.some((issue) => issue.field === 'precoAluno'));
  });

  it('valida horas aula como maior que zero', () => {
    const result = calcTurmaCost({
      alunosTurma: 10,
      numTurmas: 4,
      precoAluno: 350,
      despesasFixasMensais: 12000,
      horasAulaTurmaMes: 0,
      valorHoraInstrutor: 55,
      fatorEncargos: 1,
      modoRateio: RATEIO_MODES.POR_TURMA,
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.issues.some((issue) => issue.field === 'horasAulaTurmaMes'));
  });

  it('aplica fator de encargos na hora real', () => {
    const result = calcTurmaCost({
      alunosTurma: 8,
      numTurmas: 2,
      precoAluno: 400,
      despesasFixasMensais: 5000,
      horasAulaTurmaMes: 15,
      valorHoraInstrutor: 70,
      fatorEncargos: 1.2,
      modoRateio: RATEIO_MODES.POR_TURMA,
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.horaReal, 84);
    assert.equal(result.data.custoInstrutorTurma, 1260);
  });
});
