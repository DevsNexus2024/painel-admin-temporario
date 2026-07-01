import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Search, Edit, Loader2, Wallet, Zap, ArrowUpDown, RefreshCw, Save, ExternalLink, Info, DollarSign, Hash, FileText, Calendar, User, ChevronDown, ChevronUp, Copy, TrendingDown, Percent, Receipt, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useBinanceTrade } from '@/hooks/useBinanceTrade';
import { useBinanceWithdrawal } from '@/hooks/useBinanceWithdrawal';
import { useBinanceBalances } from '@/hooks/useBinanceBalances';
import type { BinanceWithdrawalHistoryItem } from '@/types/binance';
import { useOTCClients, useOTCClient } from '@/hooks/useOTCClients';
import { useOTCBalance } from '@/hooks/useOTCBalance';
import { BinanceWithdrawalModal } from '@/components/otc/BinanceWithdrawalModal';
import type { BinanceWithdrawalConfirmData } from '@/components/otc/BinanceWithdrawalModal';
import { BinanceForwardQueuePanel } from '@/components/otc/BinanceForwardQueuePanel';
import { BinanceForwardTrackingModal } from '@/components/otc/BinanceForwardTrackingModal';
import { consultarForwardStatusBinance } from '@/services/binance';
import { isTerminalForwardStatus } from '@/utils/binanceWithdrawal';
import { TradeConfirmationModal } from '@/components/otc/TradeConfirmationModal';
import { getBinanceConfigs, createBinanceTransaction, getBinanceTransactions, updateBinanceTransactionNotes, updateBinanceTransactionNotesByBinanceId } from '@/services/otc-binance';
import { useOTCOperations } from '@/hooks/useOTCOperations';
import { toastError, toastSuccess } from '@/utils/toast';
import type { BinanceTransaction } from '@/types/binance';
import type { OTCClient } from '@/types/otc';
import type { BinanceTransaction as SavedBinanceTransaction } from '@/services/otc-binance';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { formatUSDTInput, formatMonetaryInput, convertBrazilianUSDTToUS, convertBrazilianToUS, getNumericUSDTValue, getNumericValue } from '@/utils/monetaryInput';
import { toast } from 'sonner';

const OTCNegociar: React.FC = () => {
  // ==================== TRADING HOOKS ====================
  const {
    quote,
    quoteLoading,
    quoteError,
    solicitarCotacao,
    tradeLoading,
    executarTrade,
    carregarOrdens,
    ordens,
    ordensLoading,
    resetarEstado,
  } = useBinanceTrade();

  // ==================== WITHDRAWAL HOOKS ====================
  const {
    criarSaqueSeguro,
    acompanharRepasse,
    pararAcompanhamento,
    withdrawalLoading,
    forwardStatus,
    isPollingForward,
    historicoSaques,
    historicoSaquesLoading,
    carregarHistoricoSaques,
  } = useBinanceWithdrawal();

  // ==================== BALANCES HOOKS ====================
  const {
    balances,
    balancesLoading,
    carregarSaldos,
    getBalanceByCoin,
    getTotalBalance,
  } = useBinanceBalances();

  // ==================== TRADING STATE ====================
  const [operationType, setOperationType] = useState<'buy' | 'sell'>('buy');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState('USDT/BRL');

  // ==================== OTC CLIENTS HOOKS ====================
  const {
    clients,
    isLoading: clientsLoading,
  } = useOTCClients({ is_active: true });

  // Buscar cliente específico quando selecionado
  const { client: selectedClientData } = useOTCClient(
    selectedClient ? parseInt(selectedClient) : 0
  );

  const selectedClientIdNum = selectedClient ? parseInt(selectedClient, 10) : 0;
  const {
    balance: otcClientBalance,
    refetch: refetchOtcClientBalance,
    isLoading: otcBalanceLoading,
  } = useOTCBalance(selectedClientIdNum);

  // Hook para operações OTC
  const { createOperation, operations } = useOTCOperations();

  // Hook para autenticação (pegar email do usuário logado)
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('0,00');
  const [searchQuery, setSearchQuery] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  
  // Transações salvas no banco
  const [savedTransactions, setSavedTransactions] = useState<Record<string, SavedBinanceTransaction>>({});
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Withdrawals pagination states
  const [currentPageWithdrawals, setCurrentPageWithdrawals] = useState(1);
  const itemsPerPageWithdrawals = 10;
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<'operations' | 'withdrawals'>('operations');
  
  // Modal states
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  // Modal de acompanhamento do repasse (independente do modal de solicitação).
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [activeWithdrawId, setActiveWithdrawId] = useState<string | null>(null);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const withdrawalSubmitLockRef = useRef(false);
  
  // Binance config
  const [binanceConfig, setBinanceConfig] = useState<{ fee: number; id: number } | null>(null);

  // ==================== SALDOS REAIS ====================
  
  // Buscar saldos reais da Binance
  const usdtBalance = getBalanceByCoin('USDT');
  const brlBalance = getBalanceByCoin('BRL');
  
  // Calcular valores formatados
  const availableBalanceUSDT = usdtBalance 
    ? `${parseFloat(usdtBalance.free).toLocaleString('pt-BR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} USDT`
    : '0.00000000 USDT';
  
  const availableBalance = brlBalance
    ? `R$${parseFloat(brlBalance.free).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'R$0,00';

  // ==================== EFFECTS ====================
  
  // Função para carregar transações salvas
  const carregarTransacoesSalvas = async () => {
    const result = await getBinanceTransactions({ limit: 1000 });
    if (result) {
      // Criar um mapa por binance_transaction_id
      const map: Record<string, SavedBinanceTransaction> = {};
      result.transactions.forEach(tx => {
        if (tx.binance_transaction_id) {
          map[tx.binance_transaction_id] = tx;
        }
      });
      console.log('📦 Total de transações salvas:', Object.keys(map).length);
      setSavedTransactions(map);
    }
  };

  // Função para calcular primeiro e último dia do mês atual
  const getMonthDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return {
      startTime: firstDay.getTime(),
      endTime: lastDay.getTime()
    };
  };

  // Carregar saldos e histórico ao montar o componente
  useEffect(() => {
    carregarSaldos();
    carregarOrdens('USDTBRL', 500); // Carregar ordens ao invés de trades
    carregarTransacoesSalvas();
    
    // Carregar saques USDT do mês atual
    const { startTime, endTime } = getMonthDateRange();
    console.log('📅 Filtro de período (mês atual):', {
      startTime,
      endTime,
      startDate: new Date(startTime).toLocaleString('pt-BR'),
      endDate: new Date(endTime).toLocaleString('pt-BR')
    });
    carregarHistoricoSaques('USDT', undefined, startTime, endTime);
    
    // Buscar configuração Binance
    getBinanceConfigs().then((configs) => {
      if (configs.length > 0) {
        setBinanceConfig({
          fee: configs[0].fee * 100, // Converter de decimal para porcentagem
          id: configs[0].id,
        });
      }
    });
  }, [carregarSaldos, carregarOrdens, carregarHistoricoSaques]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Preencher automaticamente o campo não preenchido quando a cotação chegar
  useEffect(() => {
    if (quote && countdown === 5) {
      const quantityValue = getNumericUSDTValue(quantity);
      const totalValue = getNumericValue(total);
      
      if (quantityValue > 0 && totalValue === 0) {
        // Se preencheu quantidade em USDT, preencher total em BRL
        const formatted = formatMonetaryInput(quote.outputAmount.toFixed(2).replace('.', ''));
        setTotal(formatted);
      } else if (totalValue > 0 && quantityValue === 0) {
        // Se preencheu total em BRL, preencher quantidade em USDT
        const formatted = formatUSDTInput(quote.outputAmount.toFixed(2).replace('.', '').replace(',', ''));
        setQuantity(formatted);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, countdown]);

  // ==================== HANDLERS ====================

  /**
   * Solicitar cotação
   */
  const handleSolicitarCotacao = async () => {
    const symbol = getSymbolFromCurrency(selectedCurrency);
    const side = operationType === 'buy' ? 'BUY' : 'SELL';
    
    // Verificar qual campo foi preenchido e converter para formato americano
    const quantityValue = getNumericUSDTValue(quantity);
    const totalValue = getNumericValue(total);
    
    if (quantityValue > 0) {
      // Enviar USDT (já convertido para formato americano)
      await solicitarCotacao(quantityValue, 'USDT', symbol, side);
    } else if (totalValue > 0) {
      // Enviar BRL (já convertido para formato americano)
      await solicitarCotacao(totalValue, 'BRL', symbol, side);
    } else {
      toastError('Valor inválido', 'Por favor, informe um valor válido em USDT ou BRL');
      return;
    }

    // Iniciar countdown de 10 segundos
    setCountdown(10);
  };

  /**
   * Solicitar cotação automática para saques (1000 USDT padrão)
   */
  const handleRequestQuoteForWithdrawal = async () => {
    const symbol = 'USDTBRL';
    const side = 'SELL'; // Para saque, vamos vender USDT por BRL
    
    // Solicitar cotação com 1000 USDT padrão
    await solicitarCotacao(1000, 'USDT', symbol, side);
  };

  /**
   * Executar trade direto
   */
  const handleExecutarTrade = async () => {
    if (!quote) {
      toastError('Cotação não encontrada', 'Por favor, solicite uma cotação primeiro');
      return;
    }

    // Validar se cliente foi selecionado
    if (!selectedClient) {
      toastError('Cliente não selecionado', 'Por favor, selecione um cliente antes de executar o trade');
      return;
    }

    // Abrir modal de confirmação
    setShowConfirmationModal(true);
  };

  /**
   * Confirmar e executar trade na Binance
   */
  const handleConfirmTrade = async (finalPrice: number, notes: string) => {
    if (!quote || !selectedClient || !binanceConfig) {
      return;
    }

    const symbol = getSymbolFromCurrency(selectedCurrency);

    const response = await executarTrade(
      quote.inputAmount,      // Quantidade de entrada
      quote.inputCurrency,    // Moeda de entrada (BRL ou USDT)
      quote.side,             // BUY ou SELL
      undefined,              // Sem preço = MARKET order
      symbol
    );

    if (response && response.data) {
      // Fechar modal de confirmação
      setShowConfirmationModal(false);
      
      // Toast de sucesso
      toastSuccess('Trade executado com sucesso', `Ordem #${response.data.orderId} executada`);
      
      // Salvar transação no banco de dados
      try {
        const avgPrice = quote.averagePrice;
        const binanceFee = binanceConfig.fee / 100; // Converter para decimal
        const binanceFeeAmount = avgPrice * binanceFee;
        const afterBinanceFee = operationType === 'buy' 
          ? avgPrice + binanceFeeAmount   // Buy: somar taxa
          : avgPrice - binanceFeeAmount;  // Sell: subtrair taxa
        
        // Calcular taxa do cliente aplicada
        // Se o preço foi editado, precisamos recalcular a taxa baseada no novo preço
        let clientFeeAmount: number;
        let clientFeePercentage: number;
        
        if (operationType === 'buy') {
          // Buy: O preço final = afterBinanceFee + clientFeeAmount
          // Então: clientFeeAmount = finalPrice - afterBinanceFee
          clientFeeAmount = finalPrice - afterBinanceFee;
          clientFeePercentage = afterBinanceFee > 0 ? clientFeeAmount / afterBinanceFee : 0;
        } else {
          // Sell: O preço final = afterBinanceFee - clientFeeAmount
          // Então: clientFeeAmount = afterBinanceFee - finalPrice
          clientFeeAmount = afterBinanceFee - finalPrice;
          clientFeePercentage = afterBinanceFee > 0 ? clientFeeAmount / afterBinanceFee : 0;
        }
        
        // Debug: Log dos cálculos
        console.log('💰 Cálculo de Taxas:', {
          avgPrice,
          binanceFee: `${(binanceFee * 100).toFixed(3)}%`,
          binanceFeeAmount,
          afterBinanceFee,
          finalPrice,
          clientFeeAmount,
          clientFeePercentage: `${(clientFeePercentage * 100).toFixed(3)}%`,
          operationType
        });
        
        const transactionData = {
          id_binance_account: binanceConfig.id,
          otc_client_id: parseInt(selectedClient),
          binance_transaction_id: response.data.orderId.toString(),
          transaction_type: operationType === 'buy' ? 'BUY' : 'SELL' as 'BUY' | 'SELL',
          binance_price_average_no_fees: avgPrice,
          binance_fee_percentage: binanceFee,
          binance_fee_amount: binanceFeeAmount,
          binance_price_average_with_fees: afterBinanceFee,
          client_fee_percentage_applied: clientFeePercentage,
          client_fee_amount_applied: clientFeeAmount,
          client_final_price: finalPrice,
          input_coin_id: quote.inputCurrency === 'BRL' ? 7 : 3, // BRL: 7, USDT: 3
          input_coin_amount: quote.inputAmount,
          output_coin_id: quote.outputCurrency === 'BRL' ? 7 : 3,
          output_coin_amount: quote.outputAmount,
          binance_transaction_date: new Date().toISOString(),
          transaction_status: 'COMPLETED' as const,
          transaction_notes: notes.trim(), // Usar as notas do operador
        };
        
        const savedTransaction = await createBinanceTransaction(transactionData);
        
        if (savedTransaction) {
          console.log('✅ Transação Binance salva com sucesso:', savedTransaction);
          
          // Criar operação de conversão OTC (similar ao que é feito no modal de operação manual)
          try {
            // Calcular valores finais com todas as taxas aplicadas
            // Para BUY: Estamos comprando USDT com BRL
            // - Creditamos USDT = quantidade de USDT recebida da Binance
            // - Debitamos BRL = USDT recebido × preço final (com taxas aplicadas ao cliente)
            // Para SELL: Estamos vendendo USDT por BRL
            // - Debitamos USDT = quantidade de USDT vendida na Binance
            // - Creditamos BRL = USDT vendido × preço final (com taxas aplicadas ao cliente)
            
            let brlValue: number;
            let usdValue: number;
            
            // Extrair valores USD e BRL baseado na moeda
            // Sempre garantir que estamos pegando USD, não BRL
            if (quote.inputCurrency === 'USDT') {
              usdValue = quote.inputAmount; // USD está no input
            } else if (quote.outputCurrency === 'USDT') {
              usdValue = quote.outputAmount; // USD está no output
            } else {
              // Fallback: assumir que inputAmount é USD (não deveria acontecer)
              console.warn('⚠️ Não foi possível determinar USD da quote:', quote);
              usdValue = quote.inputAmount;
            }
            
            // Calcular BRL baseado no USD × taxa final
            brlValue = usdValue * finalPrice;
            
            // Taxa de conversão final (preço final já inclui todas as taxas)
            const conversionRate = finalPrice;
            
            const conversionData = {
              otc_client_id: parseInt(selectedClient),
              operation_type: 'convert' as const,
              brl_amount: brlValue,
              usd_amount: usdValue,
              conversion_rate: conversionRate,
              description: `Conversão - ${notes.trim()}`,
            };
            
            console.log('📊 Detalhes da conversão:', {
              operationType,
              quote_input: `${quote.inputAmount} ${quote.inputCurrency}`,
              quote_output: `${quote.outputAmount} ${quote.outputCurrency}`,
              finalPrice,
              brlValue,
              usdValue,
              conversionRate,
            });
            
            createOperation(conversionData);
            console.log('✅ Operação de conversão criada:', conversionData);
          } catch (conversionError) {
            console.error('❌ Erro ao criar operação de conversão:', conversionError);
            toastError('Aviso', 'Transação salva mas não foi possível criar operação de conversão');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao salvar transação:', error);
        toastError('Aviso', 'Trade executado mas não foi possível salvar os detalhes');
      }
      
      // Recarregar histórico e transações salvas
      await carregarOrdens('USDTBRL', 500);
      await carregarTransacoesSalvas();
      
      // Limpar campos
      setSelectedClient('');
      setQuantity('');
      setTotal('');
    }
  };

  /**
   * Limpar cotação atual e voltar ao estado inicial
   */
  const handleLimparCotacao = () => {
    setCountdown(0);
    // Limpar todos os campos para voltar ao estado inicial
    setQuantity('');
    setTotal('');
    // Limpar a cotação do hook
    resetarEstado();
  };

  /**
   * Executar saque seguro (criar-seguro + polling de repasse)
   */
  const handleSolicitarSaque = async (data: BinanceWithdrawalConfirmData) => {
    if (!selectedClient) {
      toastError('Cliente não selecionado', 'Por favor, selecione um cliente antes de realizar o saque');
      return;
    }

    if (!user?.email) {
      toastError('Usuário não identificado', 'Não foi possível identificar o usuário logado');
      return;
    }

    // Lock síncrono anti duplo-clique: cada saque gera nova Idempotency-Key,
    // então dois cliques rápidos virariam DOIS saques distintos (double-send).
    if (withdrawalSubmitLockRef.current) return;
    withdrawalSubmitLockRef.current = true;

    try {
      const response = await criarSaqueSeguro({
        coin: data.coin,
        amount: data.amount,
        address: data.address,
        network: data.network,
        otc_client_id: parseInt(selectedClient, 10),
        pin: data.pin,
        // NÃO enviar otc_binance_config_id: o backend resolve a config de wallet
        // escrow correta pela rede. O id que o front tem (binanceConfig.id) é da
        // conta de trading, NÃO da config de wallet — enviá-lo arriscaria escrow errada.
        addressTag: data.addressTag,
      });

      if (!response?.data) {
        return;
      }

      const withdrawId = response.data.withdrawId;
      setActiveWithdrawId(withdrawId);

      const { startTime, endTime } = getMonthDateRange();
      await carregarHistoricoSaques('USDT', undefined, startTime, endTime);
      void refetchOtcClientBalance();

      if (response.data.forward_status) {
        // Fecha o modal de solicitação e abre o de acompanhamento (stepper).
        setShowWithdrawalModal(false);
        setShowTrackingModal(true);
        // Polling apenas para UI (stepper). Débito/reserva OTC = backend.
        void acompanharRepasse(withdrawId).then((finalStatus) => {
          if (
            finalStatus?.forward_status === 'concluido' ||
            finalStatus?.forward_status === 'cancelado'
          ) {
            void refetchOtcClientBalance();
          }
        });
      } else {
        // Fluxo 1 etapa (sem repasse): apenas fecha o modal.
        setShowWithdrawalModal(false);
      }
    } catch (error) {
      console.error('❌ Erro ao criar saque:', error);
    } finally {
      withdrawalSubmitLockRef.current = false;
    }
  };

  const handleCloseWithdrawalModal = () => {
    if (withdrawalLoading) return;
    setShowWithdrawalModal(false);
  };

  /**
   * Abre o acompanhamento de um saque existente (extrato, fila ou histórico).
   * Consulta o status atual; se ainda em andamento, retoma o polling.
   */
  const handleTrackWithdrawal = async (withdrawId: string) => {
    if (!withdrawId) return;

    const response = await consultarForwardStatusBinance(withdrawId);
    if (!response?.success || !response.data) {
      toastError(
        'Sem fila de repasse',
        'Este saque não está na fila de repasse (legado ou saque direto em 1 etapa).',
      );
      return;
    }

    setActiveWithdrawId(withdrawId);
    setShowTrackingModal(true);

    if (!isTerminalForwardStatus(response.data.forward_status)) {
      void acompanharRepasse(withdrawId).then((finalStatus) => {
        if (
          finalStatus?.forward_status === 'concluido' ||
          finalStatus?.forward_status === 'cancelado'
        ) {
          void refetchOtcClientBalance();
        }
      });
    }
  };

  /** Fecha o modal de acompanhamento mantendo o polling ativo em segundo plano. */
  const handleContinueTrackingInBackground = () => {
    setShowTrackingModal(false);
  };

  /** Encerra a sessão de acompanhamento (aborta polling e limpa estado). */
  const handleDismissTracking = () => {
    setShowTrackingModal(false);
    setActiveWithdrawId(null);
    pararAcompanhamento();
  };

  /**
   * Handler para mudança no campo Quantidade (USDT)
   */
  const handleQuantityChange = (value: string) => {
    // Formata como input USDT (2 casas decimais)
    const formatted = formatUSDTInput(value);
    setQuantity(formatted);
    // Limpar campo Total quando quantidade é editada
    if (getNumericUSDTValue(formatted) > 0) {
      setTotal('');
    }
  };

  /**
   * Handler para mudança no campo Total (BRL)
   */
  const handleTotalChange = (value: string) => {
    // Formata como input monetário (2 casas decimais)
    const formatted = formatMonetaryInput(value);
    setTotal(formatted);
    // Limpar campo Quantity quando total é editado
    if (getNumericValue(formatted) > 0) {
      setQuantity('');
    }
  };

  /**
   * Calcular valor máximo
   */
  const handleMaxAmount = () => {
    if (brlBalance) {
      const maxBRL = parseFloat(brlBalance.free);
      if (!isNaN(maxBRL) && maxBRL > 0) {
        // Formata como monetário brasileiro
        const formatted = formatMonetaryInput(maxBRL.toFixed(2).replace('.', ''));
        setTotal(formatted);
        // Limpar quantidade quando usar MAX
        setQuantity('');
      }
    }
  };

  /**
   * Handler para salvar anotação
   */
  const handleSaveNote = async (transactionId: string, noteValue: string) => {
    console.log('💾 Salvando anotação:', { transactionId, noteValue });
    
    // Salvar no estado local para feedback imediato
    setNotes((prev) => ({
      ...prev,
      [transactionId]: noteValue,
    }));
    setEditingNoteId(null);
    
    // Buscar a transação para ver se tem savedTransactionId
    const transactions = converterOrdens();
    const transaction = transactions.find(t => t.id === transactionId);
    
    console.log('🔍 Transação encontrada:', transaction);
    console.log('📝 savedTransactionId:', transaction?.savedTransactionId);
    console.log('🆔 orderId:', transaction?.orderId);
    
    let result: any = null;
    
    if (transaction?.savedTransactionId) {
      // Método 1: Usar ID interno (quando a transação já existe no banco)
      console.log('✅ Usando ID interno para atualizar anotação...');
      result = await updateBinanceTransactionNotes(transaction.savedTransactionId, noteValue);
    } else if (transaction?.orderId) {
      // Método 2: Usar binance_transaction_id diretamente
      console.log('✅ Usando binance_transaction_id para atualizar anotação...');
      result = await updateBinanceTransactionNotesByBinanceId(transaction.orderId.toString(), noteValue);
    }
    
    console.log('📡 Resultado da API:', result);
    
    if (result) {
      toastSuccess('Anotação atualizada', 'A anotação foi salva no banco de dados');
      // Recarregar transações salvas para refletir a mudança
      await carregarTransacoesSalvas();
    } else {
      toastError('Erro ao salvar', 'Não foi possível salvar a anotação no banco de dados');
    }
  };

  // ==================== HELPERS ====================

  /**
   * Converter seleção de moeda para símbolo da Binance
   */
  const getSymbolFromCurrency = (currency: string): string => {
    const symbolMap: Record<string, string> = {
      'USDT/BRL': 'USDTBRL',
      'BTC/BRL': 'BTCBRL',
      'ETH/BRL': 'ETHBRL',
    };
    return symbolMap[currency] || 'USDTBRL';
  };

  /**
   * Formatar timestamp para data legível
   */
  const formatDate = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  /**
   * Converter ordens da Binance para formato de Transaction
   */
  const converterOrdens = (): BinanceTransaction[] => {
    const transactions = ordens.map((item) => {
      // Ordem tem quantidade executada, preço médio e taxa
      // Usar os valores fornecidos pelo backend
      const price = item.averagePrice || 0;
      const qty = item.executedQuantity || 0;
      // Backend já calcula o total: averagePrice × executedQuantity
      const tot = item.total || 0;
      
      // Extrair timestamp para ordenação
      const timestamp = item.orderTime || item.updateTime;
      
      // Buscar transação salva para obter anotação do banco
      // Usar orderId da ordem completa
      const binanceOrderId = item.orderId.toString();
      const savedTx = savedTransactions[binanceOrderId];
      
      const noteFromDb = savedTx?.transaction_notes || '';
      const noteFromLocal = notes[`O${item.orderId}`] || '';
      const finalNote = noteFromDb || noteFromLocal;
      
      // Determinar status da transação
      let transactionStatus: 'Executada' | 'Pendente' | 'Cancelada' = 'Executada';
      if (item.status === 'NEW' || item.status === 'PARTIALLY_FILLED') {
        transactionStatus = 'Pendente';
      } else if (item.status === 'CANCELED' || item.status === 'REJECTED' || item.status === 'EXPIRED') {
        transactionStatus = 'Cancelada';
      }
      
      return {
        id: `O${item.orderId}`,
        type: (item.side === 'BUY' ? 'Compra' : 'Venda') as 'Compra' | 'Venda',
        currency: item.symbol.replace('BRL', '').replace('USDT', 'USDT'),
        quote: savedTx?.binance_price_average_with_fees || price, // Usar preço médio com taxas quando disponível
        clientFinalPrice: savedTx?.client_final_price || null, // Preço final vendido para o cliente
        quantity: qty,
        total: tot,
        date: formatDate(timestamp),
        timestamp: timestamp, // Guardar timestamp original para ordenação
        status: transactionStatus,
        note: finalNote,
        orderId: item.orderId,
        savedTransactionId: savedTx?.id, // ID da transação salva no banco
      };
    });
    
    // Ordenar por data decrescente (mais recente primeiro)
    return transactions.sort((a, b) => {
      const timestampA = new Date(a.timestamp || 0).getTime();
      const timestampB = new Date(b.timestamp || 0).getTime();
      return timestampB - timestampA; // Decrescente
    });
  };

  /**
   * Handler para clicar na linha da tabela
   */
  const handleRowClick = (transactionId: string) => {
    setExpandedTransactionId(expandedTransactionId === transactionId ? null : transactionId);
  };

  /**
   * Status badge
   */
  const getStatusBadge = (status: BinanceTransaction['status']) => {
    const variants = {
      Executada: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
      Pendente: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
      Cancelada: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
    };

    return (
      <Badge className={variants[status]} variant="outline">
        {status}
      </Badge>
    );
  };

  /**
   * Status badge para saques
   */
  const getWithdrawalStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      'Success': { className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20', label: 'Sucesso' },
      'Completed': { className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20', label: 'Completo' },
      'Pending': { className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20', label: 'Pendente' },
      'Processing': { className: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20', label: 'Processando' },
      'Cancelled': { className: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20', label: 'Cancelado' },
      'Failure': { className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20', label: 'Falhou' },
      'Rejected': { className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20', label: 'Rejeitado' },
    };

    const statusInfo = statusMap[status] || { className: 'bg-gray-500/10 text-gray-500', label: status };

    return (
      <Badge className={statusInfo.className} variant="outline">
        {statusInfo.label}
      </Badge>
    );
  };

  /**
   * Componente de detalhes da transação Binance
   */
  const BinanceTransactionDetails: React.FC<{ transaction: BinanceTransaction }> = ({ transaction }) => {
    // Buscar transação salva no banco
    const savedTx = transaction.savedTransactionId 
      ? Object.values(savedTransactions).find(tx => tx.id === transaction.savedTransactionId)
      : transaction.orderId 
        ? savedTransactions[transaction.orderId.toString()]
        : null;

    // Buscar cliente se houver transação salva
    const clientData = savedTx?.otc_client_id 
      ? clients.find(c => c.id === savedTx.otc_client_id)
      : null;

    const formatCurrency = (value: number | null | undefined, currency: string = 'BRL') => {
      if (value === null || value === undefined) return '-';
      return currency === 'USD' 
        ? `$${value.toFixed(2)}`
        : `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatNumber = (value: number | null | undefined, decimals: number = 4) => {
      if (value === null || value === undefined) return '-';
      return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return dateString;
      }
    };

    const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    };

    // Determinar moedas de entrada/saída baseado no tipo de transação
    // Para COMPRA de USDT: Entrada = BRL, Saída = USDT
    // Para VENDA de USDT: Entrada = USDT, Saída = BRL
    const transactionType = savedTx?.transaction_type || (transaction.type === 'Compra' ? 'BUY' : 'SELL');
    const isBuy = transactionType === 'BUY' || transaction.type === 'Compra';
    const moedaEntrada = isBuy ? 'BRL' : 'USDT';
    const moedaSaida = isBuy ? 'USDT' : 'BRL';

    // Formatar taxa percentual (multiplicar por 100 se for decimal)
    const formatFeePercentage = (fee: number | undefined) => {
      if (fee === undefined) return null;
      // Se a taxa for menor que 1, assume que está em decimal (0.0004 = 0.04%)
      // Se for maior que 1, assume que já está em percentual
      const percentage = fee < 1 ? fee * 100 : fee;
      return formatNumber(percentage, 2);
    };

    // Calcular valor total custo = preço médio com taxas x quantidade
    const precoMedioComTaxas = savedTx?.binance_price_average_with_fees;
    const quantidade = transaction.quantity;
    const valorTotalCusto = precoMedioComTaxas && quantidade 
      ? precoMedioComTaxas * quantidade 
      : transaction.total || null;

    // Calcular valor total cobrado = preço repassado x quantidade
    const precoRepassado = savedTx?.client_final_price || transaction.clientFinalPrice;
    const valorTotalCobrado = precoRepassado && quantidade 
      ? precoRepassado * quantidade 
      : null;

    // Cálculos financeiros
    const lucroBruto = valorTotalCobrado && valorTotalCusto 
      ? valorTotalCobrado - valorTotalCusto 
      : null;
    
    // Taxa de saque (apenas para operações de saque/WITHDRAW)
    // Para trades, a taxa de saque seria 0. Se houver saque relacionado, seria calculado aqui
    const taxaSaque = transactionType === 'WITHDRAW' ? 0 : 0; // TODO: Implementar cálculo de taxa de saque quando disponível
    
    // Imposto = 16% do lucro bruto
    const imposto = lucroBruto ? lucroBruto * 0.16 : null;
    
    // Lucro Real = Lucro Bruto - Imposto - Taxa de Saque
    const lucroReal = lucroBruto !== null && imposto !== null 
      ? lucroBruto - imposto - taxaSaque 
      : null;
    
    // Percentual de lucro = (Lucro Real / Valor Total Cobrado) * 100
    const percentualLucro = lucroReal !== null && valorTotalCobrado && valorTotalCobrado > 0
      ? (lucroReal / valorTotalCobrado) * 100
      : null;

    const isPositive = lucroReal !== null && lucroReal > 0;

    return (
      <div className="bg-background/30 p-4 rounded-lg space-y-4 mx-2 my-2 border border-border/20">
        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Lucro Real */}
          <div className={`p-3 rounded-lg border-2 ${isPositive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Lucro Real
              </span>
            </div>
            <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {lucroReal !== null 
                ? `R$${lucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '-'}
            </div>
          </div>

          {/* Percentual de Lucro */}
          <div className={`p-3 rounded-lg border-2 ${isPositive ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Percentual de Lucro
              </span>
            </div>
            <div className={`text-lg font-bold ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
              {percentualLucro !== null 
                ? `${percentualLucro.toFixed(2).replace('.', ',')}%`
                : '-'}
            </div>
          </div>

          {/* Valor Total Cobrado */}
          <div className="p-3 rounded-lg border-2 bg-purple-500/10 border-purple-500/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor Total Cobrado
              </span>
            </div>
            <div className="text-lg font-bold text-purple-600">
              {valorTotalCobrado 
                ? `R$${valorTotalCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '-'}
            </div>
          </div>
        </div>

        {/* Informações Gerais - Compacta */}
        <div className="bg-background/50 p-2.5 rounded-md border border-border/30">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1.5">Data:</span>
              <span className="font-medium">{formatDate(savedTx?.binance_transaction_date) || transaction.date}</span>
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1.5">Tipo:</span>
              <span className="font-medium">{savedTx?.transaction_type || transaction.type || '-'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground mr-1.5">ID Binance:</span>
              <span className="font-mono text-xs truncate max-w-[100px]" title={savedTx?.binance_transaction_id || transaction.orderId?.toString()}>
                {savedTx?.binance_transaction_id || transaction.orderId?.toString() || '-'}
              </span>
              {(savedTx?.binance_transaction_id || transaction.orderId) && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-3.5 w-3.5"
                  onClick={() => copyToClipboard(savedTx?.binance_transaction_id || transaction.orderId?.toString() || '', 'ID da transação')}
                >
                  <Copy className="h-2.5 w-2.5" />
                </Button>
              )}
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1.5">Status:</span>
              <span className="font-medium">{savedTx?.transaction_status || transaction.status || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1.5">Moeda Entrada:</span>
              <span className="font-medium">{moedaEntrada}</span>
            </div>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1.5">Moeda Saída:</span>
              <span className="font-medium">{moedaSaida}</span>
            </div>
            {clientData && (
              <div className="flex items-center">
                <span className="text-muted-foreground mr-1.5">Cliente:</span>
                <span className="font-medium">{clientData.name} (ID: {clientData.id})</span>
              </div>
            )}
          </div>
        </div>

        {/* Grid: Custos | Receitas | Resultado Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Custo da Operação */}
          <div className="bg-background/50 p-3 rounded-md border border-border/30">
            <h4 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Custos da Operação
            </h4>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Preço Médio (sem taxas):</span>
                <span className="font-medium">
                  {savedTx?.binance_price_average_no_fees !== undefined 
                    ? `R$${formatNumber(savedTx.binance_price_average_no_fees)}`
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Preço Médio (com taxas):</span>
                <span className="font-medium">
                  {savedTx?.binance_price_average_with_fees !== undefined
                    ? `R$${formatNumber(savedTx.binance_price_average_with_fees)}`
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Taxa Binance:</span>
                <span className="font-medium">
                  {savedTx?.binance_fee_percentage !== undefined && savedTx?.binance_fee_amount !== undefined
                    ? `${formatFeePercentage(savedTx.binance_fee_percentage) || '-'}% (R$${formatNumber(savedTx.binance_fee_amount)})`
                    : '-'}
                </span>
              </div>
              <div className="pt-1 border-t border-border/20">
                <span className="text-muted-foreground block mb-0.5">Valor Total Custo:</span>
                <span className="font-semibold text-orange-600 text-sm">
                  {valorTotalCusto ? `R$${valorTotalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Receitas */}
          <div className="bg-background/50 p-3 rounded-md border border-border/30">
            <h4 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Receitas
            </h4>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Preço Repassado:</span>
                <span className="font-medium">
                  {precoRepassado ? `R$${formatNumber(precoRepassado)}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Taxa Aplicada:</span>
                <span className="font-medium">
                  {savedTx?.client_fee_percentage_applied !== undefined && savedTx?.client_fee_amount_applied !== undefined
                    ? `${formatFeePercentage(savedTx.client_fee_percentage_applied) || '-'}% (R$${formatNumber(savedTx.client_fee_amount_applied)})`
                    : '-'}
                </span>
              </div>
              <div className="pt-1 border-t border-border/20">
                <span className="text-muted-foreground block mb-0.5">Valor Total Cobrado:</span>
                <span className="font-semibold text-green-600 text-sm">
                  {valorTotalCobrado ? `R$${valorTotalCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Resultado Financeiro */}
          <div className="bg-background/50 p-3 rounded-md border border-border/30">
            <h4 className="font-semibold text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Resultado Financeiro
            </h4>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Lucro Bruto:</span>
                <span className={`font-semibold ${lucroBruto !== null && lucroBruto > 0 ? 'text-green-600' : lucroBruto !== null ? 'text-red-600' : ''} text-sm`}>
                  {lucroBruto !== null 
                    ? `R$${lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Taxa de Saque:</span>
                <span className="font-medium">
                  {taxaSaque > 0 
                    ? `R$${taxaSaque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'R$ 0,00'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Imposto (16%):</span>
                <span className="font-medium">
                  {imposto !== null 
                    ? `R$${imposto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </span>
              </div>
              <div className="pt-1 border-t-2 border-border/30">
                <span className="text-muted-foreground block mb-0.5">Lucro Real:</span>
                <span className={`font-bold text-base ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {lucroReal !== null 
                    ? `R$${lucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Obter link da blockchain baseado na rede
   */
  const getBlockchainLink = (network: string, txId?: string | null): string | null => {
    if (!txId) return null;
    
    const networkMap: Record<string, string> = {
      'TRX': 'https://tronscan.org/#/transaction/',
      'TRC20': 'https://tronscan.org/#/transaction/',
      'BSC': 'https://bscscan.com/tx/',
      'BEP20': 'https://bscscan.com/tx/',
      'ETH': 'https://etherscan.io/tx/',
      'ERC20': 'https://etherscan.io/tx/',
      'MATIC': 'https://polygonscan.com/tx/',
      'POLYGON': 'https://polygonscan.com/tx/',
      'ARBITRUM': 'https://arbiscan.io/tx/',
      'OPTIMISM': 'https://optimistic.etherscan.io/tx/',
      'AVAX': 'https://snowtrace.io/tx/',
      'AVAXC': 'https://snowtrace.io/tx/',
      'AllMainnet': 'https://etherscan.io/tx/',
    };
    
    const baseUrl = networkMap[network.toUpperCase()];
    return baseUrl ? `${baseUrl}${txId}` : null;
  };

  /**
   * Buscar nome do cliente relacionado a um saque através das operações OTC
   */
  const getClientNameFromWithdrawal = (withdrawId: string | undefined, operationsList: any[]): string | null => {
    if (!withdrawId || withdrawId === 'N/A') return null;
    
    // Garantir que operationsList é um array válido
    if (!Array.isArray(operationsList) || operationsList.length === 0) return null;
    
    // Buscar operação OTC que tenha descrição contendo o ID do saque
    const relatedOperation = operationsList.find((op) => {
      // A descrição é criada como: "Operação Automática USDT por {email}: SAQUE - ID: {withdrawId}"
      return op.description && op.description.includes(`SAQUE - ID: ${withdrawId}`);
    });
    
    // Se encontrou a operação, buscar o cliente na lista de clientes usando otc_client_id
    if (relatedOperation?.otc_client_id) {
      const client = clients.find(c => c.id === relatedOperation.otc_client_id);
      return client?.name || null;
    }
    
    return null;
  };

  /**
   * Converter saques para exibição
   */
  const converterSaques = (operationsList: any[]): Array<BinanceWithdrawalHistoryItem & { displayId: string; displayDate: string; clientName: string | null }> => {
    return historicoSaques.map((saque) => {
      const withdrawId = saque.withdrawId || saque.id || 'N/A';
      return {
        ...saque,
        displayId: withdrawId,
        displayDate: formatDate(saque.applyTime || saque.timestamp || ''),
        clientName: getClientNameFromWithdrawal(withdrawId, operationsList),
      };
    });
  };

  // ==================== RENDER ====================

  const transactions = converterOrdens();
  const filteredTransactions = transactions.filter((t) =>
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Paginação Operações
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Converter saques com informações de cliente (garantir que operations seja array)
  const operationsArray = Array.isArray(operations) ? operations : [];
  const saquesConvertidos = converterSaques(operationsArray);
  
  // Paginação Saques
  const filteredWithdrawals = saquesConvertidos.filter((s) => 
    s.coin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.clientName && s.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const totalPagesWithdrawals = Math.ceil(filteredWithdrawals.length / itemsPerPageWithdrawals);
  const startIndexWithdrawals = (currentPageWithdrawals - 1) * itemsPerPageWithdrawals;
  const endIndexWithdrawals = startIndexWithdrawals + itemsPerPageWithdrawals;
  const paginatedWithdrawals = filteredWithdrawals.slice(startIndexWithdrawals, endIndexWithdrawals);

  // Resetar página quando filtro mudar ou aba mudar
  useEffect(() => {
    setCurrentPage(1);
    setCurrentPageWithdrawals(1);
  }, [searchQuery, activeTab]);

  return (
    <div className="p-4 sm:p-6 space-y-4 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            OTC Trading
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Conectado • {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            carregarSaldos();
            carregarOrdens('USDTBRL', 500);
            carregarTransacoesSalvas();
          }}
          className="gap-2 h-8 text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </Button>
      </div>

      {/* Indicador de repasse em andamento (polling em segundo plano) */}
      {activeWithdrawId && !showTrackingModal && isPollingForward && (
        <button
          type="button"
          onClick={() => setShowTrackingModal(true)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-left transition-colors hover:bg-orange-500/20"
        >
          <span className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Repasse em andamento
            <span className="font-mono text-xs opacity-80">#{activeWithdrawId}</span>
          </span>
          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
            Ver status
          </span>
        </button>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Coluna Esquerda - Área de Negociação */}
        <div className="flex flex-col gap-4">
          {/* Card de Saldo */}
          <Card className="hover:shadow-xl transition-all duration-300 border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                Saldo Total Disponível
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Carregando saldos...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-bold text-foreground">
                      {availableBalance}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs font-mono text-muted-foreground">
                      {availableBalanceUSDT}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Negocia��ão */}
          <Card className="hover:shadow-xl transition-all duration-300 flex-1 flex flex-col border-2">
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-primary" />
                Nova Operação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col gap-4">
              {/* Seleção de Cliente */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Cliente OTC
                </label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between bg-muted/80 h-10 border-2 hover:border-primary/50 transition-colors"
                    >
                      {selectedClient
                        ? clients.find((client) => client.id.toString() === selectedClient)?.name || 'Selecione um cliente...'
                        : 'Selecione um cliente...'}
                      <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        {clientsLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {clients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={`${client.name} ${client.document}`}
                                  onSelect={() => {
                                    setSelectedClient(
                                      client.id.toString() === selectedClient ? '' : client.id.toString()
                                    );
                                    setClientPopoverOpen(false); // Fechar o popover após seleção
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{client.name}</span>
                                    <span className="text-xs text-muted-foreground">({client.document})</span>
                                  </div>
                                  {selectedClient === client.id.toString() && (
                                    <svg className="ml-auto h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClient && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {otcBalanceLoading ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        <Loader2 className="h-3 w-3 animate-spin mr-1 inline" />
                        Saldo OTC…
                      </Badge>
                    ) : (
                      <>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400"
                        >
                          Disponível:{' '}
                          {(otcClientBalance.usd_available ?? otcClientBalance.usd_balance ?? 0)
                            .toFixed(2)
                            .replace('.', ',')}{' '}
                          USD
                        </Badge>
                        {(otcClientBalance.usd_balance_reserved ?? 0) > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300"
                          >
                            Reservado:{' '}
                            {(otcClientBalance.usd_balance_reserved ?? 0)
                              .toFixed(2)
                              .replace('.', ',')}{' '}
                            USD
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Seleção de Moeda */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Par de Negociação
                </label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-full bg-muted/80 h-10 border-2 hover:border-primary/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT/BRL">
                      <div className="flex items-center gap-2">
                        <img src="/usdt_logo.png" alt="USDT" className="w-6 h-6" />
                        <span className="font-semibold text-sm">USDT/BRL</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="BTC/BRL">
                      <div className="flex items-center gap-2">
                        <img src="/btc_logo.png" alt="BTC" className="w-6 h-6" />
                        <span className="font-semibold text-sm">BTC/BRL</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ETH/BRL">
                      <div className="flex items-center gap-2">
                        <img src="/eth_logo.png" alt="ETH" className="w-6 h-6" />
                        <span className="font-semibold text-sm">ETH/BRL</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botões Comprar/Vender */}
              <div className="grid grid-cols-2 gap-3 flex-1">
                <Button
                  size="lg"
                  className={`h-10 text-sm font-bold transition-all duration-300 ${
                    operationType === 'buy'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('buy')}
                >
                  ↑ Comprar
                </Button>
                <Button
                  size="lg"
                  className={`h-10 text-sm font-bold transition-all duration-300 ${
                    operationType === 'sell'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('sell')}
                >
                  ↓ Vender
                </Button>
              </div>

              {/* Quantidade */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Quantidade (USDT)
                </label>
                <Input
                  type="text"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="bg-muted/80 text-base h-10 border-2 border-transparent hover:border-primary/30 focus:border-primary transition-colors font-semibold"
                  placeholder="0,00"
                />
              </div>

              {/* Total */}
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground mb-2 block flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Total (BRL)
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={total}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    className="bg-muted/80 text-base h-10 pr-14 border-2 border-transparent hover:border-primary/30 focus:border-primary transition-colors font-semibold"
                    placeholder="0,00"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 h-7 px-2 text-xs font-bold"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {/* Botão Solicitar Cotação */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-sm font-bold h-10"
                  onClick={handleSolicitarCotacao}
                  disabled={quoteLoading}
                >
                  {quoteLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 mr-2" />
                      Solicitar Cotação
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Cotação Atual e Saque */}
        <div className="space-y-4">
          {/* Card de Cotação */}
          <Card className="hover:shadow-xl transition-all duration-300 sticky top-6 border-2">
            <CardHeader className="border-b">
              <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Cotação para {operationType === 'buy' ? 'Comprar' : 'Vender'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote ? (
                <>
                  <div className="text-center space-y-3">
                    <div className="px-5 rounded-xl mt-3">
                      <p className="text-[32px] font-medium text-foreground">
                        R$ {quote.averagePrice.toFixed(4)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Entrada</p>
                        <p className="font-mono text-sm font-medium">
                          {quote.inputAmount.toLocaleString('pt-BR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })} {quote.inputCurrency}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Saída</p>
                        <p className="font-mono text-sm font-medium">
                          {quote.outputAmount.toLocaleString('pt-BR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })} {quote.outputCurrency}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Ordens Usadas</p>
                        <p className="font-mono text-sm font-medium">{quote.ordersUsed}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Orderbook Depth</p>
                        <p className="font-mono text-sm font-medium">{quote.orderBookDepth}</p>
                      </div>
                    </div>
                  </div>

                  {countdown > 0 ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-bold h-10 text-white"
                      onClick={handleExecutarTrade}
                      disabled={tradeLoading}
                    >
                      {tradeLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3 mr-2" />
                          Executar Trade ({countdown}s)
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleLimparCotacao}
                    >
                      Solicitar Nova Cotação
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-foreground font-semibold text-sm">Nenhuma cotação disponível</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique em "Solicitar cotação" para obter uma cotação</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Saque para Wallets */}
          <Card className="hover:shadow-xl transition-all duration-300 border-2">
            <CardHeader className="border-b">
              <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  Saque para Wallets
                </span>
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-400 text-xs font-bold">₿</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                  <Wallet className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="font-semibold text-foreground text-sm">Transferências para Wallets</p>
                <p className="text-xs text-muted-foreground mt-1">Suporte para USDT, BTC e ETH</p>
              </div>

              {/* Botão de Saque */}
              <Button
                size="lg"
                className="w-full bg-orange-600 hover:bg-orange-700 text-xs font-bold h-10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!selectedClient) {
                    toastError('Cliente não selecionado', 'Por favor, selecione um cliente antes de realizar o saque');
                    return;
                  }
                  setShowWithdrawalModal(true);
                }}
                disabled={!selectedClient}
              >
                <Wallet className="w-3 h-3 mr-2" />
                {selectedClient ? 'Solicitar Saque' : 'Selecione um Cliente'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Transa��ões */}
      <Card className="hover:shadow-xl transition-all duration-300 border-2">
        <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Histórico de Operações
            </CardTitle>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Pesquisar transações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 bg-muted/80 border-2 hover:border-primary/30 focus:border-primary transition-colors text-sm h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'operations' | 'withdrawals')} className="w-full">
            <TabsList className="grid w-[calc(100%-3rem)] grid-cols-2 mx-6 mt-4">
              <TabsTrigger value="operations" className="truncate">Operações</TabsTrigger>
              <TabsTrigger value="withdrawals" className="truncate">Saques USDT</TabsTrigger>
            </TabsList>
            
            {/* Aba 1: Operações */}
            <TabsContent value="operations" className="mt-0">
              {ordensLoading ? (
                <div className="flex items-center justify-center py-12 px-6">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12 px-6 text-muted-foreground">
                  <p>Nenhuma transação encontrada</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow className="h-10">
                        <TableHead className="w-16 text-xs px-4">ID</TableHead>
                        <TableHead className="text-xs px-4">Tipo</TableHead>
                        <TableHead className="text-xs px-4">Moeda</TableHead>
                        <TableHead className="text-right text-xs px-4">Cotação</TableHead>
                        <TableHead className="text-right text-xs px-4">Quantidade</TableHead>
                        <TableHead className="text-right text-xs px-4">Total</TableHead>
                        <TableHead className="text-xs px-4">Data</TableHead>
                        <TableHead className="text-xs px-4">Status</TableHead>
                        <TableHead className="text-center text-xs w-48 px-4">Anotação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => (
                        <React.Fragment key={transaction.id}>
                          <TableRow 
                            className={`hover:bg-muted/50 h-12 cursor-pointer transition-colors ${
                              expandedTransactionId === transaction.id ? 'bg-muted/30' : ''
                            }`}
                            onClick={(e) => {
                              // Prevenir clique quando clicar no botão de editar ou no input
                              const target = e.target as HTMLElement;
                              if (target.closest('button') || target.closest('input')) {
                                return;
                              }
                              handleRowClick(transaction.id);
                            }}
                          >
                            <TableCell className="font-medium text-primary text-xs px-4">
                              <div className="flex items-center gap-2">
                                {expandedTransactionId === transaction.id ? (
                                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                )}
                                #{transaction.id}
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  transaction.type === 'Compra'
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                }`}
                              >
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-xs px-4">{transaction.currency}</TableCell>
                            <TableCell className="text-right font-mono text-xs px-4">
                              <div className="flex flex-col items-end">
                                <span>R${transaction.quote.toFixed(4)}</span>
                                {transaction.clientFinalPrice && (
                                  <span className="text-[10px] text-orange-500 font-medium">
                                    R${transaction.clientFinalPrice.toFixed(4)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[10px] px-4">
                              {transaction.quantity.toLocaleString('pt-BR', {
                                minimumFractionDigits: 8,
                                maximumFractionDigits: 8,
                              })}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs px-4">
                              R${transaction.total.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-4">
                              {transaction.date}
                            </TableCell>
                            <TableCell className="text-xs px-4">{getStatusBadge(transaction.status)}</TableCell>
                            <TableCell className="text-center w-48" onClick={(e) => e.stopPropagation()}>
                              {editingNoteId === transaction.id ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Input
                                    type="text"
                                    defaultValue={transaction.note}
                                    className="h-7 text-xs w-full"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveNote(transaction.id, e.currentTarget.value);
                                      } else if (e.key === 'Escape') {
                                        setEditingNoteId(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                                      if (input) {
                                        handleSaveNote(transaction.id, input.value);
                                      }
                                    }}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  {transaction.note ? (
                                    <span className="text-xs font-medium truncate max-w-[180px]">{transaction.note}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingNoteId(transaction.id);
                                    }}
                                  >
                                    <Edit className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedTransactionId === transaction.id && (
                            <TableRow className="bg-muted/50 hover:bg-muted/60">
                              <TableCell colSpan={9} className="p-0">
                                <BinanceTransactionDetails transaction={transaction} />
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                </Table>
              </div>
              
              {/* Controles de Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} - {Math.min(endIndex, filteredTransactions.length)} de {filteredTransactions.length} transações
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8"
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Mostrar apenas páginas próximas à página atual
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="h-8 w-8 p-0"
                            >
                              {page}
                            </Button>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span key={page} className="px-2 text-sm text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
                </>
              )}
            </TabsContent>
            
            {/* Aba 2: Saques USDT */}
            <TabsContent value="withdrawals" className="mt-0">
              {isAdmin() && (
                <BinanceForwardQueuePanel
                  otcClientId={selectedClientIdNum || undefined}
                  clientNameById={(id) => clients.find((c) => c.id === id)?.name}
                  onCancelled={() => void refetchOtcClientBalance()}
                  onTrack={(withdrawId) => void handleTrackWithdrawal(withdrawId)}
                />
              )}
              {historicoSaquesLoading ? (
                <div className="flex items-center justify-center py-12 px-6">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredWithdrawals.length === 0 ? (
                <div className="text-center py-12 px-6 text-muted-foreground">
                  <p>Nenhum saque encontrado</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-8">
                          <TableHead className="w-20 text-xs px-4">ID</TableHead>
                          <TableHead className="text-xs px-4">Moeda</TableHead>
                          <TableHead className="text-right text-xs px-4">Quantidade</TableHead>
                          <TableHead className="text-right text-xs px-4">Taxa</TableHead>
                          <TableHead className="text-xs px-4">Endereço</TableHead>
                          <TableHead className="text-xs px-4">Rede</TableHead>
                          <TableHead className="text-xs px-4">Cliente</TableHead>
                          <TableHead className="text-xs px-4">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedWithdrawals.map((saque) => {
                          const blockchainLink = getBlockchainLink(saque.network, saque.txId);
                          const trackWithdrawId = saque.withdrawId || saque.id;
                          return (
                          <TableRow
                            key={saque.withdrawId || saque.id}
                            className="hover:bg-muted/50 h-8 cursor-pointer"
                            title="Clique para acompanhar o repasse"
                            onClick={
                              trackWithdrawId
                                ? () => void handleTrackWithdrawal(String(trackWithdrawId))
                                : undefined
                            }
                          >
                            <TableCell className="font-medium text-primary text-xs px-4">
                              {blockchainLink ? (
                                <a
                                  href={blockchainLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 hover:underline text-primary hover:text-primary/80 transition-colors"
                                >
                                  #{saque.withdrawId || saque.id}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                `#${saque.withdrawId || saque.id}`
                              )}
                            </TableCell>
                            <TableCell className="px-4">
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">
                                {saque.coin}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs px-4">
                              {saque.amount.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs px-4">
                              {saque.transactionFee}
                            </TableCell>
                            <TableCell className="text-xs px-4 font-mono max-w-[150px] truncate">
                              {saque.address}
                            </TableCell>
                            <TableCell className="text-xs px-4">
                              <Badge variant="outline" className="text-[10px]">
                                {saque.network}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs px-4 font-medium">
                              {saque.clientName || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-4">
                              {saque.displayDate}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Controles de Paginação */}
                  {totalPagesWithdrawals > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {startIndexWithdrawals + 1} - {Math.min(endIndexWithdrawals, filteredWithdrawals.length)} de {filteredWithdrawals.length} saques
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageWithdrawals(prev => Math.max(1, prev - 1))}
                          disabled={currentPageWithdrawals === 1}
                          className="h-8"
                        >
                          Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPagesWithdrawals }, (_, i) => i + 1).map((page) => {
                            // Mostrar apenas páginas próximas à página atual
                            if (
                              page === 1 ||
                              page === totalPagesWithdrawals ||
                              (page >= currentPageWithdrawals - 1 && page <= currentPageWithdrawals + 1)
                            ) {
                              return (
                                <Button
                                  key={page}
                                  variant={currentPageWithdrawals === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPageWithdrawals(page)}
                                  className="h-8 w-8 p-0"
                                >
                                  {page}
                                </Button>
                              );
                            } else if (
                              page === currentPageWithdrawals - 2 ||
                              page === currentPageWithdrawals + 2
                            ) {
                              return (
                                <span key={page} className="px-2 text-sm text-muted-foreground">
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPageWithdrawals(prev => Math.min(totalPagesWithdrawals, prev + 1))}
                          disabled={currentPageWithdrawals === totalPagesWithdrawals}
                          className="h-8"
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modais */}
      <BinanceWithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={handleCloseWithdrawalModal}
        onConfirm={handleSolicitarSaque}
        loading={withdrawalLoading}
        balances={balances}
        client={(() => {
          const clientToUse = selectedClientData || clients.find((c) => c.id.toString() === selectedClient);
          return clientToUse || null;
        })()}
        quote={quote}
        onRequestQuote={handleRequestQuoteForWithdrawal}
        otcUsdAvailable={
          otcClientBalance.usd_available ?? otcClientBalance.usd_balance ?? null
        }
        otcUsdReserved={otcClientBalance.usd_balance_reserved ?? 0}
        otcUsdBalance={otcClientBalance.usd_balance ?? null}
      />

      <BinanceForwardTrackingModal
        isOpen={showTrackingModal}
        withdrawId={activeWithdrawId}
        forwardStatus={forwardStatus}
        isPollingForward={isPollingForward}
        onContinueInBackground={handleContinueTrackingInBackground}
        onDismiss={handleDismissTracking}
      />

      <TradeConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleConfirmTrade}
        loading={tradeLoading}
        quote={quote}
        selectedClient={(() => {
          // Usar dados do cliente específico (que tem fee) se disponível, senão usar da lista
          const clientToUse = selectedClientData || clients.find((c) => c.id.toString() === selectedClient);
          return clientToUse || null;
        })()}
        operationType={operationType}
        binanceFee={binanceConfig?.fee || 0.039}
      />
    </div>
  );
};

export default OTCNegociar;
