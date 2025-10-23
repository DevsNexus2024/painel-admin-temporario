/**
 * 🪙 Binance Balances Hook
 * Hook para gerenciar saldos da Binance
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { consultarSaldosBinance } from '@/services/binance';
import type {
  BinanceSpotBalancesResponse,
  BinanceBalance,
} from '@/types/binance';

interface UseBinanceBalancesReturn {
  balances: BinanceBalance[];
  balancesLoading: boolean;
  balancesError: string | null;
  carregarSaldos: () => Promise<void>;
  
  // Helpers
  getBalanceByCoin: (coin: string) => BinanceBalance | undefined;
  getTotalBalance: (coin: string) => number;
}

export function useBinanceBalances(): UseBinanceBalancesReturn {
  const { toast } = useToast();
  
  // Balances state
  const [balances, setBalances] = useState<BinanceBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  
  /**
   * Carregar saldos
   */
  const carregarSaldos = useCallback(async () => {
    setBalancesLoading(true);
    setBalancesError(null);
    
    try {
      const response = await consultarSaldosBinance();
      
      if (response && response.success && response.data) {
        setBalances(response.data.balances);
      } else {
        throw new Error(response?.message || 'Erro ao carregar saldos');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar saldos';
      setBalancesError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setBalancesLoading(false);
    }
  }, [toast]);
  
  /**
   * Buscar saldo de uma moeda específica
   */
  const getBalanceByCoin = useCallback((coin: string): BinanceBalance | undefined => {
    return balances.find(b => b.coin === coin);
  }, [balances]);
  
  /**
   * Calcular saldo total (free + locked)
   */
  const getTotalBalance = useCallback((coin: string): number => {
    const balance = getBalanceByCoin(coin);
    if (!balance) return 0;
    
    const free = parseFloat(balance.free) || 0;
    const locked = parseFloat(balance.locked) || 0;
    
    return free + locked;
  }, [getBalanceByCoin]);
  
  return {
    balances,
    balancesLoading,
    balancesError,
    carregarSaldos,
    getBalanceByCoin,
    getTotalBalance,
  };
}

