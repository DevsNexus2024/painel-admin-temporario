import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, Edit, Loader2, Wallet, Zap, ArrowUpDown, RefreshCw, Save } from 'lucide-react';
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
import { useBinanceTrade } from '@/hooks/useBinanceTrade';
import { useBinanceWithdrawal } from '@/hooks/useBinanceWithdrawal';
import { useBinanceBalances } from '@/hooks/useBinanceBalances';
import { useOTCClients, useOTCClient } from '@/hooks/useOTCClients';
import { BinanceWithdrawalModal } from '@/components/otc/BinanceWithdrawalModal';
import { TradeConfirmationModal } from '@/components/otc/TradeConfirmationModal';
import { getBinanceConfigs, createBinanceTransaction } from '@/services/otc-binance';
import { toastError, toastSuccess } from '@/utils/toast';
import type { BinanceTransaction } from '@/types/binance';
import type { OTCClient } from '@/types/otc';

const OTCNegociar: React.FC = () => {
  // ==================== TRADING HOOKS ====================
  const {
    quote,
    quoteLoading,
    quoteError,
    solicitarCotacao,
    tradeLoading,
    executarTrade,
    carregarHistorico,
    historico,
    historicoLoading,
    resetarEstado,
  } = useBinanceTrade();

  // ==================== WITHDRAWAL HOOKS ====================
  const {
    criarSaque,
    withdrawalLoading,
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

  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  // Modal states
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  
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
  
  // Carregar saldos e histórico ao montar o componente
  useEffect(() => {
    carregarSaldos();
    carregarHistorico('USDTBRL', 500);
    
    // Buscar configuração Binance
    getBinanceConfigs().then((configs) => {
      if (configs.length > 0) {
        setBinanceConfig({
          fee: configs[0].fee * 100, // Converter de decimal para porcentagem
          id: configs[0].id,
        });
      }
    });
  }, [carregarSaldos, carregarHistorico]);

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
      const quantityValue = parseFloat(quantity.replace(/[^0-9.-]+/g, ''));
      const totalValue = parseFloat(total.replace(/[^0-9.-]+/g, ''));
      
      if (quantityValue > 0 && !totalValue) {
        // Se preencheu quantidade em USDT, preencher total em BRL
        setTotal(quote.outputAmount.toFixed(4));
      } else if (totalValue > 0 && !quantityValue) {
        // Se preencheu total em BRL, preencher quantidade em USDT
        setQuantity(quote.outputAmount.toFixed(8));
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
    
    // Verificar qual campo foi preenchido
    const quantityValue = parseFloat(quantity.replace(/[^0-9.-]+/g, ''));
    const totalValue = parseFloat(total.replace(/[^0-9.-]+/g, ''));
    
    if (quantityValue > 0) {
      // Enviar USDT
      await solicitarCotacao(quantityValue, 'USDT', symbol, side);
    } else if (totalValue > 0) {
      // Enviar BRL
      await solicitarCotacao(totalValue, 'BRL', symbol, side);
    } else {
      toastError('Valor inválido', 'Por favor, informe um valor válido em USDT ou BRL');
      return;
    }

    // Iniciar countdown de 10 segundos
    setCountdown(10);
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
  const handleConfirmTrade = async (finalPrice: number) => {
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
      toastSuccess('Trade executado com sucesso', `Ordem #${response.data.orderId} executada na Binance`);
      
      // Salvar transação no banco de dados
      try {
        const avgPrice = quote.averagePrice;
        const binanceFeeAmount = avgPrice * (binanceConfig.fee / 100);
        const clientFee = selectedClientData?.fee || 0;
        const clientFeeAmount = (avgPrice + binanceFeeAmount) * clientFee;
        
        const transactionData = {
          id_binance_account: binanceConfig.id,
          otc_client_id: parseInt(selectedClient),
          binance_transaction_id: response.data.orderId.toString(),
          transaction_type: operationType === 'buy' ? 'BUY' : 'SELL' as 'BUY' | 'SELL',
          binance_price_average_no_fees: avgPrice,
          binance_fee_percentage: binanceConfig.fee / 100, // Converter para decimal
          binance_fee_amount: binanceFeeAmount,
          binance_price_average_with_fees: avgPrice + binanceFeeAmount,
          client_fee_percentage_applied: clientFee,
          client_fee_amount_applied: clientFeeAmount,
          client_final_price: finalPrice,
          input_coin_id: quote.inputCurrency === 'BRL' ? 7 : 3, // BRL: 7, USDT: 3
          input_coin_amount: quote.inputAmount,
          output_coin_id: quote.outputCurrency === 'BRL' ? 7 : 3,
          output_coin_amount: quote.outputAmount,
          binance_transaction_date: new Date().toISOString(),
          transaction_status: 'COMPLETED' as const,
          transaction_notes: `Trade ${operationType === 'buy' ? 'de compra' : 'de venda'} executado via OTC`,
        };
        
        const savedTransaction = await createBinanceTransaction(transactionData);
        
        if (savedTransaction) {
          console.log('✅ Transação salva com sucesso:', savedTransaction);
        }
      } catch (error) {
        console.error('❌ Erro ao salvar transação:', error);
        toastError('Aviso', 'Trade executado mas não foi possível salvar os detalhes');
      }
      
      // Recarregar histórico
      await carregarHistorico('USDTBRL', 500);
      
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
   * Solicitar saque
   */
  const handleSolicitarSaque = async (data: {
    coin: string;
    amount: string;
    address: string;
    network?: string;
    addressTag?: string;
  }) => {
    const response = await criarSaque(
      data.coin,
      data.amount,
      data.address,
      data.network,
      data.addressTag
    );

    if (response) {
      setShowWithdrawalModal(false);
    }
  };

  /**
   * Handler para mudança no campo Quantidade (USDT)
   */
  const handleQuantityChange = (value: string) => {
    // Aceitar apenas números e ponto decimal
    const numericValue = value.replace(/[^0-9.]/g, '');
    setQuantity(numericValue);
    // Limpar campo Total quando quantidade é editada
    if (numericValue) {
      setTotal('');
    }
  };

  /**
   * Handler para mudança no campo Total (BRL)
   */
  const handleTotalChange = (value: string) => {
    // Aceitar apenas números e ponto decimal
    const numericValue = value.replace(/[^0-9.]/g, '');
    setTotal(numericValue);
    // Limpar campo Quantity quando total é editado
    if (numericValue) {
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
        setTotal(maxBRL.toFixed(4));
        // Limpar quantidade quando usar MAX
        setQuantity('');
      }
    }
  };

  /**
   * Handler para salvar anotação
   */
  const handleSaveNote = (transactionId: string, noteValue: string) => {
    setNotes((prev) => ({
      ...prev,
      [transactionId]: noteValue,
    }));
    setEditingNoteId(null);
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
   * Converter histórico da Binance para formato de Transaction
   */
  const converterHistorico = (): BinanceTransaction[] => {
    return historico.map((item) => {
      // A API da Binance retorna 'qty' ao invés de 'quantity' e 'time' ao invés de 'timestamp'
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat((item as any).qty || (item as any).quantity) || 0;
      const tot = price * qty;
      
      return {
        id: `O${item.id}`,
        type: item.isBuyer ? 'Compra' : 'Venda',
        currency: item.symbol.replace('BRL', '').replace('USDT', 'USDT'),
        quote: price,
        quantity: qty,
        total: tot,
        date: formatDate((item as any).time || (item as any).timestamp),
        status: 'Executada' as const,
        note: notes[`O${item.id}`] || '',
        orderId: item.id,
      };
    });
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

  // ==================== RENDER ====================

  const transactions = converterHistorico();
  const filteredTransactions = transactions.filter((t) =>
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            Binance Connected • {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            carregarSaldos();
            carregarHistorico('USDTBRL', 500);
          }}
          className="gap-2 h-8 text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </Button>
      </div>

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
                  placeholder="0.0000"
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
                    placeholder="0.0000"
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
                className="w-full bg-orange-600 hover:bg-orange-700 text-xs font-bold h-10 text-white"
                onClick={() => setShowWithdrawalModal(true)}
              >
                <Wallet className="w-3 h-3 mr-2" />
                Solicitar Saque
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
        <CardContent className="p-0">
          {historicoLoading ? (
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
                      <TableRow className="h-8">
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
                      {filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-muted/50 h-8">
                          <TableCell className="font-medium text-primary text-xs px-4">
                            #{transaction.id}
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
                            R${transaction.quote.toFixed(4)}
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
                        <TableCell className="text-center w-48">
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
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 flex-shrink-0"
                                onClick={(e) => {
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
                                onClick={() => setEditingNoteId(transaction.id)}
                              >
                                <Edit className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <BinanceWithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        onConfirm={handleSolicitarSaque}
        loading={withdrawalLoading}
        balances={balances}
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
        binanceFee={binanceConfig?.fee || 0.039} // Taxa da Binance em %
      />
    </div>
  );
};

export default OTCNegociar;
