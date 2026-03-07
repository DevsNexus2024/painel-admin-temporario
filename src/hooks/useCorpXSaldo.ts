// hooks/useCorpXSaldo.ts - Hook específico para saldo CorpX (CorpX v2)
// Usa alias (X-Corpx-Account-Context) em vez de CNPJ

import { useState, useEffect, useCallback, useRef } from 'react';
import { CorpXService } from '@/services/corpx';
import { getCorpxAliasByCnpj } from '@/contexts/CorpXContext';
import type { CorpXSaldoResponse } from '@/types/corpx';

interface UseCorpXSaldoOptions {
  /** CNPJ da conta (usado para obter alias via CORPX_ACCOUNTS) */
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
  const abortRef = useRef<AbortController | null>(null);

  const fetchSaldo = useCallback(async () => {
    const cnpjNumerico = (cnpj || '').replace(/\D/g, '');
    if (!cnpjNumerico || cnpjNumerico.length !== 14) {
      return;
    }

    const alias = getCorpxAliasByCnpj(cnpjNumerico);
    if (!alias) {
      setError('Conta sem alias CorpX v2 configurado');
      setSaldo(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await CorpXService.consultarSaldo(alias, { signal: controller.signal });
      
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
    const cnpjNumerico = (cnpj || '').replace(/\D/g, '');
    if (cnpjNumerico.length === 14) {
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    saldo,
    isLoading,
    error,
    refresh,
    lastUpdated
  };
}
