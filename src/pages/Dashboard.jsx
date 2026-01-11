import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { Helmet } from 'react-helmet';
import { TrendingUp, TrendingDown, DollarSign, Download, LayoutDashboard, PlusCircle, FileText, ArrowRight, ArrowLeft, Wallet, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { getValorConsiderado } from '@/lib/lancamentoValor';
import { getLancamentoStatus, normalizeTipo, STATUS } from '@/lib/lancamentoStatus';
import { useEmCashValue } from '@/hooks/useEmCashValue';

    const Dashboard = () => {
      const navigate = useNavigate();
      const { toast } = useToast();
      const [data, setData] = useState({ lancamentos: [] });
      const [loading, setLoading] = useState(false);
      const [chartData, setChartData] = useState([]);
      const [monthsSpan, setMonthsSpan] = useState(12);
      const [emCashValue, setEmCashValue] = useEmCashValue();
      const [emCashDraft, setEmCashDraft] = useState(0);
    
      useEffect(() => {
        setEmCashDraft(emCashValue);
      }, [emCashValue]);
    
      useEffect(() => {
        loadDataFromSupabase();
      }, []);
    
      const loadDataFromSupabase = async () => {
        setLoading(true);
        try {
          const pageSize = 1000;
          let from = 0;
          const allLancamentos = [];
          while (true) {
            const to = from + pageSize - 1;
            const { data: page, error } = await supabase
              .from('lancamentos')
              .select('*')
              .range(from, to);
            if (error) {
              toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
              setData({ lancamentos: [] });
              return;
            }
            if (page?.length) {
              allLancamentos.push(...page);
            }
            if (!page || page.length < pageSize) break;
            from += pageSize;
          }
          setData({ lancamentos: allLancamentos });
        } catch (err) {
          console.error('Falha ao buscar lançamentos', err);
          toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os lançamentos.", variant: "destructive" });
          setData({ lancamentos: [] });
        } finally {
          setLoading(false);
        }
      };
    
      const parseDateSafe = (value) => {
        if (!value) return null;
        if (value instanceof Date) {
          return Number.isNaN(value.getTime()) ? null : value;
        }
        const raw = String(value).trim();
        if (!raw) return null;
        const brPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const matchBr = brPattern.exec(raw);
        const normalized = matchBr ? `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}` : raw;
        const parsed = normalized.includes('T')
          ? new Date(normalized)
          : new Date(`${normalized}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const generateChartData = (financialData, span = monthsSpan, cashValue = 0) => {
        try {
          const lancamentos = Array.isArray(financialData?.lancamentos) ? financialData.lancamentos : [];
          const todayStr = new Date().toISOString().split('T')[0];
          const getStatus = (conta) => getLancamentoStatus(conta, todayStr);
          const lancamentosEmAberto = lancamentos.filter((conta) => getStatus(conta) !== STATUS.PAGO);
          const months = [];
          const currentDate = new Date();
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

          const sumValores = (lista) => lista.reduce((acc, conta) => acc + (Number(conta?.valor) || 0), 0);

          const overdueReceber = sumValores(
            lancamentosEmAberto.filter((conta) => {
              if (normalizeTipo(conta.tipo) !== 'entrada') return false;
              const venc = parseDateSafe(conta.data);
              return venc && venc < startDate;
            })
          );
          const overduePagar = sumValores(
            lancamentosEmAberto.filter((conta) => {
              if (normalizeTipo(conta.tipo) !== 'saida') return false;
              const venc = parseDateSafe(conta.data);
              return venc && venc < startDate;
            })
          );

          for (let i = 0; i < span; i++) {
            const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

            const monthPagar = lancamentosEmAberto
              .filter(conta => {
                if (normalizeTipo(conta.tipo) !== 'saida') return false;
                const vencimento = parseDateSafe(conta.data);
                return vencimento && vencimento.getMonth() === date.getMonth() &&
                       vencimento.getFullYear() === date.getFullYear();
              })
              .reduce((sum, conta) => sum + (Number(conta?.valor) || 0), 0);
            
            let monthReceber = lancamentosEmAberto
              .filter(conta => {
                if (normalizeTipo(conta.tipo) !== 'entrada') return false;
                const vencimento = parseDateSafe(conta.data);
                return vencimento && vencimento.getMonth() === date.getMonth() &&
                       vencimento.getFullYear() === date.getFullYear();
              })
              .reduce((sum, conta) => sum + (Number(conta?.valor) || 0), 0);

            if (i === 0) {
              monthReceber += cashValue + overdueReceber;
              months.push({
                month: monthName,
                pagar: monthPagar + overduePagar,
                receber: monthReceber
              });
            } else {
              months.push({
                month: monthName,
                pagar: monthPagar,
                receber: monthReceber
              });
            }
          }
          setChartData(months);
        } catch (err) {
          console.error('Erro ao gerar dados do gráfico', err);
          setChartData([]);
        }
      };
    
      useEffect(() => {
        generateChartData({ lancamentos: data.lancamentos }, monthsSpan, emCashValue);
      }, [data.lancamentos, monthsSpan, emCashValue]);
    
      const formatCurrency = (value) => {
        return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      };
    
      const parseCurrencyInput = (value) => {
        const digits = (value || '').replace(/\D/g, '');
        if (!digits) return 0;
        return Number.parseInt(digits, 10) / 100;
      };
    
      const handleEmCashInputChange = (event) => {
        setEmCashDraft(parseCurrencyInput(event.target.value));
      };
    
      const handleEmCashInputKeyDown = (event) => {
        if (event.key === 'Enter' && emCashIsDirty) {
          event.preventDefault();
          handleConfirmEmCash();
        }
      };
    
      const handleConfirmEmCash = () => {
        setEmCashValue(emCashDraft);
        toast({
          title: 'Saldo em Cash atualizado',
          description: `Novo valor confirmado: ${formatCurrency(emCashDraft)}`
        });
      };
    
      const emCashIsDirty = Math.round(emCashDraft * 100) !== Math.round(emCashValue * 100);
    
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split('T')[0];
      const getPeriodRange = (span) => {
        const start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const end = new Date(hoje.getFullYear(), hoje.getMonth() + span, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      };

      const { start: periodStart, end: periodEnd } = getPeriodRange(monthsSpan);
      const isInPeriod = (conta) => {
        const vencimento = parseDateSafe(conta.data);
        return vencimento && vencimento >= periodStart && vencimento <= periodEnd;
      };

    
      const entradas = data.lancamentos.filter(c => normalizeTipo(c.tipo) === 'entrada');
      const saidas = data.lancamentos.filter(c => normalizeTipo(c.tipo) === 'saida');
      const getStatus = (conta) => getLancamentoStatus(conta, hojeStr);
      const entradasEmAberto = entradas.filter((c) => getStatus(c) !== STATUS.PAGO);
      const saidasEmAberto = saidas.filter((c) => getStatus(c) !== STATUS.PAGO);

      const entradasPeriodo = entradasEmAberto.filter(isInPeriod);
      const saidasPeriodo = saidasEmAberto.filter(isInPeriod);

      const getValorBase = (lancamento) => Number(lancamento?.valor) || 0;
      const getOverdueBeforeCurrentMonth = (conta) => {
        if (getStatus(conta) !== STATUS.ATRASADO) return false;
        const vencimento = parseDateSafe(conta.data);
        return vencimento && vencimento < periodStart;
      };

      const receberAtrasadoAnterior = entradasEmAberto
        .filter(getOverdueBeforeCurrentMonth)
        .reduce((sum, c) => sum + getValorBase(c), 0);
      const pagarAtrasadoAnterior = saidasEmAberto
        .filter(getOverdueBeforeCurrentMonth)
        .reduce((sum, c) => sum + getValorBase(c), 0);

      const totalReceber = entradasPeriodo.reduce((sum, c) => sum + getValorBase(c), 0);
      const receberAberto = entradasPeriodo
        .filter(c => getStatus(c) === STATUS.A_VENCER)
        .reduce((sum, c) => sum + getValorBase(c), 0);
      const receberAtrasado = entradasPeriodo
        .filter(c => getStatus(c) === STATUS.ATRASADO)
        .reduce((sum, c) => sum + getValorBase(c), 0) + receberAtrasadoAnterior;
      const emCashAmount = Number(emCashValue) || 0;
      const totalReceberComCash = totalReceber + emCashAmount;
      const totalReceberPendente = receberAberto + receberAtrasado + emCashAmount;

      const totalPagar = saidasPeriodo.reduce((sum, c) => sum + getValorBase(c), 0);
      const pagarAberto = saidasPeriodo
        .filter(c => getStatus(c) === STATUS.A_VENCER)
        .reduce((sum, c) => sum + getValorBase(c), 0);
      const pagarAtrasado = saidasPeriodo
        .filter(c => getStatus(c) === STATUS.ATRASADO)
        .reduce((sum, c) => sum + getValorBase(c), 0) + pagarAtrasadoAnterior;
      const totalPagarPendente = pagarAberto + pagarAtrasado;

      const resultadoOperacional = totalReceberPendente - totalPagar;
      const resultadoOperacionalComCash = resultadoOperacional;
    
      const summaryCards = [
        {
          title: 'Total a Receber',
          value: formatCurrency(totalReceberPendente),
          icon: TrendingUp,
          color: 'from-green-500 to-green-600',
          bgColor: 'bg-green-500/10',
          details: [
            { label: 'Em Aberto', value: formatCurrency(receberAberto) },
            { label: 'Em Atraso', value: formatCurrency(receberAtrasado), color: 'text-red-400' },
            { label: 'Em Cash', value: formatCurrency(emCashAmount), color: 'text-green-300' },
            { label: 'Pendentes', value: formatCurrency(totalReceberPendente) },
          ]
        },
        {
          title: 'Total a Pagar',
          value: formatCurrency(totalPagar),
          icon: TrendingDown,
          color: 'from-red-500 to-red-600',
          bgColor: 'bg-red-500/10',
          details: [
            { label: 'Em Aberto', value: formatCurrency(pagarAberto) },
            { label: 'Vencido', value: formatCurrency(pagarAtrasado), color: 'text-red-400' },
            { label: 'Pendentes', value: formatCurrency(totalPagarPendente) },
          ]
        },
        {
          title: 'Resultado Operacional (Previsto)',
          value: formatCurrency(resultadoOperacional),
          icon: DollarSign,
          color: resultadoOperacional >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600',
          bgColor: resultadoOperacional >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10',
          showSpanSelector: true,
          details: emCashAmount ? [
            { label: 'Previsto com Cash', value: formatCurrency(resultadoOperacionalComCash), color: 'text-gray-300' },
            { label: 'Saldo em Cash', value: formatCurrency(emCashAmount), color: 'text-green-300' },
          ] : undefined
        }
      ];
      
      const navButtons = [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "Cadastro", path: "/financeiro/cadastro", icon: UserPlus },
        { label: "A Receber", path: "/contas-receber", icon: ArrowRight },
        { label: "A Pagar", path: "/contas-pagar", icon: ArrowLeft },
        { label: "Fluxo de Caixa", path: "/fluxo-caixa", icon: Wallet },
        { label: "Financeiro", path: "/financeiro", icon: PlusCircle },
        { label: "Relat\u00f3rios", path: "/relatorios", icon: FileText },
        { label: "Integra\u00e7\u00e3o", path: "/integracao", icon: Download },
      ];

      return (
        <div className="space-y-8">
          <Helmet>
            <title>Área Financeira - BooK+</title>
            <meta name="description" content="Área financeira com visão geral das finanças" />
          </Helmet>
    
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Voltar</span>
              </Button>
              <div className="text-left">
                <h1 className="text-3xl font-bold gradient-text">Área Financeira</h1>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card p-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {navButtons.map((item, index) => {
                        const Icon = item.icon;
                        const action = item.path ? () => navigate(item.path) : item.action;
                        const isDisabled = item.disabled;
                        return (
                            <Button 
                                key={index} 
                                onClick={action}
                                variant="ghost"
                                className="flex-grow sm:flex-grow-0 text-gray-300 hover:bg-white/10 hover:text-white"
                                disabled={isDisabled}
                            >
                                <Icon className={`w-4 h-4 mr-2 ${isDisabled ? 'animate-spin' : ''}`} />
                                <span>{isDisabled ? item.loadingLabel : item.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-white">Saldo em Cash</CardTitle>
                  <p className="text-sm text-gray-400">
                    Este valor será somado aos lançamentos em atraso e impacta diretamente o fluxo de caixa.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wide text-gray-400">Valor atual</span>
                  <p className="text-2xl font-semibold text-white">{formatCurrency(emCashValue)}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label htmlFor="emCashInput" className="text-sm text-gray-300">Atualizar valor</label>
                <div className="flex flex-col gap-3 lg:flex-row">
                  <Input
                    id="emCashInput"
                    type="text"
                    inputMode="decimal"
                    value={formatCurrency(emCashDraft)}
                    onChange={handleEmCashInputChange}
                    onKeyDown={handleEmCashInputKeyDown}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 font-semibold tracking-wide"
                    placeholder="R$ 0,00"
                  />
                  <Button
                    onClick={handleConfirmEmCash}
                    disabled={!emCashIsDirty}
                    className="lg:w-48"
                  >
                    Confirmar valor
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Ajuste manual usado para demonstrar o caixa imediato disponível. Clique em confirmar para aplicar.
                </p>
              </CardContent>
            </Card>
          </motion.div>
    
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summaryCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="h-full"
                >
                  <Card className="glass-card hover:scale-105 transition-transform duration-300 h-full flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300">
                        {card.title}
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${card.bgColor}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className={`text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                        {card.value}
                      </div>
                      {card.details && (
                        <div className="mt-4 space-y-2">
                          {card.details.map((detail, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-400">{detail.label}:</span>
                              <span className={`font-semibold ${detail.color ? detail.color : 'text-white'}`}>{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex-1" />
                      {card.showSpanSelector && (
                        <div className="mt-4 space-y-2">
                          <span className="text-sm text-gray-300">Periodo do grafico</span>
                          <Select value={String(monthsSpan)} onValueChange={(value) => setMonthsSpan(Number(value))}>
                            <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
                              <SelectValue placeholder="Meses" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                  {option} {option === 1 ? 'mes' : 'meses'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
    
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white">Fluxo Financeiro Mensal (Previsto)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        formatter={(value) => formatCurrency(value)}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="receber" fill="#10B981" name="A Receber" />
                      <Bar dataKey="pagar" fill="#EF4444" name="A Pagar" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    };
    
    export default Dashboard;
