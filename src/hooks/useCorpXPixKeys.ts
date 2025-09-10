// hooks/useCorpXPixKeys.ts - Hook para gerenciar chaves PIX CorpX
// Baseado no padrão usePixKeys existente

import { useState, useCallback, useEffect } from 'react';
import { CorpXService } from '@/services/corpx';
import type { 
  CorpXPixKeysResponse, 
  CorpXPixKey, 
  CorpXCreatePixKeyRequest, 
  CorpXDeletePixKeyRequest,
  CorpXPixKeyType 
} from '@/types/corpx';

interface UseCorpXPixKeysOptions {
  cnpj: string;
  autoLoad?: boolean;
}

interface UseCorpXPixKeysState {
  chaves: CorpXPixKey[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hasData: boolean;
}

interface UseCorpXPixKeysReturn extends UseCorpXPixKeysState {
  refresh: () => Promise<void>;
  criarChave: (tipo: CorpXPixKeyType, chave: string) => Promise<boolean>;
  cancelarChave: (chave: string) => Promise<boolean>;
  clearError: () => void;
  getChavesByType: (type: string) => CorpXPixKey[];
  hasChaveType: (type: string) => boolean;
}

export function useCorpXPixKeys({
  cnpj,
  autoLoad = true
}: UseCorpXPixKeysOptions): UseCorpXPixKeysReturn {
  const [state, setState] = useState<UseCorpXPixKeysState>({
    chaves: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    hasData: false
  });

  const loadChaves = useCallback(async () => {
    if (!cnpj) {
      //console.warn('[useCorpXPixKeys] CNPJ não fornecido');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      //console.log('[useCorpXPixKeys] Carregando chaves PIX...', cnpj);
      
      const response = await CorpXService.listarChavesPix(cnpj);
      
      if (response?.erro) {
        setState(prev => ({
          ...prev,
          error: 'Erro ao carregar chaves PIX CORPX',
          isLoading: false,
          hasData: false
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        chaves: response?.chaves || [],
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        hasData: (response?.chaves?.length || 0) > 0
      }));

      //console.log('[useCorpXPixKeys] Chaves carregadas:', response);
      
    } catch (err: any) {
      //console.error('[useCorpXPixKeys] Erro:', err);
      setState(prev => ({
        ...prev,
        error: CorpXService.tratarErro(err),
        isLoading: false,
        hasData: false
      }));
    }
  }, [cnpj]);

  const refresh = useCallback(async () => {
    await loadChaves();
  }, [loadChaves]);

  const criarChave = useCallback(async (tipo: CorpXPixKeyType, chave: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      //console.log('[useCorpXPixKeys] Criando chave PIX...', { tipo, chave });
      
      const dados: CorpXCreatePixKeyRequest = {
        tax_document: cnpj,
        tipo,
        key: CorpXService.formatarChavePix(chave, tipo)
      };
      
      const response = await CorpXService.criarChavePix(dados);
      
      if (response?.erro) {
        setState(prev => ({
          ...prev,
          error: response.message || 'Erro ao criar chave PIX',
          isLoading: false
        }));
        return false;
      }

      // Recarregar lista após criação
      await loadChaves();
      
      //console.log('[useCorpXPixKeys] Chave criada com sucesso');
      return true;
      
    } catch (err: any) {
      //console.error('[useCorpXPixKeys] Erro ao criar chave:', err);
      setState(prev => ({
        ...prev,
        error: CorpXService.tratarErro(err),
        isLoading: false
      }));
      return false;
    }
  }, [cnpj, loadChaves]);

  const cancelarChave = useCallback(async (chave: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      //console.log('[useCorpXPixKeys] Cancelando chave PIX...', chave);
      
      const dados: CorpXDeletePixKeyRequest = {
        tax_document: cnpj,
        key: chave
      };
      
      const response = await CorpXService.cancelarChavePix(dados);
      
      if (response?.erro) {
        setState(prev => ({
          ...prev,
          error: response.message || 'Erro ao cancelar chave PIX',
          isLoading: false
        }));
        return false;
      }

      // Recarregar lista após cancelamento
      await loadChaves();
      
      //console.log('[useCorpXPixKeys] Chave cancelada com sucesso');
      return true;
      
    } catch (err: any) {
      //console.error('[useCorpXPixKeys] Erro ao cancelar chave:', err);
      setState(prev => ({
        ...prev,
        error: CorpXService.tratarErro(err),
        isLoading: false
      }));
      return false;
    }
  }, [cnpj, loadChaves]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Helpers para filtrar chaves
  const getChavesByType = useCallback((type: string) => {
    return state.chaves.filter(chave => chave.type === type);
  }, [state.chaves]);

  const hasChaveType = useCallback((type: string) => {
    return state.chaves.some(chave => chave.type === type);
  }, [state.chaves]);

  // Load inicial
  useEffect(() => {
    if (autoLoad && cnpj) {
      loadChaves();
    }
  }, [autoLoad, cnpj, loadChaves]);

  return {
    ...state,
    refresh,
    criarChave,
    cancelarChave,
    clearError,
    getChavesByType,
    hasChaveType
  };
}
