import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, LayoutDashboard, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Operacional = () => {
  const navigate = useNavigate();

  const navButtons = [
    { label: 'Dashboard', path: '/operacional', icon: LayoutDashboard },
    { label: 'Cadastro', path: '/cadastros', icon: UserPlus },
    { label: 'Integracao', path: '/operacional/integracao', icon: Download },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Operacional - BooK+</title>
        <meta name="description" content="Area operacional" />
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
            <h1 className="text-3xl font-bold gradient-text">Operacional</h1>
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
              return (
                <Button
                  key={index}
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

export default Operacional;
