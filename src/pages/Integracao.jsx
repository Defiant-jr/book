import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, UserCheck, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
const Integracao = () => {
  const navigate = useNavigate();
  const integrationCards = [
    {
      title: 'Alunos',
      description: 'Integracao de dados de alunos.',
      icon: Users,
    },
    {
      title: 'Responsaveis',
      description: 'Integracao de dados de responsaveis.',
      icon: UserCheck,
    },
    {
      title: 'Turmas',
      description: 'Integracao de dados de turmas.',
      icon: GraduationCap,
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Integracao - BooK+</title>
        <meta name="description" content="Central de integracoes com servicos externos." />
      </Helmet>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">Integracao</h1>
            <span className="text-sm text-gray-300">Escolha a integracao que deseja executar.</span>
          </div>
        </div>
      </div>
      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-white">Opcoes de integracao</CardTitle>
          <span className="text-xs text-gray-400">Selecione o tipo de integracao desejado.</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {integrationCards.map((option) => {
              const Icon = option.icon;
              return (
                <Card key={option.title} className="bg-white/5 border-white/10">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/10">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="text-base text-white">{option.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-400">{option.description}</p>
                    <Button
                      disabled
                      className="w-full"
                      variant="secondary"
                    >
                      Em breve
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
export default Integracao;
