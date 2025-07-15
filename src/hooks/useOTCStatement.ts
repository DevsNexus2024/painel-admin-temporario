import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OTCStatement, OTCStatementParams } from '@/types/otc';
import { otcService } from '@/services/otc';

// Chaves para cache do React Query
export const OTC_STATEMENT_QUERY_KEY = 'otc-statement';

/**
 * Hook para gerenciar extrato de cliente OTC
 */
export function useOTCStatement(clientId: number, params: OTCStatementParams = {}) {
  const {
    data: statementData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [OTC_STATEMENT_QUERY_KEY, clientId, params],
    queryFn: () => otcService.getClientStatement(clientId, params),
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar extrato do cliente', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  const defaultStatement: OTCStatement = {
    cliente: {
      id: clientId,
      name: '',
      document: '',
      pix_key: '',
      current_balance: 0,
      last_updated: new Date().toISOString()
    },
    transacoes: [],
    historico_saldo: [],
    paginacao: {
      page: 1,
      limit: 50,
      total: 0,
      total_pages: 0
    }
  };

  return {
    // Dados
    statement: statementData?.data || defaultStatement,
    
    // Estados
    isLoading,
    error,
    
    // Funções utilitárias
    refetch
  };
} 