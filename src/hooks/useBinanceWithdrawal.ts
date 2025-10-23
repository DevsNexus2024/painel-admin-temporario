/**
 * 🪙 Binance Withdrawal Hook
 * Hook para gerenciar operações de saque da Binance
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  consultarHistoricoSaquesBinance,
  criarSaqueBinance,
  listarEnderecosSaqueBinance,
  listarEnderecosDepositoBinance,
  consultarHistoricoDepositosBinance,
} from '@/services/binance';
import type {
  BinanceWithdrawalRequest,
  BinanceWithdrawalResponse,
  BinanceWithdrawalHistoryResponse,
  BinanceWithdrawalAddressesResponse,
  BinanceDepositAddressesResponse,
  BinanceDepositHistoryResponse,
  BinanceWithdrawalHistoryItem,
  BinanceWithdrawalAddressItem,
  BinanceDepositAddressItem,
  BinanceDepositHistoryItem,
} from '@/types/binance';

interface UseBinanceWithdrawalReturn {
  // Withdrawal History
  historicoSaques: BinanceWithdrawalHistoryItem[];
  historicoSaquesLoading: boolean;
  historicoSaquesError: string | null;
  carregarHistoricoSaques: (coin?: string, status?: number) => Promise<void>;
  
  // Create Withdrawal
  withdrawalLoading: boolean;
  withdrawalError: string | null;
  criarSaque: (coin: string, amount: string, address: string, network?: string, addressTag?: string) => Promise<BinanceWithdrawalResponse | null>;
  
  // Withdrawal Addresses
  enderecosSaque: BinanceWithdrawalAddressItem[];
  enderecosSaqueLoading: boolean;
  enderecosSaqueError: string | null;
  carregarEnderecosSaque: () => Promise<void>;
  
  // Deposit Addresses
  enderecosDeposito: BinanceDepositAddressItem[];
  enderecosDepositoLoading: boolean;
  enderecosDepositoError: string | null;
  carregarEnderecosDeposito: (coin?: string, network?: string) => Promise<void>;
  
  // Deposit History
  historicoDepositos: BinanceDepositHistoryItem[];
  historicoDepositosLoading: boolean;
  historicoDepositosError: string | null;
  carregarHistoricoDepositos: (coin?: string, status?: number) => Promise<void>;
  
  // Utils
  resetarEstado: () => void;
}

export function useBinanceWithdrawal(): UseBinanceWithdrawalReturn {
  const { toast } = useToast();
  
  // Withdrawal History state
  const [historicoSaques, setHistoricoSaques] = useState<BinanceWithdrawalHistoryItem[]>([]);
  const [historicoSaquesLoading, setHistoricoSaquesLoading] = useState(false);
  const [historicoSaquesError, setHistoricoSaquesError] = useState<string | null>(null);
  
  // Create Withdrawal state
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  
  // Withdrawal Addresses state
  const [enderecosSaque, setEnderecosSaque] = useState<BinanceWithdrawalAddressItem[]>([]);
  const [enderecosSaqueLoading, setEnderecosSaqueLoading] = useState(false);
  const [enderecosSaqueError, setEnderecosSaqueError] = useState<string | null>(null);
  
  // Deposit Addresses state
  const [enderecosDeposito, setEnderecosDeposito] = useState<BinanceDepositAddressItem[]>([]);
  const [enderecosDepositoLoading, setEnderecosDepositoLoading] = useState(false);
  const [enderecosDepositoError, setEnderecosDepositoError] = useState<string | null>(null);
  
  // Deposit History state
  const [historicoDepositos, setHistoricoDepositos] = useState<BinanceDepositHistoryItem[]>([]);
  const [historicoDepositosLoading, setHistoricoDepositosLoading] = useState(false);
  const [historicoDepositosError, setHistoricoDepositosError] = useState<string | null>(null);
  
  /**
   * Carregar histórico de saques
   */
  const carregarHistoricoSaques = useCallback(async (coin?: string, status?: number) => {
    setHistoricoSaquesLoading(true);
    setHistoricoSaquesError(null);
    
    try {
      const response = await consultarHistoricoSaquesBinance(coin, status);
      
      if (response && response.success && response.data) {
        setHistoricoSaques(response.data.withdrawals);
      } else {
        throw new Error(response?.message || 'Erro ao carregar histórico de saques');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar histórico de saques';
      setHistoricoSaquesError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setHistoricoSaquesLoading(false);
    }
  }, [toast]);
  
  /**
   * Criar saque
   */
  const criarSaque = useCallback(async (
    coin: string,
    amount: string,
    address: string,
    network?: string,
    addressTag?: string
  ): Promise<BinanceWithdrawalResponse | null> => {
    setWithdrawalLoading(true);
    setWithdrawalError(null);
    
    try {
      const request: BinanceWithdrawalRequest = {
        coin,
        amount,
        address,
        network,
        addressTag,
      };
      
      const response = await criarSaqueBinance(request);
      
      if (response && response.success && response.data) {
        toast({
          title: 'Saque solicitado',
          description: `Saque de ${amount} ${coin} solicitado com sucesso`,
        });
        return response;
      } else {
        throw new Error(response?.message || 'Erro ao criar saque');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao criar saque';
      setWithdrawalError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setWithdrawalLoading(false);
    }
  }, [toast]);
  
  /**
   * Carregar endereços de saque salvos
   */
  const carregarEnderecosSaque = useCallback(async () => {
    setEnderecosSaqueLoading(true);
    setEnderecosSaqueError(null);
    
    try {
      const response = await listarEnderecosSaqueBinance();
      
      if (response && response.success && response.data) {
        setEnderecosSaque(response.data.addresses);
      } else {
        throw new Error(response?.message || 'Erro ao carregar endereços de saque');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar endereços de saque';
      setEnderecosSaqueError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setEnderecosSaqueLoading(false);
    }
  }, [toast]);
  
  /**
   * Carregar endereços de depósito
   */
  const carregarEnderecosDeposito = useCallback(async (coin?: string, network?: string) => {
    setEnderecosDepositoLoading(true);
    setEnderecosDepositoError(null);
    
    try {
      const response = await listarEnderecosDepositoBinance(coin, network);
      
      if (response && response.success && response.data) {
        setEnderecosDeposito(response.data.addresses);
      } else {
        throw new Error(response?.message || 'Erro ao carregar endereços de depósito');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar endereços de depósito';
      setEnderecosDepositoError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setEnderecosDepositoLoading(false);
    }
  }, [toast]);
  
  /**
   * Carregar histórico de depósitos
   */
  const carregarHistoricoDepositos = useCallback(async (coin?: string, status?: number) => {
    setHistoricoDepositosLoading(true);
    setHistoricoDepositosError(null);
    
    try {
      const response = await consultarHistoricoDepositosBinance(coin, status);
      
      if (response && response.success && response.data) {
        setHistoricoDepositos(response.data.deposits);
      } else {
        throw new Error(response?.message || 'Erro ao carregar histórico de depósitos');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao carregar histórico de depósitos';
      setHistoricoDepositosError(errorMessage);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setHistoricoDepositosLoading(false);
    }
  }, [toast]);
  
  /**
   * Resetar estado
   */
  const resetarEstado = useCallback(() => {
    setHistoricoSaquesError(null);
    setWithdrawalError(null);
    setEnderecosSaqueError(null);
    setEnderecosDepositoError(null);
    setHistoricoDepositosError(null);
  }, []);
  
  return {
    // Withdrawal History
    historicoSaques,
    historicoSaquesLoading,
    historicoSaquesError,
    carregarHistoricoSaques,
    
    // Create Withdrawal
    withdrawalLoading,
    withdrawalError,
    criarSaque,
    
    // Withdrawal Addresses
    enderecosSaque,
    enderecosSaqueLoading,
    enderecosSaqueError,
    carregarEnderecosSaque,
    
    // Deposit Addresses
    enderecosDeposito,
    enderecosDepositoLoading,
    enderecosDepositoError,
    carregarEnderecosDeposito,
    
    // Deposit History
    historicoDepositos,
    historicoDepositosLoading,
    historicoDepositosError,
    carregarHistoricoDepositos,
    
    // Utils
    resetarEstado,
  };
}

