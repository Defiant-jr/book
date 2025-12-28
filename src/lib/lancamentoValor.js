export function getValorConsiderado(lancamento, todayStr = new Date().toISOString().split('T')[0]) {
  if (!lancamento) return 0;

  const baseValor = Number(lancamento.valor) || 0;
  const valorAtrasado = Number(lancamento.valor_aberto) || baseValor;
  const valorAVencer = Number(lancamento.desc_pontual) || baseValor;
  const dataLancamento = lancamento.data;

  if (lancamento.status !== 'Pago' && dataLancamento) {
    if (dataLancamento < todayStr) {
      return valorAtrasado;
    }
    return valorAVencer;
  }

  return baseValor;
}
