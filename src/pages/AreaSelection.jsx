import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, GraduationCap, LogOut, Wallet } from 'lucide-react';

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
      title: 'Financeiro',
      description: 'Acesse o painel financeiro completo e os principais indicadores.',
      icon: Wallet,
      action: () => navigate('/dashboard'),
      status: 'Disponível',
    },
    {
      title: 'Administrativo',
      description: 'Gestão administrativa e Operacional de processos internos.',
      icon: Building2,
      action: () => navigate('/administrativo'),
      status: 'Disponível',
    },
    {
      title: 'Pedagógico',
      description: 'Recursos pedagógicos e acompanhamento acadêmico.',
      icon: GraduationCap,
      status: 'Em breve',
    },
  ];

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
        <title>Selecione uma área - SysFina</title>
        <meta name="description" content="Escolha o módulo que deseja acessar." />
      </Helmet>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400">Bem-vindo{user?.email ? `, ${user.email}` : ''}</p>
          <h1 className="text-3xl font-bold gradient-text">Escolha uma área para continuar</h1>
          <p className="text-gray-300">
            Selecione o módulo desejado. Novas áreas serão liberadas em breve.
          </p>
        </div>
        <Button variant="outline" onClick={signOut} className="flex items-center gap-2 self-start">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {modules.map((module, index) => {
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
