export const RATEIO_MODES = {
  POR_TURMA: 'por_turma',
  POR_ALUNO: 'por_aluno',
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const pushError = (errors, field, message) => {
  errors.push({ field, message });
};

export const validateTurmaCostInput = (input) => {
  const errors = [];
  if (!input || typeof input !== 'object') {
    pushError(errors, 'input', 'Dados de entrada invalidos.');
    return errors;
  }

  const {
    alunosTurma,
    numTurmas,
    precoAluno,
    despesasFixasMensais,
    horasAulaTurmaMes,
    valorHoraInstrutor,
    fatorEncargos,
    modoRateio,
    totalAlunosMes,
  } = input;

  if (!Number.isInteger(alunosTurma) || alunosTurma <= 0) {
    pushError(errors, 'alunosTurma', 'Alunos por turma deve ser um inteiro maior que zero.');
  }
  if (!Number.isInteger(numTurmas) || numTurmas <= 0) {
    pushError(errors, 'numTurmas', 'Quantidade de turmas deve ser um inteiro maior que zero.');
  }
  if (!isFiniteNumber(precoAluno) || precoAluno < 0) {
    pushError(errors, 'precoAluno', 'Valor pago por aluno deve ser maior ou igual a zero.');
  }
  if (!isFiniteNumber(despesasFixasMensais) || despesasFixasMensais < 0) {
    pushError(errors, 'despesasFixasMensais', 'Despesas fixas mensais deve ser maior ou igual a zero.');
  }
  if (!isFiniteNumber(horasAulaTurmaMes) || horasAulaTurmaMes <= 0) {
    pushError(errors, 'horasAulaTurmaMes', 'Horas/aula por turma no mes deve ser maior que zero.');
  }
  if (!isFiniteNumber(valorHoraInstrutor) || valorHoraInstrutor < 0) {
    pushError(errors, 'valorHoraInstrutor', 'Valor da hora/aula do instrutor deve ser maior ou igual a zero.');
  }
  if (fatorEncargos != null) {
    if (!isFiniteNumber(fatorEncargos) || fatorEncargos < 0) {
      pushError(errors, 'fatorEncargos', 'Fator de encargos deve ser maior ou igual a zero.');
    }
  }
  if (modoRateio !== RATEIO_MODES.POR_TURMA && modoRateio !== RATEIO_MODES.POR_ALUNO) {
    pushError(errors, 'modoRateio', 'Modo de rateio deve ser "por_turma" ou "por_aluno".');
  }
  if (modoRateio === RATEIO_MODES.POR_ALUNO) {
    if (!isFiniteNumber(totalAlunosMes) || totalAlunosMes <= 0) {
      pushError(errors, 'totalAlunosMes', 'Total de alunos no mes deve ser maior que zero no modo por aluno.');
    }
  }

  return errors;
};

export const calcTurmaCost = (input) => {
  const errors = validateTurmaCostInput(input);
  if (errors.length) {
    return {
      ok: false,
      error: {
        message: 'Dados invalidos para calculo de custos.',
        issues: errors,
      },
    };
  }

  const {
    alunosTurma,
    numTurmas,
    precoAluno,
    despesasFixasMensais,
    horasAulaTurmaMes,
    valorHoraInstrutor,
    fatorEncargos,
    modoRateio,
    totalAlunosMes,
  } = input;

  const encargos = fatorEncargos == null ? 1 : fatorEncargos;
  const receitaTurma = alunosTurma * precoAluno;
  const receitaTotal = receitaTurma * numTurmas;
  const horaReal = valorHoraInstrutor * encargos;
  const custoInstrutorTurma = horasAulaTurmaMes * horaReal;
  const fixoPorTurma =
    modoRateio === RATEIO_MODES.POR_TURMA
      ? despesasFixasMensais / numTurmas
      : (despesasFixasMensais / totalAlunosMes) * alunosTurma;
  const custoTotalTurma = custoInstrutorTurma + fixoPorTurma;
  const custoPorAluno = custoTotalTurma / alunosTurma;
  const lucroTurma = receitaTurma - custoTotalTurma;
  const margem = receitaTurma > 0 ? lucroTurma / receitaTurma : null;

  return {
    ok: true,
    data: {
      receitaTurma,
      receitaTotal,
      horaReal,
      custoInstrutorTurma,
      fixoPorTurma,
      custoTotalTurma,
      custoPorAluno,
      lucroTurma,
      margem,
    },
  };
};

export const assertTurmaCostInput = (input) => {
  const result = calcTurmaCost(input);
  if (!result.ok) {
    const message = result.error?.issues?.[0]?.message || result.error?.message || 'Entrada invalida.';
    throw new Error(message);
  }
  return result.data;
};
