import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OTCConversionsResponse, OTCConversion, OTCStatementParams } from '@/types/otc';
import { otcService } from '@/services/otc';

const OTC_CONVERSIONS_QUERY_KEY = 'otc-conversions';

export interface UseOTCConversionsParams extends OTCStatementParams {
  clientId: number;
}

/**
 * Hook para gerenciar conversões de cliente OTC
 */
export function useOTCConversions(params: UseOTCConversionsParams) {
  const { clientId, page = 1, limit = 50, dateFrom, dateTo } = params;

  const {
    data: conversionsData,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: [OTC_CONVERSIONS_QUERY_KEY, clientId, page, limit, dateFrom, dateTo],
    queryFn: () => otcService.getConversionHistory(clientId, { page, limit, dateFrom, dateTo }),
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar histórico de conversões', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  // Valores padrão
  const defaultResponse: OTCConversionsResponse = {
    success: false,
    data: {
      conversions: [],
      pagination: {
        current_page: 1,
        total_pages: 0,
        total_items: 0,
        items_per_page: limit
      }
    }
  };

  const conversions = conversionsData?.data?.conversions || [];
  const pagination = conversionsData?.data?.pagination || defaultResponse.data.pagination;

  // Estatísticas calculadas
  const stats = {
    totalConversions: pagination.total_items,
    totalBrlConverted: conversions.reduce((sum, conv) => sum + conv.brl_amount, 0),
    totalUsdReceived: conversions.reduce((sum, conv) => sum + conv.usd_amount, 0),
    averageRate: conversions.length > 0 
      ? conversions.reduce((sum, conv) => sum + conv.conversion_rate, 0) / conversions.length 
      : 0,
    lastConversion: conversions.length > 0 ? conversions[0] : null
  };

  // Função para filtrar por período
  const filterByDateRange = (startDate: string, endDate: string) => {
    return refetch();
  };

  // Função para navegar entre páginas
  const goToPage = (newPage: number) => {
    // Será implementado quando integrado com o componente que usa este hook
    return refetch();
  };

  return {
    // Dados
    conversions,
    pagination,
    stats,
    
    // Estados
    isLoading,
    isRefetching,
    error,
    
    // Funções utilitárias
    refetch,
    filterByDateRange,
    goToPage,
    
    // Helpers
    isEmpty: conversions.length === 0,
    hasError: !!error,
    hasData: conversions.length > 0
  };
}

// Hook simplificado para obter apenas as estatísticas
export function useOTCConversionsStats(clientId: number) {
  const { stats, isLoading, error } = useOTCConversions({ 
    clientId, 
    limit: 100 // Buscar mais registros para estatísticas mais precisas
  });
  
  return {
    stats,
    isLoading,
    error
  };
} 