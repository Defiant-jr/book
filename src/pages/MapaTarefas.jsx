import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
} from 'lucide-react';
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import jsPDF from 'jspdf';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { listGoogleTasks } from '@/services/googleTasksService';

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const getDateKey = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const dateKey = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
  }
  try {
    return format(value, 'yyyy-MM-dd');
  } catch {
    return null;
  }
};

const MapaTarefas = () => {
  const RELATORIOS_MAPA_TAREFAS_REF = 81200;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    handleGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthStep = (step) => {
    const base = new Date(`${selectedMonth}-01T00:00:00`);
    const moved = new Date(base.getFullYear(), base.getMonth() + step, 1);
    setSelectedMonth(format(moved, 'yyyy-MM'));
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const data = await listGoogleTasks();
      const sorted = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
        const aDate = getDateKey(a?.data) || '9999-12-31';
        const bDate = getDateKey(b?.data) || '9999-12-31';
        return aDate.localeCompare(bDate) || String(a?.tarefa || '').localeCompare(String(b?.tarefa || ''));
      });
      setTarefas(sorted);
      setReportGenerated(true);
      setGeneratedAt(new Date());
      toast({ title: 'Relatorio gerado', description: 'Tarefas carregadas com sucesso.' });
    } catch (error) {
      toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const tarefasPendentes = useMemo(
    () =>
      tarefas
        .filter((tarefa) => tarefa.concluida !== 'S')
        .map((tarefa) => ({ ...tarefa, dataStr: getDateKey(tarefa.data) })),
    [tarefas],
  );

  const tarefasConcluidas = useMemo(
    () => tarefas.filter((tarefa) => tarefa.concluida === 'S'),
    [tarefas],
  );

  const tarefasSemData = useMemo(
    () => tarefasPendentes.filter((tarefa) => !tarefa.dataStr),
    [tarefasPendentes],
  );

  const tarefasAtrasadas = useMemo(
    () => tarefasPendentes.filter((tarefa) => tarefa.dataStr && tarefa.dataStr < todayStr),
    [tarefasPendentes, todayStr],
  );

  const calendarCells = useMemo(() => {
    const current = new Date(`${selectedMonth}-01T00:00:00`);
    const start = startOfMonth(current);
    const end = endOfMonth(current);
    const days = eachDayOfInterval({ start, end });
    const lastDayIso = format(end, 'yyyy-MM-dd');

    return days.map((day) => {
      const dayIso = format(day, 'yyyy-MM-dd');
      const dayTasks = tarefasPendentes.filter((tarefa) => tarefa.dataStr === dayIso);
      const overdueForToday = dayIso === todayStr ? tarefasAtrasadas : [];
      const undatedForLastDay = dayIso === lastDayIso ? tarefasSemData : [];
      const scheduledTasks = dayTasks.filter((tarefa) => tarefa.dataStr >= todayStr);
      const tasks = dayIso === todayStr
        ? [
            ...overdueForToday.map((tarefa) => ({ ...tarefa, atrasada: true })),
            ...scheduledTasks,
            ...undatedForLastDay.map((tarefa) => ({ ...tarefa, semData: true })),
          ]
        : [
            ...scheduledTasks,
            ...undatedForLastDay.map((tarefa) => ({ ...tarefa, semData: true })),
          ];

      return {
        date: day,
        tasks,
        overdueCount: overdueForToday.length,
        undatedCount: undatedForLastDay.length,
      };
    });
  }, [selectedMonth, tarefasPendentes, tarefasAtrasadas, tarefasSemData, todayStr]);

  const leadingEmptyCells = useMemo(() => {
    if (!calendarCells.length) return 0;
    return getDay(calendarCells[0].date);
  }, [calendarCells]);

  const monthTotals = useMemo(() => {
    const current = new Date(`${selectedMonth}-01T00:00:00`);
    const start = format(startOfMonth(current), 'yyyy-MM-dd');
    const end = format(endOfMonth(current), 'yyyy-MM-dd');
    const monthTasks = tarefasPendentes.filter(
      (tarefa) => tarefa.dataStr && tarefa.dataStr >= start && tarefa.dataStr <= end,
    );

    return {
      pendentesMes: monthTasks.length,
      atrasadas: tarefasAtrasadas.length,
      semData: tarefasSemData.length,
      concluidas: tarefasConcluidas.length,
    };
  }, [selectedMonth, tarefasPendentes, tarefasAtrasadas.length, tarefasSemData.length, tarefasConcluidas.length]);

  const handleDownloadPdf = () => {
    if (!reportGenerated) {
      toast({
        title: 'Gere o relatorio primeiro',
        description: 'Clique em "Gerar relatorio" para carregar as tarefas.',
        variant: 'destructive',
      });
      return;
    }

    const current = new Date(`${selectedMonth}-01T00:00:00`);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 24;
    const headerY = margin;
    const summaryY = headerY + 18;
    const gridStartY = summaryY + 26;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cellWidth = (pageWidth - margin * 2) / 7;
    const cellsWithPlaceholders = [
      ...Array.from({ length: leadingEmptyCells }, () => null),
      ...calendarCells,
    ];
    const rows = Math.max(1, Math.ceil(cellsWithPlaceholders.length / 7));
    const cellHeight = (pageHeight - gridStartY - margin) / rows;
    const padding = 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Mapa de Tarefas - ${format(current, 'MMMM yyyy')}`, margin, headerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Pendentes no mes: ${monthTotals.pendentesMes} | Atrasadas: ${monthTotals.atrasadas} | Sem data: ${monthTotals.semData} | Concluidas: ${monthTotals.concluidas}`,
      margin,
      summaryY,
    );

    cellsWithPlaceholders.forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const x = margin + col * cellWidth;
      const y = gridStartY + row * cellHeight;

      if (!cell) {
        doc.setLineDash([2, 2], 0);
        doc.setDrawColor(120, 130, 145);
        doc.rect(x, y, cellWidth, cellHeight);
        doc.setLineDash([]);
        doc.setDrawColor(0);
        return;
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 210, 220);
      doc.roundedRect(x, y, cellWidth, cellHeight, 8, 8, 'FD');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(format(cell.date, 'd'), x + padding, y + padding + 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 145);
      doc.text(`${cell.tasks.length} tarefas`, x + cellWidth - padding, y + padding + 2, { align: 'right' });

      let cursorY = y + padding + 14;
      const maxY = y + cellHeight - 8;
      const maxItems = 8;

      if (cell.tasks.length === 0) {
        doc.setFontSize(8);
        doc.text('Sem tarefas', x + padding, cursorY);
      } else {
        doc.setFontSize(7);
        cell.tasks.slice(0, maxItems).forEach((tarefa) => {
          if (cursorY > maxY) return;
          const prefix = tarefa.atrasada ? '[Atrasada] ' : tarefa.semData ? '[Sem data] ' : '';
          const title = `${prefix}${tarefa.tarefa || 'Tarefa'}`;
          const line = doc.splitTextToSize(title, cellWidth - padding * 2)[0] || title;
          doc.setTextColor(tarefa.atrasada ? 190 : 31, tarefa.atrasada ? 70 : 41, tarefa.atrasada ? 70 : 55);
          doc.text(line, x + padding, cursorY);
          cursorY += 9;
        });
        if (cell.tasks.length > maxItems && cursorY <= maxY) {
          doc.setTextColor(120, 130, 145);
          doc.text(`+${cell.tasks.length - maxItems} tarefas`, x + padding, cursorY);
        }
      }

      doc.setTextColor(0);
    });

    doc.save(`mapa_tarefas_${format(current, 'yyyy_MM')}.pdf`);
  };

  const monthLabel = format(new Date(`${selectedMonth}-01T00:00:00`), 'MMMM yyyy');

  return (
    <>
      <Helmet>
        <title>Mapa de Tarefas - BooK+</title>
        <meta name="description" content="Mapa de acompanhamento das tarefas." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/relatorios')}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Voltar</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold gradient-text">Mapa de Tarefas</h1>
              <p className="text-sm text-gray-300">Calendario mensal das tarefas pendentes.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
              {RELATORIOS_MAPA_TAREFAS_REF}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => handleMonthStep(-1)}>
                <ChevronLeft className="h-5 w-5 text-white" />
              </Button>
              <div className="w-36 text-center text-lg font-semibold capitalize text-white">{monthLabel}</div>
              <Button variant="ghost" size="icon" onClick={() => handleMonthStep(1)}>
                <ChevronRight className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarRange className="w-5 h-5" />
              Configuracao do relatorio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex w-full flex-col gap-2 md:w-72">
                <label className="text-sm text-gray-300">Competencia</label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="border-white/20 bg-white/10 text-white"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={handleGenerateReport} disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Gerando...' : 'Gerar relatorio'}
                </Button>
                <Button
                  onClick={handleDownloadPdf}
                  disabled={!reportGenerated || loading}
                  variant="outline"
                  className="border-blue-500 text-blue-300 hover:bg-blue-500/10"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Gerar PDF (paisagem)
                </Button>
              </div>
            </div>
            {generatedAt && (
              <p className="text-xs text-gray-400">
                Gerado em: {format(generatedAt, 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Resumo do mes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 text-white md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/15 bg-[#344b92]/70 p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-white/85">Pendentes no mes</p>
                <CalendarRange className="h-5 w-5 text-blue-200" />
              </div>
              <p className="mt-4 text-4xl font-bold text-blue-200">{monthTotals.pendentesMes}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#344b92]/70 p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-white/85">Atrasadas</p>
                <AlertCircle className="h-5 w-5 text-red-300" />
              </div>
              <p className="mt-4 text-4xl font-bold text-red-300">{monthTotals.atrasadas}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#344b92]/70 p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-white/85">Sem data</p>
                <AlertCircle className="h-5 w-5 text-amber-300" />
              </div>
              <p className="mt-4 text-4xl font-bold text-amber-300">{monthTotals.semData}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-[#344b92]/70 p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-white/85">Concluidas</p>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="mt-4 text-4xl font-bold text-emerald-300">{monthTotals.concluidas}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Calendario do mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-gray-300 text-sm">
              {weekdayLabels.map((day) => (
                <div key={day} className="font-semibold tracking-wide">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: leadingEmptyCells }).map((_, idx) => (
                <div key={`empty-${idx}`} className="rounded-xl border border-dashed border-white/10 h-28" />
              ))}
              {calendarCells.map((cell) => (
                <div
                  key={cell.date.toISOString()}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 text-white"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{format(cell.date, 'd')}</span>
                    <span className="text-xs text-gray-300">
                      {cell.tasks.length} tarefas
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto space-y-1">
                    {cell.tasks.length === 0 ? (
                      <p className="text-xs text-gray-400">Sem tarefas</p>
                    ) : (
                      cell.tasks.map((tarefa) => (
                        <div key={`${tarefa.atrasada ? 'overdue' : 'task'}-${tarefa.id}`} className="text-xs flex justify-between gap-1">
                          <span className="truncate max-w-[82%]">{tarefa.tarefa || 'Tarefa'}</span>
                          {tarefa.atrasada && <span className="text-red-300 font-mono">Atr.</span>}
                          {tarefa.semData && <span className="text-amber-300 font-mono">S/Data</span>}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="text-xs text-green-300 border-t border-white/10 pt-2">
                    Atrasadas: <span className="font-semibold">{cell.overdueCount}</span>
                    {cell.undatedCount > 0 && (
                      <span className="ml-2 text-amber-300">Sem data: <span className="font-semibold">{cell.undatedCount}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!calendarCells.length && (
              <p className="text-center text-gray-400">Nenhuma tarefa para este mes.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default MapaTarefas;
