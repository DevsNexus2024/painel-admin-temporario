import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useCacheManager = () => {
  const queryClient = useQueryClient();

  const invalidateExtrato = () => {
    queryClient.invalidateQueries({ queryKey: ['extrato'] });
  };

  const invalidatePixKeys = () => {
    queryClient.invalidateQueries({ queryKey: ['pix-keys'] });
  };

  const invalidateSaldo = () => {
    queryClient.invalidateQueries({ queryKey: ['saldo'] });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries();
    toast.info('Cache atualizado', {
      description: 'Todos os dados serão recarregados na próxima consulta'
    });
  };

  const clearCache = () => {
    queryClient.clear();
    toast.success('Cache limpo', {
      description: 'Todo o cache foi removido'
    });
  };

  const refetchAll = async () => {
    await queryClient.refetchQueries();
    toast.success('Dados atualizados', {
      description: 'Todas as consultas foram recarregadas'
    });
  };

  const getCacheData = (queryKey: string[]) => {
    return queryClient.getQueryData(queryKey);
  };

  const setCacheData = (queryKey: string[], data: any) => {
    queryClient.setQueryData(queryKey, data);
  };

  return {
    invalidateExtrato,
    invalidatePixKeys,
    invalidateSaldo,
    invalidateAll,
    clearCache,
    refetchAll,
    getCacheData,
    setCacheData,
    queryClient
  };
}; 