// hooks/useCorpXSaldo.ts - Hook específico para saldo CorpX
// Compatível com o padrão dos outros hooks de saldo do projeto

import { useState, useEffect, useCallback } from 'react';
import { CorpXService } from '@/services/corpx';
import type { CorpXSaldoResponse } from '@/types/corpx';

interface UseCorpXSaldoOptions {
  cnpj: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // em milissegundos
}

interface UseCorpXSaldoReturn {
  saldo: CorpXSaldoResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useCorpXSaldo({ 
  cnpj, 
  autoRefresh = false, 
  refreshInterval = 30000 
}: UseCorpXSaldoOptions): UseCorpXSaldoReturn {
  const [saldo, setSaldo] = useState<CorpXSaldoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSaldo = useCallback(async () => {
    if (!cnpj) {
      //console.warn('[useCorpXSaldo] CNPJ não fornecido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      ////console.log('[useCorpXSaldo] Consultando saldo CORPX...', cnpj);
      
      const response = await CorpXService.consultarSaldo(cnpj);
      
      if (response?.erro) {
        setError('Erro ao consultar saldo CORPX');
        setSaldo(null);
      } else {
        setSaldo(response);
        setLastUpdated(new Date());
        //console.log('[useCorpXSaldo] Saldo atualizado:', response);
      }
      
    } catch (err: any) {
      //console.error('[useCorpXSaldo] Erro:', err);
      setError(CorpXService.tratarErro(err));
      setSaldo(null);
    } finally {
      setIsLoading(false);
    }
  }, [cnpj]);

  const refresh = useCallback(async () => {
    await fetchSaldo();
  }, [fetchSaldo]);

  // Fetch inicial
  useEffect(() => {
    if (cnpj) {
      fetchSaldo();
    }
  }, [cnpj, fetchSaldo]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !cnpj || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      //console.log('[useCorpXSaldo] Auto refresh executado');
      fetchSaldo();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoRefresh, cnpj, refreshInterval, fetchSaldo]);

  return {
    saldo,
    isLoading,
    error,
    refresh,
    lastUpdated
  };
}
