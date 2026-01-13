import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Pencil, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const AdministrativoTarefas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [dataExecucao, setDataExecucao] = useState('');
  const [loading, setLoading] = useState(false);
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState(null);
  const [edicaoDescricao, setEdicaoDescricao] = useState('');
  const [edicaoData, setEdicaoData] = useState('');

  const tarefasOrdenadas = useMemo(() => {
    return [...tarefas].sort((a, b) => {
      const timeA = a.data ? new Date(a.data).getTime() : Infinity;
      const timeB = b.data ? new Date(b.data).getTime() : Infinity;
      return timeA - timeB;
    });
  }, [tarefas]);

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

  const handleDelete = async (tarefa) => {
    const { error } = await supabase.from('postit').delete().eq('id', tarefa.id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) => prev.filter((item) => item.id !== tarefa.id));
    toast({ title: 'Tarefa removida', description: 'A tarefa foi excluida.' });
  };

  const iniciarEdicao = (tarefa) => {
    setTarefaEmEdicao(tarefa.id);
    setEdicaoDescricao(tarefa.tarefa ?? '');
    setEdicaoData(tarefa.data ? tarefa.data.slice(0, 10) : '');
  };

  const cancelarEdicao = () => {
    setTarefaEmEdicao(null);
    setEdicaoDescricao('');
    setEdicaoData('');
  };

  const handleSalvarEdicao = async () => {
    const descricao = edicaoDescricao.trim();
    if (!descricao) {
      toast({ title: 'Informe a tarefa', description: 'Digite uma descricao valida.' });
      return;
    }

    const iso = edicaoData ? new Date(`${edicaoData}T00:00:00`).toISOString() : null;
    const { error } = await supabase
      .from('postit')
      .update({ tarefa: descricao, data: iso })
      .eq('id', tarefaEmEdicao);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) =>
      prev.map((item) =>
        item.id === tarefaEmEdicao ? { ...item, tarefa: descricao, data: iso } : item,
      ),
    );
    cancelarEdicao();
    toast({ title: 'Tarefa atualizada', description: 'A tarefa foi alterada.' });
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
            <span className="text-sm text-gray-300">Cadastre e acompanhe as tarefas.</span>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Nova tarefa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-300">
              <label htmlFor="nova-tarefa">Descrição</label>
              <span className="text-xs text-gray-400">{novaTarefa.length}/256</span>
            </div>
            <Textarea
              id="nova-tarefa"
              maxLength={256}
              placeholder="Digite a tarefa"
              value={novaTarefa}
              onChange={(event) => setNovaTarefa(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="data-execucao" className="text-sm text-gray-300">
              Data de Execução
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
          <CardTitle className="text-white">Tarefas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {tarefas.length === 0 ? (
            <p className="text-sm text-gray-400">
              {loading ? 'Carregando tarefas...' : 'Nenhuma tarefa cadastrada.'}
            </p>
          ) : (
            <div className="space-y-3">
              {tarefasOrdenadas.map((tarefa) => {
                const isEditing = tarefaEmEdicao === tarefa.id;
                return (
                  <div
                    key={tarefa.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                          value={edicaoDescricao}
                          maxLength={256}
                          onChange={(event) => setEdicaoDescricao(event.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="date"
                          value={edicaoData}
                          onChange={(event) => setEdicaoData(event.target.value)}
                          className="sm:w-40"
                        />
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={handleSalvarEdicao} className="h-8 w-8">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={cancelarEdicao} className="h-8 w-8">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{tarefa.tarefa}</p>
                          <p className="text-xs opacity-80">
                            {tarefa.data ? new Date(tarefa.data).toLocaleDateString('pt-BR') : 'Sem data'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              tarefa.concluida === 'S'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {tarefa.concluida === 'S' ? 'Finalizada' : 'A Realizar'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => iniciarEdicao(tarefa)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tarefa)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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
