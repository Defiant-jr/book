import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, UserPlus, Download, FileText, LayoutDashboard, Settings, ClipboardList } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Administrativo = () => {
  const navigate = useNavigate();

  const navButtons = [
    { label: 'Dashboard', path: '/administrativo', icon: LayoutDashboard },
    { label: 'Tarefas', icon: ClipboardList, disabled: true, loadingLabel: 'Em breve' },
    { label: 'Cadastro', path: '/cadastros', icon: UserPlus },
    { label: 'Operações', path: '/lancamentos', icon: Settings },
    { label: 'Relatórios', path: '/administrativo/relatorios', icon: FileText },
    { label: 'Integração', path: '/integracao', icon: Download },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Administrativo - BooK+</title>
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Quantidade de Alunos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">0</p>
              <p className="text-sm text-gray-400">Total cadastrado</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Turmas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">0</p>
              <p className="text-sm text-gray-400">Ativas no momento</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white">Resultado Operacional</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">R$ 0,00</p>
              <p className="text-sm text-gray-400">Resultado do periodo</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card mt-4">
          <CardHeader>
            <CardTitle className="text-white">Tarefas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-400">Post-its das tarefas cadastradas.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="aspect-square rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-300 p-3 text-yellow-900 shadow-lg shadow-black/20">
                <p className="text-xs font-semibold">Sem tarefas</p>
                <p className="text-[10px] opacity-80">Aguardando</p>
              </div>
              <div className="aspect-square rounded-xl bg-gradient-to-br from-green-100 to-green-300 p-3 text-green-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-blue-100 to-blue-300 p-3 text-blue-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-orange-100 to-orange-300 p-3 text-orange-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-rose-100 to-rose-300 p-3 text-rose-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-amber-100 to-amber-300 p-3 text-amber-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-lime-100 to-lime-300 p-3 text-lime-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-teal-100 to-teal-300 p-3 text-teal-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-300 p-3 text-cyan-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-sky-100 to-sky-300 p-3 text-sky-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-violet-100 to-violet-300 p-3 text-violet-900 shadow-lg shadow-black/20" />
              <div className="aspect-square rounded-xl bg-gradient-to-br from-fuchsia-100 to-fuchsia-300 p-3 text-fuchsia-900 shadow-lg shadow-black/20" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Administrativo;





