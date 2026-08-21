import React, { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';

const MAX_DIGITS = 15;

const calculate = (left, right, operator) => {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '×') return left * right;
  if (operator === '÷') return right === 0 ? null : left / right;
  return right;
};

const normalizeResult = (value) => {
  if (value === null || !Number.isFinite(value)) return 'Erro';
  return Number.parseFloat(value.toPrecision(12)).toString();
};

const StandardCalculator = () => {
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState(null);
  const [pendingOperator, setPendingOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const reset = () => {
    setDisplay('0');
    setAccumulator(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  };

  const inputDigit = (digit) => {
    if (display === 'Erro' || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }

    const digitCount = display.replace(/[-.]/g, '').length;
    if (digitCount >= MAX_DIGITS) return;
    setDisplay(display === '0' ? digit : `${display}${digit}`);
  };

  const inputDecimal = () => {
    if (display === 'Erro' || waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) setDisplay(`${display}.`);
  };

  const chooseOperator = (operator) => {
    if (display === 'Erro') {
      reset();
      return;
    }

    if (pendingOperator && waitingForOperand) {
      setPendingOperator(operator);
      return;
    }

    const inputValue = Number(display);
    if (accumulator === null) {
      setAccumulator(inputValue);
    } else if (pendingOperator) {
      const result = calculate(accumulator, inputValue, pendingOperator);
      const normalized = normalizeResult(result);
      setDisplay(normalized);
      setAccumulator(normalized === 'Erro' ? null : Number(normalized));
    }

    setPendingOperator(operator);
    setWaitingForOperand(true);
  };

  const equals = () => {
    if (!pendingOperator || accumulator === null || display === 'Erro') return;
    const normalized = normalizeResult(calculate(accumulator, Number(display), pendingOperator));
    setDisplay(normalized);
    setAccumulator(null);
    setPendingOperator(null);
    setWaitingForOperand(true);
  };

  const applyUnaryOperation = (operation) => {
    if (display === 'Erro') return;
    const value = Number(display);
    let result = value;

    if (operation === 'sign') result = value * -1;
    if (operation === 'percent') result = value / 100;
    if (operation === 'square') result = value ** 2;
    if (operation === 'sqrt') result = value < 0 ? null : Math.sqrt(value);
    if (operation === 'reciprocal') result = value === 0 ? null : 1 / value;

    setDisplay(normalizeResult(result));
  };

  const backspace = () => {
    if (display === 'Erro') {
      reset();
      return;
    }
    if (waitingForOperand) return;
    const nextDisplay = display.slice(0, -1);
    setDisplay(nextDisplay === '' || nextDisplay === '-' ? '0' : nextDisplay);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (/^[0-9]$/.test(event.key)) inputDigit(event.key);
      else if (event.key === '.' || event.key === ',') inputDecimal();
      else if (event.key === '+') chooseOperator('+');
      else if (event.key === '-') chooseOperator('-');
      else if (event.key === '*') chooseOperator('×');
      else if (event.key === '/') chooseOperator('÷');
      else if (event.key === '%' ) applyUnaryOperation('percent');
      else if (event.key === 'Enter' || event.key === '=') equals();
      else if (event.key === 'Backspace') backspace();
      else if (event.key === 'Delete' || event.key === 'Escape') reset();
      else return;

      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const keyClass =
    'flex h-11 items-center justify-center rounded-md border border-white/10 bg-white/10 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400';
  const operatorClass = `${keyClass} bg-blue-500/25 text-blue-100 hover:bg-blue-500/40`;

  return (
    <div className="w-72 p-3" aria-label="Calculadora">
      <div className="mb-3 rounded-lg border border-white/15 bg-black/25 px-3 py-3 text-right">
        <div className="h-4 text-xs text-white/50">{pendingOperator || '\u00a0'}</div>
        <output className="block overflow-hidden text-ellipsis text-2xl font-semibold text-white">
          {display === 'Erro' ? display : display.replace('.', ',')}
        </output>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={keyClass} onClick={reset}>AC</button>
        <button type="button" className={keyClass} onClick={() => applyUnaryOperation('sign')}>±</button>
        <button type="button" className={keyClass} onClick={() => applyUnaryOperation('percent')}>%</button>
        <button type="button" className={operatorClass} onClick={() => chooseOperator('÷')}>÷</button>

        <button type="button" className={keyClass} onClick={() => applyUnaryOperation('reciprocal')}>1/x</button>
        <button type="button" className={keyClass} onClick={() => applyUnaryOperation('square')}>x²</button>
        <button type="button" className={keyClass} onClick={() => applyUnaryOperation('sqrt')}>√x</button>
        <button type="button" className={operatorClass} onClick={() => chooseOperator('×')}>×</button>

        {[7, 8, 9].map((digit) => (
          <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>
        ))}
        <button type="button" className={operatorClass} onClick={() => chooseOperator('-')}>−</button>

        {[4, 5, 6].map((digit) => (
          <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>
        ))}
        <button type="button" className={operatorClass} onClick={() => chooseOperator('+')}>+</button>

        {[1, 2, 3].map((digit) => (
          <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>
        ))}
        <button type="button" className={keyClass} onClick={backspace} aria-label="Apagar último dígito">
          <Delete className="h-4 w-4" />
        </button>

        <button type="button" className={`${keyClass} col-span-2`} onClick={() => inputDigit('0')}>0</button>
        <button type="button" className={keyClass} onClick={inputDecimal}>,</button>
        <button type="button" className={`${operatorClass} bg-blue-600 hover:bg-blue-500`} onClick={equals}>=</button>
      </div>
    </div>
  );
};

export default StandardCalculator;
