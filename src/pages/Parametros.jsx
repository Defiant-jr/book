import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllPaginated } from '@/lib/supabasePagination';

const PARAMETROS_REF = 90000;
const READONLY_COLUMNS = new Set(['id', 'created_at', 'updated_at']);
const DEFAULT_COLUMNS = ['cash', 'investimento', 'hora_aula_clt', 'hora_aula_cnt', 'carga_hr'];

const formatLabel = (value) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizePayloadValue = (value) => {
  if (value === '') return null;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && normalized.trim() !== '' ? parsed : value;
};

const createEmptyDraft = (columns) =>
  columns.reduce((acc, column) => {
    acc[column] = '';
    return acc;
  }, {});

const Parametros = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parametros, setParametros] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newDraft, setNewDraft] = useState(createEmptyDraft(DEFAULT_COLUMNS));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const columns = useMemo(() => {
    const keys = new Set(DEFAULT_COLUMNS);
    parametros.forEach((row) => {
      Object.keys(row || {}).forEach((column) => {
        if (!READONLY_COLUMNS.has(column)) {
          keys.add(column);
        }
      });
    });
    return Array.from(keys);
  }, [parametros]);

  useEffect(() => {
    setNewDraft((current) => ({ ...createEmptyDraft(columns), ...current }));
  }, [columns]);

  const fetchParametros = async () => {
    setLoading(true);
    const { data, error } = await fetchAllPaginated((from, to) =>
      supabase
        .from('parametros')
        .select('*')
        .order('id', { ascending: true })
        .range(from, to),
    );
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao carregar parametros',
        description: error.message || 'Nao foi possivel buscar os parametros.',
        variant: 'destructive',
      });
      return;
    }

    setParametros(data || []);
    setDrafts({});
    setEditingId(null);
  };

  useEffect(() => {
    fetchParametros();
  }, []);

  const startEditing = (row) => {
    setEditingId(row.id);
    setDrafts((prev) => ({
      ...prev,
      [row.id]: columns.reduce((acc, column) => {
        acc[column] = row[column] ?? '';
        return acc;
      }, {}),
    }));
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleDraftChange = (id, column, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [column]: value,
      },
    }));
  };

  const handleNewDraftChange = (column, value) => {
    setNewDraft((prev) => ({ ...prev, [column]: value }));
  };

  const buildPayload = (draft) =>
    columns.reduce((acc, column) => {
      acc[column] = normalizePayloadValue(draft[column]);
      return acc;
    }, {});

  const handleCreate = async () => {
    const payload = buildPayload(newDraft);
    const hasValue = Object.values(payload).some((value) => value !== null && value !== '');

    if (!hasValue) {
      toast({ title: 'Nada para salvar', description: 'Informe ao menos um parametro.' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('parametros').insert([payload]);
    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao criar parametro',
        description: error.message || 'Nao foi possivel inserir o registro.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Parametro criado', description: 'O registro foi adicionado com sucesso.' });
    setNewDraft(createEmptyDraft(columns));
    fetchParametros();
  };

  const handleUpdate = async (id) => {
    const draft = drafts[id];
    if (!draft) return;

    setSaving(true);
    const { error } = await supabase.from('parametros').update(buildPayload(draft)).eq('id', id);
    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar parametro',
        description: error.message || 'Nao foi possivel atualizar o registro.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Parametro atualizado', description: 'As alteracoes foram salvas.' });
    fetchParametros();
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(`Excluir o parametro ID ${row.id}?`);
    if (!confirmed) return;

    setSaving(true);
    const { error } = await supabase.from('parametros').delete().eq('id', row.id);
    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao excluir parametro',
        description: error.message || 'Nao foi possivel excluir o registro.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Parametro excluido', description: 'O registro foi removido.' });
    fetchParametros();
  };

  const renderFields = (draft, onChange, prefix) => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {columns.map((column) => (
        <div
          key={`${prefix}-${column}`}
          className="rounded-xl border border-white/10 bg-slate-900/60 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        >
          <Label htmlFor={`${prefix}-${column}`} className="text-xs uppercase tracking-wide text-gray-400">
            {formatLabel(column)}
          </Label>
          <Input
            id={`${prefix}-${column}`}
            value={draft[column] ?? ''}
            onChange={(event) => onChange(column, event.target.value)}
            className="mt-2"
          />
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Parametros - BooK+</title>
        <meta name="description" content="CRUD da tabela parametros." />
      </Helmet>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Sistema</span>
            <h1 className="text-3xl font-bold gradient-text">Parametros</h1>
            <span className="text-sm text-gray-300">CRUD direto na tabela parametros.</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-[10px] font-medium text-gray-400 lg:text-xs">{PARAMETROS_REF}</div>
          <Button variant="outline" onClick={fetchParametros} disabled={loading || saving} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Novo parametro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderFields(newDraft, handleNewDraftChange, 'novo-parametro')}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setNewDraft(createEmptyDraft(columns))} disabled={saving}>
              Limpar
            </Button>
            <Button onClick={handleCreate} disabled={saving || loading} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading && <p className="text-gray-300">Carregando parametros...</p>}

        {!loading && parametros.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-6 text-gray-300">
            Nenhum parametro encontrado.
          </div>
        )}

        {!loading &&
          parametros.map((row, index) => {
            const rowId = row.id ?? index;
            const isEditing = editingId === row.id;
            const draft = isEditing ? drafts[row.id] || row : row;

            return (
              <Card key={rowId} className="glass-card">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-white">Parametro {row.id != null ? `ID ${row.id}` : index + 1}</CardTitle>
                    {row.created_at && (
                      <p className="text-xs text-gray-400">
                        Criado em {new Date(row.created_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="outline" onClick={cancelEditing} disabled={saving} className="gap-2">
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                        <Button onClick={() => handleUpdate(row.id)} disabled={saving} className="gap-2">
                          <Save className="h-4 w-4" />
                          {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => startEditing(row)} disabled={saving}>
                          Editar
                        </Button>
                        <Button variant="destructive" onClick={() => handleDelete(row)} disabled={saving} className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    renderFields(draft, (column, value) => handleDraftChange(row.id, column, value), `parametro-${rowId}`)
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {columns.map((column) => (
                        <div key={`${rowId}-${column}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                          <div className="text-xs uppercase tracking-wide text-gray-400">{formatLabel(column)}</div>
                          <div className="mt-2 break-words text-sm font-semibold text-white">
                            {row[column] ?? '--'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </motion.div>
  );
};

export default Parametros;
