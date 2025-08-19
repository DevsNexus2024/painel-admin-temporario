import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
// ✅ CORRIGIDO: Usar sistema unificado ao invés do serviço antigo
import { getBalance, unifiedBankingService } from '@/services/banking';
import type { StandardBalance } from '@/services/banking/types';

export interface UseSaldoOptions {
  enabled?: boolean;
  staleTime?: number;
}

export const useSaldo = (options: UseSaldoOptions = {}) => {
  const { 
    enabled = true, 
    staleTime = 2 * 60 * 1000
  } = options;

  // ✅ Detectar mudanças de conta ativa para invalidar cache
  const [accountKey, setAccountKey] = useState(() => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      return activeAccount ? `${activeAccount.id}-${activeAccount.provider}` : 'no-account';
    } catch (error) {
      return 'fallback-account';
    }
  });

  // ✅ Monitorar mudanças de conta
  useEffect(() => {
    const checkAccountChange = () => {
      try {
        const activeAccount = unifiedBankingService.getActiveAccount();
        const newKey = activeAccount ? `${activeAccount.id}-${activeAccount.provider}` : 'no-account';
        
        if (newKey !== accountKey) {
          setAccountKey(newKey);
        }
      } catch (error) {
        // Silenciar erros em produção
      }
    };

    // Verificar mudanças a cada 300ms
    const interval = setInterval(checkAccountChange, 300);
    
    // Verificar imediatamente também
    checkAccountChange();
    
    return () => clearInterval(interval);
  }, [accountKey]);

  return useQuery<StandardBalance, Error>({
    queryKey: ['saldo-unified', accountKey],
    queryFn: getBalance,
    enabled,
    staleTime,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}; 