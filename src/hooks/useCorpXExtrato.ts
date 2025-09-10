// hooks/useCorpXExtrato.ts - Hook para extrato CorpX com paginação
// Compatível com o padrão do projeto

import { useState, useCallback, useEffect } from 'react';
import { CorpXService } from '@/services/corpx';
import type { CorpXExtratoResponse, CorpXExtratoParams, CorpXExtratoTransaction } from '@/types/corpx';

interface UseCorpXExtratoOptions {
  cnpj: string;
  initialPage?: number;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  autoLoad?: boolean;
}

interface UseCorpXExtratoState {
  transactions: CorpXExtratoTransaction[];
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hasData: boolean;
}

interface UseCorpXExtratoReturn extends UseCorpXExtratoState {
  loadPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  refresh: () => Promise<void>;
  updateDateRange: (dataInicio?: string, dataFim?: string) => Promise<void>;
  clearError: () => void;
}

export function useCorpXExtrato({
  cnpj,
  initialPage = 1,
  dataInicio,
  dataFim,
  autoLoad = true
}: UseCorpXExtratoOptions): UseCorpXExtratoReturn {
  const [state, setState] = useState<UseCorpXExtratoState>({
    transactions: [],
    currentPage: initialPage,
    totalPages: 1,
    isLoading: false,
    error: null,
    lastUpdated: null,
    hasData: false
  });

  const loadExtrato = useCallback(async (params: CorpXExtratoParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      //console.log('[useCorpXExtrato] Carregando extrato...', params);
      
      const response = await CorpXService.consultarExtrato(params);
      
      if (response?.erro) {
        setState(prev => ({
          ...prev,
          error: 'Erro ao carregar extrato CORPX',
          isLoading: false,
          hasData: false
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        transactions: response?.transactions || [],
        currentPage: response?.page || 1,
        totalPages: response?.totalPages || 1,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        hasData: (response?.transactions?.length || 0) > 0
      }));

      //console.log('[useCorpXExtrato] Extrato carregado:', response);
      
    } catch (err: any) {
      //console.error('[useCorpXExtrato] Erro:', err);
      setState(prev => ({
        ...prev,
        error: CorpXService.tratarErro(err),
        isLoading: false,
        hasData: false
      }));
    }
  }, []);

  const loadPage = useCallback(async (page: number) => {
    if (!cnpj) {
      //console.warn('[useCorpXExtrato] CNPJ não fornecido');
      return;
    }

    const params: CorpXExtratoParams = {
      cnpj,
      page,
      dataInicio,
      dataFim
    };

    await loadExtrato(params);
  }, [cnpj, dataInicio, dataFim, loadExtrato]);

  const nextPage = useCallback(async () => {
    if (state.currentPage < state.totalPages) {
      await loadPage(state.currentPage + 1);
    }
  }, [state.currentPage, state.totalPages, loadPage]);

  const prevPage = useCallback(async () => {
    if (state.currentPage > 1) {
      await loadPage(state.currentPage - 1);
    }
  }, [state.currentPage, loadPage]);

  const refresh = useCallback(async () => {
    await loadPage(state.currentPage);
  }, [state.currentPage, loadPage]);

  const updateDateRange = useCallback(async (novaDataInicio?: string, novaDataFim?: string) => {
    const params: CorpXExtratoParams = {
      cnpj,
      page: 1, // Reset para primeira página
      dataInicio: novaDataInicio,
      dataFim: novaDataFim
    };

    await loadExtrato(params);
  }, [cnpj, loadExtrato]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Load inicial
  useEffect(() => {
    if (autoLoad && cnpj) {
      loadPage(initialPage);
    }
  }, [autoLoad, cnpj, initialPage, loadPage]);

  // Reload quando as datas mudarem
  useEffect(() => {
    if (cnpj && state.hasData) {
      loadPage(1); // Reset para primeira página quando filtros mudarem
    }
  }, [dataInicio, dataFim]); // Não incluir loadPage nas dependências para evitar loop

  return {
    ...state,
    loadPage,
    nextPage,
    prevPage,
    refresh,
    updateDateRange,
    clearError
  };
}
