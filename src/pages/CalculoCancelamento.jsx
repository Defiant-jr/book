import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, FileDown, Loader2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getLancamentoStatus, STATUS } from '@/lib/lancamentoStatus';
import { getValorConsiderado } from '@/lib/lancamentoValor';
import { fetchAllPaginated } from '@/lib/supabasePagination';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const CalculoCancelamento = () => {
  const CALCULO_CANCELAMENTO_REF = 63100;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [responsaveis, setResponsaveis] = useState([]);
  const [responsavel, setResponsavel] = useState('');
  const [percentualBase, setPercentualBase] = useState('');
  const [taxaAdministrativa, setTaxaAdministrativa] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchResponsaveis = async () => {
      setLoading(true);

      const { data, error } = await fetchAllPaginated((from, to) =>
        supabase
          .from('lancamentos')
          .select('cliente_fornecedor')
          .not('cliente_fornecedor', 'is', null)
          .order('cliente_fornecedor', { ascending: true })
          .range(from, to)
      );

      if (!active) return;

      if (error) {
        setResponsaveis([]);
        toast({
          title: 'Erro ao carregar responsáveis',
          description: 'Não foi possível consultar os responsáveis dos lançamentos.',
          variant: 'destructive',
        });
      } else {
        const nomesUnicos = [...new Set(
          (data || [])
            .map((item) => item.cliente_fornecedor?.trim())
            .filter(Boolean),
        )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        setResponsaveis(nomesUnicos);
      }

      setLoading(false);
    };

    fetchResponsaveis();

    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    setResultado(null);
  }, [responsavel, percentualBase, taxaAdministrativa]);

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
  };

  const handleGenerate = async () => {
    const percentual = Number(percentualBase);
    const taxa = Number(taxaAdministrativa);

    if (!responsavel || percentualBase === '' || taxaAdministrativa === '') {
      toast({
        title: 'Preencha os dados',
        description: 'Selecione o responsável e informe % Base e Tx Adm.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(percentual) || percentual < 0 || !Number.isFinite(taxa) || taxa < 0) {
      toast({
        title: 'Valores inválidos',
        description: 'Informe valores numéricos iguais ou maiores que zero.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    const { data, error } = await fetchAllPaginated((from, to) =>
      supabase
        .from('lancamentos')
        .select('id, data, descricao, valor, valor_aberto, desc_pontual, status, datapag')
        .eq('cliente_fornecedor', responsavel)
        .eq('tipo', 'Entrada')
        .order('data', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );

    setGenerating(false);

    if (error) {
      toast({
        title: 'Erro ao gerar cálculo',
        description: 'Não foi possível consultar os lançamentos do responsável.',
        variant: 'destructive',
      });
      return;
    }

    const emAberto = (data || []).filter((item) => getLancamentoStatus(item) !== STATUS.PAGO);
    const atrasados = emAberto
      .filter((item) => getLancamentoStatus(item) === STATUS.ATRASADO)
      .map((item) => ({
        ...item,
        valorAtrasado: Number(item.valor_aberto) || 0,
      }));
    const aVencer = emAberto.filter((item) => getLancamentoStatus(item) === STATUS.A_VENCER);
    const totalAtrasado = atrasados.reduce((total, item) => total + item.valorAtrasado, 0);
    const totalAVencer = aVencer.reduce(
      (total, item) => total + getValorConsiderado(item),
      0,
    );
    const valorPercentualBase = totalAVencer * (percentual / 100);
    const totalCancelamento = totalAtrasado + valorPercentualBase + taxa;

    setResultado({
      atrasados,
      totalAtrasado,
      totalAVencer,
      percentual,
      valorPercentualBase,
      taxa,
      totalCancelamento,
    });
  };

  const handlePdf = () => {
    if (!resultado) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Cálculo de Cancelamento', 40, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Responsável: ${responsavel}`, 40, 62);

    const linhasAtrasadas = resultado.atrasados.length
      ? resultado.atrasados.map((item) => [
          formatDate(item.data),
          item.descricao || '-',
          formatCurrency(item.valorAtrasado),
        ])
      : [['-', 'Nenhum valor em atraso', formatCurrency(0)]];

    doc.autoTable({
      startY: 78,
      head: [['Vencimento', 'Descrição', 'Valor em atraso']],
      body: linhasAtrasadas,
      foot: [['', 'Total em atraso', formatCurrency(resultado.totalAtrasado)]],
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: {
        0: { halign: 'center' },
        2: { halign: 'right' },
      },
      footStyles: { halign: 'right', fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 18,
      body: [
        ['Total a vencer', formatCurrency(resultado.totalAVencer)],
        [`% Base (${resultado.percentual.toLocaleString('pt-BR')}%)`, formatCurrency(resultado.valorPercentualBase)],
        ['Tx Adm', formatCurrency(resultado.taxa)],
        ['Total do cancelamento', formatCurrency(resultado.totalCancelamento)],
      ],
      theme: 'grid',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    const nomeArquivo = responsavel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    doc.save(`calculo-cancelamento-${nomeArquivo || 'responsavel'}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Cálculo de Cancelamento - BooK+</title>
        <meta name="description" content="Cálculo de cancelamento por responsável." />
      </Helmet>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => navigate('/operacional/calculos')}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <h1 className="text-3xl font-bold gradient-text">Cálculo de Cancelamento</h1>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {CALCULO_CANCELAMENTO_REF}
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Dados do cálculo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xl">
            <label htmlFor="responsavel" className="mb-2 block text-sm font-medium text-gray-300">
              Responsável
            </label>
            <Select value={responsavel} onValueChange={setResponsavel} disabled={loading}>
              <SelectTrigger
                id="responsavel"
                className="w-full bg-white/10 border-white/20 text-white"
              >
                <SelectValue placeholder={loading ? 'Carregando responsáveis...' : 'Selecione o responsável'} />
              </SelectTrigger>
              <SelectContent>
                {responsaveis.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && responsaveis.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">Nenhum responsável encontrado.</p>
            )}
          </div>

          <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="percentual-base" className="mb-2 block text-sm font-medium text-gray-300">
                % Base
              </label>
              <Input
                id="percentual-base"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={percentualBase}
                onChange={(event) => setPercentualBase(event.target.value)}
                placeholder="0,00"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <label htmlFor="taxa-administrativa" className="mb-2 block text-sm font-medium text-gray-300">
                Tx Adm
              </label>
              <Input
                id="taxa-administrativa"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={taxaAdministrativa}
                onChange={(event) => setTaxaAdministrativa(event.target.value)}
                placeholder="0,00"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={
                loading ||
                generating ||
                !responsavel ||
                percentualBase === '' ||
                taxaAdministrativa === ''
              }
            >
              {loading || generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {generating ? 'Gerando...' : 'Gerar'}
            </Button>
            <Button type="button" variant="outline" onClick={handlePdf} disabled={!resultado}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Resultado do cálculo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-white/10 bg-white p-6 text-slate-900">
              <div className="mb-6">
                <div className="text-xl font-bold">Cálculo de Cancelamento</div>
                <div className="mt-1 text-sm text-slate-600">
                  Responsável: <strong>{responsavel}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border border-slate-300 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 px-3 py-2 text-center font-semibold">
                        Vencimento
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">
                        Descrição
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                        Valor em atraso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.atrasados.length > 0 ? (
                      resultado.atrasados.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-slate-300 px-3 py-2 text-center">
                            {formatDate(item.data)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            {item.descricao || '-'}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatCurrency(item.valorAtrasado)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="border border-slate-300 px-3 py-4 text-center text-slate-500"
                        >
                          Nenhum valor em atraso.
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={2} className="border border-slate-300 px-3 py-2">
                        Total em atraso
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatCurrency(resultado.totalAtrasado)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border border-slate-300 text-sm">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-medium">
                        Total a vencer
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatCurrency(resultado.totalAVencer)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-medium">
                        % Base ({resultado.percentual.toLocaleString('pt-BR')}%)
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatCurrency(resultado.valorPercentualBase)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3 py-2 font-medium">
                        Tx Adm
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatCurrency(resultado.taxa)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 text-base font-bold">
                      <td className="border border-slate-300 px-3 py-3">
                        Total do cancelamento
                      </td>
                      <td className="border border-slate-300 px-3 py-3 text-right">
                        {formatCurrency(resultado.totalCancelamento)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default CalculoCancelamento;
