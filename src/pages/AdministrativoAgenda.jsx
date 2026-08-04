import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from '@/services/googleCalendarService';
import { listGoogleTasks, updateGoogleTask } from '@/services/googleTasksService';

const ADMINISTRATIVO_AGENDA_REF = 12000;

const categories = [
  { value: 'administrativo', label: 'Administrativo', color: 'bg-blue-500', soft: 'bg-blue-500/15 text-blue-100 border-blue-400/30' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-emerald-500', soft: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30' },
  { value: 'pedagogico', label: 'Pedagogico', color: 'bg-violet-500', soft: 'bg-violet-500/15 text-violet-100 border-violet-400/30' },
  { value: 'reuniao', label: 'Reuniao', color: 'bg-amber-500', soft: 'bg-amber-500/15 text-amber-100 border-amber-400/30' },
  { value: 'pessoal', label: 'Pessoal', color: 'bg-rose-500', soft: 'bg-rose-500/15 text-rose-100 border-rose-400/30' },
];

const emptyEvent = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  startTime: '09:00',
  endTime: '10:00',
  category: 'administrativo',
  notes: '',
  isRecurring: false,
  recurrenceFrequency: '',
  recurrenceEndDate: '',
};

const getCategory = (value) => categories.find((category) => category.value === value) || categories[0];
const dateKey = (date) => format(date, 'yyyy-MM-dd');
const parseLocalDate = (value) => parseISO(`${value}T00:00:00`);
const getEventKey = (event) => event.key || `${event.calendarId || 'default'}:${event.id || event.title}`;

const getTaskDateKey = (value) => (value ? String(value).slice(0, 10) : null);
const formatTaskDate = (value) => {
  const taskDate = getTaskDateKey(value);
  return taskDate
    ? format(parseLocalDate(taskDate), 'dd/MM/yyyy')
    : 'Sem data';
};
const getTaskScheduleDateKey = (task) =>
  getTaskDateKey(task.data) || dateKey(startOfWeek(new Date(), { weekStartsOn: 1 }));

const sortEvents = (events) =>
  [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });

const EventPill = ({ event, compact = false, onClick }) => {
  const category = getCategory(event.category);
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={`w-full truncate rounded border px-2 py-1 text-left text-xs ${category.soft} hover:border-white/40`}
      style={event.calendarColor ? { borderColor: event.calendarColor } : undefined}
      title={event.calendarSummary ? `${event.title} - ${event.calendarSummary}` : event.title}
    >
      {!compact && <span className="mr-1 font-mono">{event.startTime}</span>}
      <span className="font-semibold">{event.title}</span>
    </button>
  );
};

const TaskPill = ({ task, onClick }) => (
  <button
    type="button"
    onClick={(clickEvent) => {
      clickEvent.stopPropagation();
      onClick();
    }}
    className="flex w-full items-center gap-1.5 truncate rounded border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-left text-xs text-violet-100 hover:border-violet-300/60"
    title={task.detalhes ? `${task.tarefa} - ${task.detalhes}` : task.tarefa}
  >
    <ClipboardList className="h-3 w-3 shrink-0" />
    <span className="truncate font-semibold">{task.tarefa}</span>
  </button>
);

const EventDetails = ({ event, onEdit, onDelete, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 text-xs font-semibold uppercase text-slate-400">Compromisso</div>
            <h2 className="break-words text-2xl font-bold text-white">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {format(parseLocalDate(event.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {` - ${event.startTime} ate ${event.endTime}`}
            </p>
            {event.calendarSummary && (
              <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{event.calendarSummary}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-300">
          {event.notes && <p className="whitespace-pre-wrap rounded-md bg-white/5 p-3 leading-relaxed">{event.notes}</p>}
        </div>

        {event.canEdit && (
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onDelete(event)} className="gap-2 border-red-400/30 text-red-200 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
            <Button type="button" onClick={() => onEdit(event)} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
              <Edit3 className="h-4 w-4" />
              Editar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const EventForm = ({ event, onCancel, onSave, saving }) => {
  const [draft, setDraft] = useState(event || emptyEvent);

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!draft.title.trim()) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      startTime: draft.startTime,
      endTime: draft.endTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">{draft.id ? 'Editar compromisso' : 'Novo compromisso'}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-title">Titulo</label>
            <Input
              id="agenda-title"
              value={draft.title}
              onChange={(inputEvent) => update('title', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
              placeholder="Adicionar titulo"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-date">Data</label>
            <Input
              id="agenda-date"
              type="date"
              value={draft.date}
              onChange={(inputEvent) => update('date', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-start-time">Hora Inicio</label>
            <Input
              id="agenda-start-time"
              type="time"
              value={draft.startTime}
              onChange={(inputEvent) => update('startTime', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-end-time">Hora Fim</label>
            <Input
              id="agenda-end-time"
              type="time"
              value={draft.endTime}
              onChange={(inputEvent) => update('endTime', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-notes">Detalhe</label>
            <Textarea
              id="agenda-notes"
              value={draft.notes}
              onChange={(inputEvent) => update('notes', inputEvent.target.value)}
              className="min-h-[110px] border-white/15 bg-white/10 text-white"
              placeholder="Adicionar detalhe"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/15 text-slate-200 hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const TaskEditForm = ({ task, onCancel, onSave, saving }) => {
  const [draft, setDraft] = useState({
    title: task.tarefa || '',
    notes: task.detalhes || '',
    due: getTaskDateKey(task.data) || '',
  });

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!draft.title.trim()) return;
    onSave({
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      due: draft.due || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">Editar tarefa</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-task-title">
              Tarefa
            </label>
            <Input
              id="agenda-task-title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="border-white/15 bg-white/10 text-white"
              autoFocus
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-task-due">
              Data
            </label>
            <Input
              id="agenda-task-due"
              type="date"
              value={draft.due}
              onChange={(event) => setDraft((current) => ({ ...current, due: event.target.value }))}
              className="border-white/15 bg-white/10 text-white [color-scheme:dark]"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-task-notes">
              Detalhes
            </label>
            <Textarea
              id="agenda-task-notes"
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-[110px] border-white/15 bg-white/10 text-white"
              disabled={saving}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="border-white/15 text-slate-200 hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500">
            {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const MiniCalendar = ({ currentDate, selectedDate, onSelect }) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-3 text-sm font-semibold capitalize text-white">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-500">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={`aspect-square rounded-full text-xs ${
                selected
                  ? 'bg-blue-500 text-white'
                  : isSameMonth(day, currentDate)
                    ? 'text-slate-200 hover:bg-white/10'
                    : 'text-slate-600 hover:bg-white/5'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AdministrativoAgenda = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [quickEvent, setQuickEvent] = useState(emptyEvent);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const loadEvents = async ({ force = false } = {}) => {
    setLoadingEvents(true);
    try {
      const data = await listGoogleCalendarEvents({ force });
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ title: 'Erro ao carregar agenda', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const data = await listGoogleTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadEvents();
    loadTasks();
  }, []);

  const filteredEvents = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortEvents(events).filter((event) => {
      const matchesCategory = categoryFilter === 'todas' || event.category === categoryFilter;
      const matchesText = !text || `${event.title || ''} ${event.notes || ''}`.toLowerCase().includes(text);
      return matchesCategory && matchesText;
    });
  }, [events, query, categoryFilter]);

  const selectedDateEvents = filteredEvents.filter((event) => isSameDay(parseLocalDate(event.date), currentDate));
  const pendingTasks = useMemo(() => {
    const text = query.trim().toLowerCase();
    return tasks
      .filter((task) => task.concluida !== 'S')
      .filter((task) => !text || `${task.tarefa || ''} ${task.detalhes || ''}`.toLowerCase().includes(text))
      .sort((a, b) => {
        const aDate = getTaskDateKey(a.data) || '9999-12-31';
        const bDate = getTaskDateKey(b.data) || '9999-12-31';
        return aDate.localeCompare(bDate);
      });
  }, [tasks, query]);
  const tasksForDate = (day) =>
    pendingTasks.filter((task) => getTaskScheduleDateKey(task) === dateKey(day));
  const selectedDateTasks = tasksForDate(currentDate);

  const openNewEvent = (date = currentDate) => {
    setSelectedEvent(null);
    setEditingEvent({ ...emptyEvent, date: dateKey(date) });
  };

  const openEventEditor = (event) => {
    if (event.canEdit === false) {
      setSelectedEvent(event);
      return;
    }
    setSelectedEvent(null);
    setEditingEvent(event);
  };

  const saveTask = async (updates) => {
    if (!editingTask?.id) return;

    setSavingTask(true);
    try {
      const updatedTask = await updateGoogleTask(editingTask.id, updates);
      setTasks((current) =>
        current.map((task) => (task.id === editingTask.id ? updatedTask : task)));
      setEditingTask(null);
      toast({ title: 'Tarefa atualizada', description: 'As alteracoes foram salvas no Google Tasks.' });
    } catch (error) {
      toast({ title: 'Erro ao editar tarefa', description: error.message, variant: 'destructive' });
    } finally {
      setSavingTask(false);
    }
  };

  const saveEvent = async (event) => {
    const payload = {
      title: event.title.trim(),
      notes: event.notes?.trim() || '',
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      calendarId: event.calendarId,
      isRecurring: Boolean(event.isRecurring),
      recurrenceFrequency: event.recurrenceFrequency || '',
      recurrenceEndDate: event.recurrenceEndDate || '',
    };

    setSavingEvent(true);
    try {
      const savedEvent = event.id
        ? await updateGoogleCalendarEvent(event.id, payload)
        : await createGoogleCalendarEvent(payload);

      if (event.isRecurring && !event.id) {
        await loadEvents({ force: true });
      } else {
        setEvents((current) => {
          if (event.id) {
            return current.map((item) => (getEventKey(item) === getEventKey(event) ? savedEvent : item));
          }
          return [savedEvent, ...current];
        });
      }
      setEditingEvent(null);
      setSelectedEvent(null);
      toast({ title: event.id ? 'Compromisso atualizado' : 'Compromisso criado', description: 'A agenda foi gravada no Google Calendar.' });
      return savedEvent;
    } catch (error) {
      toast({ title: 'Erro ao salvar agenda', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setSavingEvent(false);
    }
  };

  const updateQuickEvent = (field, value) => {
    setQuickEvent((current) => ({ ...current, [field]: value }));
  };

  const addQuickEvent = async () => {
    const title = quickEvent.title.trim();
    if (!title) {
      toast({ title: 'Informe o titulo', description: 'Digite um titulo valido para o compromisso.' });
      return;
    }

    if (quickEvent.isRecurring && (!quickEvent.recurrenceFrequency || !quickEvent.recurrenceEndDate)) {
      toast({
        title: 'Recorrencia incompleta',
        description: 'Selecione a periodicidade e a data de termino.',
      });
      return;
    }

    if (quickEvent.isRecurring && quickEvent.recurrenceEndDate < quickEvent.date) {
      toast({
        title: 'Data de termino invalida',
        description: 'A recorrencia deve terminar na data inicial ou depois dela.',
      });
      return;
    }

    const savedEvent = await saveEvent({
      ...quickEvent,
      title,
      notes: quickEvent.notes.trim(),
      category: 'administrativo',
    });
    if (savedEvent) {
      setQuickEvent({
        ...emptyEvent,
        date: quickEvent.date || format(new Date(), 'yyyy-MM-dd'),
        startTime: quickEvent.startTime || emptyEvent.startTime,
        endTime: quickEvent.endTime || emptyEvent.endTime,
      });
    }
  };

  const deleteEvent = async (event) => {
    try {
      await deleteGoogleCalendarEvent(event.id, { calendarId: event.calendarId });
      setEvents((current) => current.filter((item) => getEventKey(item) !== getEventKey(event)));
      setSelectedEvent(null);
      setEditingEvent(null);
      toast({ title: 'Compromisso excluido', description: 'O compromisso foi removido do Google Calendar.' });
    } catch (error) {
      toast({ title: 'Erro ao excluir agenda', description: error.message, variant: 'destructive' });
    }
  };

  const movePrevious = () => {
    if (view === 'month') setCurrentDate((date) => subMonths(date, 1));
    if (view === 'week') setCurrentDate((date) => subWeeks(date, 1));
    if (view === 'day') setCurrentDate((date) => subDays(date, 1));
  };

  const moveNext = () => {
    if (view === 'month') setCurrentDate((date) => addMonths(date, 1));
    if (view === 'week') setCurrentDate((date) => addWeeks(date, 1));
    if (view === 'day') setCurrentDate((date) => addDays(date, 1));
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [currentDate]);

  const renderMonth = () => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs font-semibold uppercase text-slate-400">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => <div key={day} className="p-3">{day}</div>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-7">
        {monthDays.map((day) => {
          const dayEvents = filteredEvents.filter((event) => isSameDay(parseLocalDate(event.date), day));
          const dayTasks = tasksForDate(day);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => openNewEvent(day)}
              className={`min-h-[132px] border-b border-r border-white/10 p-2 text-left align-top hover:bg-white/[0.06] ${
                isSameMonth(day, currentDate) ? 'bg-transparent' : 'bg-black/20'
              }`}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                isToday ? 'bg-blue-500 text-white' : isSameMonth(day, currentDate) ? 'text-slate-200' : 'text-slate-600'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="mt-2 space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <EventPill key={getEventKey(event)} event={event} onClick={openEventEditor} />
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <TaskPill
                    key={task.id}
                    task={task}
                    onClick={() => setEditingTask(task)}
                  />
                ))}
                {dayEvents.length + dayTasks.length > 4 && (
                  <p className="text-xs font-semibold text-slate-400">
                    +{dayEvents.length + dayTasks.length - 4} itens
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderWeek = () => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="grid grid-cols-1 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = filteredEvents.filter((event) => isSameDay(parseLocalDate(event.date), day));
          const dayTasks = tasksForDate(day);
          return (
            <div key={day.toISOString()} className="min-h-[520px] border-b border-r border-white/10">
              <button type="button" onClick={() => setCurrentDate(day)} className="w-full border-b border-white/10 p-3 text-left hover:bg-white/[0.06]">
                <p className="text-xs uppercase text-slate-500">{format(day, 'EEE', { locale: ptBR })}</p>
                <p className={`mt-1 text-2xl font-semibold ${isSameDay(day, new Date()) ? 'text-blue-300' : 'text-white'}`}>{format(day, 'd')}</p>
              </button>
              <div className="space-y-2 p-3">
                {dayEvents.map((event) => <EventPill key={getEventKey(event)} event={event} onClick={openEventEditor} />)}
                {dayTasks.map((task) => (
                  <TaskPill
                    key={task.id}
                    task={task}
                    onClick={() => setEditingTask(task)}
                  />
                ))}
                <Button type="button" variant="ghost" onClick={() => openNewEvent(day)} className="h-8 w-full justify-start gap-2 text-xs text-slate-400 hover:bg-white/10">
                  <Plus className="h-3 w-3" />
                  Criar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDay = () => (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-4">
        <p className="text-sm capitalize text-slate-400">{format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        <p className="mt-1 text-3xl font-bold text-white">{format(currentDate, 'd')}</p>
      </div>
      <div className="divide-y divide-white/10">
        {selectedDateEvents.length === 0 && selectedDateTasks.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-slate-400">
            <CalendarDays className="h-10 w-10" />
            <Button type="button" onClick={() => openNewEvent(currentDate)} className="mt-4 gap-2 bg-blue-600 text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" />
              Criar compromisso
            </Button>
          </div>
        ) : (
          <>
            {selectedDateEvents.map((event) => {
            const category = getCategory(event.category);
            return (
              <button key={getEventKey(event)} type="button" onClick={() => openEventEditor(event)} className="flex w-full items-start gap-4 p-4 text-left hover:bg-white/[0.06]">
                <div className="w-20 shrink-0 text-sm text-slate-400">{event.startTime}</div>
                <span className={`mt-1 h-3 w-3 rounded-full ${category.color}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-white">{event.title}</p>
                  <p className="text-sm text-slate-400">{`${event.startTime} - ${event.endTime} - ${event.calendarSummary || category.label}`}</p>
                </div>
              </button>
            );
            })}
            {selectedDateTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setEditingTask(task)}
                className="flex w-full items-start gap-4 p-4 text-left hover:bg-white/[0.06]"
              >
                <div className="w-20 shrink-0 text-sm font-medium text-violet-300">Tarefa</div>
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <div className="min-w-0">
                  <p className="font-semibold text-white">{task.tarefa}</p>
                  {task.detalhes && <p className="text-sm text-slate-400">{task.detalhes}</p>}
                  <p className="mt-1 text-xs text-slate-500">{formatTaskDate(task.data)}</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const periodLabel = view === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
    : view === 'day'
      ? format(currentDate, 'dd MMMM yyyy', { locale: ptBR })
      : `${format(weekDays[0], 'dd MMM', { locale: ptBR })} - ${format(weekDays[6], 'dd MMM yyyy', { locale: ptBR })}`;

  return (
    <div className="screen-size-ref-12000 space-y-6">
      <Helmet>
        <title>Agenda - BooK+</title>
        <meta name="description" content="Agenda administrativa" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div className="flex min-w-0 items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/administrativo')}
            className="shrink-0 text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold gradient-text">Agenda</h1>
            <p className="text-sm capitalize text-slate-400">{periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-slate-400 lg:text-xs">{ADMINISTRATIVO_AGENDA_REF}</span>
          <Button type="button" variant="outline" onClick={() => setCurrentDate(new Date())} className="border-white/15 text-slate-200 hover:bg-white/10">
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              loadEvents({ force: true });
              loadTasks();
            }}
            disabled={loadingEvents || loadingTasks}
            className="gap-2 border-white/15 text-slate-200 hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${loadingEvents || loadingTasks ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <div className="flex overflow-hidden rounded-md border border-white/15">
            <Button type="button" variant="ghost" size="icon" onClick={movePrevious} className="rounded-none text-slate-200 hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={moveNext} className="rounded-none text-slate-200 hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="h-10 w-[130px] border-white/15 bg-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dia</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => openNewEvent()} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>
      </motion.div>

      <section className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-lg">
        <p className="text-xs font-bold uppercase text-slate-400">Insercao de compromisso</p>
        <div
          className={`mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 ${
            quickEvent.isRecurring
              ? 'xl:grid-cols-[minmax(170px,0.85fr)_145px_110px_110px_116px_125px_145px_auto]'
              : 'xl:grid-cols-[minmax(220px,1fr)_160px_120px_120px_130px_auto]'
          }`}
        >
          <Input
            value={quickEvent.title}
            onChange={(event) => updateQuickEvent('title', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addQuickEvent();
            }}
            placeholder="Titulo"
            className="h-11 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-blue-400"
            disabled={savingEvent}
          />
          <Input
            type="date"
            value={quickEvent.date}
            onChange={(event) => updateQuickEvent('date', event.target.value)}
            aria-label="Data"
            className="h-11 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark] focus-visible:ring-blue-400"
            disabled={savingEvent}
          />
          <Input
            type="time"
            value={quickEvent.startTime}
            onChange={(event) => updateQuickEvent('startTime', event.target.value)}
            aria-label="Hora Inicio"
            className="h-11 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark] focus-visible:ring-blue-400"
            disabled={savingEvent}
          />
          <Input
            type="time"
            value={quickEvent.endTime}
            onChange={(event) => updateQuickEvent('endTime', event.target.value)}
            aria-label="Hora Fim"
            className="h-11 rounded-xl border-white/20 bg-white/10 text-white [color-scheme:dark] focus-visible:ring-blue-400"
            disabled={savingEvent}
          />
          <>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 text-xs font-medium text-slate-200">
              <input
                type="checkbox"
                checked={quickEvent.isRecurring}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setQuickEvent((current) => ({
                    ...current,
                    isRecurring: checked,
                    recurrenceFrequency: checked ? current.recurrenceFrequency : '',
                    recurrenceEndDate: checked ? current.recurrenceEndDate : '',
                  }));
                }}
                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-blue-600 focus:ring-blue-500"
                disabled={savingEvent}
              />
              Recorrente
            </label>

            {quickEvent.isRecurring && (
              <>
                <div className="min-w-0">
                  <Select
                    value={quickEvent.recurrenceFrequency}
                    onValueChange={(value) => updateQuickEvent('recurrenceFrequency', value)}
                    disabled={savingEvent}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-white/20 bg-white/10 px-2 text-xs text-white">
                      <SelectValue placeholder="Periodicidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diaria</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Input
                    id="quick-recurrence-end"
                    type="date"
                    min={quickEvent.date}
                    value={quickEvent.recurrenceEndDate}
                    onChange={(event) => updateQuickEvent('recurrenceEndDate', event.target.value)}
                    aria-label="Termina em"
                    title="Termina em"
                    className="h-11 rounded-xl border-white/20 bg-white/10 px-2 text-xs text-white [color-scheme:dark] focus-visible:ring-blue-400"
                    disabled={savingEvent}
                  />
                </div>
              </>
            )}
          </>
          <Button
            type="button"
            onClick={addQuickEvent}
            disabled={savingEvent}
            className="h-11 gap-1 rounded-xl bg-blue-600 px-3 text-sm text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            {savingEvent ? 'Salvando...' : 'Adicionar'}
          </Button>
          <Textarea
            value={quickEvent.notes}
            onChange={(event) => updateQuickEvent('notes', event.target.value)}
            placeholder="Detalhe"
            className="min-h-[86px] rounded-xl border-white/20 bg-white/10 text-white placeholder:text-slate-400 focus-visible:ring-blue-400 md:col-span-2 xl:col-span-full"
            disabled={savingEvent}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card className="glass-card">
            <CardContent className="space-y-4 p-4">
              <MiniCalendar currentDate={currentDate} selectedDate={currentDate} onSelect={setCurrentDate} />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-white/15 bg-white/10 pl-9 text-white"
                  placeholder="Buscar"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="border-white/15 bg-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as agendas</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.value} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className={`h-3 w-3 rounded-full ${category.color}`} />
                    {category.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </aside>

        <main>
          {loadingEvents ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="mt-3 text-sm font-semibold">Carregando agenda...</p>
            </div>
          ) : (
            <>
              {view === 'month' && renderMonth()}
              {view === 'week' && renderWeek()}
              {view === 'day' && renderDay()}
            </>
          )}
        </main>
      </div>

      {editingEvent && (
        <EventForm event={editingEvent} onCancel={() => setEditingEvent(null)} onSave={saveEvent} saving={savingEvent} />
      )}
      {editingTask && (
        <TaskEditForm
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSave={saveTask}
          saving={savingTask}
        />
      )}
      {selectedEvent && (
        <EventDetails
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
          onEdit={(event) => {
            setSelectedEvent(null);
            setEditingEvent(event);
          }}
        />
      )}
    </div>
  );
};

export default AdministrativoAgenda;


