import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const CHANGE_EVENT = 'defFinance:emCashValueChanged';

const parseValue = (raw) => {
  const parsed = Number.parseFloat(raw ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const emitValueChanged = (value) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { value: parseValue(value) } }));
};

const fetchRemoteValue = async () => {
  const { data, error } = await supabase
    .from('parametros')
    .select('id, cash')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const persistRemoteValue = async (value) => {
  const numericValue = parseValue(value);
  const row = await fetchRemoteValue();

  if (!row) {
    const { error } = await supabase.from('parametros').insert({ cash: numericValue });
    if (error) throw error;
    return numericValue;
  }

  let query = supabase.from('parametros').update({ cash: numericValue });
  query = row.id != null ? query.eq('id', row.id) : query;

  const { error } = await query;
  if (error) throw error;

  return numericValue;
};

export const useEmCashValue = () => {
  const [value, setValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncFromSupabase = async () => {
      try {
        const remote = await fetchRemoteValue();
        if (!isMounted) return;
        const nextValue = parseValue(remote?.cash);
        setValue(nextValue);
      } catch (error) {
        console.error('Falha ao carregar cash em parametros', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    syncFromSupabase();

    const syncValue = (event) => {
      setValue(parseValue(event?.detail?.value));
    };

    window.addEventListener(CHANGE_EVENT, syncValue);

    return () => {
      isMounted = false;
      window.removeEventListener(CHANGE_EVENT, syncValue);
    };
  }, []);

  const updateValue = async (nextValue) => {
    const parsedValue = parseValue(nextValue);
    setValue(parsedValue);
    emitValueChanged(parsedValue);

    try {
      await persistRemoteValue(parsedValue);
      return { ok: true, value: parsedValue };
    } catch (error) {
      console.error('Falha ao salvar cash em parametros', error);
      return { ok: false, value: parsedValue, error };
    }
  };

  return [value, updateValue, isLoading];
};
