import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import IndicadoresPedagogico from '@/components/pedagogico/IndicadoresPedagogico';

const Administrativo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [tarefaDetalhe, setTarefaDetalhe] = useState(null);
  const [paginaTarefas, setPaginaTarefas] = useState(0);
  const dateInputRefs = useRef({});

  const noteColors = useMemo(
    () => [
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
    ],
    [],
  );

  useEffect(() => {
    const loadTarefas = async () => {
      setLoadingTarefas(true);
      const { data, error } = await supabase.from('postit').select('*');
      if (error) {
        toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
        setLoadingTarefas(false);
        return;
      }

      const sorted = (data || []).slice().sort((a, b) => {
        const aTime = a?.data ? new Date(a.data).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b?.data ? new Date(b.data).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
      setTarefas(sorted);
      setLoadingTarefas(false);
    };

    loadTarefas();
  }, [toast]);

  const handleConcluir = async (tarefa) => {
    const { error } = await supabase
      .from('postit')
      .update({ concluida: 'S' })
      .eq('id', tarefa.id);

    if (error) {
      toast({ title: 'Erro ao concluir', description: error.message, variant: 'destructive' });
      return;
    }

    setTarefas((prev) => prev.filter((item) => item.id !== tarefa.id));
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

  const tarefasPendentes = useMemo(
    () => tarefas.filter((tarefa) => tarefa.concluida === 'N'),
    [tarefas],
  );
  const tarefasPorPagina = 6;
  const totalPaginas = Math.max(1, Math.ceil(tarefasPendentes.length / tarefasPorPagina));
  const inicio = paginaTarefas * tarefasPorPagina;
  const tarefasPagina = tarefasPendentes.slice(inicio, inicio + tarefasPorPagina);

  useEffect(() => {
    if (paginaTarefas > totalPaginas - 1) {
      setPaginaTarefas(Math.max(0, totalPaginas - 1));
    }
  }, [paginaTarefas, totalPaginas]);

  const closeDetalhe = () => {
    setTarefaDetalhe(null);
  };

  const navButtons = [
    { label: 'Dashboard', path: '/administrativo', icon: LayoutDashboard },
    { label: 'Tarefas', path: '/administrativo/tarefas', icon: ClipboardList },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Administrativo - BooK+</title>
        <meta name="description" content="Módulo administrativo" />
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
            <h1 className="text-3xl font-bold gradient-text">Administrativo</h1>
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <IndicadoresPedagogico />

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Resultado Operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">R$ 0,00</p>
              <p className="text-sm text-gray-400">Resultado do periodo</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-white">Tarefas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-400">Post-its das tarefas cadastradas.</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setPaginaTarefas((prev) => Math.max(0, prev - 1))}
                disabled={paginaTarefas === 0}
                aria-label="Pagina anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                {tarefasPendentes.length === 0 ? (
                  <div className="aspect-square max-w-[160px] rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-300 p-3 text-yellow-900 shadow-lg shadow-black/20">
                    <p className="text-xs font-semibold">
                      {loadingTarefas ? 'Carregando...' : 'Sem tarefas'}
                    </p>
                    <p className="text-[10px] opacity-80">Aguardando</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-3">
                    {tarefasPagina.map((tarefa, index) => {
                  const color = noteColors[index % noteColors.length];
                  return (
                    <div
                      key={tarefa.id}
                      className={`h-48 w-48 rounded-xl bg-gradient-to-br ${color} p-3 shadow-lg shadow-black/20`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (tarefa.tarefa?.length > 80) {
                              setTarefaDetalhe(tarefa);
                            }
                          }}
                          className={`text-left text-xs font-semibold ${
                            tarefa.tarefa?.length > 80 ? 'cursor-pointer hover:underline' : 'cursor-default'
                          }`}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 8,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          aria-label={tarefa.tarefa?.length > 80 ? 'Ver tarefa completa' : 'Tarefa'}
                        >
                          {tarefa.tarefa}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleConcluir(tarefa)}
                            className="rounded-full p-1 text-xs bg-white/40 hover:bg-white/60"
                            aria-label="Concluir tarefa"
                          >
                            <Check className="h-3 w-3 text-black/80" />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => openDatePicker(tarefa.id)}
                              className="rounded-full p-1 text-xs bg-white/40 hover:bg-white/60"
                              aria-label="Alterar data"
                            >
                              <Calendar className="h-3 w-3 text-black/80" />
                            </button>
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
                        </div>
                      </div>
                      {tarefa.data && (
                        <p className="mt-2 text-[10px] opacity-80">
                          {new Date(tarefa.data).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {tarefa.tarefa?.length > 80 && (
                        <p className="mt-1 text-[10px] opacity-80">Clique para ver mais</p>
                      )}
                    </div>
                  );
                    })}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setPaginaTarefas((prev) => Math.min(totalPaginas - 1, prev + 1))}
                disabled={paginaTarefas >= totalPaginas - 1}
                aria-label="Proxima pagina"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {tarefaDetalhe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeDetalhe}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 text-gray-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Detalhes da tarefa</h3>
                <p className="text-sm text-gray-500">
                  {tarefaDetalhe.data
                    ? new Date(tarefaDetalhe.data).toLocaleDateString('pt-BR')
                    : 'Sem data'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetalhe}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{tarefaDetalhe.tarefa}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Administrativo;






