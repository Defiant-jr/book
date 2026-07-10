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
  Clock,
  Edit3,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'book-administrativo-agenda-events';
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
  allDay: false,
  category: 'administrativo',
  location: '',
  guests: '',
  notes: '',
};

const getCategory = (value) => categories.find((category) => category.value === value) || categories[0];
const dateKey = (date) => format(date, 'yyyy-MM-dd');
const parseLocalDate = (value) => parseISO(`${value}T00:00:00`);

const seedEvents = () => [
  {
    id: crypto.randomUUID(),
    title: 'Reuniao administrativa',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    category: 'reuniao',
    location: 'Sala principal',
    guests: 'Equipe administrativa',
    notes: 'Acompanhamento semanal de prioridades.',
  },
  {
    id: crypto.randomUUID(),
    title: 'Fechamento financeiro',
    date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    startTime: '14:00',
    endTime: '15:30',
    allDay: false,
    category: 'financeiro',
    location: '',
    guests: '',
    notes: '',
  },
];

const loadEvents = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedEvents();
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : seedEvents();
  } catch {
    return seedEvents();
  }
};

const sortEvents = (events) =>
  [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
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
      title={event.title}
    >
      {!compact && !event.allDay && <span className="mr-1 font-mono">{event.startTime}</span>}
      <span className="font-semibold">{event.title}</span>
    </button>
  );
};

const EventDetails = ({ event, onEdit, onDelete, onClose }) => {
  const category = getCategory(event.category);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${category.color}`} />
              <span className="text-xs font-semibold uppercase text-slate-400">{category.label}</span>
            </div>
            <h2 className="break-words text-2xl font-bold text-white">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {format(parseLocalDate(event.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {event.allDay ? ' - Dia todo' : ` - ${event.startTime} ate ${event.endTime}`}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-300">
          {event.location && (
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{event.location}</p>
          )}
          {event.guests && (
            <p className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />{event.guests}</p>
          )}
          {event.notes && <p className="whitespace-pre-wrap rounded-md bg-white/5 p-3 leading-relaxed">{event.notes}</p>}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onDelete(event.id)} className="gap-2 border-red-400/30 text-red-200 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
          <Button type="button" onClick={() => onEdit(event)} className="gap-2 bg-blue-600 text-white hover:bg-blue-500">
            <Edit3 className="h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
};

const EventForm = ({ event, onCancel, onSave }) => {
  const [draft, setDraft] = useState(event || emptyEvent);

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!draft.title.trim()) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      location: draft.location.trim(),
      guests: draft.guests.trim(),
      notes: draft.notes.trim(),
      startTime: draft.allDay ? '00:00' : draft.startTime,
      endTime: draft.allDay ? '23:59' : draft.endTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">{draft.id ? 'Editar evento' : 'Novo evento'}</h2>
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
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">Categoria</label>
            <Select value={draft.category} onValueChange={(value) => update('category', value)}>
              <SelectTrigger className="border-white/15 bg-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(inputEvent) => update('allDay', inputEvent.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            Dia todo
          </label>

          {!draft.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="time"
                value={draft.startTime}
                onChange={(inputEvent) => update('startTime', inputEvent.target.value)}
                className="border-white/15 bg-white/10 text-white"
                aria-label="Hora inicial"
              />
              <Input
                type="time"
                value={draft.endTime}
                onChange={(inputEvent) => update('endTime', inputEvent.target.value)}
                className="border-white/15 bg-white/10 text-white"
                aria-label="Hora final"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-location">Local</label>
            <Input
              id="agenda-location"
              value={draft.location}
              onChange={(inputEvent) => update('location', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
              placeholder="Adicionar local"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-guests">Convidados</label>
            <Input
              id="agenda-guests"
              value={draft.guests}
              onChange={(inputEvent) => update('guests', inputEvent.target.value)}
              className="border-white/15 bg-white/10 text-white"
              placeholder="Adicionar convidados"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase text-slate-400" htmlFor="agenda-notes">Descricao</label>
            <Textarea
              id="agenda-notes"
              value={draft.notes}
              onChange={(inputEvent) => update('notes', inputEvent.target.value)}
              className="min-h-[110px] border-white/15 bg-white/10 text-white"
              placeholder="Adicionar descricao"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/15 text-slate-200 hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-500">
            Salvar
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
  const [events, setEvents] = useState(loadEvents);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortEvents(events).filter((event) => {
      const matchesCategory = categoryFilter === 'todas' || event.category === categoryFilter;
      const matchesText = !text || `${event.title} ${event.location} ${event.guests} ${event.notes}`.toLowerCase().includes(text);
      return matchesCategory && matchesText;
    });
  }, [events, query, categoryFilter]);

  const todayEvents = filteredEvents.filter((event) => isSameDay(parseLocalDate(event.date), new Date()));
  const selectedDateEvents = filteredEvents.filter((event) => isSameDay(parseLocalDate(event.date), currentDate));

  const openNewEvent = (date = currentDate) => {
    setSelectedEvent(null);
    setEditingEvent({ ...emptyEvent, date: dateKey(date) });
  };

  const saveEvent = (event) => {
    setEvents((current) => {
      if (event.id) {
        return current.map((item) => (item.id === event.id ? event : item));
      }
      return [...current, { ...event, id: crypto.randomUUID() }];
    });
    setEditingEvent(null);
    setSelectedEvent(null);
  };

  const deleteEvent = (id) => {
    setEvents((current) => current.filter((event) => event.id !== id));
    setSelectedEvent(null);
    setEditingEvent(null);
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
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill key={event.id} event={event} onClick={setSelectedEvent} />
                ))}
                {dayEvents.length > 3 && <p className="text-xs font-semibold text-slate-400">+{dayEvents.length - 3} eventos</p>}
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
          return (
            <div key={day.toISOString()} className="min-h-[520px] border-b border-r border-white/10">
              <button type="button" onClick={() => setCurrentDate(day)} className="w-full border-b border-white/10 p-3 text-left hover:bg-white/[0.06]">
                <p className="text-xs uppercase text-slate-500">{format(day, 'EEE', { locale: ptBR })}</p>
                <p className={`mt-1 text-2xl font-semibold ${isSameDay(day, new Date()) ? 'text-blue-300' : 'text-white'}`}>{format(day, 'd')}</p>
              </button>
              <div className="space-y-2 p-3">
                {dayEvents.map((event) => <EventPill key={event.id} event={event} onClick={setSelectedEvent} />)}
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
        {selectedDateEvents.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-slate-400">
            <CalendarDays className="h-10 w-10" />
            <Button type="button" onClick={() => openNewEvent(currentDate)} className="mt-4 gap-2 bg-blue-600 text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" />
              Criar evento
            </Button>
          </div>
        ) : (
          selectedDateEvents.map((event) => {
            const category = getCategory(event.category);
            return (
              <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} className="flex w-full items-start gap-4 p-4 text-left hover:bg-white/[0.06]">
                <div className="w-20 shrink-0 text-sm text-slate-400">{event.allDay ? 'Dia todo' : event.startTime}</div>
                <span className={`mt-1 h-3 w-3 rounded-full ${category.color}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-white">{event.title}</p>
                  <p className="text-sm text-slate-400">{event.allDay ? category.label : `${event.startTime} - ${event.endTime} · ${category.label}`}</p>
                  {event.location && <p className="mt-1 text-sm text-slate-400">{event.location}</p>}
                </div>
              </button>
            );
          })
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
    <div className="space-y-6">
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

          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Clock className="h-4 w-4 text-blue-300" />
                <h2 className="text-sm font-semibold">Hoje</h2>
              </div>
              <div className="space-y-2">
                {todayEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum evento para hoje.</p>
                ) : (
                  todayEvents.map((event) => <EventPill key={event.id} event={event} onClick={setSelectedEvent} />)
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <main>
          {view === 'month' && renderMonth()}
          {view === 'week' && renderWeek()}
          {view === 'day' && renderDay()}
        </main>
      </div>

      {editingEvent && (
        <EventForm event={editingEvent} onCancel={() => setEditingEvent(null)} onSave={saveEvent} />
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
