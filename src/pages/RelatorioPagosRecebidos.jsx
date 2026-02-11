import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, FileDown, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getLancamentoStatus, normalizeTipo, STATUS, STATUS_LABELS } from '@/lib/lancamentoStatus';

const RelatorioPagosRecebidos = () => {
  const RELATORIOS_PAGOS_RECEBIDOS_REF = 88000;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    tipo: 'todos',
    status: STATUS.PAGO,
    unidade: 'todas',
    dataInicio: '',
    dataFim: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'ascending' });
  const reportRef = useRef();
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

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

  const getBaseDate = (conta) => normalizeDateOnly(conta?.datapag || conta?.data);

  const mapOperacoes = (items) => (items || []).map((item) => {
    const valorPago = Number.isFinite(Number(item?.valor_pago)) ? Number(item.valor_pago) : null;
    const valorOriginal = Number.isFinite(Number(item?.valor)) ? Number(item.valor) : 0;
    const dataPago = normalizeDateOnly(item?.data_pago);
    const dataVenc = normalizeDateOnly(item?.data_venc);

    return {
      id: `op-${item.id}`,
      data: dataPago || dataVenc,
      datapag: dataPago,
      status: 'Pago',
      tipo: 'Entrada',
      cliente_fornecedor: item?.responsavel || item?.aluno || 'Nao informado',
      descricao: item?.aluno || item?.responsavel || '',
      unidade: item?.unidade || null,
      valor: valorPago != null ? valorPago : valorOriginal,
      valor_aberto: null,
      desc_pontual: null,
    };
  });

  const fetchOperacoes = async () => {
    const pageSize = 1000;
    let from = 0;
    const rows = [];
    while (true) {
      let query = supabase.from('operacoes').select('*');
      if (filters.unidade !== 'todas') {
        query = query.eq('unidade', filters.unidade);
      }
      if (filters.dataInicio) {
        query = query.gte('data_pago', filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte('data_pago', filters.dataFim);
      }
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (data?.length) {
        rows.push(...data);
      }
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return mapOperacoes(rows);
  };

  const fetchLancamentos = async () => {
    const pageSize = 1000;
    let from = 0;
    const rows = [];
    while (true) {
      let query = supabase.from('lancamentos').select('*').eq('tipo', 'Saida');
      if (filters.unidade !== 'todas') {
        query = query.eq('unidade', filters.unidade);
      }
      if (filters.dataInicio) {
        query = query.gte('datapag', filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte('datapag', filters.dataFim);
      }
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (data?.length) {
        rows.push(...data);
      }
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setReportGenerated(false);
    try {
      const tipoFiltro = normalizeTipo(filters.tipo);
      let results = [];
      if (tipoFiltro === 'entrada') {
        results = await fetchOperacoes();
      } else if (tipoFiltro === 'saida') {
        results = await fetchLancamentos();
      } else {
        const [operacoes, lancamentos] = await Promise.all([fetchOperacoes(), fetchLancamentos()]);
        results = [...operacoes, ...lancamentos];
      }

      const pagos = results.filter((item) => getLancamentoStatus(item) === STATUS.PAGO);
      setContas(pagos);
      setReportGenerated(true);
      setGeneratedAt(new Date());
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedContas = useMemo(() => {
    const tipoFiltro = normalizeTipo(filters.tipo);
    const unidadeFiltro = (filters.unidade || '').trim();
    const filtered = contas.filter((c) => {
      const statusAtual = getLancamentoStatus(c);
      const tipoOk = tipoFiltro === 'todos' || normalizeTipo(c.tipo) === tipoFiltro;
      const unidadeOk = filters.unidade === 'todas' || (c.unidade || '').trim() === unidadeFiltro;
      const baseDate = getBaseDate(c);
      const dataInicioOk = !filters.dataInicio || (baseDate && new Date(`${baseDate}T00:00:00`) >= new Date(`${filters.dataInicio}T00:00:00`));
      const dataFimOk = !filters.dataFim || (baseDate && new Date(`${baseDate}T00:00:00`) <= new Date(`${filters.dataFim}T00:00:00`));
      return tipoOk && unidadeOk && dataInicioOk && dataFimOk && statusAtual === STATUS.PAGO;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === 'valor') {
        aValue = valorConta(a);
        bValue = valorConta(b);
      }
      if (sortConfig.key === 'data') {
        aValue = getBaseDate(a);
        bValue = getBaseDate(b);
      }
      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [contas, filters, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorConta = (conta) => Number(conta?.valor) || 0;
  const formatDate = (dateString) => {
    const normalized = normalizeDateOnly(dateString);
    if (!normalized) return '-';
    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, 'dd/MM/yyyy');
  };
  const formatStatusDisplay = (status) => STATUS_LABELS[status] || status;
  const totalGeral = useMemo(() => {
    const tipoFiltro = normalizeTipo(filters.tipo);
    if (tipoFiltro === 'entrada' || tipoFiltro === 'saida') {
      return filteredAndSortedContas.reduce((acc, c) => acc + valorConta(c), 0);
    }
    return filteredAndSortedContas.reduce((acc, c) => acc + (normalizeTipo(c.tipo) === 'entrada' ? valorConta(c) : -valorConta(c)), 0);
  }, [filteredAndSortedContas, filters.tipo]);

  const handleDownloadPdf = () => {
    if (!reportGenerated) {
      toast({ title: 'Gere o relatório primeiro', description: 'Clique em "Gerar Relatório" para carregar os dados.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF();
    doc.text('Relatório de Contas Pagas/Recebidas', 14, 16);
    doc.autoTable({
      head: [['Data', 'Tipo', 'Cliente/Fornecedor', 'Descrição', 'Unidade', 'Status', 'Valor']],
      body: filteredAndSortedContas.map(c => [
        formatDate(getBaseDate(c)), c.tipo, c.cliente_fornecedor, c.descricao, c.unidade, formatStatusDisplay(getLancamentoStatus(c)), formatCurrency(valorConta(c))
      ]),
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
    });
    doc.save('relatorio_contas_pagas_recebidas.pdf');
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="w-4 h-4 ml-1" /> : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <Helmet><title>Contas Pagas/Recebidas - BooK+</title></Helmet>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/relatorios')}><ArrowLeft className="h-5 w-5" /><span className="sr-only">Voltar</span></Button>
          <h1 className="text-3xl font-bold gradient-text">Contas Pagas/Recebidas</h1>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {RELATORIOS_PAGOS_RECEBIDOS_REF}
        </div>
      </div>
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Filter className="w-5 h-5" />Configuração do Relatório</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Tipo</label>
              <Select value={filters.tipo} onValueChange={(v) => setFilters(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Entrada">Entradas</SelectItem>
                  <SelectItem value="Saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Status</label>
              <Select value={STATUS.PAGO} disabled>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS.PAGO}>Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Unidade</label>
              <Select value={filters.unidade} onValueChange={(v) => setFilters(f => ({ ...f, unidade: v }))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="CNA Angra dos Reis">CNA Angra dos Reis</SelectItem>
                  <SelectItem value="CNA Mangaratiba">CNA Mangaratiba</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Data Início</label>
              <Input
                type="date"
                placeholder="dd/mm/aaaa"
                value={filters.dataInicio}
                onChange={(e) => setFilters(f => ({ ...f, dataInicio: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Data Fim</label>
              <Input
                type="date"
                placeholder="dd/mm/aaaa"
                value={filters.dataFim}
                onChange={(e) => setFilters(f => ({ ...f, dataFim: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button onClick={handleGenerateReport} disabled={loading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">{loading ? 'Gerando...' : 'Gerar Relatório'}</Button>
            <Button onClick={handleDownloadPdf} disabled={!reportGenerated || loading} variant="outline" className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50">
              <FileDown className="mr-2 h-4 w-4" /> Gerar PDF
            </Button>
          </div>
        </CardContent>
      </Card>
      {!reportGenerated && !loading && (
        <Card className="glass-card border-dashed border-white/20">
          <CardContent className="text-center text-gray-300 py-12">
            Escolha os filtros desejados e clique em <span className="font-semibold text-white">"Gerar Relatório"</span> para visualizar os dados.
          </CardContent>
        </Card>
      )}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      )}
      {reportGenerated && !loading && (
        <div className="space-y-6">
          {generatedAt && (
            <div className="text-sm text-gray-300">
              <span className="text-white font-medium">Gerado em:</span> {format(generatedAt, 'dd/MM/yyyy HH:mm')}
            </div>
          )}
          <Card className="glass-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table ref={reportRef} className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-white/5">
                    <tr>
                      <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('data')}><div className="flex items-center">Data <SortIcon columnKey="data" /></div></th>
                      <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('tipo')}><div className="flex items-center">Tipo <SortIcon columnKey="tipo" /></div></th>
                      <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('cliente_fornecedor')}><div className="flex items-center">Cliente/Fornecedor <SortIcon columnKey="cliente_fornecedor" /></div></th>
                      <th scope="col" className="px-6 py-3">Descrição</th>
                      <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('unidade')}><div className="flex items-center">Unidade <SortIcon columnKey="unidade" /></div></th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3 text-right cursor-pointer" onClick={() => requestSort('valor')}><div className="flex items-center justify-end">Valor <SortIcon columnKey="valor" /></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedContas.map(conta => (
                      <tr key={conta.id} className="border-b border-gray-700 hover:bg-white/10">
                        <td className="px-6 py-4">{formatDate(getBaseDate(conta))}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${conta.tipo === 'Entrada' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{conta.tipo}</span></td>
                        <td className="px-6 py-4 font-medium text-white">{conta.cliente_fornecedor}</td>
                        <td className="px-6 py-4">{conta.descricao}</td>
                        <td className="px-6 py-4">{conta.unidade}</td>
                        <td className="px-6 py-4">{formatStatusDisplay(getLancamentoStatus(conta))}</td>
                        <td className={`px-6 py-4 text-right font-mono ${conta.tipo === 'Entrada' ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(valorConta(conta))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-white bg-white/5">
                      <td colSpan={6} className="px-6 py-3 text-right">Total</td>
                      <td className="px-6 py-3 text-right font-mono">{formatCurrency(totalGeral)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
};

export default RelatorioPagosRecebidos;
