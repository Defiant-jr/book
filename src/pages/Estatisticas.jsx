import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, FileText, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Estatisticas = () => {
  const ESTATISTICAS_REF = 70000;
  const navigate = useNavigate();

  const navButtons = [
    {
      label: 'Visão ADM/FIN',
      path: '/estatisticas/custo-aluno',
      icon: BarChart3,
    },
    {
      label: 'Custo Turma',
      path: '/estatisticas/custo-turma',
      icon: GraduationCap,
    },
    {
      label: 'Ficha de Custos',
      path: '/estatisticas/ficha-custos',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Estatisticas - BooK+</title>
        <meta name="description" content="Central de estatisticas e indicadores." />
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
            <h1 className="text-3xl font-bold gradient-text">Estatisticas</h1>
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 lg:text-xs">
          {ESTATISTICAS_REF}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-card p-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {navButtons.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  variant="ghost"
                  className="flex-grow sm:flex-grow-0 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Estatisticas;
