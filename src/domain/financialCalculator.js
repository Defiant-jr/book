const EPSILON = 1e-10;

export const tvmBalance = ({ n, i, pv, pmt, fv, begin = false }) => {
  const rate = i / 100;
  if (Math.abs(rate) < EPSILON) return pv + pmt * n + fv;
  const factor = (1 + rate) ** n;
  return pv * factor + pmt * (1 + (begin ? rate : 0)) * ((factor - 1) / rate) + fv;
};

const solveRate = (balanceAtRate) => {
  let previousRate = -99.99;
  let previousValue = balanceAtRate(previousRate);

  for (let step = 1; step <= 4000; step += 1) {
    const rate = -99.99 + step * 0.275;
    const value = balanceAtRate(rate);
    if (Number.isFinite(value) && Number.isFinite(previousValue) && value * previousValue <= 0) {
      let low = previousRate;
      let high = rate;
      for (let iteration = 0; iteration < 120; iteration += 1) {
        const middle = (low + high) / 2;
        const middleValue = balanceAtRate(middle);
        if (Math.abs(middleValue) < EPSILON) return middle;
        if (balanceAtRate(low) * middleValue <= 0) high = middle;
        else low = middle;
      }
      return (low + high) / 2;
    }
    previousRate = rate;
    previousValue = value;
  }
  return null;
};

export const solveTvm = (registers, target) => {
  const { n, i, pv, pmt, fv, begin = false } = registers;
  const rate = i / 100;

  if (target === 'pv') {
    const factor = (1 + rate) ** n;
    if (Math.abs(factor) < EPSILON) return null;
    const annuity = Math.abs(rate) < EPSILON ? pmt * n : pmt * (1 + (begin ? rate : 0)) * ((factor - 1) / rate);
    return -(annuity + fv) / factor;
  }
  if (target === 'pmt') {
    const factor = (1 + rate) ** n;
    const annuityFactor = Math.abs(rate) < EPSILON ? n : (1 + (begin ? rate : 0)) * ((factor - 1) / rate);
    return Math.abs(annuityFactor) < EPSILON ? null : -(pv * factor + fv) / annuityFactor;
  }
  if (target === 'fv') {
    const factor = (1 + rate) ** n;
    const annuity = Math.abs(rate) < EPSILON ? pmt * n : pmt * (1 + (begin ? rate : 0)) * ((factor - 1) / rate);
    return -(pv * factor + annuity);
  }
  if (target === 'n') {
    if (Math.abs(rate) < EPSILON) return Math.abs(pmt) < EPSILON ? null : -(pv + fv) / pmt;
    const adjustedPayment = pmt * (1 + (begin ? rate : 0));
    const numerator = adjustedPayment - fv * rate;
    const denominator = pv * rate + adjustedPayment;
    const ratio = numerator / denominator;
    return ratio > 0 && rate > -1 ? Math.log(ratio) / Math.log(1 + rate) : null;
  }
  if (target === 'i') return solveRate((candidate) => tvmBalance({ ...registers, i: candidate }));
  return null;
};

export const expandCashFlows = (cashFlows) => cashFlows.flatMap(({ amount, count = 1 }) =>
  Array.from({ length: Math.max(1, Math.trunc(count)) }, () => Number(amount) || 0));

export const calculateNpv = (cashFlows, annualRate) => {
  const values = expandCashFlows(cashFlows);
  const rate = annualRate / 100;
  return values.reduce((total, value, index) => total + value / ((1 + rate) ** index), 0);
};

export const calculateIrr = (cashFlows) => {
  const values = expandCashFlows(cashFlows);
  if (values.length < 2 || !values.some((value) => value < 0) || !values.some((value) => value > 0)) return null;
  return solveRate((rate) => calculateNpv(values.map((amount) => ({ amount, count: 1 })), rate));
};

export const calculateStatistics = (points) => {
  if (!points.length) return null;
  const count = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const meanX = sumX / count;
  const meanY = sumY / count;
  const varianceX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const varianceY = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const slope = varianceX < EPSILON ? null : covariance / varianceX;

  return {
    count,
    sumX,
    sumY,
    meanX,
    meanY,
    stdX: count > 1 ? Math.sqrt(varianceX / (count - 1)) : 0,
    stdY: count > 1 ? Math.sqrt(varianceY / (count - 1)) : 0,
    slope,
    intercept: slope === null ? null : meanY - slope * meanX,
    correlation: varianceX < EPSILON || varianceY < EPSILON ? null : covariance / Math.sqrt(varianceX * varianceY),
  };
};

export const calculateDepreciation = ({ cost, salvage, life, period, method }) => {
  if (life <= 0 || period <= 0 || period > life) return null;
  const depreciable = cost - salvage;
  if (method === 'sl') return depreciable / life;
  if (method === 'soyd') return depreciable * ((life - period + 1) / ((life * (life + 1)) / 2));
  if (method === 'db') {
    const rate = 2 / life;
    const bookAtStart = cost * ((1 - rate) ** (period - 1));
    return Math.min(bookAtStart * rate, Math.max(0, bookAtStart - salvage));
  }
  return null;
};

export const calculateBondPrice = ({ face = 100, couponRate, yieldRate, periods, paymentsPerYear = 2 }) => {
  if (periods <= 0 || paymentsPerYear <= 0) return null;
  const coupon = face * (couponRate / 100) / paymentsPerYear;
  const rate = yieldRate / 100 / paymentsPerYear;
  if (Math.abs(rate) < EPSILON) return coupon * periods + face;
  return coupon * ((1 - (1 + rate) ** -periods) / rate) + face / ((1 + rate) ** periods);
};

export const calculateBondYield = ({ price, face = 100, couponRate, periods, paymentsPerYear = 2 }) => {
  if (price <= 0) return null;
  return solveRate((yieldRate) => calculateBondPrice({ face, couponRate, yieldRate, periods, paymentsPerYear }) - price);
};
