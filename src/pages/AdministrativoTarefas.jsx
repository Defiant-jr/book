import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Check, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const NOTE_COLORS = [
  'from-yellow-100 to-yellow-300 text-yellow-900',
  'from-green-100 to-green-300 text-green-900',
  'from-blue-100 to-blue-300 text-blue-900',
  'from-orange-100 to-orange-300 text-orange-900',
  'from-rose-100 to-rose-300 text-rose-900',
  'from-amber-100 to-amber-300 text-amber-900',
  'from-lime-100 to-lime-300 text-lime-900',
  'from-teal-100 to-teal-300 text-teal-900',
  'from-cyan-100 to-cyan-300 text-cyan-900',
  'from-sky-100 to-sky-300 text-sky-900',
  'from-violet-100 to-violet-300 text-violet-900',
  'from-fuchsia-100 to-fuchsia-300 text-fuchsia-900',
];

const AdministrativoTarefas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [dataExecucao, setDataExecucao] = useState('');
  const [loading, setLoading] = useState(false);
  const dateInputRefs = useRef({});

  const colorsByIndex = useMemo(() => NOTE_COLORS, []);

  const loadTarefas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('postit')
      .select('*')
      .order('data', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setTarefas(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    loadTarefas();
  }, []);

  const handleAdd = async () => {
    const tarefa = novaTarefa.trim();
    if (!tarefa) {
      toast({ title: 'Informe a tarefa', description: 'Digite uma descricao valida.' });
      return;
    }

    setLoading(true);
    const data = dataExecucao ? new Date(`${dataExecucao}T00:00:00`).toISOString() : null;
    const { error } = await supabase.from('postit').insert([
      {
        tarefa,
        concluida: 'N',
        data,
      },
    ]);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    setNovaTarefa('');
    setDataExecucao('');
    await loadTarefas();
    toast({ title: 'Tarefa criada', description: 'A tarefa foi adicionada.' });
  };

  const toggleConcluida = async (tarefa) => {
    const concluida = tarefa.concluida === 'S' ? 'N' : 'S';
    const { error } = await supabase
      .from('postit')
      .update({ concluida })
      .eq('id', tarefa.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) =>
      prev.map((item) => (item.id === tarefa.id ? { ...item, concluida } : item)),
    );
  };

  const handleDelete = async (tarefa) => {
    const { error } = await supabase.from('postit').delete().eq('id', tarefa.id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) => prev.filter((item) => item.id !== tarefa.id));
    toast({ title: 'Tarefa removida', description: 'A tarefa foi excluida.' });
  };

  const handleAlterarData = async (tarefa, novaData) => {
    if (!novaData) return;
    const iso = new Date(`${novaData}T00:00:00`).toISOString();
    const { error } = await supabase
      .from('postit')
      .update({ data: iso })
      .eq('id', tarefa.id);

    if (error) {
      toast({ title: 'Erro ao atualizar data', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) =>
      prev.map((item) => (item.id === tarefa.id ? { ...item, data: iso } : item)),
    );
  };

  const openDatePicker = (tarefaId) => {
    const input = dateInputRefs.current[tarefaId];
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Tarefas Administrativas - BooK+</title>
        <meta name="description" content="Cadastro de tarefas administrativas." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">Tarefas</h1>
            <span className="text-sm text-gray-300">Cadastre e acompanhe os post-its.</span>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Nova tarefa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="nova-tarefa" className="text-sm text-gray-300">
              Descricao
            </label>
            <Input
              id="nova-tarefa"
              placeholder="Digite a tarefa"
              value={novaTarefa}
              onChange={(event) => setNovaTarefa(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="data-execucao" className="text-sm text-gray-300">
              Data de execucao
            </label>
            <Input
              id="data-execucao"
              type="date"
              value={dataExecucao}
              onChange={(event) => setDataExecucao(event.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={loading} className="sm:w-40">
            {loading ? 'Salvando...' : 'Adicionar'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Post-its cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {tarefas.length === 0 ? (
            <p className="text-sm text-gray-400">
              {loading ? 'Carregando tarefas...' : 'Nenhuma tarefa cadastrada.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {tarefas.map((tarefa, index) => {
                const color = colorsByIndex[index % colorsByIndex.length];
                const isDone = tarefa.concluida === 'S';
                return (
                  <div
                    key={tarefa.id}
                    className={`aspect-square rounded-xl bg-gradient-to-br ${color} p-3 shadow-lg shadow-black/20`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold ${isDone ? 'line-through opacity-70' : ''}`}>
                        {tarefa.tarefa}
                      </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleConcluida(tarefa)}
                        className="h-6 w-6"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDatePicker(tarefa.id)}
                          className="h-6 w-6"
                        >
                          <Calendar className="h-3 w-3" />
                        </Button>
                        <input
                          ref={(el) => {
                            dateInputRefs.current[tarefa.id] = el;
                          }}
                          type="date"
                          value={tarefa.data ? tarefa.data.slice(0, 10) : ''}
                          onChange={(event) => handleAlterarData(tarefa, event.target.value)}
                          className="absolute inset-0 opacity-0 pointer-events-none"
                          tabIndex={-1}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tarefa)}
                        className="h-6 w-6"
                      >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {tarefa.data && (
                      <p className="mt-2 text-[10px] opacity-80">
                        {new Date(tarefa.data).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AdministrativoTarefas;
