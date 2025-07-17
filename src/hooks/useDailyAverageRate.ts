import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { otcService } from '@/services/otc';

// Chave para cache do React Query
export const DAILY_AVERAGE_RATE_QUERY_KEY = 'daily-average-rate';

interface UseDailyAverageRateParams {
  enabled?: boolean;
}

/**
 * Hook para obter média diária das conversões
 */
export function useDailyAverageRate(params: UseDailyAverageRateParams = {}) {
  const { 
    enabled = true 
  } = params;

  const {
    data: averageRateData,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: [DAILY_AVERAGE_RATE_QUERY_KEY],
    queryFn: () => otcService.getDailyAverageRate(),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados do banco
    gcTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false,
    refetchInterval: 2 * 60 * 1000, // Atualizar a cada 2 minutos
    retry: 2
  });

  // Extrair dados da resposta
  const averageRate = (averageRateData as any)?.data?.average_rate || 0;
  const conversionsCount = (averageRateData as any)?.data?.conversions_count || 0;
  const totalBrlConverted = (averageRateData as any)?.data?.total_brl_converted || 0;
  const totalUsdReceived = (averageRateData as any)?.data?.total_usd_received || 0;
  const calculatedAt = (averageRateData as any)?.data?.calculated_at;

  // Função para forçar atualização
  const refreshRate = () => {
    refetch();
    toast.info('Atualizando média das cotações...');
  };

  // Função para formatar a taxa
  const formatRate = (rate: number) => {
    return rate.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  };

  return {
    // Dados
    averageRate,
    conversionsCount,
    totalBrlConverted,
    totalUsdReceived,
    calculatedAt,
    isSuccess: !!(averageRateData as any)?.success,
    
    // Estados de loading
    isLoading,
    isRefetching,
    
    // Ações
    refreshRate,
    
    // Utilidades
    formatRate,
    
    // Para debug
    error,
    rawData: averageRateData
  };
}

/**
 * Hook simplificado para apenas obter a taxa média atual
 */
export function useCurrentAverageRate() {
  const { averageRate, isLoading, refreshRate, formatRate } = useDailyAverageRate({
    enabled: true
  });

  return {
    rate: averageRate,
    formattedRate: formatRate(averageRate),
    isLoading,
    refresh: refreshRate
  };
} 