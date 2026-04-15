import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const CHANGE_EVENT = 'defFinance:financialAdjustmentsChanged';

const parseValue = (raw) => {
  const parsed = Number.parseFloat(raw ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseAdjustments = (raw = {}) => ({
  cash: parseValue(raw.cash),
  investimento: parseValue(raw.investimento),
});

const emitAdjustmentsChanged = (adjustments) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: parseAdjustments(adjustments) }));
};

const fetchRemoteAdjustments = async () => {
  const { data, error } = await supabase
    .from('parametros')
    .select('id, cash, investimento')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const persistRemoteAdjustments = async (nextValues) => {
  const normalized = parseAdjustments(nextValues);
  const row = await fetchRemoteAdjustments();

  if (!row) {
    const { error } = await supabase.from('parametros').insert(normalized);
    if (error) throw error;
    return normalized;
  }

  let query = supabase.from('parametros').update(normalized);
  query = row.id != null ? query.eq('id', row.id) : query;

  const { error } = await query;
  if (error) throw error;

  return normalized;
};

export const useFinanceAdjustments = () => {
  const [adjustments, setAdjustments] = useState({ cash: 0, investimento: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncFromSupabase = async () => {
      try {
        const remote = await fetchRemoteAdjustments();
        if (!isMounted) return;
        setAdjustments(parseAdjustments(remote));
      } catch (error) {
        console.error('Falha ao carregar ajustes financeiros em parametros', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    syncFromSupabase();

    const syncAdjustments = (event) => {
      setAdjustments(parseAdjustments(event?.detail));
    };

    window.addEventListener(CHANGE_EVENT, syncAdjustments);

    return () => {
      isMounted = false;
      window.removeEventListener(CHANGE_EVENT, syncAdjustments);
    };
  }, []);

  const updateAdjustments = async (nextValues) => {
    const normalized = parseAdjustments(nextValues);
    setAdjustments(normalized);
    emitAdjustmentsChanged(normalized);

    try {
      await persistRemoteAdjustments(normalized);
      return { ok: true, value: normalized };
    } catch (error) {
      console.error('Falha ao salvar ajustes financeiros em parametros', error);
      return { ok: false, value: normalized, error };
    }
  };

  return [adjustments, updateAdjustments, isLoading];
};

export const useEmCashValue = () => {
  const [adjustments, updateAdjustments, isLoading] = useFinanceAdjustments();

  const updateCash = async (nextCashValue) => {
    const nextValue = parseValue(nextCashValue);
    const result = await updateAdjustments({
      cash: nextValue,
      investimento: adjustments.investimento,
    });

    if (!result?.ok) {
      return { ok: false, value: nextValue, error: result?.error };
    }

    return { ok: true, value: nextValue };
  };

  return [adjustments.cash, updateCash, isLoading];
};
