import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  OTCClient, 
  OTCClientsParams, 
  CreateOTCClientRequest,
  CreateCompleteOTCClientRequest,
  OTCClientsResponse 
} from '@/types/otc';
import { otcService } from '@/services/otc';

// Chaves para cache do React Query
export const OTC_CLIENTS_QUERY_KEY = 'otc-clients';

/**
 * Hook para gerenciar clientes OTC
 */
export function useOTCClients(params: OTCClientsParams = {}) {
  const queryClient = useQueryClient();

  // Query para listar clientes
  const {
    data: clientsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [OTC_CLIENTS_QUERY_KEY, params],
    queryFn: () => otcService.getClients(params),
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error: any) => {
      toast.error('Erro ao carregar clientes OTC', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  // Mutation para criar cliente
  const createClientMutation = useMutation({
    mutationFn: ({ clientData, isComplete = false }: { 
      clientData: CreateOTCClientRequest | CreateCompleteOTCClientRequest; 
      isComplete?: boolean 
    }) => {
      if (isComplete) {
        return otcService.createCompleteClient(clientData as CreateCompleteOTCClientRequest);
      } else {
        return otcService.createClient(clientData as CreateOTCClientRequest);
      }
    },
    onSuccess: (data) => {
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: [OTC_CLIENTS_QUERY_KEY] });
      
      toast.success('Cliente OTC criado com sucesso', {
        description: `Cliente ${data.data?.name || 'desconhecido'} foi adicionado ao sistema`
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao criar cliente OTC', {
        description: error.response?.data?.message || error.message || 'Falha na operação'
      });
    }
  });

  // Mutation para atualizar cliente
  const updateClientMutation = useMutation({
    mutationFn: ({ id, clientData }: { id: number; clientData: Partial<CreateOTCClientRequest> }) => 
      otcService.updateClient(id, clientData),
    onSuccess: (data) => {
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: [OTC_CLIENTS_QUERY_KEY] });
      
      toast.success('Cliente OTC atualizado com sucesso', {
        description: `Dados do cliente ${data.data?.name || 'desconhecido'} foram atualizados`
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar cliente OTC', {
        description: error.response?.data?.message || error.message || 'Falha na operação'
      });
    }
  });

  // Mutation para alterar status do cliente
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      otcService.toggleClientStatus(id, isActive),
    onSuccess: (data, variables) => {
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: [OTC_CLIENTS_QUERY_KEY] });
      
      const status = variables.isActive ? 'ativado' : 'desativado';
      toast.success(`Cliente ${status} com sucesso`, {
        description: `Cliente ${data.data?.name || 'desconhecido'} foi ${status}`
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao alterar status do cliente', {
        description: error.response?.data?.message || error.message || 'Falha na operação'
      });
    }
  });

  // Função para invalidar cache manualmente
  const invalidateClients = () => {
    queryClient.invalidateQueries({ queryKey: [OTC_CLIENTS_QUERY_KEY] });
  };

  return {
    // Dados - Garantir que sempre retorne um array válido
    clients: Array.isArray(clientsData?.data?.clientes) ? clientsData.data.clientes : [],
    statistics: clientsData?.data?.estatisticas || {
      total_clientes: 0,
      clientes_ativos: 0,
      clientes_inativos: 0,
      total_saldo: 0,
      total_transacoes: 0
    },
    
    // Estados
    isLoading,
    error,
    
    // Mutations
    createClient: (clientData: CreateOTCClientRequest | CreateCompleteOTCClientRequest, isComplete?: boolean) => 
      createClientMutation.mutate({ clientData, isComplete }),
    updateClient: updateClientMutation.mutate,
    toggleStatus: toggleStatusMutation.mutate,
    
    // Estados das mutations
    isCreating: createClientMutation.isLoading,
    isUpdating: updateClientMutation.isLoading,
    isToggling: toggleStatusMutation.isLoading,
    
    // Funções utilitárias
    refetch,
    invalidateClients
  };
}

/**
 * Hook para obter um cliente específico
 */
export function useOTCClient(id: number) {
  const {
    data: clientData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['otc-client', id],
    queryFn: () => otcService.getClient(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 segundos
    cacheTime: 5 * 60 * 1000, // 5 minutos
    onError: (error: any) => {
      toast.error('Erro ao carregar cliente OTC', {
        description: error.message || 'Falha na comunicação com o servidor'
      });
    }
  });

  return {
    client: clientData?.data || null,
    isLoading,
    error,
    refetch
  };
} 