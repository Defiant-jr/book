import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Search,
  ListChecks,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  createGoogleTask,
  listGoogleTasks,
  updateGoogleTask,
} from '@/services/googleTasksService';

const getDateKey = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const formatTaskDate = (value) => {
  const dateKey = getDateKey(value);
  if (!dateKey) return 'Sem data';
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
};

const PageHeader = ({ title, refCode, onBack }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex min-w-0 items-center gap-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-none bg-black/85 text-white hover:bg-black hover:text-white"
        onClick={onBack}
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="sr-only">Voltar</span>
      </Button>
      <h1 className="truncate text-3xl font-bold gradient-text">{title}</h1>
    </div>
    <div className="shrink-0 text-[10px] font-medium text-slate-400 lg:text-xs">
      {refCode}
    </div>
  </div>
);

const AdministrativoTarefas = () => {
  const ADMINISTRATIVO_TAREFAS_REF = 11000;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [busca, setBusca] = useState('');
  const [loadingTarefas, setLoadingTarefas] = useState(false);
  const [savingTarefa, setSavingTarefa] = useState(false);

  const hojeKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const refAtual = searchParams.get('ref');

  const loadTarefas = async () => {
    setLoadingTarefas(true);
    try {
      const data = await listGoogleTasks();
      const sorted = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
        const aTime = a?.data ? new Date(a.data).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b?.data ? new Date(b.data).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
      setTarefas(sorted);
    } catch (error) {
      toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingTarefas(false);
    }
  };

  useEffect(() => {
    loadTarefas();
  }, []);

  const tarefasPendentes = useMemo(
    () => tarefas.filter((tarefa) => tarefa.concluida !== 'S'),
    [tarefas],
  );

  const tarefasConcluidas = useMemo(
    () => tarefas.filter((tarefa) => tarefa.concluida === 'S'),
    [tarefas],
  );

  const tarefasHoje = useMemo(
    () => tarefasPendentes.filter((tarefa) => getDateKey(tarefa.data) === hojeKey),
    [tarefasPendentes, hojeKey],
  );

  const tarefasAtrasadas = useMemo(
    () => tarefasPendentes.filter((tarefa) => {
      const dateKey = getDateKey(tarefa.data);
      return dateKey && dateKey < hojeKey;
    }),
    [tarefasPendentes, hojeKey],
  );

  const tarefasRecentes = tarefasPendentes.slice(0, 5);

  const viewConfig = {
    11100: {
      ref: '11100',
      title: 'Todas as Tarefas',
      subtitle: `${tarefasPendentes.length} tarefas pendentes`,
      emptyTitle: 'Nenhuma tarefa pendente',
      emptyIcon: ClipboardList,
      tasks: tarefasPendentes,
      showSearch: true,
    },
    11200: {
      ref: '11200',
      eyebrow: 'Hoje',
      title: 'Para Hoje',
      subtitle: `${tarefasHoje.length} tarefas urgentes`,
      emptyTitle: 'Tudo em dia!',
      emptyDescription: 'Nenhuma tarefa vence hoje',
      emptyIcon: CheckCircle2,
      emptyIconClassName: 'text-emerald-400',
      tasks: tarefasHoje,
    },
    11300: {
      ref: '11300',
      title: 'Concluidas',
      subtitle: `${tarefasConcluidas.length} tarefas finalizadas`,
      emptyTitle: 'Nenhuma tarefa concluida ainda',
      emptyIcon: CheckCircle2,
      tasks: tarefasConcluidas,
      actionLabel: 'Atualizar',
      actionIcon: RefreshCw,
      action: loadTarefas,
    },
  };

  const activeView = viewConfig[refAtual];

  const tarefasDaTela = useMemo(() => {
    if (!activeView) return [];
    const text = busca.trim().toLowerCase();
    if (!text) return activeView.tasks;
    return activeView.tasks.filter((tarefa) =>
      String(tarefa.tarefa || '').toLowerCase().includes(text),
    );
  }, [activeView, busca]);

  const handleAdd = async () => {
    const tarefa = novaTarefa.trim();
    if (!tarefa) {
      toast({ title: 'Informe a tarefa', description: 'Digite uma descricao valida.' });
      return;
    }

    setSavingTarefa(true);
    try {
      const createdTask = await createGoogleTask({ title: tarefa, due: null });
      setTarefas((prev) => [createdTask, ...prev]);
      setNovaTarefa('');
      toast({ title: 'Tarefa criada', description: 'A tarefa foi adicionada ao Google Tasks.' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSavingTarefa(false);
    }
  };

  const handleConcluir = async (tarefa) => {
    try {
      const updatedTask = await updateGoogleTask(tarefa.id, { status: 'completed' });
      setTarefas((prev) => prev.map((item) => (item.id === tarefa.id ? updatedTask : item)));
      toast({ title: 'Tarefa concluida', description: 'A tarefa foi marcada no Google Tasks.' });
    } catch (error) {
      toast({ title: 'Erro ao concluir', description: error.message, variant: 'destructive' });
    }
  };

  const stats = [
    {
      label: 'Total pendente',
      value: tarefasPendentes.length,
      icon: ListChecks,
      className: 'border-blue-400/25 bg-blue-500/10',
      iconClassName: 'bg-blue-400/15 text-blue-300',
    },
    {
      label: 'Para hoje',
      value: tarefasHoje.length,
      icon: Calendar,
      className: 'border-sky-400/25 bg-sky-500/10',
      iconClassName: 'bg-sky-400/15 text-sky-300',
    },
    {
      label: 'Atrasadas',
      value: tarefasAtrasadas.length,
      icon: AlertCircle,
      className: 'border-red-400/30 bg-red-500/10',
      iconClassName: 'bg-red-400/15 text-red-300',
    },
    {
      label: 'Concluidas',
      value: tarefasConcluidas.length,
      icon: CheckCircle2,
      className: 'border-emerald-400/25 bg-emerald-500/10',
      iconClassName: 'bg-emerald-400/15 text-emerald-300',
    },
  ];

  const shortcuts = [
    {
      title: 'Todas as Tarefas',
      description: 'Gerencie todas as suas tarefas pendentes',
      icon: ListChecks,
      className: 'border-blue-300/25 bg-blue-500/15',
      iconClassName: 'bg-blue-400/20 text-blue-300',
      ref: '11100',
      action: () => navigate('/administrativo/tarefas?ref=11100'),
    },
    {
      title: 'Para Hoje',
      description: 'Tarefas com vencimento para hoje',
      icon: Calendar,
      className: 'border-cyan-300/25 bg-cyan-500/15',
      iconClassName: 'bg-cyan-400/20 text-cyan-300',
      ref: '11200',
      action: () => navigate('/administrativo/tarefas?ref=11200'),
    },
    {
      title: 'Concluidas',
      description: 'Historico de tarefas finalizadas',
      icon: CheckCircle2,
      className: 'border-emerald-300/25 bg-emerald-500/15',
      iconClassName: 'bg-emerald-400/20 text-emerald-300',
      ref: '11300',
      action: () => navigate('/administrativo/tarefas?ref=11300'),
    },
    {
      title: 'Atualizar',
      description: 'Sincronizar com o Google Tasks',
      icon: RefreshCw,
      className: 'border-indigo-300/25 bg-indigo-500/15',
      iconClassName: 'bg-indigo-400/20 text-indigo-300',
      action: loadTarefas,
    },
  ];

  if (activeView) {
    const EmptyIcon = activeView.emptyIcon;
    const ActionIcon = activeView.actionIcon || Plus;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <Helmet>
          <title>{activeView.title} - BooK+</title>
          <meta name="description" content={`${activeView.title} integradas ao Google Tasks.`} />
        </Helmet>

        <PageHeader
          title={activeView.title}
          refCode={activeView.ref}
          onBack={() => navigate('/administrativo/tarefas')}
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            {activeView.eyebrow && (
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                {activeView.eyebrow}
              </p>
            )}
            <p className="text-sm text-slate-400">{activeView.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={activeView.action || (() => navigate('/administrativo/tarefas'))}
              className="h-10 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
              variant={activeView.action ? 'outline' : 'default'}
              disabled={loadingTarefas && Boolean(activeView.action)}
            >
              <ActionIcon className={`h-4 w-4 ${loadingTarefas && activeView.action ? 'animate-spin' : ''}`} />
              {activeView.actionLabel || 'Nova Tarefa'}
            </Button>
          </div>
        </div>

        {activeView.showSearch && (
          <section className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-lg">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar tarefas..."
                className="h-11 border-white/20 bg-white/10 pl-10 text-white placeholder:text-slate-400 focus-visible:ring-blue-400"
              />
            </div>
          </section>
        )}

        <section className="min-h-[238px] rounded-xl border border-white/20 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur-lg">
          {loadingTarefas ? (
            <div className="flex min-h-[170px] flex-col items-center justify-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="mt-3 text-sm font-semibold">Carregando tarefas...</p>
            </div>
          ) : tarefasDaTela.length === 0 ? (
            <div className="flex min-h-[170px] flex-col items-center justify-center text-center text-slate-400">
              <EmptyIcon className={`h-10 w-10 ${activeView.emptyIconClassName || ''}`} />
              <p className="mt-4 text-base font-bold">{activeView.emptyTitle}</p>
              {activeView.emptyDescription && (
                <p className="mt-2 text-sm">{activeView.emptyDescription}</p>
              )}
              <Button
                onClick={() => navigate('/administrativo/tarefas')}
                className="mt-4 h-10 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Nova Tarefa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tarefasDaTela.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{tarefa.tarefa}</p>
                    <p className="text-xs text-slate-400">{formatTaskDate(tarefa.data)}</p>
                  </div>
                  {tarefa.concluida !== 'S' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConcluir(tarefa)}
                      className="gap-2 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Concluir
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Tarefas Administrativas - BooK+</title>
        <meta name="description" content="Dashboard de tarefas administrativas integrado ao Google Tasks." />
      </Helmet>

      <PageHeader
        title="Tarefas"
        refCode={ADMINISTRATIVO_TAREFAS_REF}
        onBack={() => navigate('/administrativo')}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`rounded-xl border p-4 shadow-xl shadow-black/10 backdrop-blur-lg ${item.className}`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-md ${item.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-tight text-white">{item.value}</p>
                  <p className="text-xs font-medium text-slate-300">{item.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={item.action}
              className={`min-h-[150px] rounded-xl border p-4 text-left shadow-xl shadow-black/10 backdrop-blur-lg transition hover:-translate-y-0.5 hover:bg-white/15 ${item.className}`}
            >
              <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-md ${item.iconClassName}`}>
                <Icon className={`h-5 w-5 ${loadingTarefas && item.title === 'Atualizar' ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="text-sm font-bold text-white">{item.title}</h2>
              <p className="mt-1 text-xs text-slate-300">{item.description}</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  Acessar <ArrowRight className="h-3 w-3" />
                </span>
                {item.ref && <span className="font-semibold">{item.ref}</span>}
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-lg">
        <p className="text-xs font-bold uppercase text-slate-400">Adicao rapida</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={novaTarefa}
            onChange={(event) => setNovaTarefa(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAdd();
            }}
            placeholder="Digite uma nova tarefa..."
            className="h-11 border-white/20 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-blue-400"
            disabled={savingTarefa}
          />
          <Button
            onClick={handleAdd}
            disabled={savingTarefa}
            className="h-11 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            {savingTarefa ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Tarefas recentes</h2>
          <button
            type="button"
            onClick={() => navigate('/administrativo/tarefas')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-300 hover:text-blue-200"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="min-h-[198px] rounded-xl border border-white/20 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur-lg">
          {loadingTarefas ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin" />
              <p className="mt-3 text-sm font-semibold">Carregando tarefas...</p>
            </div>
          ) : tarefasRecentes.length === 0 ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center text-slate-400">
              <ClipboardList className="h-8 w-8" />
              <p className="mt-4 text-sm font-semibold">Nenhuma tarefa pendente</p>
              <Button
                onClick={() => navigate('/administrativo/tarefas')}
                className="mt-4 h-10 gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Nova Tarefa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tarefasRecentes.map((tarefa) => (
                <div
                  key={tarefa.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{tarefa.tarefa}</p>
                    <p className="text-xs text-slate-400">{formatTaskDate(tarefa.data)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConcluir(tarefa)}
                    className="gap-2 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Concluir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
};

export default AdministrativoTarefas;
