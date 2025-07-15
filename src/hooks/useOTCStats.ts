import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OTCStats } from '@/types/otc';
import { otcService } from '@/services/otc';

// Chaves para cache do React Query
export const OTC_STATS_QUERY_KEY = 'otc-stats';

/**
 * Hook para gerenciar estatísticas OTC
 */
export function useOTCStats() {
  const {
    data: statsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [OTC_STATS_QUERY_KEY],
    queryFn: () => otcService.getStats(),
    staleTime: 60 * 1000, // 1 minuto
    cacheTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Atualizar a cada minuto
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar estatísticas OTC', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  const defaultStats: OTCStats = {
    clientes: {
      total: 0,
      ativos: 0,
      inativos: 0
    },
    transacoes: {
      total: 0,
      hoje: 0
    },
    valores: {
      total_depositos: 0,
      total_saques: 0,
      saldo_total: 0
    }
  };

  return {
    // Dados
    stats: statsData?.data || defaultStats,
    
    // Estados
    isLoading,
    error,
    
    // Funções utilitárias
    refetch
  };
} 