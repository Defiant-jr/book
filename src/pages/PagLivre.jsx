import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, FileDown, Filter, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllPaginated } from '@/lib/supabasePagination';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const PAG_LIVRES_REF = 27000;
const READONLY_COLUMNS = new Set(['id', 'created_at', 'updated_at']);
const DISPLAY_FIELDS = [
  { name: 'nome', label: 'Nome', size: 'minmax(20rem, 2fr)' },
  { name: 'valor', label: 'Valor', size: 'minmax(9rem, 0.7fr)' },
  { name: 'data', label: 'Data', size: 'minmax(9rem, 0.7fr)' },
  { name: 'reconhecido', label: 'Reconhecido', size: 'minmax(9rem, 0.7fr)' },
  { name: 'responsavel', label: 'Responsável', size: 'minmax(20rem, 2fr)' },
];

const getReconhecidoOption = (value) => {
  if (value === true) return 'sim';
  if (value === false) return 'nao';
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['sim', 's', 'true', '1'].includes(normalized)) return 'sim';
  if (['não', 'nao', 'n', 'false', '0'].includes(normalized)) return 'nao';
  return '';
};

const getReconhecidoValue = (option, currentValue) => {
  const isSim = option === 'sim';
  if (typeof currentValue === 'boolean') return isSim;
  const normalized = String(currentValue ?? '').trim().toLowerCase();
  if (['s', 'n'].includes(normalized)) return isSim ? 'S' : 'N';
  if (['true', 'false'].includes(normalized)) return isSim ? 'true' : 'false';
  return isSim ? 'SIM' : 'NÃO';
};

const getDateInputValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return '';
};

const formatDate = (value) => {
  const isoValue = getDateInputValue(value);
  if (!isoValue) return value ?? '';
  const [year, month, day] = isoValue.split('-');
  return `${day}-${month}-${year}`;
};

const normalizeColumnName = (column) =>
  column
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const PagLivre = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registros, setRegistros] = useState([]);
  const [ordenacao, setOrdenacao] = useState('');
  const [filters, setFilters] = useState({
    nome: '',
    reconhecido: 'todos',
    responsavel: '',
    dataInicio: '',
    dataFim: '',
    valorInicio: '',
    valorFim: '',
  });
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [newRecord, setNewRecord] = useState(null);

  const columns = useMemo(() => {
    const keys = new Set();
    registros.forEach((row) => {
      Object.keys(row || {}).forEach((column) => {
        if (!READONLY_COLUMNS.has(column)) keys.add(column);
      });
    });
    return Array.from(keys);
  }, [registros]);

  const displayColumns = useMemo(
    () =>
      DISPLAY_FIELDS.map((field) => ({
        ...field,
        column: columns.find((column) => normalizeColumnName(column) === field.name),
      })).filter((field) => field.column),
    [columns],
  );

  const gridTemplateColumns = useMemo(
    () => displayColumns.map((field) => field.size).join(' '),
    [displayColumns],
  );
  const rowGridTemplateColumns = `${gridTemplateColumns} minmax(7rem, 0.5fr)`;

  useEffect(() => {
    if (!displayColumns.length) return;
    const availableColumns = displayColumns.map((field) => field.column);
    if (!ordenacao || !availableColumns.includes(ordenacao)) {
      setOrdenacao(availableColumns[0]);
    }
  }, [displayColumns, ordenacao]);

  const registrosFiltradosOrdenados = useMemo(() => {
    const getColumn = (name) => columns.find((column) => normalizeColumnName(column) === name);
    const nomeColumn = getColumn('nome');
    const valorColumn = getColumn('valor');
    const dataColumn = getColumn('data');
    const reconhecidoColumn = getColumn('reconhecido');
    const responsavelColumn = getColumn('responsavel');

    let filtered = [...registros];
    if (filters.nome && nomeColumn) {
      const search = filters.nome.trim().toLowerCase();
      filtered = filtered.filter((row) => String(row[nomeColumn] ?? '').toLowerCase().includes(search));
    }
    if (filters.responsavel && responsavelColumn) {
      const search = filters.responsavel.trim().toLowerCase();
      filtered = filtered.filter((row) => String(row[responsavelColumn] ?? '').toLowerCase().includes(search));
    }
    if (filters.reconhecido !== 'todos' && reconhecidoColumn) {
      filtered = filtered.filter(
        (row) => getReconhecidoOption(row[reconhecidoColumn]) === filters.reconhecido,
      );
    }
    if (filters.dataInicio && dataColumn) {
      filtered = filtered.filter((row) => {
        const value = getDateInputValue(row[dataColumn]);
        return value && value >= filters.dataInicio;
      });
    }
    if (filters.dataFim && dataColumn) {
      filtered = filtered.filter((row) => {
        const value = getDateInputValue(row[dataColumn]);
        return value && value <= filters.dataFim;
      });
    }
    if ((filters.valorInicio !== '' || filters.valorFim !== '') && valorColumn) {
      const parseValue = (value) => {
        const raw = String(value ?? '').trim();
        return Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
      };
      const start = filters.valorInicio === '' ? null : parseValue(filters.valorInicio);
      const end = filters.valorFim === '' ? null : parseValue(filters.valorFim);
      filtered = filtered.filter((row) => {
        const value = parseValue(row[valorColumn]);
        if (!Number.isFinite(value)) return false;
        if (start != null && value < start) return false;
        if (end != null && value > end) return false;
        return true;
      });
    }

    if (!ordenacao) return filtered;
    return filtered.sort((a, b) => {
      const aValue = String(a?.[ordenacao] ?? '').toLowerCase();
      const bValue = String(b?.[ordenacao] ?? '').toLowerCase();
      return aValue.localeCompare(bValue, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }, [columns, filters, ordenacao, registros]);

  const fetchRegistros = async () => {
    setLoading(true);
    const { data, error } = await fetchAllPaginated((from, to) =>
      supabase
        .from('pag_livres')
        .select('*')
        .order('id', { ascending: true })
        .range(from, to),
    );
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao carregar',
        description: error.message || 'Nao foi possivel buscar os registros a reconhecer.',
        variant: 'destructive',
      });
      return;
    }

    setRegistros(data || []);
    setDirtyIds(new Set());
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

  const markDirty = (id) => {
    setDirtyIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const handleChange = (id, column, value) => {
    setRegistros((current) =>
      current.map((row) => (row.id === id ? { ...row, [column]: value } : row)),
    );
    markDirty(id);
  };

  const handleSave = async (id) => {
    if (!dirtyIds.has(id)) {
      toast({ title: 'Nada para salvar', description: 'Este registro nao foi alterado.' });
      return;
    }

    const row = registros.find((item) => item.id === id);
    if (!row) return;

    const payload = {};
    columns.forEach((column) => {
      payload[column] = row[column] === '' ? null : row[column];
    });

    setSavingId(id);
    const { error } = await supabase.from('pag_livres').update(payload).eq('id', id);
    setSavingId(null);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Nao foi possivel salvar o registro.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Registro salvo',
      description: `O registro ID ${id} foi atualizado.`,
    });
    setDirtyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const handleStartCreate = () => {
    const draft = {};
    displayColumns.forEach((field) => {
      draft[field.column] = field.name === 'reconhecido' ? 'nao' : '';
    });
    setNewRecord(draft);
  };

  const handleCreate = async () => {
    if (!newRecord) return;

    const nomeColumn = displayColumns.find((field) => field.name === 'nome')?.column;
    if (nomeColumn && !String(newRecord[nomeColumn] ?? '').trim()) {
      toast({
        title: 'Informe o nome',
        description: 'O campo Nome e obrigatorio para incluir o registro.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {};
    displayColumns.forEach((field) => {
      const value = newRecord[field.column];
      if (field.name === 'reconhecido') {
        const example = registros.find((row) => row[field.column] != null)?.[field.column];
        payload[field.column] = getReconhecidoValue(getReconhecidoOption(value) || 'nao', example);
      } else {
        payload[field.column] = value === '' ? null : value;
      }
    });

    setSavingId('new');
    const { data, error } = await supabase
      .from('pag_livres')
      .insert([payload])
      .select('*')
      .single();
    setSavingId(null);

    if (error) {
      toast({
        title: 'Erro ao adicionar',
        description: error.message || 'Nao foi possivel incluir o registro.',
        variant: 'destructive',
      });
      return;
    }

    setRegistros((current) => [...current, data]);
    setNewRecord(null);
    toast({ title: 'Registro adicionado', description: 'O novo registro foi incluido em pag_livres.' });
  };

  const handleGeneratePdf = () => {
    if (!registrosFiltradosOrdenados.length) {
      toast({
        title: 'Nenhum registro para exportar',
        description: 'Ajuste os filtros antes de gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    const getColumn = (name) => displayColumns.find((field) => field.name === name)?.column;
    const nomeColumn = getColumn('nome');
    const valorColumn = getColumn('valor');
    const dataColumn = getColumn('data');
    const reconhecidoColumn = getColumn('reconhecido');
    const responsavelColumn = getColumn('responsavel');
    const parseCurrency = (value) => {
      const raw = String(value ?? '').trim();
      const parsed = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const formatCurrency = (value) =>
      parseCurrency(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const total = registrosFiltradosOrdenados.reduce(
      (sum, row) => sum + parseCurrency(row[valorColumn]),
      0,
    );
    const filterDescriptions = [
      filters.nome && `Nome: ${filters.nome}`,
      filters.reconhecido !== 'todos' && `Reconhecido: ${filters.reconhecido === 'sim' ? 'SIM' : 'NÃO'}`,
      filters.responsavel && `Responsável: ${filters.responsavel}`,
      filters.dataInicio && `Data inicial: ${formatDate(filters.dataInicio)}`,
      filters.dataFim && `Data final: ${formatDate(filters.dataFim)}`,
      filters.valorInicio !== '' && `Valor inicial: ${formatCurrency(filters.valorInicio)}`,
      filters.valorFim !== '' && `Valor final: ${formatCurrency(filters.valorFim)}`,
    ].filter(Boolean);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Conciliação de Pagamento', 40, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Registros: ${registrosFiltradosOrdenados.length} | Total: ${formatCurrency(total)}`, 40, 55);
    const filtersText = filterDescriptions.length ? filterDescriptions.join(' | ') : 'Filtros: Todos os registros';
    const filterLines = doc.splitTextToSize(filtersText, pageWidth - 80);
    doc.text(filterLines, 40, 70);

    doc.autoTable({
      head: [['Nome', 'Valor', 'Data', 'Reconhecido', 'Responsável']],
      body: registrosFiltradosOrdenados.map((row) => [
        row[nomeColumn] ?? '',
        formatCurrency(row[valorColumn]),
        formatDate(row[dataColumn]),
        getReconhecidoOption(row[reconhecidoColumn]) === 'sim' ? 'SIM' : 'NÃO',
        row[responsavelColumn] ?? '',
      ]),
      startY: 70 + filterLines.length * 11,
      theme: 'grid',
      margin: { left: 40, right: 40, bottom: 34 },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 70, halign: 'right' },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 75, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(`Página ${data.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 16, {
          align: 'right',
        });
      },
    });

    const generatedDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`conciliacao-pagamentos-${generatedDate}.pdf`);
  };

  const renderFieldControl = (row, column, onChange, disabled = false) => {
    const normalizedColumn = normalizeColumnName(column);
    if (normalizedColumn === 'reconhecido') {
      return (
        <Select
          value={getReconhecidoOption(row[column])}
          onValueChange={(value) => onChange(getReconhecidoValue(value, row[column]))}
          disabled={disabled}
        >
          <SelectTrigger className="bg-white/10 border-white/20 text-white">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sim">SIM</SelectItem>
            <SelectItem value="nao">NÃO</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (normalizedColumn === 'data') {
      return (
        <div className="relative">
          <Input
            value={formatDate(row[column])}
            readOnly
            disabled={disabled}
            placeholder="DD-MM-AAAA"
            className="pr-10"
          />
          <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={getDateInputValue(row[column])}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            aria-label="Escolher data"
            className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>
      );
    }

    return (
      <Input
        value={row[column] ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>A Reconhecer - Financeiro</title>
        <meta name="description" content="Edicao da tabela pag_livres." />
      </Helmet>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">A Reconhecer</h1>
            <span className="mt-2 text-sm text-gray-300">Conciliação de Pagamento</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
            {PAG_LIVRES_REF}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-400">Ordenar por</span>
              <Select value={ordenacao} onValueChange={setOrdenacao} disabled={!displayColumns.length}>
                <SelectTrigger
                  className="w-full bg-white/10 border-white/20 text-white sm:w-40"
                  aria-label="Ordenar listagem"
                >
                  <SelectValue placeholder="Ordenacao" />
                </SelectTrigger>
                <SelectContent>
                  {displayColumns.map((field) => (
                    <SelectItem key={field.column} value={field.column}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleStartCreate}
              disabled={loading || !displayColumns.length || newRecord != null}
              className="gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
            <Button
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={loading || !registrosFiltradosOrdenados.length}
              className="gap-2 self-start sm:self-auto"
            >
              <FileDown className="h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
              <div>
                <label className="mb-2 block text-sm text-gray-300">Nome</label>
                <Input
                  placeholder="Buscar nome..."
                  value={filters.nome}
                  onChange={(event) => setFilters({ ...filters, nome: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Reconhecido</label>
                <Select
                  value={filters.reconhecido}
                  onValueChange={(value) => setFilters({ ...filters, reconhecido: value })}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sim">SIM</SelectItem>
                    <SelectItem value="nao">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Responsável</label>
                <Input
                  placeholder="Buscar responsável..."
                  value={filters.responsavel}
                  onChange={(event) => setFilters({ ...filters, responsavel: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Data Início</label>
                <Input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(event) => setFilters({ ...filters, dataInicio: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Data Fim</label>
                <Input
                  type="date"
                  value={filters.dataFim}
                  onChange={(event) => setFilters({ ...filters, dataFim: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Valor Inicial</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={filters.valorInicio}
                  onChange={(event) => setFilters({ ...filters, valorInicio: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-300">Valor Final</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={filters.valorFim}
                  onChange={(event) => setFilters({ ...filters, valorFim: event.target.value })}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-4">
        {loading && <p className="text-gray-300">Carregando registros...</p>}

        {!loading && registros.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-gray-300">
            Nenhum registro encontrado.
          </div>
        )}

        {!loading && registros.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/30">
            <div className="min-w-[70rem]">
              <div
                className="sticky top-0 z-10 grid gap-3 border-b border-white/10 bg-slate-950/95 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300"
                style={{ gridTemplateColumns: rowGridTemplateColumns }}
              >
                {displayColumns.map((field) => (
                  <div key={`header-${field.column}`}>{field.label}</div>
                ))}
                <div className="text-center">Ações</div>
              </div>

              <div className="divide-y divide-white/10">
                {newRecord && (
                  <div
                    className="grid gap-3 bg-blue-500/10 px-3 py-3"
                    style={{ gridTemplateColumns: rowGridTemplateColumns }}
                  >
                    {displayColumns.map(({ column }) => (
                      <div key={`new-${column}`}>
                        {renderFieldControl(
                          newRecord,
                          column,
                          (value) => setNewRecord((current) => ({ ...current, [column]: value })),
                          savingId === 'new',
                        )}
                      </div>
                    ))}
                    <div className="flex flex-col justify-center gap-2">
                      <Button onClick={handleCreate} disabled={savingId === 'new'} className="w-full">
                        {savingId === 'new' ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNewRecord(null)}
                        disabled={savingId === 'new'}
                        className="w-full gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                {registrosFiltradosOrdenados.map((row, index) => (
                  <div
                    key={row.id ?? index}
                    className="grid gap-3 bg-slate-900/40 px-3 py-3"
                    style={{ gridTemplateColumns: rowGridTemplateColumns }}
                  >
                    {displayColumns.map(({ column }) => (
                      <div key={`${row.id ?? index}-${column}`}>
                        {renderFieldControl(
                          row,
                          column,
                          (value) => handleChange(row.id, column, value),
                          row.id == null,
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-center">
                      <Button
                        onClick={() => handleSave(row.id)}
                        disabled={row.id == null || savingId === row.id || !dirtyIds.has(row.id)}
                        className="w-full"
                      >
                        {savingId === row.id ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && registros.length > 0 && registrosFiltradosOrdenados.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center text-gray-300">
            Nenhum registro encontrado para os filtros informados.
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PagLivre;
