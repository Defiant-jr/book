import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, PenLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import LancamentoForm from '@/components/forms/LancamentoForm';

const FinanceiroCadastro = () => {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState('lancamento');

  const cardOptions = [
    {
      id: 'lancamento',
      title: 'Lançamento',
      description: 'Registrar novos lançamentos financeiros.',
      icon: PenLine,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <Helmet>
        <title>Cadastro Financeiro - BooK+</title>
        <meta name="description" content="Cadastre lançamentos financeiros." />
      </Helmet>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold gradient-text">Cadastro</h1>
            <span className="text-sm text-gray-300">Área Financeira</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardOptions.map((card) => {
          const Icon = card.icon;
          const isActive = activeCard === card.id;
          return (
            <Card
              key={card.id}
              className={`glass-card cursor-pointer transition-all ${isActive ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-white/20'}`}
              onClick={() => setActiveCard(card.id)}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-gray-300'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{card.title}</h2>
                    <p className="text-sm text-gray-400">{card.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeCard === 'lancamento' && (
        <LancamentoForm
          onCancel={() => navigate(-1)}
          onSuccess={() => navigate('/dashboard')}
          allowRecurrence
        />
      )}
    </motion.div>
  );
};

export default FinanceiroCadastro;
