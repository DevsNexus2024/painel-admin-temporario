import { useState, useEffect } from 'react';
import { consultarExtratoBitso } from '@/services/bitso';
import type { BitsoFilters } from '@/services/banking/BitsoApiClient';

export function useBitsoExtrato(filters?: BitsoFilters) {
  const [extrato, setExtrato] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExtrato = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const resultado = await consultarExtratoBitso(filters);
      setExtrato(resultado);
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar extrato');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtrato();
  }, [filters?.start_date, filters?.end_date]);

  return {
    extrato,
    loading,
    error,
    refetch: fetchExtrato
  };
}



