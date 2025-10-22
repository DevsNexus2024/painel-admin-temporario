import { useState, useEffect } from 'react';
import { consultarSaldoBitso } from '@/services/bitso';
import type { BitsoBalance } from '@/services/banking/BitsoApiClient';

export function useBitsoSaldo() {
  const [saldo, setSaldo] = useState<BitsoBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaldo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const resultado = await consultarSaldoBitso();
      setSaldo(resultado);
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar saldo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaldo();
  }, []);

  return {
    saldo,
    loading,
    error,
    refetch: fetchSaldo
  };
}



