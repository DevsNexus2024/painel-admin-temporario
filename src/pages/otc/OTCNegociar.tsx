import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, Edit, Loader2 } from 'lucide-react';
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
import { BinanceWithdrawalModal } from '@/components/otc/BinanceWithdrawalModal';
import type { BinanceTransaction } from '@/types/binance';

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
  const [selectedCurrency, setSelectedCurrency] = useState('USDT/BRL');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

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
  
  const creditUSDT = usdtBalance && parseFloat(usdtBalance.locked) > 0
    ? `${parseFloat(usdtBalance.locked).toLocaleString('pt-BR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} USDT`
    : '0.00000000 USDT';
  
  const credit = brlBalance && parseFloat(brlBalance.locked) > 0
    ? `R$${parseFloat(brlBalance.locked).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'R$0,00';

  // ==================== EFFECTS ====================
  
  // Carregar saldos e histórico ao montar o componente
  useEffect(() => {
    carregarSaldos();
    carregarHistorico('USDTBRL', 500);
  }, [carregarSaldos, carregarHistorico]);

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
      alert('Por favor, informe um valor válido em USDT ou BRL');
      return;
    }
  };

  /**
   * Executar trade direto
   */
  const handleExecutarTrade = async () => {
    if (!quote) {
      alert('Por favor, solicite uma cotação primeiro');
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

    if (response) {
      // Recarregar histórico
      await carregarHistorico('USDTBRL', 500);
      // Limpar cotação
      // setQuote(null);
    }
  };

  /**
   * Solicitar nova cotação
   */
  const handleSolicitarNovaCotacao = async () => {
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
      alert('Por favor, informe um valor válido em USDT ou BRL');
      return;
    }
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
    setQuantity(value);
    // Limpar campo Total quando quantidade é editada
    if (value) {
      setTotal('');
    }
  };

  /**
   * Handler para mudança no campo Total (BRL)
   */
  const handleTotalChange = (value: string) => {
    setTotal(value);
    // Limpar campo Quantity quando total é editado
    if (value) {
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
    return historico.map((item) => ({
      id: `O${item.id}`,
      type: item.isBuyer ? 'Compra' : 'Venda',
      currency: item.symbol.replace('BRL', '').replace('USDT', 'USDT'),
      quote: parseFloat(item.price),
      quantity: parseFloat(item.quantity),
      total: parseFloat(item.price) * parseFloat(item.quantity),
      date: formatDate(item.timestamp),
      status: 'Executada' as const,
      note: '',
      orderId: item.id,
    }));
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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-primary" />
            OTC - Negociar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {new Date().toLocaleTimeString('pt-BR')} - Binance Connected
            </span>
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Área de Negociação */}
        <div className="flex flex-col gap-6">
          {/* Cards de Saldo e Crédito */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Saldo disponível
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balancesLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregando...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">
                      {availableBalance}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {availableBalanceUSDT}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Crédito
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balancesLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregando...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">{credit}</p>
                    <p className="text-xs text-muted-foreground">{creditUSDT}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Card de Negociação */}
          <Card className="hover:shadow-lg transition-shadow flex-1 flex flex-col">
            <CardContent className="pt-6 flex-1 flex flex-col gap-5">
              {/* Seleção de Moeda */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Moeda selecionada
                </label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-full bg-muted/50 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-green-500">₮</span>
                        </div>
                        USDT/BRL
                      </div>
                    </SelectItem>
                    <SelectItem value="BTC/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-orange-500">₿</span>
                        </div>
                        BTC/BRL
                      </div>
                    </SelectItem>
                    <SelectItem value="ETH/BRL">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-500">Ξ</span>
                        </div>
                        ETH/BRL
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botões Comprar/Vender */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <Button
                  size="lg"
                  className={`h-14 text-lg font-semibold ${
                    operationType === 'buy'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('buy')}
                >
                  Comprar
                </Button>
                <Button
                  size="lg"
                  className={`h-14 text-lg font-semibold ${
                    operationType === 'sell'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  onClick={() => setOperationType('sell')}
                >
                  Vender
                </Button>
              </div>

              {/* Quantidade */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Quantidade (USDT)
                </label>
                <Input
                  type="text"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="bg-muted/50 text-xl h-14"
                  placeholder="0.0000"
                />
              </div>

              {/* Total */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Total (BRL)
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={total}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    className="bg-muted/50 text-xl h-14 pr-20"
                    placeholder="0.0000"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 h-10 px-4 text-base font-semibold"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              {/* Botão Solicitar Cotação */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xl font-semibold h-16"
                  onClick={handleSolicitarCotacao}
                  disabled={quoteLoading}
                >
                  {quoteLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    'Solicitar cotação'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Cotação Atual e Saque */}
        <div className="space-y-6">
          {/* Card de Cotação */}
          <Card className="hover:shadow-lg transition-shadow sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                Cotação para {operationType === 'buy' ? 'Comprar' : 'Vender'}
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {quote ? (
                <>
                  <div className="text-center space-y-4">
                    <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-3xl font-bold text-primary">
                        R$ {quote.averagePrice.toFixed(4)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Preço Médio</p>
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

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-lg font-semibold h-12"
                    onClick={handleExecutarTrade}
                    disabled={tradeLoading}
                  >
                    {tradeLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Executando...
                      </>
                    ) : (
                      'Executar Trade'
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSolicitarNovaCotacao}
                    disabled={quoteLoading}
                  >
                    {quoteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      'Solicitar nova cotação'
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma cotação disponível</p>
                  <p className="text-sm mt-2">Clique em "Solicitar cotação" para obter uma cotação</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Saque para Wallets */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                Saque para Wallets
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <span className="text-orange-500 text-xs">₿</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>Solicite saques para suas wallets</p>
                <p className="text-sm mt-2">Suporte para USDT, BTC e ETH</p>
              </div>

              {/* Botão de Saque */}
              <Button
                size="lg"
                className="w-full bg-orange-600 hover:bg-orange-700 text-base font-semibold"
                onClick={() => setShowWithdrawalModal(true)}
              >
                Solicitar Saque
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico de Transações */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-xl font-semibold">Histórico</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historicoLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma transação encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Moeda</TableHead>
                      <TableHead className="text-right">Cotação</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Anotação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-primary">
                          #{transaction.id}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              transaction.type === 'Compra'
                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            }
                          >
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{transaction.currency}</TableCell>
                        <TableCell className="text-right font-mono">
                          R${transaction.quote.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {transaction.quantity.toLocaleString('pt-BR', {
                            minimumFractionDigits: 8,
                            maximumFractionDigits: 8,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          R${transaction.total.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {transaction.date}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-center">
                          {transaction.note ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm font-medium">{transaction.note}</span>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
      />
    </div>
  );
};

export default OTCNegociar;
