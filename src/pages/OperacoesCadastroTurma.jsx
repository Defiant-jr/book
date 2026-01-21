import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const READONLY_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

const formatLabel = (value) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const OperacoesCadastroTurma = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [turmas, setTurmas] = useState([]);
  const [ordenacao, setOrdenacao] = useState('');
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const columns = useMemo(() => {
    const keys = new Set();
    turmas.forEach((row) => {
      if (!row) return;
      Object.keys(row).forEach((column) => {
        if (!READONLY_COLUMNS.has(column)) {
          keys.add(column);
        }
      });
    });
    return Array.from(keys);
  }, [turmas]);

  useEffect(() => {
    if (!columns.length) return;
    if (!ordenacao || !columns.includes(ordenacao)) {
      setOrdenacao(columns[0]);
    }
  }, [columns, ordenacao]);

  const turmasOrdenadas = useMemo(() => {
    if (!turmas.length || !ordenacao) return turmas;
    return [...turmas].sort((a, b) => {
      const aValue = String(a?.[ordenacao] ?? '').toLowerCase();
      const bValue = String(b?.[ordenacao] ?? '').toLowerCase();
      return aValue.localeCompare(bValue, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }, [turmas, ordenacao]);

  const fetchTurmas = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('turmas').select('*').order('id', { ascending: true });
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao carregar',
        description: error.message || 'Nao foi possivel buscar as turmas.',
        variant: 'destructive',
      });
      return;
    }

    setTurmas(data || []);
    setDirtyIds(new Set());
  };

  useEffect(() => {
    fetchTurmas();
  }, []);

  const markDirty = (id) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleChange = (id, column, value) => {
    setTurmas((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [column]: value } : row)),
    );
    markDirty(id);
  };

  const handleSave = async () => {
    if (!dirtyIds.size) {
      toast({ title: 'Nada para salvar', description: 'Nenhuma alteracao pendente.' });
      return;
    }

    setSaving(true);
    const updates = Array.from(dirtyIds)
      .map((id) => {
        const row = turmas.find((item) => item.id === id);
        if (!row) {
          return null;
        }

        const payload = {};
        columns.forEach((column) => {
          payload[column] = row[column] === '' ? null : row[column];
        });

        return supabase.from('turmas').update(payload).eq('id', id);
      })
      .filter(Boolean);

    const results = await Promise.all(updates);
    const firstError = results.find((result) => result?.error)?.error;

    setSaving(false);

    if (firstError) {
      toast({
        title: 'Erro ao salvar',
        description: firstError.message || 'Nao foi possivel salvar as alteracoes.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Alteracoes salvas', description: 'Os dados das turmas foram atualizados.' });
    setDirtyIds(new Set());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Cadastro de Turmas - Operacoes</title>
        <meta name="description" content="Edicao da tabela de turmas." />
      </Helmet>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Operações / Cadastro</span>
            <h1 className="text-3xl font-bold gradient-text">Turmas</h1>
            <span className="text-sm text-gray-300">Edicao direta na tabela Turmas.</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">Ordenar por</span>
            <Select value={ordenacao} onValueChange={setOrdenacao} disabled={!columns.length}>
              <SelectTrigger className="w-full bg-white/10 border-white/20 text-white sm:w-40" aria-label="Ordenar listagem">
                <SelectValue placeholder="Ordenacao" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {formatLabel(column)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} className="self-start sm:self-auto">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-gray-300">Carregando turmas...</p>}

        {!loading && turmas.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-gray-300">
            Nenhuma turma encontrada.
          </div>
        )}

        {!loading &&
          turmasOrdenadas.map((row, index) => (
            <div key={row.id ?? index} className="space-y-2">
              {row.id != null && (
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">ID {row.id}</div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {columns.map((column) => (
                  <div
                    key={`${row.id ?? index}-${column}`}
                    className="rounded-xl border border-white/10 bg-slate-900/60 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] md:col-span-1"
                  >
                    <Label className="text-xs uppercase tracking-wide text-gray-400">
                      {formatLabel(column)}
                    </Label>
                    <Input
                      value={row[column] ?? ''}
                      onChange={(event) => handleChange(row.id, column, event.target.value)}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  );
};

export default OperacoesCadastroTurma;
