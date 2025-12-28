import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdministrativoRelatorios = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Relatórios Administrativos - SysFina</title>
        <meta name="description" content="Área reservada para relatórios administrativos." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={() => navigate('/administrativo')}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div className="text-left">
          <h1 className="text-3xl font-bold gradient-text">Relatórios Administrativos</h1>
          <p className="text-gray-400">Conteúdo em breve.</p>
        </div>
      </motion.div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5" />
            Espaço reservado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">
            Esta área será utilizada para relatórios administrativos. Volte em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdministrativoRelatorios;
