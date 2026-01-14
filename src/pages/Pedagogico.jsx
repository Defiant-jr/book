import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import IndicadoresPedagogico from '@/components/pedagogico/IndicadoresPedagogico';

const Pedagogico = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Área Pedagógica - BooK+</title>
        <meta name="description" content="Indicadores pedagógicos e acompanhamento acadêmico." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <h1 className="text-3xl font-bold gradient-text">Área Pedagógica</h1>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <GraduationCap className="h-5 w-5 text-blue-300" />
          <CardTitle className="text-white">Indicadores</CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <IndicadoresPedagogico />
      </div>
    </motion.div>
  );
};

export default Pedagogico;
