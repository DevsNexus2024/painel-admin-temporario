import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, Wifi, WifiOff, CheckCircle, AlertCircle, FileText, Banknote, Lock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useBelmontXRealtime } from "@/hooks/useBelmontXRealtime";
import AnimatedBalance from "@/components/AnimatedBalance";
import { consultarSaldoBelmontX, consultarExtratoBelmontX } from "@/services/belmontx";

export default function TopBarBelmontXTcr() {
  // WebSocket para BelmontX TCR (não disponível no momento)
  const { isConnected, isReconnecting } = useBelmontXRealtime({
    tenantId: 2, // BelmontX TCR
  });

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

  // Buscar saldo usando API BelmontX
  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);
    
    try {
      // ✅ Usar endpoint específico de saldo da BelmontX
      const saldoResponse = await consultarSaldoBelmontX();
      
      console.log('[BELMONTX-TCR] Resposta de saldo:', saldoResponse);
      
      if (saldoResponse?.response?.success) {
        const saldoReais = parseFloat(saldoResponse.response.saldoReais || '0');
        
        if (!isNaN(saldoReais)) {
          setBalanceData({
            currency: 'BRL',
            total: String(Math.abs(saldoReais)),
            available: String(Math.abs(saldoReais)),
            locked: '0',
            pendingDeposit: '0',
            pendingWithdrawal: '0'
          });
          setErrorSaldo(null);
        } else {
          console.warn('[BELMONTX-TCR] Saldo inválido:', saldoResponse.response.saldoReais);
          setErrorSaldo('Saldo inválido na resposta da API');
        }
      } else {
        setErrorSaldo('Resposta inválida da API');
      }
      
      // Buscar total de transações (últimos 30 dias para contagem)
      const hoje = new Date();
      const dataInicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dataFim = hoje.toISOString().split('T')[0];
      
      try {
        const extratoResponse = await consultarExtratoBelmontX({
          dataInicio,
          dataFim,
          porPagina: 1, // Apenas para obter total
        });
        
        setTotalTransacoes(extratoResponse.response.paginacao?.total || 0);
      } catch (extratoErr) {
        // Se falhar ao buscar extrato, não é crítico
        console.warn('[BELMONTX-TCR] Erro ao buscar total de transações:', extratoErr);
        setTotalTransacoes(0);
      }
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
      // Se falhar, inicializar com zero
      setBalanceData({
        currency: 'BRL',
        total: '0',
        available: '0',
        locked: '0',
        pendingDeposit: '0',
        pendingWithdrawal: '0'
      });
      setTotalTransacoes(0);
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  // Carregar saldo ao montar
  useEffect(() => {
    fetchSaldo();
  }, []);

  const handleRefresh = () => {
    fetchSaldo();
  };

  const parseValue = (value: string): number => {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  const getStatusIcon = () => {
    if (isLoadingSaldo) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
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
          <div className="p-3 rounded-2xl bg-[#9333ea] shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-[#9333ea]" />
              <h1 className="text-2xl font-bold text-foreground">BelmontX</h1>
              <Badge className="bg-[rgba(147,51,234,0.2)] text-[#9333ea] border-[rgba(147,51,234,0.4)] text-xs font-medium">
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
              Central de transferências PIX BelmontX {isConnected && '• Atualizações em tempo real'}
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
            <ArrowDownCircle className="h-[18px] w-[18px] text-[#9333ea] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Depósito Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[#9333ea] mt-1 overflow-hidden">
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
            <ArrowUpCircle className="h-[18px] w-[18px] text-[#9333ea] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saque Pendente</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[#9333ea] mt-1 overflow-hidden">
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
