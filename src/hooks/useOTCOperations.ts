import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  OTCOperation, 
  CreateOTCOperationRequest,
  OTCOperationsParams 
} from '@/types/otc';
import { otcService } from '@/services/otc';
import { OTC_CLIENTS_QUERY_KEY } from './useOTCClients';

// Chaves para cache do React Query
export const OTC_OPERATIONS_QUERY_KEY = 'otc-operations';

/**
 * Hook para gerenciar operações OTC
 */
export function useOTCOperations(params: OTCOperationsParams = {}) {
  const queryClient = useQueryClient();

  // Query para listar operações
  const {
    data: operationsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [OTC_OPERATIONS_QUERY_KEY, params],
    queryFn: () => otcService.getOperations(params),
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar operações OTC', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  // Mutation para criar operação
  const createOperationMutation = useMutation({
    mutationFn: (operationData: CreateOTCOperationRequest) => otcService.createOperation(operationData),
    onSuccess: (data) => {
      console.log('[OTC-OPERATIONS] Operação criada:', data.data?.operation_type);
      
      // Invalidar cache das operações, clientes, statement e balances
      queryClient.invalidateQueries({ queryKey: [OTC_OPERATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [OTC_CLIENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['otc-client'] }); // Cliente individual
      queryClient.invalidateQueries({ queryKey: ['otc-statement'] });
      queryClient.invalidateQueries({ queryKey: ['otc-balance'] });
      queryClient.invalidateQueries({ queryKey: ['otc-conversions'] }); // Histórico de conversões
      
      // ✅ REMOVIDO RELOAD FORÇADO - invalidação de cache já atualiza os dados
      
      const operationType = data.data?.operation_type || 'desconhecida';
      const operationLabels = {
        credit: 'Crédito',
        debit: 'Débito',
        convert: 'Conversão',
        lock: 'Bloqueio',
        unlock: 'Desbloqueio',
        note: 'Anotação'
      };
      

      
      toast.success('Operação realizada com sucesso', {
        description: `${operationLabels[operationType as keyof typeof operationLabels] || 'Operação'} executada no cliente ${data.data?.client_name || 'desconhecido'}`
      });
    },
    onError: (error: any) => {
      console.error('[OTC-OPERATIONS] ===== ERRO NA OPERAÇÃO =====');
      console.error('[OTC-OPERATIONS] Erro completo:', error);
      console.error('[OTC-OPERATIONS] Response data:', error.response?.data);
      console.error('[OTC-OPERATIONS] Status:', error.response?.status);
      
      toast.error('Erro ao executar operação OTC', {
        description: error.response?.data?.message || error.message || 'Falha na operação'
      });
    }
  });

  // Função para invalidar cache manualmente
  const invalidateOperations = () => {
    queryClient.invalidateQueries({ queryKey: [OTC_OPERATIONS_QUERY_KEY] });
  };

  return {
    // Dados
    operations: operationsData?.data || [],
    
    // Estados
    isLoading,
    error,
    
    // Mutations
    createOperation: createOperationMutation.mutate,
    
    // Estados das mutations
    isCreating: createOperationMutation.isLoading,
    
    // Funções utilitárias
    refetch,
    invalidateOperations
  };
}

/**
 * Hook para operações de um cliente específico
 */
export function useOTCClientOperations(clientId: number) {
  return useOTCOperations({ otc_client_id: clientId });
} 