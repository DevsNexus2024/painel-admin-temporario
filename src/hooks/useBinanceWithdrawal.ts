/**
 * 🪙 Binance Withdrawal Hook
 * Hook para gerenciar operações de saque da Binance (fluxo seguro 2 etapas)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  consultarHistoricoSaquesBinance,
  criarSaqueSeguroBinance,
  pollForwardStatusBinance,
  listarEnderecosSaqueBinance,
  listarEnderecosDepositoBinance,
  consultarHistoricoDepositosBinance,
} from '@/services/binance';
import type {
  BinanceSecureWithdrawalRequest,
  BinanceSecureWithdrawalResponse,
  BinanceForwardStatusData,
  BinanceWithdrawalHistoryResponse,
  BinanceWithdrawalAddressesResponse,
  BinanceDepositAddressesResponse,
  BinanceDepositHistoryResponse,
  BinanceWithdrawalHistoryItem,
  BinanceWithdrawalAddressItem,
  BinanceDepositAddressItem,
  BinanceDepositHistoryItem,
} from '@/types/binance';

export interface CriarSaqueSeguroParams {
  coin: string;
  /** Valor que o cliente final recebe */
  amount: string;
  address: string;
  network: string;
  otc_client_id: number;
  pin: string;
  otc_binance_config_id?: number;
  addressTag?: string;
}

interface UseBinanceWithdrawalReturn {
  historicoSaques: BinanceWithdrawalHistoryItem[];
  historicoSaquesLoading: boolean;
  historicoSaquesError: string | null;
  carregarHistoricoSaques: (
    coin?: string,
    status?: number,
    startTime?: number,
    endTime?: number,
  ) => Promise<void>;

  withdrawalLoading: boolean;
  withdrawalError: string | null;
  forwardStatus: BinanceForwardStatusData | null;
  isPollingForward: boolean;
  criarSaqueSeguro: (
    params: CriarSaqueSeguroParams,
  ) => Promise<BinanceSecureWithdrawalResponse | null>;
  acompanharRepasse: (withdrawId: string) => Promise<BinanceForwardStatusData | null>;
  pararAcompanhamento: () => void;

  enderecosSaque: BinanceWithdrawalAddressItem[];
  enderecosSaqueLoading: boolean;
  enderecosSaqueError: string | null;
  carregarEnderecosSaque: () => Promise<void>;

  enderecosDeposito: BinanceDepositAddressItem[];
  enderecosDepositoLoading: boolean;
  enderecosDepositoError: string | null;
  carregarEnderecosDeposito: (coin?: string, network?: string) => Promise<void>;

  historicoDepositos: BinanceDepositHistoryItem[];
  historicoDepositosLoading: boolean;
  historicoDepositosError: string | null;
  carregarHistoricoDepositos: (coin?: string, status?: number) => Promise<void>;

  resetarEstado: () => void;
}

export function useBinanceWithdrawal(): UseBinanceWithdrawalReturn {
  const { toast } = useToast();
  const pollingControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollingControllerRef.current?.abort();
    };
  }, []);

  const [historicoSaques, setHistoricoSaques] = useState<BinanceWithdrawalHistoryItem[]>([]);
  const [historicoSaquesLoading, setHistoricoSaquesLoading] = useState(false);
  const [historicoSaquesError, setHistoricoSaquesError] = useState<string | null>(null);

  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [forwardStatus, setForwardStatus] = useState<BinanceForwardStatusData | null>(null);
  const [isPollingForward, setIsPollingForward] = useState(false);

  const [enderecosSaque, setEnderecosSaque] = useState<BinanceWithdrawalAddressItem[]>([]);
  const [enderecosSaqueLoading, setEnderecosSaqueLoading] = useState(false);
  const [enderecosSaqueError, setEnderecosSaqueError] = useState<string | null>(null);

  const [enderecosDeposito, setEnderecosDeposito] = useState<BinanceDepositAddressItem[]>([]);
  const [enderecosDepositoLoading, setEnderecosDepositoLoading] = useState(false);
  const [enderecosDepositoError, setEnderecosDepositoError] = useState<string | null>(null);

  const [historicoDepositos, setHistoricoDepositos] = useState<BinanceDepositHistoryItem[]>([]);
  const [historicoDepositosLoading, setHistoricoDepositosLoading] = useState(false);
  const [historicoDepositosError, setHistoricoDepositosError] = useState<string | null>(null);

  const carregarHistoricoSaques = useCallback(
    async (coin?: string, status?: number, startTime?: number, endTime?: number) => {
      setHistoricoSaquesLoading(true);
      setHistoricoSaquesError(null);

      try {
        const response = await consultarHistoricoSaquesBinance(coin, status, startTime, endTime);

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
    },
    [toast],
  );

  const pararAcompanhamento = useCallback(() => {
    pollingControllerRef.current?.abort();
    pollingControllerRef.current = null;
    setIsPollingForward(false);
  }, []);

  const acompanharRepasse = useCallback(
    async (withdrawId: string): Promise<BinanceForwardStatusData | null> => {
      // Cancela qualquer polling anterior antes de iniciar um novo.
      pollingControllerRef.current?.abort();
      const controller = new AbortController();
      pollingControllerRef.current = controller;
      setIsPollingForward(true);

      try {
        const result = await pollForwardStatusBinance(withdrawId, {
          intervalMs: 7000,
          signal: controller.signal,
          onUpdate: (data) => {
            if (!controller.signal.aborted) {
              setForwardStatus(data);
            }
          },
        });

        if (result && !controller.signal.aborted) {
          setForwardStatus(result);
          if (result.forward_status === 'concluido') {
            toast({
              title: 'Repasse concluído',
              description:
                'Cliente recebeu o valor. O débito OTC foi lançado automaticamente pelo backend.',
            });
          } else if (result.forward_status === 'cancelado') {
            toast({
              title: 'Saque cancelado',
              description: 'A reserva OTC foi liberada. Nenhum débito foi lançado.',
            });
          }
        }

        return result;
      } finally {
        if (pollingControllerRef.current === controller) {
          pollingControllerRef.current = null;
        }
        setIsPollingForward(false);
      }
    },
    [toast],
  );

  const criarSaqueSeguro = useCallback(
    async (params: CriarSaqueSeguroParams): Promise<BinanceSecureWithdrawalResponse | null> => {
      setWithdrawalLoading(true);
      setWithdrawalError(null);
      setForwardStatus(null);

      try {
        const request: BinanceSecureWithdrawalRequest = {
          coin: params.coin,
          amount: params.amount,
          address: params.address,
          network: params.network,
          otc_client_id: params.otc_client_id,
          pin: params.pin,
          otc_binance_config_id: params.otc_binance_config_id,
          addressTag: params.addressTag,
        };

        const response = await criarSaqueSeguroBinance(request);

        if (response?.success && response.data) {
          toast({
            title: 'Saque solicitado',
            description: `Saque de ${params.amount} ${params.coin} enviado à Binance. Acompanhando repasse…`,
          });

          if (response.data.forward_status) {
            setForwardStatus({
              withdraw_id_binance: response.data.withdrawId,
              otc_client_id: params.otc_client_id,
              forward_status: response.data.forward_status,
              otc_hold_status: 'ACTIVE',
              status: response.data.status,
              last_error: null,
              txid_recebimento: null,
              txid_reenvio_cliente: null,
              forwarded_at: null,
              created_at: response.data.timestamp,
            });
          }

          return response;
        }

        throw new Error(response?.message || 'Erro ao criar saque');
      } catch (error: any) {
        const errorMessage = error.message || 'Erro ao criar saque';
        setWithdrawalError(errorMessage);
        toast({
          title: 'Erro no saque',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setWithdrawalLoading(false);
      }
    },
    [toast],
  );

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

  const carregarEnderecosDeposito = useCallback(
    async (coin?: string, network?: string) => {
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
    },
    [toast],
  );

  const carregarHistoricoDepositos = useCallback(
    async (coin?: string, status?: number) => {
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
    },
    [toast],
  );

  const resetarEstado = useCallback(() => {
    setHistoricoSaquesError(null);
    setWithdrawalError(null);
    setEnderecosSaqueError(null);
    setEnderecosDepositoError(null);
    setHistoricoDepositosError(null);
    setForwardStatus(null);
    pararAcompanhamento();
  }, [pararAcompanhamento]);

  return {
    historicoSaques,
    historicoSaquesLoading,
    historicoSaquesError,
    carregarHistoricoSaques,

    withdrawalLoading,
    withdrawalError,
    forwardStatus,
    isPollingForward,
    criarSaqueSeguro,
    acompanharRepasse,
    pararAcompanhamento,

    enderecosSaque,
    enderecosSaqueLoading,
    enderecosSaqueError,
    carregarEnderecosSaque,

    enderecosDeposito,
    enderecosDepositoLoading,
    enderecosDepositoError,
    carregarEnderecosDeposito,

    historicoDepositos,
    historicoDepositosLoading,
    historicoDepositosError,
    carregarHistoricoDepositos,

    resetarEstado,
  };
}
