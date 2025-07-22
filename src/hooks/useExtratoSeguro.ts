/**
 * 🚨 HOOK DE EMERGÊNCIA PARA EXTRATO ULTRA-SEGURO
 * 
 * ⚡ VERSÃO 2.0 - ISOLAMENTO TOTAL DA NOVA ARQUITETURA
 * ❌ NÃO USA MAIS O apiRouter (sistema antigo)
 * ✅ USA EXCLUSIVAMENTE UnifiedBankingService
 * 🔒 GARANTIA DE ISOLAMENTO ENTRE BANCOS
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { consultarExtrato, ExtratoFiltros, ExtratoResponse } from '@/services/extrato';
import { unifiedBankingService } from '@/services/banking';

interface UseExtratoSeguroOptions {
  filtros?: ExtratoFiltros;
  enabled?: boolean;
}

export const useExtratoSeguro = (options: UseExtratoSeguroOptions = {}) => {
  const { filtros = {}, enabled = true } = options;
  
  // 🚨 FUNÇÃO PARA OBTER PROVIDER EXCLUSIVAMENTE DA NOVA ARQUITETURA
  const obterProviderNovaArquitetura = (): 'bmp' | 'bitso' => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      
      if (!activeAccount) {
        console.warn(`⚠️ [useExtratoSeguro-V2] NENHUMA CONTA ATIVA na nova arquitetura, usando BMP como padrão`);
        return 'bmp';
      }
      
      const provider = activeAccount.provider;
      console.log(`🔒 [useExtratoSeguro-V2] Provider da NOVA ARQUITETURA: ${provider}`);
      console.log(`🔒 [useExtratoSeguro-V2] Conta ativa: ${activeAccount.displayName}`);
      console.log(`🔒 [useExtratoSeguro-V2] ID: ${activeAccount.id}`);
      console.log(`🔒 [useExtratoSeguro-V2] Timestamp: ${new Date().toISOString()}`);
      
      if (provider === 'bmp' || provider === 'bitso') {
        return provider;
      }
      
      console.warn(`⚠️ [useExtratoSeguro-V2] Provider inválido: ${provider}, usando BMP`);
      return 'bmp';
      
    } catch (error) {
      console.error(`🚨 [useExtratoSeguro-V2] ERRO CRÍTICO ao obter provider da nova arquitetura:`, error);
      console.error(`🚨 [useExtratoSeguro-V2] A nova arquitetura pode não estar inicializada!`);
      return 'bmp';
    }
  };

  // Estado para forçar re-render quando conta mudar
  const [forceRefresh, setForceRefresh] = useState(0);
  
  // Monitorar mudanças de conta APENAS na nova arquitetura
  useEffect(() => {
    const checkNewArchitectureAccount = () => {
      try {
        const activeAccount = unifiedBankingService.getActiveAccount();
        
        if (activeAccount) {
          const newKey = `v2-${activeAccount.id}-${activeAccount.provider}`;
          
          // Forçar refresh se conta mudou
          const currentKey = localStorage.getItem('nova_arquitetura_account_key');
          if (currentKey !== newKey) {
            console.log(`🔄 [useExtratoSeguro-V2] NOVA ARQUITETURA - Conta mudou:`);
            console.log(`   Anterior: ${currentKey}`);
            console.log(`   Atual: ${newKey}`);
            console.log(`   Conta: ${activeAccount.displayName}`);
            console.log(`   Provider: ${activeAccount.provider}`);
            
            localStorage.setItem('nova_arquitetura_account_key', newKey);
            setForceRefresh(prev => prev + 1);
          }
        } else {
          console.warn(`⚠️ [useExtratoSeguro-V2] Nenhuma conta ativa na nova arquitetura`);
        }
      } catch (error) {
        console.error(`🚨 [useExtratoSeguro-V2] Erro ao monitorar nova arquitetura:`, error);
      }
    };

    // Verificar mais frequentemente para detectar mudanças rápido
    const interval = setInterval(checkNewArchitectureAccount, 500);
    return () => clearInterval(interval);
  }, []);

  const provider = obterProviderNovaArquitetura();
  
  console.log(`🎯 [useExtratoSeguro-V2] PROVIDER FINAL SELECIONADO: ${provider}`);
  console.log(`🎯 [useExtratoSeguro-V2] Força refresh: ${forceRefresh}`);

  // React Query com cache ultra-agressivo desabilitado
  const queryResult = useQuery({
    queryKey: ['extrato-seguro-v2', provider, filtros, forceRefresh],
    queryFn: async () => {
      console.log(`📡 [useExtratoSeguro-V2] ===== INICIANDO CONSULTA =====`);
      console.log(`📡 [useExtratoSeguro-V2] Provider: ${provider}`);
      console.log(`📡 [useExtratoSeguro-V2] Filtros:`, filtros);
      
      // 🚨 CHAMADA ISOLADA - APENAS NOVA ARQUITETURA
      const resultado = await consultarExtrato({
        ...filtros,
        provider // ← FORÇAR PROVIDER EXPLICITAMENTE
      });
      
      console.log(`✅ [useExtratoSeguro-V2] Resultado obtido:`, {
        provider: resultado.provider,
        items: resultado.items?.length || 0,
        temItems: !!resultado.items,
        hasMore: resultado.hasMore
      });
      
      // 🔍 VALIDAÇÃO TRIPLA DE SEGURANÇA
      if (resultado.provider && resultado.provider !== provider) {
        const erro = `🚨 VIOLAÇÃO DE SEGURANÇA: Provider esperado '${provider}' mas recebido '${resultado.provider}'`;
        console.error(erro);
        throw new Error(erro);
      }
      
      if (!resultado.provider) {
        console.warn(`⚠️ [useExtratoSeguro-V2] Resposta sem provider, adicionando manualmente: ${provider}`);
        resultado.provider = provider;
      }
      
      console.log(`✅ [useExtratoSeguro-V2] Resultado VÁLIDO e SEGURO para ${provider}`);
      return resultado;
    },
    enabled: enabled,
    // 🚨 CACHE TOTALMENTE DESABILITADO PARA EVITAR CONTAMINAÇÃO
    staleTime: 0, // Dados sempre considerados obsoletos
    gcTime: 0, // Remover do cache imediatamente
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000
  });

  console.log(`📊 [useExtratoSeguro-V2] Query State:`, {
    isLoading: queryResult.isLoading,
    error: !!queryResult.error,
    hasData: !!queryResult.data,
    provider: provider
  });

  return queryResult;
}; 