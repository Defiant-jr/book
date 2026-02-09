import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import TurmaCostCalculator from '@/components/TurmaCostCalculator';

const CustoTurma = () => {
  const ESTATISTICAS_CUSTO_TURMA_REF = 72000;
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Custo por Turma - BooK+</title>
        <meta name="description" content="Calculadora de custos por turma." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="text-left">
            <h1 className="text-3xl font-bold gradient-text">Custo por Turma</h1>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {ESTATISTICAS_CUSTO_TURMA_REF}
        </div>
      </motion.div>

      <TurmaCostCalculator />
    </div>
  );
};

export default CustoTurma;
