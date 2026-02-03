import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CashClosureListParams,
  CashClosureSummary,
} from '@/types/cash-closure';
import { cashClosureService } from '@/services/cash-closure';

// Chaves para cache do React Query
export const CASH_CLOSURE_QUERY_KEYS = {
  closures: (params: CashClosureListParams) => ['cash-closure', 'closures', params],
  summary: (params: { startDate?: string; endDate?: string; taxDocument?: string }) => ['cash-closure', 'summary', params],
  detail: (id: string) => ['cash-closure', 'detail', id],
  dailyEvolution: (params: { startDate?: string; endDate?: string; taxDocument?: string }) => 
    ['cash-closure', 'daily-evolution', params],
  accounts: () => ['cash-closure', 'accounts'],
};

/**
 * Hook para listar fechamentos de caixa
 */
export function useCashClosures(params: CashClosureListParams = {}) {
  return useQuery({
    queryKey: CASH_CLOSURE_QUERY_KEYS.closures(params),
    queryFn: () => cashClosureService.listClosures(params),
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar fechamentos', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });
}

/**
 * Hook para obter resumo do período
 */
export function useCashClosureSummary(params: { startDate?: string; endDate?: string; taxDocument?: string } = {}) {
  return useQuery({
    queryKey: CASH_CLOSURE_QUERY_KEYS.summary(params),
    queryFn: () => cashClosureService.getSummary(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar resumo', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });
}

/**
 * Hook para obter detalhes de um fechamento
 */
export function useCashClosureDetail(id: string) {
  return useQuery({
    queryKey: CASH_CLOSURE_QUERY_KEYS.detail(id),
    queryFn: () => cashClosureService.getClosureById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar detalhes', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });
}

/**
 * Hook para obter dados de evolução diária (gráfico)
 */
export function useCashClosureDailyEvolution(params: {
  startDate?: string;
  endDate?: string;
  taxDocument?: string;
} = {}) {
  return useQuery({
    queryKey: CASH_CLOSURE_QUERY_KEYS.dailyEvolution(params),
    queryFn: () => cashClosureService.getDailyEvolution(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar evolução diária', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });
}

/**
 * Hook para listar contas disponíveis
 */
export function useCashClosureAccounts() {
  return useQuery({
    queryKey: CASH_CLOSURE_QUERY_KEYS.accounts(),
    queryFn: () => cashClosureService.getAccounts(),
    staleTime: 5 * 60 * 1000, // 5 minutos (contas mudam pouco)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar contas', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });
}
