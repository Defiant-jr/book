import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBondPrice,
  calculateDepreciation,
  calculateIrr,
  calculateNpv,
  calculateStatistics,
  solveTvm,
} from './financialCalculator.js';

test('calcula valor futuro de um investimento', () => {
  const result = solveTvm({ n: 12, i: 1, pv: -1000, pmt: 0, fv: 0 }, 'fv');
  assert.ok(Math.abs(result - 1126.82503013) < 1e-6);
});

test('calcula VPL e TIR de fluxos de caixa', () => {
  const flows = [{ amount: -1000 }, { amount: 600 }, { amount: 600 }];
  assert.ok(Math.abs(calculateNpv(flows, 10) - 41.32231405) < 1e-6);
  assert.ok(Math.abs(calculateIrr(flows) - 13.06623863) < 1e-5);
});

test('calcula estatística e regressão linear', () => {
  const result = calculateStatistics([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
  assert.equal(result.meanX, 2);
  assert.equal(result.slope, 2);
  assert.equal(result.intercept, 1);
});

test('calcula depreciação e preço de título', () => {
  assert.equal(calculateDepreciation({ cost: 1000, salvage: 100, life: 5, period: 1, method: 'sl' }), 180);
  assert.ok(Math.abs(calculateBondPrice({ face: 1000, couponRate: 8, yieldRate: 10, periods: 10, paymentsPerYear: 2 }) - 922.78265031) < 1e-6);
});
