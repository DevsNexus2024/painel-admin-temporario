import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendHorizontal, RefreshCcw, Loader2, DollarSign, Wifi, WifiOff, CheckCircle, AlertCircle, TrendingUp, Lock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useBitsoWebSocket } from "@/hooks/useBitsoWebSocket";
import { BitsoRealtimeService } from "@/services/bitso-realtime";
import AnimatedBalance from "@/components/AnimatedBalance";

export default function TopBarBitsoTcr() {
  const { isConnected, isReconnecting, newBalance, newTransaction } = useBitsoWebSocket();
  const [balanceData, setBalanceData] = useState({
    currency: 'BRL',
    total: '0',
    available: '0',
    locked: '0',
    pendingDeposit: '0',
    pendingWithdrawal: '0'
  });
  const [totalTransacoes, setTotalTransacoes] = useState<number>(0);
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<string | null>(null);

  // Buscar saldo REAL da API
  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);
    
    try {
      const response = await BitsoRealtimeService.getBalanceCached();
      
      // A API retorna: { success: true, data: { balance: { currency, total, available, locked, pendingDeposit, pendingWithdrawal }, timestamp } }
      if (response?.data?.balance) {
        const balance = response.data.balance;
        setBalanceData({
          currency: balance.currency?.toUpperCase() || 'BRL',
          total: String(balance.total || 0),
          available: String(balance.available || 0),
          locked: String(balance.locked || 0),
          pendingDeposit: String(balance.pendingDeposit || 0),
          pendingWithdrawal: String(balance.pendingWithdrawal || 0)
        });
      }

      // Buscar total de transações
      const transactionsData = await BitsoRealtimeService.getTransactions({
        limit: 1,
        offset: 0
      });
      setTotalTransacoes(transactionsData.pagination.total || 0);
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
      console.error('[TopBarBitsoTcr] Erro ao buscar saldo:', err);
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  // Carregar saldo ao montar
  useEffect(() => {
    fetchSaldo();
  }, []);

  // Atualizar saldo quando receber via WebSocket
  useEffect(() => {
    if (newBalance && newBalance.length > 0) {
      const brlBalance = newBalance.find(b => b.currency === 'brl');
      if (brlBalance) {
        setBalanceData({
          currency: brlBalance.currency?.toUpperCase() || 'BRL',
          total: String(brlBalance.total || 0),
          available: String(brlBalance.available || 0),
          locked: String(brlBalance.locked || 0),
          pendingDeposit: String(brlBalance.pendingDeposit || 0),
          pendingWithdrawal: String(brlBalance.pendingWithdrawal || 0)
        });
      }
    }
  }, [newBalance]);

  // Recarregar saldo quando receber nova transação
  useEffect(() => {
    if (newTransaction) {
      console.log('💰 Nova transação detectada, recarregando saldo...');
      setTimeout(() => {
        fetchSaldo();
      }, 500);
    }
  }, [newTransaction]);

  const handleRefresh = () => {
    fetchSaldo();
  };

  const parseValue = (value: string): number => {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  const getContaInfo = () => {
    return (
      <div className="text-xs text-muted-foreground">
        <span>
          Bitso → TCR • {balanceData.currency} • {new Date().toLocaleTimeString('pt-BR')}
        </span>
      </div>
    );
  };

  const getStatusIcon = () => {
    if (isLoadingSaldo) {
      return <Loader2 className="h-4 w-4 animate-spin text-orange-500" />;
    }
    if (errorSaldo) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="sticky top-0 z-30 bg-gradient-to-r from-orange-600/10 to-red-600/10 backdrop-blur-xl border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 shadow-xl">
            <SendHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Bitso → TCR</h1>
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
              {/* Status WebSocket com estado de reconexão */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md">
                    <Wifi className="h-3 w-3" />
                    <span className="text-xs font-medium">Tempo Real</span>
                  </div>
                ) : isReconnecting ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs font-medium">Reconectando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-md">
                    <WifiOff className="h-3 w-3" />
                    <span className="text-xs font-medium">Offline</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Central de transferências PIX {isConnected && '• Atualizações em tempo real'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingSaldo}
            className="hover:bg-muted rounded-xl"
          >
            {isLoadingSaldo ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-sm">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Cards lado a lado - 5 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Total</span>
            <TrendingUp className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-orange-600 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.total)} /></div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Saldo total
          </div>
        </div>

        {/* Card 2: Available */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-500/20 hover:border-green-500/40 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Disponível</span>
            <DollarSign className="h-4 w-4 text-green-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-green-600 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.available)} /></div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-xs text-muted-foreground">
              Uso imediato
            </div>
            {isConnected && (
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Card 3: Locked */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 backdrop-blur-sm border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Bloqueado</span>
            <Lock className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-amber-600 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.locked)} /></div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Em processamento
          </div>
        </div>

        {/* Card 4: Pending Deposit */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Depósito Pendente</span>
            <ArrowDownCircle className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-blue-600 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingDeposit)} /></div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            A receber
          </div>
        </div>

        {/* Card 5: Pending Withdrawal */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-pink-500/10 backdrop-blur-sm border border-red-500/20 hover:border-red-500/40 transition-all duration-300 group shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Saque Pendente</span>
            <ArrowUpCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-red-600 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingWithdrawal)} /></div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            A enviar
          </div>
        </div>
      </div>
    </div>
  );
}

