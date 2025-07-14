import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listarChavesPix, PixKeysListResponse } from '@/services/pix';

export interface UsePixKeysOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export const usePixKeys = (options: UsePixKeysOptions = {}) => {
  const { 
    enabled = true, 
    staleTime = 10 * 60 * 1000, // 10 minutos (chaves mudam pouco)
    cacheTime = 30 * 60 * 1000 // 30 minutos
  } = options;

  return useQuery<PixKeysListResponse>({
    queryKey: ['pix-keys'],
    queryFn: listarChavesPix,
    enabled,
    staleTime, // Dados são frescos por 10 minutos
    cacheTime, // Cache persiste por 30 minutos
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    retry: 2, // Tentar 2 vezes em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
  });
};

// Hook para invalidar cache das chaves PIX (usar após criar/deletar chave)
export const useInvalidatePixKeys = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['pix-keys'] });
  };
};

// Hook para atualizar cache após criar uma nova chave
export const useUpdatePixKeysCache = () => {
  const queryClient = useQueryClient();

  return (novaChave: any) => {
    queryClient.setQueryData(['pix-keys'], (oldData: PixKeysListResponse | undefined) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        total: oldData.total + 1,
        chaves: [...oldData.chaves, novaChave],
        estatisticas: {
          ...oldData.estatisticas,
          totalChaves: oldData.estatisticas.totalChaves + 1,
        }
      };
    });
  };
};

// Hook para refetch manual das chaves PIX
export const useRefreshPixKeys = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.refetchQueries({ queryKey: ['pix-keys'] });
  };
}; 