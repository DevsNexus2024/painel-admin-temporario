/**
 * 🔗 Hook para gerenciar funcionários OTC
 * 
 * Fornece funcionalidades para:
 * - Conceder acesso a funcionários
 * - Listar funcionários de um cliente
 * - Revogar acessos
 * - Ativar acessos pendentes
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  otcEmployeeService, 
  EmployeeAccess, 
  GrantAccessRequest, 
  PendingAccess 
} from '@/services/otc-employee';
import { logger } from '@/utils/logger';

// ==================== QUERY KEYS ====================

export const OTC_EMPLOYEES_QUERY_KEYS = {
  employees: (clientId: number) => ['otc-employees', 'client', clientId],
  accessInfo: () => ['otc-employee', 'access-info'],
  pendingAccess: () => ['otc-employee', 'pending-access']
} as const;

// ==================== HOOKS ====================

/**
 * Hook para listar funcionários de um cliente OTC
 */
export function useOTCEmployees(clientId: number, enabled: boolean = true) {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: OTC_EMPLOYEES_QUERY_KEYS.employees(clientId),
    queryFn: async () => {
      const result = await otcEmployeeService.listClientEmployees(clientId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: enabled && !!clientId,
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 2
  });

  return {
    employees: data || [],
    isLoading,
    error,
    refetch
  };
}

/**
 * Hook para conceder acesso a funcionário
 */
export function useGrantEmployeeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GrantAccessRequest) => {
      const result = await otcEmployeeService.grantAccess(data);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidar cache dos funcionários do cliente
      queryClient.invalidateQueries({
        queryKey: OTC_EMPLOYEES_QUERY_KEYS.employees(variables.otc_client_id)
      });

      toast.success('Acesso concedido com sucesso!', {
        description: `${variables.employee_name} agora pode acessar o extrato limitado.`
      });

      logger.info('Acesso de funcionário concedido', {
        employee_email: variables.employee_email,
        client_id: variables.otc_client_id
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao conceder acesso', {
        description: error.message
      });

      logger.error('Erro ao conceder acesso de funcionário', error);
    }
  });
}

/**
 * Hook para revogar acesso de funcionário
 */
export function useRevokeEmployeeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accessId, reason, clientId }: { 
      accessId: number; 
      reason: string; 
      clientId: number; 
    }) => {
      const result = await otcEmployeeService.revokeAccess(accessId, reason);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidar cache dos funcionários do cliente
      queryClient.invalidateQueries({
        queryKey: OTC_EMPLOYEES_QUERY_KEYS.employees(variables.clientId)
      });

      toast.success('Acesso revogado com sucesso!', {
        description: 'O funcionário não poderá mais acessar o extrato.'
      });

      logger.info('Acesso de funcionário revogado', {
        access_id: variables.accessId,
        reason: variables.reason
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao revogar acesso', {
        description: error.message
      });

      logger.error('Erro ao revogar acesso de funcionário', error);
    }
  });
}

/**
 * Hook para ativar acesso de funcionário (usado pelo próprio funcionário)
 */
export function useActivateEmployeeAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accessId?: number) => {
      const result = await otcEmployeeService.activateAccess(accessId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidar cache das informações de acesso
      queryClient.invalidateQueries({
        queryKey: OTC_EMPLOYEES_QUERY_KEYS.accessInfo()
      });
      
      // Invalidar cache dos acessos pendentes
      queryClient.invalidateQueries({
        queryKey: OTC_EMPLOYEES_QUERY_KEYS.pendingAccess()
      });

      toast.success('Acesso ativado com sucesso!', {
        description: 'Você agora pode acessar o extrato do cliente.'
      });

      logger.info('Acesso de funcionário ativado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao ativar acesso', {
        description: error.message
      });

      logger.error('Erro ao ativar acesso de funcionário', error);
    }
  });
}

/**
 * Hook para obter informações de acesso do funcionário logado
 */
export function useEmployeeAccessInfo(enabled: boolean = true) {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: OTC_EMPLOYEES_QUERY_KEYS.accessInfo(),
    queryFn: async () => {
      const result = await otcEmployeeService.getEmployeeAccessInfo();
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minuto
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
    retry: 1
  });

  return {
    accessInfo: data,
    isLoading,
    error,
    refetch,
    hasAccess: !!data && data.status === 'active'
  };
}

/**
 * Hook para obter acessos pendentes do funcionário logado
 */
export function usePendingEmployeeAccess() {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: OTC_EMPLOYEES_QUERY_KEYS.pendingAccess(),
    queryFn: async () => {
      const result = await otcEmployeeService.getPendingAccess();
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data || [];
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: true,
    retry: 1
  });

  return {
    pendingAccess: data || [],
    isLoading,
    error,
    refetch,
    hasPendingAccess: !!(data && data.length > 0)
  };
}

/**
 * Hook para gerenciar estado local de funcionários
 */
export function useEmployeeManagement(clientId: number) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeAccess | null>(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  // Hooks de query
  const { employees, isLoading, refetch } = useOTCEmployees(clientId);
  const grantMutation = useGrantEmployeeAccess();
  const revokeMutation = useRevokeEmployeeAccess();

  // Funções auxiliares
  const openGrantModal = () => setIsGrantModalOpen(true);
  const closeGrantModal = () => setIsGrantModalOpen(false);

  const openRevokeModal = (employee: EmployeeAccess) => {
    setSelectedEmployee(employee);
    setIsRevokeModalOpen(true);
  };

  const closeRevokeModal = () => {
    setSelectedEmployee(null);
    setIsRevokeModalOpen(false);
  };

  const handleGrantAccess = async (data: GrantAccessRequest) => {
    try {
      await grantMutation.mutateAsync(data);
      closeGrantModal();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleRevokeAccess = async (reason: string) => {
    if (!selectedEmployee) return;

    try {
      await revokeMutation.mutateAsync({
        accessId: selectedEmployee.id,
        reason,
        clientId
      });
      closeRevokeModal();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  // Estatísticas
  const stats = {
    total: employees.length,
    active: employees.filter(emp => emp.status === 'active').length,
    pending: employees.filter(emp => emp.status === 'pending').length,
    revoked: employees.filter(emp => emp.status === 'revoked').length
  };

  return {
    // Dados
    employees,
    selectedEmployee,
    stats,
    
    // Estados
    isLoading,
    isGrantModalOpen,
    isRevokeModalOpen,
    isGranting: grantMutation.isPending,
    isRevoking: revokeMutation.isPending,
    
    // Funções
    refetch,
    openGrantModal,
    closeGrantModal,
    openRevokeModal,
    closeRevokeModal,
    handleGrantAccess,
    handleRevokeAccess
  };
}
