import { useState, useEffect, useCallback, useRef } from 'react';
import { consultarSaldoTCR } from '@/services/tcr';
import { TCR_CORPX_ALIAS } from '@/contexts/CorpXContext';
import type { CorpXSaldoResponse } from '@/types/corpx'; // Reutilizando os types

interface UseTCRSaldoOptions {
  /** @deprecated Usado apenas para compatibilidade. TCR usa TCR_CORPX_ALIAS (CorpX v2) */
  cnpj?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // em ms, default 30000 (30s)
}

interface UseTCRSaldoReturn {
  saldo: CorpXSaldoResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useTCRSaldo({
  cnpj,
  autoRefresh = false,
  refreshInterval = 30000
}: UseTCRSaldoOptions): UseTCRSaldoReturn {
  const [saldo, setSaldo] = useState<CorpXSaldoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // UseRef para controlar o interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  const fetchSaldo = useCallback(async () => {
    const alias = TCR_CORPX_ALIAS;
    if (!alias) {
      setError('Alias da conta TCR não configurado');
      return;
    }

    // ✅ Mostrar loading apenas no primeiro carregamento ou refresh manual
    if (isFirstLoad.current || !autoRefresh) {
      setIsLoading(true);
    }
    
    setError(null);

    try {
      //console.log('[TCR-SALDO-HOOK] 🔄 Consultando saldo para CNPJ:', cnpj);
      
      const resultado = await consultarSaldoTCR(alias);
      
      if (resultado) {
        if (resultado.erro) {
          setError('Erro ao consultar saldo TCR');
          setSaldo(null);
        } else {
          setSaldo(resultado);
          setLastUpdated(new Date());
          //console.log('[TCR-SALDO-HOOK] ✅ Saldo obtido:', resultado);
        }
      } else {
        setError('Erro de comunicação com a API');
        setSaldo(null);
      }
    } catch (err: any) {
      console.error('[TCR-SALDO-HOOK] ❌ Erro:', err);
      setError(err.message || 'Erro ao consultar saldo');
      setSaldo(null);
    } finally {
      setIsLoading(false);
      isFirstLoad.current = false;
    }
  }, [autoRefresh]);

  const refresh = useCallback(async () => {
    // Force loading quando é refresh manual
    isFirstLoad.current = true;
    await fetchSaldo();
  }, [fetchSaldo]);

  // ✅ Configurar auto-refresh se habilitado
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      // Limpar interval anterior se existir
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Configurar novo interval
      intervalRef.current = setInterval(() => {
        //console.log('[TCR-SALDO-HOOK] 🔄 Auto-refresh ativado');
        fetchSaldo();
      }, refreshInterval);

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchSaldo]);

  // Carregar saldo inicial ao montar o hook
  useEffect(() => {
    fetchSaldo();
  }, [fetchSaldo]);

  // ✅ Cleanup quando componente desmonta
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
