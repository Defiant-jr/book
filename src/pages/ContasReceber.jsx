import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Filter, User, DollarSign, AlertTriangle, ArrowLeft, CheckCircle, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format as formatDateFns } from 'date-fns';
import { getLancamentoStatus, STATUS, STATUS_LABELS, STATUS_COLORS, STATUS_OPTIONS } from '@/lib/lancamentoStatus';

const STATUS_ABERTO = 'em_aberto';
const STATUS_ABERTO_LABEL = 'Em Aberto';

    const ContasReceber = () => {
      const CONTAS_RECEBER_REF = 21000;
      const CONTAS_RECEBIDAS_REF = 25000;
      const navigate = useNavigate();
      const location = useLocation();
      const { toast } = useToast();
      const [contas, setContas] = useState([]);
      const [loading, setLoading] = useState(false);
      const [filters, setFilters] = useState({
        cliente: '',
        status: 'todos',
        unidade: 'todas',
        dataInicio: '',
        dataFim: '',
        valorInicio: '',
        valorFim: ''
      });

      const isRecebidos = new URLSearchParams(location.search).get('status') === STATUS.PAGO;
      const headerTitle = isRecebidos ? 'Contas Recebidas' : 'Contas a Receber';
      const headerRef = isRecebidos ? CONTAS_RECEBIDAS_REF : CONTAS_RECEBER_REF;
    
      useEffect(() => {
        const statusParam = new URLSearchParams(location.search).get('status');
        if (statusParam === STATUS.PAGO) {
          setFilters((prev) => ({ ...prev, status: STATUS.PAGO }));
        } else {
          setFilters((prev) => ({ ...prev, status: 'todos' }));
        }
      }, [location.search]);
    
      useEffect(() => {
        loadData();
      }, [isRecebidos]);
    
      const mapOperacoesToLancamentos = (items) => (items || []).map((item) => {
        const valorPago = Number.isFinite(Number(item?.valor_pago)) ? Number(item.valor_pago) : null;
        const valorOriginal = Number.isFinite(Number(item?.valor)) ? Number(item.valor) : 0;
        const isPago = Boolean(item?.data_pago || valorPago != null);

        return {
          id: item.id,
          data: normalizeDateOnly(item?.data_venc),
          datapag: normalizeDateOnly(item?.data_pago),
          status: isPago ? 'Pago' : null,
          tipo: 'Entrada',
          cliente_fornecedor: item?.responsavel || item?.aluno || 'Nao informado',
          descricao: item?.aluno || item?.responsavel || '',
          valor: valorPago != null ? valorPago : valorOriginal,
          valor_aberto: null,
          desc_pontual: null,
          unidade: item?.unidade || null,
          pago_por: item?.pago_por || null,
        };
      });

      const loadData = async () => {
        setLoading(true);
        try {
          const pageSize = 1000;
          let from = 0;
          const allContas = [];
          while (true) {
            const to = from + pageSize - 1;
            const query = isRecebidos
              ? supabase.from('operacoes').select('*').range(from, to)
              : supabase.from('lancamentos').select('*').eq('tipo', 'Entrada').range(from, to);
            const { data, error } = await query;
            if (error) {
              toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
              return;
            }
            if (data?.length) {
              allContas.push(...(isRecebidos ? mapOperacoesToLancamentos(data) : data));
            }
            if (!data || data.length < pageSize) break;
            from += pageSize;
          }
          setContas(allContas);
        } finally {
          setLoading(false);
        }
      };
    
      const getStatus = (conta) => getLancamentoStatus(conta);

      const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const normalizeDateOnly = (value) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toISOString().slice(0, 10);
        }
        const raw = String(value).trim();
        if (!raw) return null;
        if (raw.includes('T')) return raw.slice(0, 10);
        return raw;
      };

      const formatDate = (dateString) => {
        const normalized = normalizeDateOnly(dateString);
        if (!normalized) return '-';
        const date = new Date(`${normalized}T00:00:00`);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      };
      const valorParaReceber = (conta) => {
        const status = getStatus(conta);
        const valor = Number(conta?.valor) || 0;
        const valorAberto = Number.isFinite(conta?.valor_aberto) ? Number(conta?.valor_aberto) : valor;
        if (status === STATUS.A_VENCER) {
          const descPontual = Number(conta?.desc_pontual);
          return Number.isFinite(descPontual) ? descPontual : valor;
        }
        if (status === STATUS.ATRASADO) {
          return valorAberto;
        }
        return valor;
      };
    
      const filteredContas = useMemo(() => {
        let filtered = [...contas];
        const toCents = (value) => Math.round((Number(value) || 0) * 100);
        if (filters.cliente) {
          filtered = filtered.filter(conta => 
            conta.cliente_fornecedor?.toLowerCase().includes(filters.cliente.toLowerCase())
          );
        }
        if (isRecebidos) {
          filtered = filtered.filter(conta => getStatus(conta) === STATUS.PAGO);
        } else if (filters.status !== 'todos') {
          if (filters.status === STATUS_ABERTO) {
            filtered = filtered.filter((conta) => {
              const status = getStatus(conta);
              return status === STATUS.A_VENCER || status === STATUS.ATRASADO;
            });
          } else {
            filtered = filtered.filter(conta => getStatus(conta) === filters.status);
          }
        }
        if (filters.unidade !== 'todas') {
          filtered = filtered.filter(conta => conta.unidade === filters.unidade);
        }
        if (filters.dataInicio) {
          const startDate = new Date(filters.dataInicio + 'T00:00:00');
          filtered = filtered.filter(conta => {
            const rawDate = normalizeDateOnly(isRecebidos ? conta.datapag : conta.data);
            return rawDate && new Date(rawDate + 'T00:00:00') >= startDate;
          });
        }
        if (filters.dataFim) {
          const endDate = new Date(filters.dataFim + 'T00:00:00');
          filtered = filtered.filter(conta => {
            const rawDate = normalizeDateOnly(isRecebidos ? conta.datapag : conta.data);
            return rawDate && new Date(rawDate + 'T00:00:00') <= endDate;
          });
        }
        if (filters.valorInicio || filters.valorFim) {
          const hasInicio = filters.valorInicio !== '';
          const hasFim = filters.valorFim !== '';
          const inicioCents = hasInicio ? toCents(filters.valorInicio) : null;
          const fimCents = hasFim ? toCents(filters.valorFim) : null;
          filtered = filtered.filter((conta) => {
            const contaCents = toCents(valorParaReceber(conta));
            if (hasInicio && hasFim) {
              return contaCents >= inicioCents && contaCents <= fimCents;
            }
            if (hasInicio) {
              return contaCents === inicioCents;
            }
            return contaCents <= fimCents;
          });
        }
        return filtered.sort((a, b) => {
          const aDate = normalizeDateOnly(isRecebidos ? a.datapag : a.data);
          const bDate = normalizeDateOnly(isRecebidos ? b.datapag : b.data);
          return new Date(`${aDate}T00:00:00`).getTime() - new Date(`${bDate}T00:00:00`).getTime();
        });
      }, [contas, filters, isRecebidos]);
    
      const getStatusColor = (status) => STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      const getStatusLabel = (status) => STATUS_LABELS[status] || status;
    
      const groupedContas = useMemo(() => {
        return filteredContas.reduce((acc, conta) => {
          const groupKey = normalizeDateOnly(isRecebidos ? conta.datapag : conta.data);
          if (!groupKey) return acc;
          (acc[groupKey] = acc[groupKey] || []).push(conta);
          return acc;
        }, {});
      }, [filteredContas, isRecebidos]);
    
      const calculateTotalsByUnit = (contas, getValor) => {
        const totals = {
          'CNA Angra dos Reis': 0,
          'CNA Mangaratiba': 0,
          'Casa': 0,
        };
        contas.forEach(conta => {
          if (totals.hasOwnProperty(conta.unidade)) {
            totals[conta.unidade] += getValor(conta);
          }
        });
        return totals;
      };
    
      const totalAberto = filteredContas.filter(c => getStatus(c) === STATUS.A_VENCER);
      const totalAtrasado = filteredContas.filter(c => getStatus(c) === STATUS.ATRASADO);
      const totalAbertoValor = totalAberto.reduce((s, c) => s + valorParaReceber(c), 0);
      const totalAtrasadoValor = totalAtrasado.reduce((s, c) => s + valorParaReceber(c), 0);
      const totalGeral = filteredContas.reduce((sum, conta) => sum + valorParaReceber(conta), 0);

      const totalAbertoPorUnidade = calculateTotalsByUnit(totalAberto, valorParaReceber);
      const totalAtrasadoPorUnidade = calculateTotalsByUnit(totalAtrasado, valorParaReceber);
      const totalAtrasadoDetalhes = Object.entries(totalAtrasadoPorUnidade);

  const handleMarkAsPaid = async (id) => {
    const today = formatDateFns(new Date(), 'yyyy-MM-dd');
    const { error } = await supabase.from('lancamentos').update({ status: 'Pago', datapag: today }).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o status.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso!', description: 'Lançamento marcado como recebido.' });
      loadData();
    }
  };

  const handleEditLancamento = (lancamento) => {
    navigate('/lancamentos', { state: { lancamento, from: location.pathname } });
  };
    
      return (
        <div className="space-y-8">
          <Helmet>
            <title>{headerTitle} - BooK+</title>
            <meta name="description" content="Gerencie suas contas a receber com filtros e totalizadores" />
          </Helmet>
    
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/10"><ArrowLeft className="w-6 h-6" /></Button>
              <div>
                <h1 className="text-3xl font-bold gradient-text">{headerTitle}</h1>
                <p className="text-gray-400 mt-2">Gerencie seus recebimentos</p>
              </div>
            </div>
            <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
              {headerRef}
            </div>
          </motion.div>
    
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">Total Filtrado</CardTitle>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{formatCurrency(totalGeral)}</div>
              </CardContent>
            </Card>
            {!isRecebidos && (
              <>
                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">A Vencer</CardTitle>
                    <Calendar className="w-4 h-4 text-blue-300" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-300">{formatCurrency(totalAbertoValor)}</div>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      {Object.entries(totalAbertoPorUnidade).map(([unit, val]) => (
                        <div key={unit} className="flex justify-between">
                          <span>{unit}:</span>
                          <span className="font-semibold">{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">Atrasado</CardTitle>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-400">{formatCurrency(totalAtrasadoValor)}</div>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      {totalAtrasadoDetalhes.map(([unit, val]) => (
                        <div key={unit} className="flex justify-between">
                          <span>{unit}:</span>
                          <span className="font-semibold">{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
    
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Filter className="w-5 h-5" />Filtros</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  <div><label className="text-sm text-gray-300 mb-2 block">Cliente</label><Input placeholder="Buscar cliente..." value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })} className="bg-white/10 border-white/20 text-white" /></div>
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Status</label>
                    <Select
                      value={isRecebidos ? STATUS.PAGO : filters.status}
                      onValueChange={(value) => setFilters({ ...filters, status: value })}
                      disabled={isRecebidos}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isRecebidos ? (
                          <SelectItem value={STATUS.PAGO}>Pago</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value={STATUS_ABERTO}>{STATUS_ABERTO_LABEL}</SelectItem>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-sm text-gray-300 mb-2 block">Unidade</label><Select value={filters.unidade} onValueChange={(value) => setFilters({ ...filters, unidade: value })}><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="CNA Angra dos Reis">CNA Angra dos Reis</SelectItem><SelectItem value="CNA Mangaratiba">CNA Mangaratiba</SelectItem><SelectItem value="Casa">Casa</SelectItem></SelectContent></Select></div>
                  <div><label className="text-sm text-gray-300 mb-2 block">Data Início</label><Input type="date" value={filters.dataInicio} onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })} className="bg-white/10 border-white/20 text-white" /></div>
                  <div><label className="text-sm text-gray-300 mb-2 block">Data Fim</label><Input type="date" value={filters.dataFim} onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })} className="bg-white/10 border-white/20 text-white" /></div>
                  <div><label className="text-sm text-gray-300 mb-2 block">Valor Inicial</label><Input type="number" min="0" step="0.01" placeholder="0,00" value={filters.valorInicio} onChange={(e) => setFilters({ ...filters, valorInicio: e.target.value })} className="bg-white/10 border-white/20 text-white" /></div>
                  <div><label className="text-sm text-gray-300 mb-2 block">Valor Final</label><Input type="number" min="0" step="0.01" placeholder="0,00" value={filters.valorFim} onChange={(e) => setFilters({ ...filters, valorFim: e.target.value })} className="bg-white/10 border-white/20 text-white" /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
    
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-6">
            {loading ? <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>
              : Object.entries(groupedContas).map(([date, contasData], index) => (
                <Card key={date} className="glass-card">
                  <CardHeader><div className="flex justify-between items-center"><CardTitle className="text-white flex items-center gap-2"><Calendar className="w-5 h-5" />{formatDate(date)}</CardTitle><div className="text-lg font-bold text-green-400">{formatCurrency(contasData.reduce((s, c) => s + valorParaReceber(c), 0))}</div></div></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contasData.map((conta) => {
                        const status = getStatus(conta);
                        return (
                          <motion.div key={conta.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3 mb-2 md:mb-0">
                              <div className="p-2 rounded-lg bg-green-500/20">
                                <User className="w-4 h-4 text-green-400" />
                              </div>
                              <div>
                                <h3 className="font-medium text-white">{conta.cliente_fornecedor}</h3>
                                <p className="text-sm text-gray-400">{conta.descricao}</p>
                                <p className="text-xs text-gray-500">Unidade: {conta.unidade || 'Nao informado'}</p>
                                {conta.pago_por && (
                                  <p className="text-xs text-gray-500">Pago por: {conta.pago_por}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {!isRecebidos && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>{getStatusLabel(status)}</span>
                              )}
                              <div className="text-lg font-bold text-green-400">{formatCurrency(valorParaReceber(conta))}</div>
                              {!isRecebidos && (
                                <button
                                  type="button"
                                  onClick={() => handleEditLancamento(conta)}
                                  className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                  aria-label="Editar lançamento"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                              )}
                              {!isRecebidos && status !== 'pago' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-400 border-green-400 hover:bg-green-400 hover:text-black"
                                  onClick={() => handleMarkAsPaid(conta.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Recebido
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </motion.div>
    
          {!loading && filteredContas.length === 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12"><div className="text-gray-400 text-lg">Nenhuma conta encontrada</div><p className="text-gray-500 mt-2">Ajuste os filtros ou importe novos dados.</p></motion.div>}
        </div>
      );
    };
    
    export default ContasReceber;
