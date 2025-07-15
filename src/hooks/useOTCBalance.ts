import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OTCBalance } from '@/types/otc';
import { otcService } from '@/services/otc';

// Chaves para cache do React Query
export const OTC_BALANCE_QUERY_KEY = 'otc-balance';

/**
 * Hook para gerenciar saldo de cliente OTC
 */
export function useOTCBalance(clientId: number) {
  const {
    data: balanceData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [OTC_BALANCE_QUERY_KEY, clientId],
    queryFn: () => otcService.getClientBalance(clientId),
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar saldo do cliente', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  const defaultBalance: OTCBalance = {
    client_id: clientId,
    client_name: '',
    current_balance: 0,
    last_updated: new Date().toISOString()
  };

  return {
    // Dados
    balance: balanceData?.data || defaultBalance,
    
    // Estados
    isLoading,
    error,
    
    // Funções utilitárias
    refetch
  };
} 