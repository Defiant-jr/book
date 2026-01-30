import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Building2, FileText, GraduationCap, LogOut, Settings, Sliders, Users, Wallet } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AreaSelection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const modules = [
    {
      title: 'Administrativo',
      description: 'Gestão administrativa e Operacional de processos internos.',
      icon: Building2,
      action: () => navigate('/administrativo'),
      sortKey: 'administrativo',
      status: 'Disponível',
    },
    {
      title: 'Operacional',
      description: 'Rotinas operacionais e acompanhamento do dia a dia.',
      icon: Settings,
      action: () => navigate('/operacional'),
      sortKey: 'operacional',
      status: 'Disponível',
    },
    {
      title: 'Financeiro',
      description: 'Acesse o painel financeiro completo e os principais indicadores.',
      icon: Wallet,
      action: () => navigate('/dashboard'),
      sortKey: 'financeiro',
      status: 'Disponível',
    },
    {
      title: 'Comercial',
      description: 'Gestão comercial e acompanhamento de oportunidades para implementação futura.',
      icon: Briefcase,
      sortKey: 'comercial',
      status: 'Em breve',
    },
    {
      title: 'Relatórios',
      description: 'Central de relatórios e documentos para acompanhamento.',
      icon: FileText,
      action: () => navigate('/relatorios'),
      sortKey: 'relatorios',
      status: 'Disponível',
    },
    {
      title: 'Estatisticas',
      description: 'Painel de estatisticas e indicadores para desenvolvimento futuro.',
      icon: BarChart3,
      action: () => navigate('/estatisticas'),
      sortKey: 'estatisticas',
      status: 'Disponivel',
    },
    {
      title: 'Pedagógico',
      description: 'Recursos pedagógicos e acompanhamento acadêmico.',
      icon: GraduationCap,
      action: () => navigate('/pedagogico'),
      sortKey: 'pedagogico',
      status: 'Disponível',
    },
    {
      title: 'CRM',
      description: 'Relacionamento com clientes e gestão comercial para implementação futura.',
      icon: Users,
      sortKey: 'crm',
      status: 'Em breve',
    },
    {
      title: 'Parametros',
      description: 'Configurações e parâmetros do sistema para implementação futura.',
      icon: Sliders,
      sortKey: 'parametros',
      status: 'Em breve',
    },
  ];

  const moduleOrder = [
    'administrativo',
    'financeiro',
    'comercial',
    'pedagogico',
    'crm',
    'operacional',
    'estatisticas',
    'relatorios',
    'parametros',
  ];
  const orderedModules = [...modules].sort(
    (a, b) => moduleOrder.indexOf(a.sortKey) - moduleOrder.indexOf(b.sortKey)
  );

  const handleModuleClick = (module) => {
    if (module.action) {
      module.action();
      return;
    }

    toast({
      title: 'Módulo em desenvolvimento',
      description: `O módulo ${module.title} estará disponível em breve.`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <Helmet>
        <title>Selecione uma área - BooK+</title>
        <meta name="description" content="Escolha o módulo que deseja acessar." />
      </Helmet>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex justify-center md:justify-start">
            <img
              src="/brand/book-plus-logo.png"
              alt="BooK+"
              className="w-52 max-w-full opacity-80 mix-blend-screen select-none pointer-events-none"
            />
          </div>
          <p className="text-sm text-gray-400">Bem-vindo{user?.email ? `, ${user.email}` : ''}</p>
          <p className="text-gray-300">
          </p>
        </div>
        <Button variant="outline" onClick={signOut} className="flex items-center gap-2 self-start">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {orderedModules.map((module, index) => {
          const Icon = module.icon;
          const isAvailable = Boolean(module.action);

          return (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card
                className={`glass-card h-full cursor-pointer transition border border-white/10 hover:border-blue-500/60 ${
                  !isAvailable ? 'opacity-80' : ''
                }`}
                onClick={() => handleModuleClick(module)}
              >
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-white/10 text-gray-200">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-white">{module.title}</CardTitle>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      isAvailable
                        ? 'bg-green-500/20 text-green-200 border border-green-500/40'
                        : 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/30'
                    }`}
                  >
                    {module.status}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4 text-gray-300">
                  <p>{module.description}</p>
                  <Button
                    variant={isAvailable ? 'default' : 'outline'}
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleModuleClick(module);
                    }}
                  >
                    {isAvailable ? 'Acessar' : 'Avisar quando disponível'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AreaSelection;
