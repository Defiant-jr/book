const STATUS = {
  A_VENCER: 'a_vencer',
  ATRASADO: 'atrasado',
  PAGO: 'pago',
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeTipo = (tipo) => (tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const getLancamentoStatus = (lancamento, todayStr) => {
  if (!lancamento) return STATUS.A_VENCER;

  const today = todayStr ? normalizeDate(todayStr) || new Date() : new Date();
  today.setHours(0, 0, 0, 0);

  const rawStatus = (lancamento.status || '').toLowerCase();
  if (rawStatus === 'pago' || lancamento.datapag) return STATUS.PAGO;

  const vencimento = normalizeDate(lancamento.data);
  if (!vencimento) return STATUS.A_VENCER;

  const tipo = normalizeTipo(lancamento.tipo);
  if (tipo === 'saida') {
    return vencimento < today ? STATUS.ATRASADO : STATUS.A_VENCER;
  }

  if (rawStatus.includes('atras')) return STATUS.ATRASADO;
  if (rawStatus.includes('venc')) return STATUS.A_VENCER;

  return vencimento < today ? STATUS.ATRASADO : STATUS.A_VENCER;
};

export const STATUS_LABELS = {
  [STATUS.A_VENCER]: 'A Vencer',
  [STATUS.ATRASADO]: 'Atrasado',
  [STATUS.PAGO]: 'Pago',
};

export const STATUS_COLORS = {
  [STATUS.A_VENCER]: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  [STATUS.ATRASADO]: 'bg-red-500/20 text-red-400 border-red-500/30',
  [STATUS.PAGO]: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export const STATUS_OPTIONS = [
  { value: STATUS.A_VENCER, label: STATUS_LABELS[STATUS.A_VENCER] },
  { value: STATUS.ATRASADO, label: STATUS_LABELS[STATUS.ATRASADO] },
  { value: STATUS.PAGO, label: STATUS_LABELS[STATUS.PAGO] },
];

export { STATUS };
