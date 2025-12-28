import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, UserPlus, Download, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Administrativo = () => {
  const navigate = useNavigate();

  const navButtons = [
    { label: 'Cadastro', path: '/cadastros', icon: UserPlus },
    { label: 'Relatórios', path: '/administrativo/relatorios', icon: FileText },
    { label: 'Integração', path: '/integracao', icon: Download },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Administrativo - SysFina</title>
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
            <h1 className="text-3xl font-bold gradient-text">Área Administrativa</h1>
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
    </div>
  );
};

export default Administrativo;
