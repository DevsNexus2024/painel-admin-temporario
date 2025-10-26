/**
 * 🪙 Binance Trade Hook
 * Hook para gerenciar operações de trading da Binance
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  calcularCotacaoBinance,
  executarTradeBinance,
  consultarStatusOrdemBinance,
  cancelarOrdemBinance,
  consultarHistoricoTradesBinance,
  consultarHistoricoOrdensBinance,
} from '@/services/binance';
import type {
  BinanceQuoteRequest,
  BinanceQuoteData,
  BinanceExecuteTradeRequest,
  BinanceTradeResponse,
  BinanceOrderStatusResponse,
  BinanceTradeHistoryResponse,
  BinanceTradeHistoryItem,
  BinanceOrderHistoryResponse,
  BinanceOrderItem,
} from '@/types/binance';

interface UseBinanceTradeReturn {
  // Quote
  quote: BinanceQuoteData | null;
  quoteLoading: boolean;
  quoteError: string | null;
  solicitarCotacao: (amount: number, fromCurrency?: 'BRL' | 'USDT', symbol?: string, side?: 'BUY' | 'SELL') => Promise<void>;
  
  // Trade
  tradeLoading: boolean;
  tradeError: string | null;
  executarTrade: (quantity: number, fromCurrency: 'BRL' | 'USDT', side: 'BUY' | 'SELL', price?: number, symbol?: string) => Promise<BinanceTradeResponse | null>;
  
  // Order Status
  orderStatus: BinanceOrderStatusData | null;
  orderStatusLoading: boolean;
  orderStatusError: string | null;
  consultarStatus: (orderId: number, symbol?: string) => Promise<void>;
  
  // Cancel Order
  cancelOrderLoading: boolean;
  cancelOrderError: string | null;
  cancelarOrdem: (orderId: number, symbol?: string) => Promise<void>;
  
  // History (Trades - execuções individuais)
  historico: BinanceTradeHistoryItem[];
  historicoLoading: boolean;
  historicoError: string | null;
  carregarHistorico: (symbol?: string, limit?: number) => Promise<void>;
  
  // Orders History (Ordens completas)
  ordens: BinanceOrderItem[];
  ordensLoading: boolean;
  ordensError: string | null;
  carregarOrdens: (symbol?: string, limit?: number) => Promise<void>;
  
  // Utils
  resetarEstado: () => void;
}

interface BinanceOrderStatusData {
  orderId: number;
  status: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  price: string;
  timestamp: string;
}

export function useBinanceTrade(): UseBinanceTradeReturn {
  const { toast } = useToast();
  
  // Quote state
  const [quote, setQuote] = useState<BinanceQuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // Trade state
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  
  // Order Status state
  const [orderStatus, setOrderStatus] = useState<BinanceOrderStatusData | null>(null);
  const [orderStatusLoading, setOrderStatusLoading] = useState(false);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);
  
  // Cancel Order state
  const [cancelOrderLoading, setCancelOrderLoading] = useState(false);
  const [cancelOrderError, setCancelOrderError] = useState<string | null>(null);
  
  // History state (Trades - execuções individuais)
  const [historico, setHistorico] = useState<BinanceTradeHistoryItem[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  
  // Orders state (Ordens completas)
  const [ordens, setOrdens] = useState<BinanceOrderItem[]>([]);
  const [ordensLoading, setOrdensLoading] = useState(false);
  const [ordensError, setOrdensError] = useState<string | null>(null);
  
  /**
   * Solicitar cotação
   */
  const solicitarCotacao = useCallback(async (
    amount: number,
    fromCurrency: 'BRL' | 'USDT' = 'BRL',
    symbol: string = 'USDTBRL',
    side: 'BUY' | 'SELL' = 'BUY'
  ) => {
    setQuoteLoading(true);
    setQuoteError(null);
    
    try {
      const request: BinanceQuoteRequest = {
        amount,
        fromCurrency,
        symbol,
        side,
      };
      
      const response = await calcularCotacaoBinance(request);
      
      if (response && response.success && response.data) {
        setQuote(response.data);
      } else {
        throw new Error(response?.message || 'Erro ao calcular cotação');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao calcular cotação';
      setQuoteError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setQuoteLoading(false);
    }
  }, [toast]);
  
  /**
   * Executar trade
   */
  const executarTrade = useCallback(async (
    quantity: number,
    fromCurrency: 'BRL' | 'USDT',
    side: 'BUY' | 'SELL',
    price?: number,
    symbol: string = 'USDTBRL'
  ): Promise<BinanceTradeResponse | null> => {
    setTradeLoading(true);
    setTradeError(null);
    
    try {
      const request: BinanceExecuteTradeRequest = {
        quantity,
        fromCurrency,
        side,
        price,
        symbol,
      };
      
      const response = await executarTradeBinance(request);
      
      if (response && response.success && response.data) {
        toast({
          title: 'Trade executado',
          description: `Ordem #${response.data.orderId} executada com sucesso`,
        });
        return response;
      } else {
        throw new Error(response?.message || 'Erro ao executar trade');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao executar trade';
      setTradeError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setTradeLoading(false);
    }
  }, [toast]);
  
  /**
   * Consultar status da ordem
   */
  const consultarStatus = useCallback(async (orderId: number, symbol: string = 'USDTBRL') => {
    setOrderStatusLoading(true);
    setOrderStatusError(null);
    
    try {
      const response = await consultarStatusOrdemBinance(orderId, symbol);
      
      if (response && response.success && response.data) {
        setOrderStatus(response.data);
      } else {
        throw new Error(response?.message || 'Erro ao consultar status');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao consultar status';
      setOrderStatusError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setOrderStatusLoading(false);
    }
  }, [toast]);
  
  /**
   * Cancelar ordem
   */
  const cancelarOrdem = useCallback(async (orderId: number, symbol: string = 'USDTBRL') => {
    setCancelOrderLoading(true);
    setCancelOrderError(null);
    
    try {
      const response = await cancelarOrdemBinance(orderId, symbol);
      
      if (response && response.success && response.data) {
        toast({
          title: 'Ordem cancelada',
          description: `Ordem #${orderId} cancelada com sucesso`,
        });
      } else {
        throw new Error(response?.message || 'Erro ao cancelar ordem');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao cancelar ordem';
      setCancelOrderError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCancelOrderLoading(false);
    }
  }, [toast]);
  
  /**
   * Carregar histórico de trades (execuções individuais)
   */
  const carregarHistorico = useCallback(async (symbol: string = 'USDTBRL', limit: number = 500) => {
    setHistoricoLoading(true);
    setHistoricoError(null);
    
    try {
      const response = await consultarHistoricoTradesBinance(symbol, limit);
      
      if (response && response.success && response.data) {
        setHistorico(response.data.trades);
      } else {
        throw new Error(response?.message || 'Erro ao carregar histórico');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar histórico';
      setHistoricoError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setHistoricoLoading(false);
    }
  }, [toast]);
  
  /**
   * Carregar histórico de ordens (ordens completas)
   */
  const carregarOrdens = useCallback(async (symbol: string = 'USDTBRL', limit: number = 500) => {
    setOrdensLoading(true);
    setOrdensError(null);
    
    try {
      const response = await consultarHistoricoOrdensBinance(symbol, limit);
      
      if (response && response.success && response.data) {
        setOrdens(response.data.orders);
      } else {
        throw new Error(response?.message || 'Erro ao carregar ordens');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar ordens';
      setOrdensError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setOrdensLoading(false);
    }
  }, [toast]);
  
  /**
   * Resetar estado
   */
  const resetarEstado = useCallback(() => {
    setQuote(null);
    setQuoteError(null);
    setTradeError(null);
    setOrderStatus(null);
    setOrderStatusError(null);
    setCancelOrderError(null);
    setHistoricoError(null);
  }, []);
  
  return {
    // Quote
    quote,
    quoteLoading,
    quoteError,
    solicitarCotacao,
    
    // Trade
    tradeLoading,
    tradeError,
    executarTrade,
    
    // Order Status
    orderStatus,
    orderStatusLoading,
    orderStatusError,
    consultarStatus,
    
    // Cancel Order
    cancelOrderLoading,
    cancelOrderError,
    cancelarOrdem,
    
    // History (Trades)
    historico,
    historicoLoading,
    historicoError,
    carregarHistorico,
    
    // Orders History
    ordens,
    ordensLoading,
    ordensError,
    carregarOrdens,
    
    // Utils
    resetarEstado,
  };
}

