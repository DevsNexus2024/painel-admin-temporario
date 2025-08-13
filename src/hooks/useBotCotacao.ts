import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { botCotacaoService } from '@/services/bot-cotacao';
import {
  OtcUser,
  OtcUserGroup,
  WhatsAppGroup,
  BotStatus,
  CreateOtcUserDto,
  CreateOtcUserGroupDto,
  UpdateGroupFeeDto,
  GroupFilters,
  PaginationParams,
  GroupWithClient
} from '@/types/bot-cotacao';

// Query Keys
export const BOT_COTACAO_KEYS = {
  all: ['bot-cotacao'] as const,
  status: () => [...BOT_COTACAO_KEYS.all, 'status'] as const,
  clients: () => [...BOT_COTACAO_KEYS.all, 'clients'] as const,
  clientsList: (params?: PaginationParams) => [...BOT_COTACAO_KEYS.clients(), 'list', params] as const,
  groups: () => [...BOT_COTACAO_KEYS.all, 'groups'] as const,
  groupsList: (filters?: GroupFilters, params?: PaginationParams) => 
    [...BOT_COTACAO_KEYS.groups(), 'list', filters, params] as const,
  whatsappGroups: () => [...BOT_COTACAO_KEYS.all, 'whatsapp-groups'] as const,
  whatsappGroupsList: (params?: PaginationParams) => 
    [...BOT_COTACAO_KEYS.whatsappGroups(), 'list', params] as const,
  dashboardStats: () => [...BOT_COTACAO_KEYS.all, 'dashboard-stats'] as const,
  sync: () => [...BOT_COTACAO_KEYS.all, 'sync'] as const,
} as const;

// Hook para buscar status do bot
export const useBotStatus = () => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.status(),
    queryFn: () => botCotacaoService.getBotStatus(),
    refetchInterval: 30000, // Atualizar a cada 30 segundos
    staleTime: 15000, // Considerar stale após 15 segundos
  });
};

// Hook para buscar clientes
export const useClients = (params?: PaginationParams) => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.clientsList(params),
    queryFn: () => botCotacaoService.getClients(params),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

// Hook para buscar grupos cadastrados
export const useRegisteredGroups = (
  filters?: GroupFilters,
  params?: PaginationParams
) => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.groupsList(filters, params),
    queryFn: () => botCotacaoService.getRegisteredGroups(filters, params),
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

// Hook para buscar grupos do WhatsApp
export const useWhatsAppGroups = (params?: PaginationParams) => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.whatsappGroupsList(params),
    queryFn: () => botCotacaoService.getAllWhatsAppGroups(params),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};

// Hook para estatísticas do dashboard
export const useDashboardStats = () => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.dashboardStats(),
    queryFn: () => botCotacaoService.getDashboardStats(),
    refetchInterval: 60000, // Atualizar a cada minuto
    staleTime: 30000, // 30 segundos
  });
};

// Hook para sincronização
export const useSync = () => {
  return useQuery({
    queryKey: BOT_COTACAO_KEYS.sync(),
    queryFn: () => botCotacaoService.syncWhatsAppGroups(),
    enabled: false, // Só executar quando chamado manualmente
    staleTime: 0, // Sempre buscar dados frescos
  });
};

// Mutations

// Hook para criar cliente
export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientData: CreateOtcUserDto) => 
      botCotacaoService.createClient(clientData),
    onSuccess: (response) => {
      if (response.sucesso) {
        // Invalidar cache dos clientes
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.clients() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.dashboardStats() });
        toast.success(response.mensagem || 'Cliente cadastrado com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro ao cadastrar cliente');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão ao cadastrar cliente');
    },
  });
};

// Hook para atualizar cliente
export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, clientData }: { 
      clientId: string; 
      clientData: Partial<CreateOtcUserDto> 
    }) => botCotacaoService.updateClient(clientId, clientData),
    onSuccess: (response) => {
      if (response.sucesso) {
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.clients() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.groups() });
        toast.success(response.mensagem || 'Cliente atualizado com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro ao atualizar cliente');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão ao atualizar cliente');
    },
  });
};

// Hook para vincular grupo ao cliente
export const useAddGroupToClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupData: CreateOtcUserGroupDto) => 
      botCotacaoService.addGroupToClient(groupData),
    onSuccess: (response) => {
      if (response.sucesso) {
        // Invalidar caches relevantes
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.groups() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.dashboardStats() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.sync() });
        toast.success(response.mensagem || 'Grupo vinculado com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro ao vincular grupo');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão ao vincular grupo');
    },
  });
};

// Hook para atualizar taxa do grupo
export const useUpdateGroupFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, feeData }: { 
      groupId: string; 
      feeData: UpdateGroupFeeDto 
    }) => botCotacaoService.updateGroupFee(groupId, feeData),
    onSuccess: (response) => {
      if (response.sucesso) {
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.groups() });
        toast.success(response.mensagem || 'Taxa atualizada com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro ao atualizar taxa');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão ao atualizar taxa');
    },
  });
};

// Hook para remover grupo
export const useRemoveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => botCotacaoService.removeGroup(groupId),
    onSuccess: (response) => {
      if (response.sucesso) {
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.groups() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.dashboardStats() });
        toast.success(response.mensagem || 'Grupo removido com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro ao remover grupo');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão ao remover grupo');
    },
  });
};

// Hook para sincronização manual
export const useSyncGroups = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => botCotacaoService.syncWhatsAppGroups(),
    onSuccess: (response) => {
      if (response.sucesso) {
        // Atualizar cache da sincronização
        queryClient.setQueryData(BOT_COTACAO_KEYS.sync(), response);
        // Invalidar outros caches relacionados
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.whatsappGroups() });
        queryClient.invalidateQueries({ queryKey: BOT_COTACAO_KEYS.groups() });
        toast.success(response.mensagem || 'Sincronização realizada com sucesso!');
      } else {
        toast.error(response.mensagem || 'Erro na sincronização');
      }
    },
    onError: (error) => {

      toast.error('Erro de conexão durante a sincronização');
    },
  });
};

// Hook combinado para facilitar o uso nas páginas
export const useBotCotacao = () => {
  return {
    // Queries
    status: useBotStatus(),
    dashboardStats: useDashboardStats(),
    
    // Mutations
    createClient: useCreateClient(),
    updateClient: useUpdateClient(),
    addGroupToClient: useAddGroupToClient(),
    updateGroupFee: useUpdateGroupFee(),
    removeGroup: useRemoveGroup(),
    syncGroups: useSyncGroups(),
  };
}; 