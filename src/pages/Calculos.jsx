import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const Calculos = () => {
  const CALCULOS_REF = 63000;
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Cálculos - BooK+</title>
        <meta name="description" content="Área de cálculos operacionais." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => navigate('/operacional')}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="text-left">
            <h1 className="text-3xl font-bold gradient-text">Cálculos</h1>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {CALCULOS_REF}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="glass-card h-full flex flex-col justify-between hover:border-blue-500 transition-colors duration-300 cursor-pointer"
            onClick={() => navigate('/operacional/calculos/cancelamento')}
          >
            <CardContent className="relative p-4 flex flex-col items-center text-center">
              <span className="absolute right-3 top-3 text-[10px] font-medium text-gray-400 lg:text-xs">
                63100
              </span>
              <div className="p-3 bg-blue-500/10 rounded-full mb-3">
                <Calculator className="w-9 h-9 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold mb-2 text-white">
                Cálculo de Cancelamento
              </h2>
              <p className="text-gray-400 text-xs flex-grow">
                Calcule os valores relacionados ao cancelamento.
              </p>
            </CardContent>
            <div className="p-3 pt-0">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-xs py-2"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/operacional/calculos/cancelamento');
                }}
              >
                Calcular
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Calculos;
