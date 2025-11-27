import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendHorizontal, RefreshCcw, Loader2, DollarSign, Wifi, WifiOff, CheckCircle, AlertCircle, FileText, Banknote, Lock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";
import { BrasilCashRealtimeService } from "@/services/brasilcash-realtime";
import AnimatedBalance from "@/components/AnimatedBalance";

// Constantes para TCR BrasilCash
const TCR_ACCOUNT_ID = BrasilCashRealtimeService.TCR_ACCOUNT_ID;

export default function TopBarBrasilCashTcr() {
  // WebSocket filtrado para TCR (mantendo compatibilidade por enquanto)
  const { isConnected, isReconnecting, newBalance, newTransaction } = useFilteredBitsoWebSocket({
    context: 'tcr',
    tenantId: 2,
  });
  const [balanceData, setBalanceData] = useState({
    currency: 'BRL',
    total: '0',
    available: '0',
    locked: '0',
    pendingDeposit: '0',
    pendingWithdrawal: '0'
  });
  const [accountInfo, setAccountInfo] = useState<{
    account_id?: string;
    name?: string;
    account_number?: string;
    branch_code?: string;
  }>({});
  const [totalTransacoes, setTotalTransacoes] = useState<number>(0);
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<string | null>(null);

  // Buscar saldo REAL da API BrasilCash
  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);
    
    try {
      // Buscar informações completas da conta usando /api/brasilcash/account/me
      // Retorna informações da conta autenticada
      const accountInfoResponse = await BrasilCashRealtimeService.getAccountInfo();

      if (accountInfoResponse) {
        // Salvar informações da conta
        setAccountInfo({
          account_id: accountInfoResponse.account_id,
          name: accountInfoResponse.name,
          account_number: accountInfoResponse.account_number,
          branch_code: accountInfoResponse.branch_code,
        });

        // Converter valores de centavos para reais
        // API retorna valores em centavos (ex: 16 = R$ 0,16, 1600 = R$ 16,00)
        const balance = accountInfoResponse.balance;
        const availableValue = balance?.available ?? 0;
        const blockedValue = balance?.blocked ?? 0;
        const futureValue = balance?.future ?? 0;
        
        // Converter de centavos para reais (dividir por 100)
        const available = (availableValue / 100).toFixed(2);
        const blocked = (blockedValue / 100).toFixed(2);
        const future = (futureValue / 100).toFixed(2);
        const total = ((availableValue + blockedValue + futureValue) / 100).toFixed(2);

        setBalanceData({
          currency: 'BRL',
          total: total,
          available: available,
          locked: blocked,
          pendingDeposit: future,
          pendingWithdrawal: '0'
        });
      } else {
        setBalanceData({
          currency: 'BRL',
          total: '0',
          available: '0',
          locked: '0',
          pendingDeposit: '0',
          pendingWithdrawal: '0'
        });
      }
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
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

  // Recarregar saldo quando receber nova transação (após toast aparecer)
  useEffect(() => {
    if (newTransaction) {
      // Delay maior para que o toast apareça primeiro (2s após evento)
      setTimeout(() => {
        fetchSaldo();
      }, 2000);
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
          BrasilCash → TCR • {balanceData.currency} • {new Date().toLocaleTimeString('pt-BR')}
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
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-600 shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-orange-500" />
              <h1 className="text-2xl font-bold text-foreground">BrasilCash → TCR</h1>
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
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-sm">
                Central de transferências PIX {isConnected && '• Atualizações em tempo real'}
              </p>
              {accountInfo.name && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">{accountInfo.name}</span>
                  {accountInfo.account_number && (
                    <>
                      <span>•</span>
                      <span>Conta: {accountInfo.account_number}</span>
                    </>
                  )}
                  {accountInfo.branch_code && (
                    <>
                      <span>•</span>
                      <span>Agência: {accountInfo.branch_code}</span>
                    </>
                  )}
                  {accountInfo.account_id && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[10px]">ID: {accountInfo.account_id.substring(0, 8)}...</span>
                    </>
                  )}
                </div>
              )}
            </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {/* Card 1: Total */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-[18px] w-[18px] text-[rgb(0,105,209)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Total</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(0,105,209)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.total)} /></div>
            )}
          </div>
        </div>

        {/* Card 2: Available */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-[18px] w-[18px] text-[rgb(56,209,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Disponível</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(56,209,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.available)} /></div>
            )}
          </div>
        </div>

        {/* Card 3: Locked */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-[18px] w-[18px] text-[rgb(184,0,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Bloqueado</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(184,0,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.locked)} /></div>
            )}
          </div>
        </div>

        {/* Card 4: Pending Deposit */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="h-[18px] w-[18px] text-[rgb(218,114,45)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Depósito Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(218,114,45)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingDeposit)} /></div>
            )}
          </div>
        </div>

        {/* Card 5: Pending Withdrawal */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="h-[18px] w-[18px] text-[rgb(160,38,29)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saque Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(160,38,29)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.pendingWithdrawal)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

