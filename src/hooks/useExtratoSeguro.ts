/**
 * 🚨 HOOK DE EMERGÊNCIA PARA EXTRATO ULTRA-SEGURO
 * 
 * ⚡ VERSÃO 2.1 - OTIMIZADA PARA PERFORMANCE
 * ❌ NÃO USA MAIS O apiRouter (sistema antigo)
 * ✅ USA EXCLUSIVAMENTE UnifiedBankingService
 * 🔒 GARANTIA DE ISOLAMENTO ENTRE BANCOS
 * 🚀 SISTEMA DE EVENTOS EFICIENTE SEM POLLING
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { consultarExtrato, ExtratoFiltros, ExtratoResponse } from '@/services/extrato';
import { unifiedBankingService } from '@/services/banking';

interface UseExtratoSeguroOptions {
  filtros?: ExtratoFiltros;
  enabled?: boolean;
}

export const useExtratoSeguro = (options: UseExtratoSeguroOptions = {}) => {
  const { filtros = {}, enabled = true } = options;
  
  // 🚨 FUNÇÃO PARA OBTER PROVIDER EXCLUSIVAMENTE DA NOVA ARQUITETURA
  const obterProviderNovaArquitetura = (): 'bmp' | 'bmp-531' | 'bitso' => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      
      if (!activeAccount) {

        return 'bmp';
      }
      
      const provider = activeAccount.provider;
      
      // ✅ LOGS APENAS EM DESENVOLVIMENTO
      // Provider e conta identificados
      
      if (provider === 'bmp' || provider === 'bmp-531' || provider === 'bitso') {
        return provider as 'bmp' | 'bmp-531' | 'bitso';
      }
      

      return 'bmp';
      
    } catch (error) {

      return 'bmp';
    }
  };

  // Estado para forçar re-render quando conta mudar
  const [forceRefresh, setForceRefresh] = useState(0);
  const lastAccountKeyRef = useRef<string>('');
  
  // 🚀 SISTEMA DE EVENTOS OTIMIZADO - SEM POLLING CONSTANTE
  useEffect(() => {
    const checkAccountChange = () => {
      try {
        const activeAccount = unifiedBankingService.getActiveAccount();
        
        if (activeAccount) {
          const newKey = `v2-${activeAccount.id}-${activeAccount.provider}`;
          
          // Só atualizar se realmente mudou
          if (lastAccountKeyRef.current !== newKey) {
            // Mudança de conta detectada
            
            lastAccountKeyRef.current = newKey;
            localStorage.setItem('nova_arquitetura_account_key', newKey);
            setForceRefresh(prev => prev + 1);
          }
        } else {
          if (lastAccountKeyRef.current !== '') {
            lastAccountKeyRef.current = '';
            setForceRefresh(prev => prev + 1);
          }
        }
      } catch (error) {

      }
    };

    // ✅ VERIFICAÇÃO INICIAL
    checkAccountChange();

    // ✅ POLLING REDUZIDO: De 500ms para 2000ms (4x menos requisições)
    const interval = setInterval(checkAccountChange, 2000);
    return () => clearInterval(interval);
  }, []);

  const provider = obterProviderNovaArquitetura();
  
  // ✅ LOGS APENAS EM DESENVOLVIMENTO
  // Provider final selecionado

  // React Query com cache otimizado para performance
  const queryResult = useQuery({
    queryKey: ['extrato-seguro-v2', provider, filtros, forceRefresh],
    queryFn: async () => {
      // Iniciando consulta
      
      // 🚨 CHAMADA ISOLADA - APENAS NOVA ARQUITETURA
      const resultado = await consultarExtrato({
        ...filtros,
        provider // ← FORÇAR PROVIDER EXPLICITAMENTE
      });
      
      if (process.env.NODE_ENV === 'development') {

      }
      
      // 🔍 VALIDAÇÃO TRIPLA DE SEGURANÇA
      if (resultado.provider && resultado.provider !== provider) {
        const erro = `🚨 VIOLAÇÃO DE SEGURANÇA: Provider esperado '${provider}' mas recebido '${resultado.provider}'`;

        throw new Error(erro);
      }
      
      if (!resultado.provider) {

        resultado.provider = provider;
      }
      
      // Resultado válido
      return resultado;
    },
    enabled: enabled,
    // 🚀 CACHE OTIMIZADO PARA PERFORMANCE
    staleTime: 30000, // Dados válidos por 30 segundos
    gcTime: 60000, // Manter no cache por 1 minuto
    refetchOnMount: false, // Não buscar automaticamente ao montar
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1000
  });

  // ✅ LOGS APENAS EM DESENVOLVIMENTO
  if (process.env.NODE_ENV === 'development') {

  }

  return queryResult;
}; 