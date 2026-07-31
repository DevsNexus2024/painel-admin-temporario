import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, Wifi, WifiOff, CheckCircle, AlertCircle, FileText, Banknote, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useNtxRealtime } from "@/hooks/useNtxRealtime";
import { getNtxBalance } from "@/services/ntx-realtime";
import AnimatedBalance from "@/components/AnimatedBalance";

export default function TopBarNtxTcr() {
  // Sem WebSocket na NTX (stub) — indicador fica Offline, refresh é manual
  const { isConnected, isReconnecting } = useNtxRealtime();
  // Valores em REAIS direto da API (a NTX NÃO é centavos — não dividir por 100)
  const [balanceData, setBalanceData] = useState({
    currency: 'BRL',
    net: '0',
    gross: '0',
    blocked: '0',
  });
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [errorSaldo, setErrorSaldo] = useState<string | null>(null);

  const fetchSaldo = async () => {
    setIsLoadingSaldo(true);
    setErrorSaldo(null);

    try {
      const balance = await getNtxBalance();
      setBalanceData({
        currency: 'BRL',
        net: (balance.netBalance ?? 0).toFixed(2),
        gross: (balance.grossBalance ?? 0).toFixed(2),
        blocked: (balance.blockedBalance ?? 0).toFixed(2),
      });
    } catch (err: any) {
      setErrorSaldo(err.message || 'Erro ao consultar saldo');
    } finally {
      setIsLoadingSaldo(false);
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">NTX Pay → TCR</h1>
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
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
              Saldo e extrato da conta NTX Pay da TCR
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

      {/* Cards lado a lado - 3 cards (a NTX só expõe net/gross/blocked) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        {/* Card 1: Saldo líquido */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-[18px] w-[18px] text-[rgb(56,209,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Líquido</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(56,209,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.net)} /></div>
            )}
          </div>
        </div>

        {/* Card 2: Saldo bruto */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-[18px] w-[18px] text-[rgb(0,105,209)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Bruto</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(0,105,209)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.gross)} /></div>
            )}
          </div>
        </div>

        {/* Card 3: Bloqueado */}
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
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(balanceData.blocked)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
