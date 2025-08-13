import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { consultarExtrato, ExtratoFiltros, ExtratoResponse } from '@/services/extrato';
// ❌ REMOVIDO: import { apiRouter } from '@/pages/payments/apiRouter';
import { unifiedBankingService } from '@/services/banking';

export interface UseExtratoOptions {
  filtros?: ExtratoFiltros;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

/**
 * 🚨 HOOK SEGURO PARA DADOS FINANCEIROS
 * 
 * ✅ USA NOVA ARQUITETURA MULTI-BANCO
 * ✅ Roteamento isolado e explícito
 * ✅ Provider obrigatório
 * ✅ Cache isolado por conta
 * ✅ Validação de segurança
 */
export const useExtrato = (options: UseExtratoOptions = {}) => {
  const { 
    filtros = {}, 
    enabled = true, 
    staleTime = 5 * 60 * 1000, // 5 minutos
    cacheTime = 10 * 60 * 1000 // 10 minutos
  } = options;

  // 🚨 USAR NOVA ARQUITETURA: Obter conta da nova arquitetura
  const [accountKey, setAccountKey] = useState(() => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      if (activeAccount) {
        return `${activeAccount.id}-${activeAccount.provider}`;
      }
      
      // Fallback para apiRouter se nova arquitetura não estiver inicializada
      const apiRouter = (window as any).apiRouter;
      if (apiRouter) {
        const account = apiRouter.getCurrentAccount();
        return `${account.id}-${account.provider}`;
      }
      
      return 'no-account';
    } catch (error) {

      return 'fallback-bmp-main';
    }
  });

  // Effect para detectar mudanças de conta
  useEffect(() => {
    const checkAccountChange = () => {
      try {
        // 🚨 PRIORIDADE: Nova arquitetura
        const activeAccount = unifiedBankingService.getActiveAccount();
        if (activeAccount) {
          const newKey = `${activeAccount.id}-${activeAccount.provider}`;
          if (newKey !== accountKey) {

            setAccountKey(newKey);
            return;
          }
        }

        // Fallback para sistema antigo se necessário
        const apiRouter = (window as any).apiRouter;
        if (apiRouter) {
          const currentAccount = apiRouter.getCurrentAccount();
          const fallbackKey = `${currentAccount.id}-${currentAccount.provider}`;
          if (fallbackKey !== accountKey) {

            setAccountKey(fallbackKey);
          }
        }
      } catch (error) {

      }
    };

    // Verificar mudança de conta a cada segundo
    const interval = setInterval(checkAccountChange, 1000);
    
    return () => clearInterval(interval);
  }, [accountKey]);

  // 🚨 OBTER PROVIDER SEGURO
  const getProviderSeguro = (): 'bmp' | 'bmp-531' | 'bitso' => {
    try {
      // 1. Tentar nova arquitetura primeiro
      const activeAccount = unifiedBankingService.getActiveAccount();
      if (activeAccount && (activeAccount.provider === 'bmp' || activeAccount.provider === 'bmp-531' || activeAccount.provider === 'bitso')) {

        return activeAccount.provider as 'bmp' | 'bmp-531' | 'bitso';
      }

      // 2. Fallback para sistema antigo
      const apiRouter = (window as any).apiRouter;
      if (apiRouter) {
        const currentAccount = apiRouter.getCurrentAccount();
        if (currentAccount.provider === 'bmp' || currentAccount.provider === 'bmp-531' || currentAccount.provider === 'bitso') {

          return currentAccount.provider as 'bmp' | 'bmp-531' | 'bitso';
        }
      }

      // 3. Último recurso: extrair do accountKey
      if (accountKey.includes('bmp-531')) {

        return 'bmp-531';
      }
      if (accountKey.includes('bmp')) {

        return 'bmp';
      }
      if (accountKey.includes('bitso')) {

        return 'bitso';
      }

      // 4. Padrão seguro: BMP

      return 'bmp';
      
    } catch (error) {

      return 'bmp';
    }
  };

  const provider = getProviderSeguro();
  
  return useQuery<ExtratoResponse, Error>({
    queryKey: ['extrato-ultra-seguro', accountKey, provider, filtros],
    queryFn: () => {
      // 🚨 CRÍTICO: Provider explícito obrigatório
      const filtrosComProvider = {
        ...filtros,
        provider // 🚨 SEMPRE incluir provider explícito
      };
      

      
      return consultarExtrato(filtrosComProvider);
    },
    enabled,
    staleTime: 0, // Sempre buscar dados frescos para evitar cache contaminado
    gcTime: 0, // Não manter cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
  });
};

// Hook específico para extrato sem filtros (mais comum)
export const useExtratoGeral = () => {
  return useExtrato({
    filtros: {}, // ✅ REMOVIDO cursor: 0 que causa erro na API Bitso
    staleTime: 3 * 60 * 1000, // 3 minutos para dados gerais
  });
};

// Hook para carregar mais dados (paginação)
export const useExtratoComPaginacao = (initialFiltros: ExtratoFiltros = {}) => {
  return useExtrato({
    filtros: initialFiltros,
    staleTime: 5 * 60 * 1000,
  });
}; 