import React, { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllPaginated } from '@/lib/supabasePagination';

const emptyAlunosStats = {
  total: 0,
  angraDosReis: 0,
  mangaratiba: 0,
};

const IndicadoresPedagogico = () => {
  const [alunos, setAlunos] = useState([]);
  const [loadingAlunos, setLoadingAlunos] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAlunos = async () => {
      setLoadingAlunos(true);
      const { data, error } = await fetchAllPaginated((from, to) =>
        supabase
          .from('alunos')
          .select('id, unidade')
          .range(from, to)
      );

      if (!isMounted) return;
      setLoadingAlunos(false);

      if (error) {
        setAlunos([]);
        return;
      }

      setAlunos(data || []);
    };

    fetchAlunos();

    return () => {
      isMounted = false;
    };
  }, []);

  const alunosStats = useMemo(
    () =>
      alunos.reduce((acc, row) => {
        const unidade = String(row?.unidade ?? '').toLowerCase();
        acc.total += 1;
        if (unidade.includes('cna angra dos reis') || unidade.includes('angra dos reis')) {
          acc.angraDosReis += 1;
        } else if (unidade.includes('mangaratiba')) {
          acc.mangaratiba += 1;
        }
        return acc;
      }, { ...emptyAlunosStats }),
    [alunos],
  );

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Quantidade de Alunos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-white">
            {loadingAlunos ? '...' : alunosStats.total}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">CNA Angra dos Reis</p>
              <p className="font-semibold text-blue-200">{loadingAlunos ? '...' : alunosStats.angraDosReis}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">CNA Mangaratiba</p>
              <p className="font-semibold text-blue-200">{loadingAlunos ? '...' : alunosStats.mangaratiba}</p>
            </div>
          </div>
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
};

export default IndicadoresPedagogico;
