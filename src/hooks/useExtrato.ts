import { useQuery } from '@tanstack/react-query';
import { consultarExtrato, ExtratoFiltros, ExtratoResponse } from '@/services/extrato';

export interface UseExtratoOptions {
  filtros?: ExtratoFiltros;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export const useExtrato = (options: UseExtratoOptions = {}) => {
  const { 
    filtros = {}, 
    enabled = true, 
    staleTime = 5 * 60 * 1000, // 5 minutos
    cacheTime = 10 * 60 * 1000 // 10 minutos
  } = options;

  return useQuery<ExtratoResponse, Error>({
    queryKey: ['extrato', filtros],
    queryFn: () => consultarExtrato(filtros),
    enabled,
    staleTime: 0, // Sempre buscar dados frescos
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