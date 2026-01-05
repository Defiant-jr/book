const normalizeDate = (value) => {
  if (!value) return null;
  const brPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  let normalizedValue = value;
  const matchBr = brPattern.exec(value);
  if (matchBr) {
    const [, day, month, year] = matchBr;
    normalizedValue = `${year}-${month}-${day}`;
  }
  const date = new Date(`${normalizedValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function getValorConsiderado(lancamento, todayStr = new Date().toISOString().split('T')[0]) {
  if (!lancamento) return 0;

  const baseValor = Number(lancamento.valor) || 0;
  const valorAtrasado = Number(lancamento.valor_aberto);
  const valorAVencer = Number(lancamento.desc_pontual);
  const dataLancamento = normalizeDate(lancamento.data);

  const status = (lancamento.status || '').toLowerCase().trim();
  const isPago = status === 'pago';
  const today = normalizeDate(todayStr) || new Date();
  today.setHours(0, 0, 0, 0);

  if (!isPago && dataLancamento) {
    if (dataLancamento < today) {
      return Number.isFinite(valorAtrasado) && valorAtrasado > 0 ? valorAtrasado : baseValor;
    }
    return Number.isFinite(valorAVencer) && valorAVencer > 0 ? valorAVencer : baseValor;
  }

  return baseValor;
}
