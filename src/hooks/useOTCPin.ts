/**
 * Hook para gerenciar PIN de saque
 * PIN está vinculado ao usuário, não ao cliente OTC
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { otcService } from '@/services/otc';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PinStatus {
  pinConfigured: boolean;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Hook para gerenciar PIN de saque
 * PIN está vinculado diretamente ao usuário autenticado
 */
export function useOTCPin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Verificar se usuário logado é admin
  const { data: adminCheck, isLoading: adminLoading } = useQuery({
    queryKey: ['otc-pin-admin', user?.id],
    queryFn: () => otcService.checkUserIsAdmin(),
    enabled: !!user?.id || !!user?.email, // Habilitar quando usuário estiver logado
    retry: 1,
  });

  // Verificar status do PIN (só verifica se for admin)
  const { data: pinStatus, isLoading: pinStatusLoading } = useQuery({
    queryKey: ['otc-pin-status', user?.id],
    queryFn: () => otcService.checkPinStatus(),
    enabled: !!adminCheck?.data?.is_admin && (!!user?.id || !!user?.email),
    retry: 1,
  });

  // Mutation para criar PIN
  const createPinMutation = useMutation({
    mutationFn: ({ pin }: { pin: string }) => {
      return otcService.createPin(pin);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otc-pin-status'] });
      toast.success('PIN criado com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Erro ao criar PIN';
      toast.error(message);
      throw error;
    },
  });

  // Mutation para verificar PIN (sem toast automático - deixa o componente decidir)
  const verifyPinMutation = useMutation({
    mutationFn: ({ pin }: { pin: string }) => {
      return otcService.verifyPin(pin);
    },
    // Não mostrar toast automático - o componente pode mostrar mensagens mais específicas
  });

  // Mutation para atualizar PIN
  const updatePinMutation = useMutation({
    mutationFn: ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      return otcService.updatePin(currentPin, newPin);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otc-pin-status'] });
      toast.success('PIN atualizado com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Erro ao atualizar PIN';
      toast.error(message);
      throw error;
    },
  });

  const status: PinStatus = {
    pinConfigured: pinStatus?.data?.pin_configured ?? false,
    isAdmin: adminCheck?.data?.is_admin ?? false,
    loading: adminLoading || pinStatusLoading,
  };

  return {
    // Status
    status,
    
    // Mutations
    createPin: createPinMutation.mutateAsync,
    verifyPin: verifyPinMutation.mutateAsync,
    updatePin: updatePinMutation.mutateAsync,
    
    // Estados de loading
    isCreatingPin: createPinMutation.isPending,
    isVerifyingPin: verifyPinMutation.isPending,
    isUpdatingPin: updatePinMutation.isPending,
    
    // Erros
    createPinError: createPinMutation.error,
    verifyPinError: verifyPinMutation.error,
    updatePinError: updatePinMutation.error,
  };
}
