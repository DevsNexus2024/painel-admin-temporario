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
      console.warn('[useExtrato] Erro ao obter conta ativa, usando fallback');
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
            console.log('🔄 [useExtrato-SEGURO] Detectada mudança de conta (NOVA ARQUITETURA):', {
              anterior: accountKey,
              atual: newKey,
              conta: activeAccount.displayName,
              provider: activeAccount.provider
            });
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
            console.log('🔄 [useExtrato-SEGURO] Detectada mudança de conta (FALLBACK):', {
              anterior: accountKey,
              atual: fallbackKey,
              conta: currentAccount.displayName,
              provider: currentAccount.provider
            });
            setAccountKey(fallbackKey);
          }
        }
      } catch (error) {
        console.error('[useExtrato] Erro ao verificar mudança de conta:', error);
      }
    };

    // Verificar mudança de conta a cada segundo
    const interval = setInterval(checkAccountChange, 1000);
    
    return () => clearInterval(interval);
  }, [accountKey]);

  // 🚨 OBTER PROVIDER SEGURO
  const getProviderSeguro = (): 'bmp' | 'bitso' => {
    try {
      // 1. Tentar nova arquitetura primeiro
      const activeAccount = unifiedBankingService.getActiveAccount();
      if (activeAccount && (activeAccount.provider === 'bmp' || activeAccount.provider === 'bitso')) {
        console.log(`🔒 [useExtrato-SEGURO] Provider da NOVA ARQUITETURA: ${activeAccount.provider}`);
        return activeAccount.provider as 'bmp' | 'bitso';
      }

      // 2. Fallback para sistema antigo
      const apiRouter = (window as any).apiRouter;
      if (apiRouter) {
        const currentAccount = apiRouter.getCurrentAccount();
        if (currentAccount.provider === 'bmp' || currentAccount.provider === 'bitso') {
          console.log(`🔒 [useExtrato-SEGURO] Provider do SISTEMA ANTIGO: ${currentAccount.provider}`);
          return currentAccount.provider as 'bmp' | 'bitso';
        }
      }

      // 3. Último recurso: extrair do accountKey
      if (accountKey.includes('bmp')) {
        console.log(`🔒 [useExtrato-SEGURO] Provider do ACCOUNT KEY: bmp`);
        return 'bmp';
      }
      if (accountKey.includes('bitso')) {
        console.log(`🔒 [useExtrato-SEGURO] Provider do ACCOUNT KEY: bitso`);
        return 'bitso';
      }

      // 4. Padrão seguro: BMP
      console.warn(`⚠️ [useExtrato-SEGURO] Nenhum provider detectado, usando BMP como padrão`);
      return 'bmp';
      
    } catch (error) {
      console.error('🚨 [useExtrato-SEGURO] Erro ao obter provider, usando BMP:', error);
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
      
      console.log('🔥 [useExtrato-SEGURO] Executando consultarExtrato ULTRA-SEGURO:', {
        accountKey,
        provider: provider,
        filtros: filtrosComProvider,
        timestamp: new Date().toISOString()
      });
      
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
    filtros: { cursor: 0 },
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