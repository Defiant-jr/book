import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const MapaTarefas = () => {
  const RELATORIOS_MAPA_TAREFAS_REF = 81200;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const handleMonthStep = (step) => {
    const base = new Date(`${selectedMonth}-01T00:00:00`);
    const moved = new Date(base.getFullYear(), base.getMonth() + step, 1);
    setSelectedMonth(format(moved, 'yyyy-MM'));
  };

  const handleGenerateReport = () => {
    setLoading(true);
    window.setTimeout(() => {
      setGeneratedAt(new Date());
      setLoading(false);
      toast({ title: 'Relatorio gerado', description: 'Cabecalho do mapa de tarefas atualizado.' });
    }, 250);
  };

  const handleDownloadPdf = () => {
    toast({
      title: 'PDF indisponivel',
      description: 'O mapa de tarefas ainda possui apenas o cabecalho do relatorio.',
    });
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
              <p className="text-sm text-gray-300">Acompanhamento das tarefas pendentes e concluidas.</p>
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
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-end">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={handleGenerateReport} disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Gerando...' : 'Gerar relatorio'}
                </Button>
                <Button
                  onClick={handleDownloadPdf}
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
      </motion.div>
    </>
  );
};

export default MapaTarefas;
