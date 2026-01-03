export function getValorConsiderado(lancamento, todayStr = new Date().toISOString().split('T')[0]) {
  if (!lancamento) return 0;

  const baseValor = Number(lancamento.valor) || 0;
  const valorAtrasado = Number(lancamento.valor_aberto);
  const valorAVencer = Number(lancamento.desc_pontual);
  const dataLancamento = lancamento.data;

  const status = (lancamento.status || '').toLowerCase().trim();
  const isPago = status === 'pago';

  if (!isPago && dataLancamento) {
    if (dataLancamento < todayStr) {
      return Number.isFinite(valorAtrasado) && valorAtrasado > 0 ? valorAtrasado : baseValor;
    }
    return Number.isFinite(valorAVencer) && valorAVencer > 0 ? valorAVencer : baseValor;
  }

  return baseValor;
}
