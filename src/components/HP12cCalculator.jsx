import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateBondPrice,
  calculateBondYield,
  calculateDepreciation,
  calculateIrr,
  calculateNpv,
  calculateStatistics,
  solveTvm,
} from '@/domain/financialCalculator';

const initialRegisters = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0, begin: false };

const binaryCalculations = {
  '+': (y, x) => y + x,
  '−': (y, x) => y - x,
  '×': (y, x) => y * x,
  '÷': (y, x) => (x === 0 ? null : y / x),
  'yˣ': (y, x) => y ** x,
  'Δ%': (y, x) => (y === 0 ? null : ((x - y) / Math.abs(y)) * 100),
  '%T': (y, x) => (y === 0 ? null : (x / y) * 100),
};

const normalize = (value) => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number.parseFloat(value.toPrecision(12));
};

const HP12cCalculator = () => {
  const [stack, setStack] = useState([0, 0, 0, 0]);
  const [entry, setEntry] = useState(null);
  const [lastX, setLastX] = useState(0);
  const [registers, setRegisters] = useState(initialRegisters);
  const [memory, setMemory] = useState(() => Array(10).fill(0));
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [cashFlows, setCashFlows] = useState([]);
  const [statPoints, setStatPoints] = useState([]);
  const [precision, setPrecision] = useState(2);
  const [activePanel, setActivePanel] = useState('finance');
  const [message, setMessage] = useState('RPN pronta');
  const [firstDate, setFirstDate] = useState('');
  const [secondDate, setSecondDate] = useState('');

  const currentX = entry === null ? stack[0] : Number(entry);
  const statistics = useMemo(() => calculateStatistics(statPoints), [statPoints]);

  const formattedDisplay = useMemo(() => {
    if (entry !== null) return entry.replace('.', ',');
    if (!Number.isFinite(stack[0])) return 'Erro';
    return stack[0].toLocaleString('pt-BR', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }, [entry, precision, stack]);

  const showError = (text = 'Operação inválida') => setMessage(text);

  const replaceX = (value, text) => {
    const normalized = normalize(value);
    if (normalized === null) {
      showError(text);
      return false;
    }
    setStack((previous) => [normalized, previous[1], previous[2], previous[3]]);
    setEntry(null);
    if (text) setMessage(text);
    return true;
  };

  const pushResult = (value, text) => {
    const normalized = normalize(value);
    if (normalized === null) {
      showError(text);
      return;
    }
    setStack((previous) => [normalized, previous[0], previous[1], previous[2]]);
    setEntry(null);
    if (text) setMessage(text);
  };

  const inputDigit = (digit) => {
    setMessage('RPN pronta');
    setEntry((previous) => {
      if (previous === null || previous === '0') return digit;
      if (previous.replace(/[-.]/g, '').length >= 15) return previous;
      return `${previous}${digit}`;
    });
  };

  const inputDecimal = () => {
    setEntry((previous) => {
      if (previous === null) return '0.';
      return previous.includes('.') ? previous : `${previous}.`;
    });
  };

  const enter = () => {
    const value = currentX;
    setStack((previous) => [value, value, previous[0], previous[1]]);
    setEntry(null);
    setMessage('ENTER');
  };

  const clearX = () => {
    setEntry(null);
    setStack((previous) => [0, previous[1], previous[2], previous[3]]);
    setMessage('X limpo');
  };

  const clearAll = () => {
    setStack([0, 0, 0, 0]);
    setEntry(null);
    setLastX(0);
    setRegisters(initialRegisters);
    setCashFlows([]);
    setStatPoints([]);
    setMessage('Todos os registros foram limpos');
  };

  const backspace = () => {
    if (entry === null) return;
    const next = entry.slice(0, -1);
    setEntry(next === '' || next === '-' ? null : next);
  };

  const toggleSign = () => {
    if (entry !== null) {
      setEntry(entry.startsWith('-') ? entry.slice(1) : `-${entry}`);
      return;
    }
    setLastX(stack[0]);
    replaceX(-stack[0], 'CHS');
  };

  const binaryOperation = (operator) => {
    const x = currentX;
    const y = entry === null ? stack[1] : stack[0];
    const result = normalize(binaryCalculations[operator](y, x));
    setLastX(x);
    if (result === null) {
      showError('Erro matemático');
      return;
    }
    setStack(entry === null
      ? [result, stack[2], stack[3], stack[3]]
      : [result, stack[1], stack[2], stack[3]]);
    setEntry(null);
    setMessage(operator);
  };

  const unaryOperation = (label, operation) => {
    const value = currentX;
    const result = normalize(operation(value));
    setLastX(value);
    if (result === null) {
      showError('Erro matemático');
      return;
    }
    if (entry !== null) setEntry(String(result));
    else setStack((previous) => [result, previous[1], previous[2], previous[3]]);
    setMessage(label);
  };

  const swapXY = () => {
    const x = currentX;
    const y = entry === null ? stack[1] : stack[0];
    setStack(entry === null
      ? [y, x, stack[2], stack[3]]
      : [y, x, stack[1], stack[2]]);
    setEntry(null);
    setMessage('x↔y');
  };

  const rollDown = () => {
    setEntry(null);
    setStack(([x, y, z, t]) => [y, z, t, x]);
    setMessage('R↓');
  };

  const useFinancialRegister = (key) => {
    if (entry !== null) {
      const value = Number(entry);
      setRegisters((previous) => ({ ...previous, [key]: value }));
      setStack((previous) => [value, previous[1], previous[2], previous[3]]);
      setEntry(null);
      setMessage(`${key.toUpperCase()} armazenado`);
      return;
    }
    const result = solveTvm(registers, key);
    if (replaceX(result, `${key.toUpperCase()} calculado`)) {
      setRegisters((previous) => ({ ...previous, [key]: normalize(result) }));
    }
  };

  const storeMemory = () => {
    setMemory((previous) => previous.map((value, index) => index === memoryIndex ? currentX : value));
    setEntry(null);
    setMessage(`STO ${memoryIndex}`);
  };

  const updateMemory = (operator) => {
    const currentMemory = memory[memoryIndex];
    const operation = binaryCalculations[operator];
    const result = normalize(operation(currentMemory, currentX));
    if (result === null) return showError('Operação de memória inválida');
    setMemory((previous) => previous.map((value, index) => index === memoryIndex ? result : value));
    setEntry(null);
    setMessage(`STO ${operator} ${memoryIndex}`);
  };

  const recallMemory = () => pushResult(memory[memoryIndex], `RCL ${memoryIndex}`);

  const storeInitialCashFlow = () => {
    setCashFlows([{ amount: currentX, count: 1 }]);
    setEntry(null);
    setMessage('CF₀ armazenado');
  };

  const appendCashFlow = () => {
    setCashFlows((previous) => [...previous, { amount: currentX, count: 1 }]);
    setEntry(null);
    setMessage(`CF${cashFlows.length} armazenado`);
  };

  const setCashFlowCount = () => {
    const count = Math.max(1, Math.trunc(currentX));
    setCashFlows((previous) => previous.map((flow, index) =>
      index === previous.length - 1 ? { ...flow, count } : flow));
    setEntry(null);
    setMessage(`Nj = ${count}`);
  };

  const runNpv = () => replaceX(calculateNpv(cashFlows, registers.i), 'VPL calculado');
  const runIrr = () => replaceX(calculateIrr(cashFlows), 'TIR calculada');

  const addStatPoint = () => {
    const x = entry === null ? stack[1] : stack[0];
    const y = currentX;
    setStatPoints((previous) => [...previous, { x, y }]);
    setEntry(null);
    setMessage(`Σ+ (${statPoints.length + 1})`);
  };

  const removeStatPoint = () => {
    setStatPoints((previous) => previous.slice(0, -1));
    setMessage('Σ−');
  };

  const showStatPair = (x, y, label) => {
    if (x === null || y === null || x === undefined || y === undefined) {
      showError('Dados estatísticos insuficientes');
      return;
    }
    setStack((previous) => [normalize(x), normalize(y), previous[0], previous[1]]);
    setEntry(null);
    setMessage(label);
  };

  const runAmortization = () => {
    const periods = Math.max(1, Math.trunc(currentX));
    const rate = registers.i / 100;
    let balance = registers.pv;
    let interestTotal = 0;
    let principalTotal = 0;
    for (let index = 0; index < periods; index += 1) {
      const interest = balance * rate;
      const principal = registers.pmt + interest;
      interestTotal += interest;
      principalTotal += principal;
      balance += principal;
    }
    setStack((previous) => [normalize(interestTotal), normalize(principalTotal), normalize(balance), previous[0]]);
    setEntry(null);
    setMessage(`AMORT ${periods}: X=juros, Y=principal, Z=saldo`);
  };

  const runSimpleInterest = () => {
    const interest = -(registers.pv * registers.i * registers.n) / 36000;
    setStack((previous) => [normalize(interest), normalize(registers.pv + interest), previous[0], previous[1]]);
    setEntry(null);
    setMessage('INT: X=juros, Y=montante');
  };

  const runDepreciation = (method) => {
    const result = calculateDepreciation({
      cost: Math.abs(registers.pv),
      salvage: Math.abs(registers.fv),
      life: registers.n,
      period: Math.max(1, Math.trunc(currentX)),
      method,
    });
    replaceX(result, `${method.toUpperCase()} calculado`);
  };

  const runBondPrice = () => replaceX(calculateBondPrice({
    face: Math.abs(registers.fv) || 100,
    couponRate: Math.abs(registers.pmt),
    yieldRate: registers.i,
    periods: registers.n,
    paymentsPerYear: 2,
  }), 'Preço do título calculado');

  const runBondYield = () => replaceX(calculateBondYield({
    price: Math.abs(currentX),
    face: Math.abs(registers.fv) || 100,
    couponRate: Math.abs(registers.pmt),
    periods: registers.n,
    paymentsPerYear: 2,
  }), 'Yield do título calculado');

  const runDaysBetween = () => {
    if (!firstDate || !secondDate) return showError('Informe as duas datas');
    const milliseconds = new Date(`${secondDate}T12:00:00`) - new Date(`${firstDate}T12:00:00`);
    replaceX(Math.round(milliseconds / 86400000), 'ΔDYS calculado');
  };

  const runDays360 = () => {
    if (!firstDate || !secondDate) return showError('Informe as duas datas');
    const start = new Date(`${firstDate}T12:00:00`);
    const end = new Date(`${secondDate}T12:00:00`);
    const startDay = Math.min(30, start.getDate());
    const endDay = end.getDate() === 31 && startDay === 30 ? 30 : end.getDate();
    const days = (end.getFullYear() - start.getFullYear()) * 360
      + (end.getMonth() - start.getMonth()) * 30
      + endDay - startDay;
    replaceX(days, 'ΔDYS 30/360 calculado');
  };

  const runAddDays = () => {
    if (!firstDate) return showError('Informe a data inicial');
    const result = new Date(`${firstDate}T12:00:00`);
    result.setDate(result.getDate() + Math.trunc(currentX));
    setSecondDate(result.toISOString().slice(0, 10));
    setEntry(null);
    setMessage('DATE calculada');
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['INPUT', 'SELECT'].includes(event.target.tagName)) return;
      if (/^[0-9]$/.test(event.key)) inputDigit(event.key);
      else if (event.key === '.' || event.key === ',') inputDecimal();
      else if (event.key === 'Enter') enter();
      else if (event.key === 'Backspace') backspace();
      else if (event.key === 'Escape' || event.key === 'Delete') clearX();
      else if (event.key === '+') binaryOperation('+');
      else if (event.key === '-') binaryOperation('−');
      else if (event.key === '*') binaryOperation('×');
      else if (event.key === '/') binaryOperation('÷');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const keyClass = 'min-h-10 rounded-md border border-white/15 bg-[#30343b] px-2 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#414750] focus:outline-none focus:ring-2 focus:ring-amber-400';
  const financeKeyClass = `${keyClass} bg-[#d8dce3] text-slate-900 hover:bg-white`;
  const operationKeyClass = `${keyClass} bg-[#d88924] text-slate-950 hover:bg-amber-400`;
  const secondaryKeyClass = `${keyClass} bg-[#20242a] text-amber-300 hover:bg-[#343941]`;

  return (
    <div className="w-[760px] max-w-[calc(100vw-3rem)] select-none p-4 text-white" aria-label="Calculadora financeira RPN HP 12c">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold tracking-wide text-amber-300">HP 12c</div>
          <div className="text-[11px] text-white/55">Calculadora financeira RPN</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="hp-precision" className="text-white/60">Casas</label>
          <select id="hp-precision" value={precision} onChange={(event) => setPrecision(Number(event.target.value))} className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-white">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-500 bg-[#b9c7ac] p-3 text-right text-slate-950 shadow-inner">
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider opacity-65">
          <span>{registers.begin ? 'BEGIN' : 'END'}</span>
          <span>{message}</span>
        </div>
        <output className="mt-1 block overflow-hidden text-ellipsis font-mono text-3xl font-bold">{formattedDisplay}</output>
      </div>

      <div className="my-3 grid grid-cols-5 gap-2">
        {['n', 'i', 'pv', 'pmt', 'fv'].map((key) => (
          <button key={key} type="button" className={financeKeyClass} onClick={() => useFinancialRegister(key)}>
            <span className="block text-sm uppercase">{key}</span>
            <span className="block truncate text-[9px] font-normal opacity-65">{registers[key].toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        <button type="button" className={secondaryKeyClass} onClick={() => setRegisters((previous) => ({ ...previous, begin: !previous.begin }))}>BEG/END</button>
        <button type="button" className={secondaryKeyClass} onClick={rollDown}>R↓</button>
        <button type="button" className={secondaryKeyClass} onClick={swapXY}>x↔y</button>
        <button type="button" className={secondaryKeyClass} onClick={() => pushResult(lastX, 'LAST x')}>LAST x</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('√x', (value) => value < 0 ? null : Math.sqrt(value))}>√x</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('x²', (value) => value ** 2)}>x²</button>
        <button type="button" className={operationKeyClass} onClick={() => binaryOperation('÷')}>÷</button>

        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('1/x', (value) => value === 0 ? null : 1 / value)}>1/x</button>
        <button type="button" className={secondaryKeyClass} onClick={() => binaryOperation('yˣ')}>yˣ</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('ln', (value) => value <= 0 ? null : Math.log(value))}>ln</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('eˣ', (value) => Math.exp(value))}>eˣ</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('%', (value) => value / 100)}>%</button>
        <button type="button" className={secondaryKeyClass} onClick={() => binaryOperation('Δ%')}>Δ%</button>
        <button type="button" className={operationKeyClass} onClick={() => binaryOperation('×')}>×</button>

        {[7, 8, 9].map((digit) => <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>)}
        <button type="button" className={secondaryKeyClass} onClick={() => binaryOperation('%T')}>%T</button>
        <button type="button" className={secondaryKeyClass} onClick={toggleSign}>CHS</button>
        <button type="button" className={secondaryKeyClass} onClick={backspace}>←</button>
        <button type="button" className={operationKeyClass} onClick={() => binaryOperation('−')}>−</button>

        {[4, 5, 6].map((digit) => <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>)}
        <button type="button" className={`${keyClass} col-span-2`} onClick={enter}>ENTER</button>
        <button type="button" className={secondaryKeyClass} onClick={clearX}>CL x</button>
        <button type="button" className={operationKeyClass} onClick={() => binaryOperation('+')}>+</button>

        {[1, 2, 3].map((digit) => <button key={digit} type="button" className={keyClass} onClick={() => inputDigit(String(digit))}>{digit}</button>)}
        <button type="button" className={keyClass} onClick={() => inputDigit('0')}>0</button>
        <button type="button" className={keyClass} onClick={inputDecimal}>,</button>
        <button type="button" className={secondaryKeyClass} onClick={clearAll}>CL REG</button>
        <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('FRAC', (value) => value - Math.trunc(value))}>FRAC</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-white/15 pb-3">
        {[
          ['finance', 'Financeiro'],
          ['cash', 'Fluxos'],
          ['stats', 'Estatística'],
          ['tools', 'Datas e títulos'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setActivePanel(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${activePanel === value ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}>{label}</button>
        ))}
      </div>

      {activePanel === 'finance' && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <button type="button" className={secondaryKeyClass} onClick={runAmortization}>AMORT</button>
          <button type="button" className={secondaryKeyClass} onClick={runSimpleInterest}>INT simples</button>
          <button type="button" className={secondaryKeyClass} onClick={() => runDepreciation('sl')}>SL</button>
          <button type="button" className={secondaryKeyClass} onClick={() => runDepreciation('soyd')}>SOYD</button>
          <button type="button" className={secondaryKeyClass} onClick={() => runDepreciation('db')}>DB</button>
          <button type="button" className={secondaryKeyClass} onClick={() => {
            const value = currentX * 12;
            setRegisters((previous) => ({ ...previous, n: value }));
            replaceX(value, 'n anual convertido em meses');
          }}>12× n</button>
          <button type="button" className={secondaryKeyClass} onClick={() => {
            const value = currentX / 12;
            setRegisters((previous) => ({ ...previous, i: value }));
            replaceX(value, 'i anual convertido em mensal');
          }}>12÷ i</button>
          <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('INTG', Math.trunc)}>INTG</button>
          <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('RND', (value) => Number(value.toFixed(precision)))}>RND</button>
          <button type="button" className={secondaryKeyClass} onClick={() => unaryOperation('π', () => Math.PI)}>π</button>
          <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs md:col-span-5">
            <select value={memoryIndex} onChange={(event) => setMemoryIndex(Number(event.target.value))} className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-white">
              {memory.map((_, index) => <option key={index} value={index}>R{index}</option>)}
            </select>
            <button type="button" className={secondaryKeyClass} onClick={storeMemory}>STO</button>
            <button type="button" className={secondaryKeyClass} onClick={recallMemory}>RCL</button>
            {['+', '−', '×', '÷'].map((operator) => <button key={operator} type="button" className={secondaryKeyClass} onClick={() => updateMemory(operator)}>STO {operator}</button>)}
            <span className="truncate text-white/55">{memory[memoryIndex].toLocaleString('pt-BR', { maximumFractionDigits: precision })}</span>
          </div>
          <p className="col-span-full text-[11px] text-white/50">AMORT usa X como número de períodos. Depreciação usa PV=custo, FV=residual, n=vida e X=período.</p>
        </div>
      )}

      {activePanel === 'cash' && (
        <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
          <div className="grid grid-cols-2 gap-2 self-start">
            <button type="button" className={secondaryKeyClass} onClick={storeInitialCashFlow}>CF₀</button>
            <button type="button" className={secondaryKeyClass} onClick={appendCashFlow}>CFⱼ</button>
            <button type="button" className={secondaryKeyClass} onClick={setCashFlowCount}>Nⱼ</button>
            <button type="button" className={secondaryKeyClass} onClick={() => setCashFlows([])}>CL CF</button>
            <button type="button" className={financeKeyClass} onClick={runNpv}>VPL</button>
            <button type="button" className={financeKeyClass} onClick={runIrr}>TIR</button>
          </div>
          <div className="max-h-28 overflow-auto rounded-md border border-white/10 bg-black/15 p-2 text-xs">
            {cashFlows.length ? cashFlows.map((flow, index) => (
              <div key={`${index}-${flow.amount}`} className="flex justify-between border-b border-white/5 py-1 last:border-0">
                <span>CF{index}{index > 0 ? ` × ${flow.count}` : ''}</span>
                <span>{flow.amount.toLocaleString('pt-BR', { maximumFractionDigits: precision })}</span>
              </div>
            )) : <span className="text-white/45">Nenhum fluxo armazenado.</span>}
          </div>
        </div>
      )}

      {activePanel === 'stats' && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
          <button type="button" className={secondaryKeyClass} onClick={addStatPoint}>Σ+</button>
          <button type="button" className={secondaryKeyClass} onClick={removeStatPoint}>Σ−</button>
          <button type="button" className={secondaryKeyClass} onClick={() => setStatPoints([])}>CL Σ</button>
          <button type="button" className={financeKeyClass} onClick={() => showStatPair(statistics?.meanX, statistics?.meanY, 'Médias: X=x̄, Y=ȳ')}>x̄ ȳ</button>
          <button type="button" className={financeKeyClass} onClick={() => showStatPair(statistics?.stdX, statistics?.stdY, 'Desvios: X=sx, Y=sy')}>s</button>
          <button type="button" className={financeKeyClass} onClick={() => showStatPair(statistics?.slope, statistics?.intercept, 'Regressão: X=m, Y=b')}>ŷ,r</button>
          <div className="col-span-full rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/60">
            n={statistics?.count || 0} · Σx={statistics?.sumX?.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) || 0} · Σy={statistics?.sumY?.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) || 0} · r={statistics?.correlation?.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) || '—'}
          </div>
        </div>
      )}

      {activePanel === 'tools' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-amber-300">Cálculo de datas</div>
            <input type="date" value={firstDate} onChange={(event) => setFirstDate(event.target.value)} className="w-full rounded border border-white/20 bg-slate-900 px-2 py-1.5 text-xs text-white" />
            <input type="date" value={secondDate} onChange={(event) => setSecondDate(event.target.value)} className="w-full rounded border border-white/20 bg-slate-900 px-2 py-1.5 text-xs text-white" />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className={secondaryKeyClass} onClick={runDaysBetween}>ΔDYS</button>
              <button type="button" className={secondaryKeyClass} onClick={runDays360}>30/360</button>
              <button type="button" className={secondaryKeyClass} onClick={runAddDays}>DATE + X</button>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold text-amber-300">Títulos semestrais</div>
            <button type="button" className={`${financeKeyClass} w-full`} onClick={runBondPrice}>PRICE</button>
            <button type="button" className={`${financeKeyClass} w-full`} onClick={runBondYield}>YTM</button>
            <p className="text-[10px] text-white/45">Usa FV=valor de face, PMT=cupom anual %, i=yield anual %, n=períodos. Para YTM, informe o preço em X.</p>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-md bg-black/15 p-2 text-[10px] text-white/45">
        {['X', 'Y', 'Z', 'T'].map((label, index) => <div key={label}><span>{label}: </span><span>{stack[index].toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</span></div>)}
      </div>
    </div>
  );
};

export default HP12cCalculator;
