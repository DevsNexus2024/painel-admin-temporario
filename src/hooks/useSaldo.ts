import { useQuery } from '@tanstack/react-query';
import { consultarSaldo, SaldoResponse } from '@/services/account';

export interface UseSaldoOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export const useSaldo = (options: UseSaldoOptions = {}) => {
  const { 
    enabled = true, 
    staleTime = 2 * 60 * 1000, // 2 minutos (saldo muda mais frequentemente)
    cacheTime = 5 * 60 * 1000 // 5 minutos
  } = options;

  return useQuery<SaldoResponse, Error>({
    queryKey: ['saldo'],
    queryFn: consultarSaldo,
    enabled,
    staleTime, // Dados são frescos por 2 minutos
    cacheTime, // Cache persiste por 5 minutos
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    retry: 2, // Tentar 2 vezes em caso de erro
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponencial
  });
}; 