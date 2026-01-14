import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const IndicadoresPedagogico = () => (
  <>
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
  </>
);

export default IndicadoresPedagogico;
