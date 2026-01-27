import React, { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, DollarSign, Lock, CheckCircle, AlertCircle, FileText, Banknote, Wifi, WifiOff } from "lucide-react";
import { useCorpXSaldo } from "@/hooks/useCorpXSaldo";
import { CorpXService } from "@/services/corpx";
import { useCorpX } from "@/contexts/CorpXContext";
import { toast } from "sonner";
import AnimatedBalance from "@/components/AnimatedBalance";
import { useCorpxRealtime } from "@/hooks/useCorpxRealtime";

export default function TopBarCorpX() {
  const { taxDocument, selectedAccount } = useCorpX();
  
  // Remove formatação do CNPJ para usar apenas números na API
  const cnpjNumerico = taxDocument.replace(/\D/g, '');
  
  const {
    saldo: saldoData,
    isLoading: isLoadingSaldo,
    error: errorSaldo,
    refresh: handleRefresh,
    lastUpdated
  } = useCorpXSaldo({ 
    cnpj: cnpjNumerico,
    autoRefresh: false // Refresh manual via botão
  });

  // WebSocket para tempo real (se disponível)
  const { isConnected, isReconnecting } = useCorpxRealtime({
    taxDocument: cnpjNumerico
  });

  // 🔄 Recarregar saldo automaticamente quando tax_document mudar
  useEffect(() => {
    if (cnpjNumerico && cnpjNumerico.length === 14) {
      console.log('[CORPX-SALDO] 🔄 Tax document alterado, recarregando saldo...', cnpjNumerico);
      handleRefresh();
      toast.info("Atualizando saldo para nova conta...");
    }
  }, [cnpjNumerico, handleRefresh]);

  const formatCurrency = (value: number) => {
    return CorpXService.formatarValor(value);
  };

  // Funções para exibir saldos baseadas na nova API
  const getSaldoDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro ao consultar saldo CORPX';
    if (saldoData?.erro) return 'Erro na API CORPX';
    return formatCurrency(saldoData?.saldo || 0);
  };

  const getSaldoDisponivelDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro';
    if (saldoData?.erro) return 'Erro';
    return formatCurrency(saldoData?.saldoDisponivel || 0);
  };

  const getLimiteBloqueadoDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro';
    if (saldoData?.erro) return 'Erro';
    return formatCurrency(saldoData?.limiteBloqueado || 0);
  };

  const parseValue = (value: string | number): number => {
    const numValue = parseFloat(String(value));
    return isNaN(numValue) ? 0 : numValue;
  };

  const getStatusIcon = () => {
    if (isLoadingSaldo) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (errorSaldo || saldoData?.erro) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-600 shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-purple-600" />
              <h1 className="text-2xl font-bold text-foreground">CORPX</h1>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
              {/* Status WebSocket com estado de reconexão */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
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
            <span className="ml-2 text-sm text-muted-foreground">
              {isLoadingSaldo ? "Atualizando..." : "Atualizar"}
            </span>
          </Button>
        </div>
      </div>

      {/* Cards lado a lado - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Card 1: Saldo Global */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-[18px] w-[18px] text-purple-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Global</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-purple-500 mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoData?.globalBalance || 0)} /></div>
            )}
          </div>
        </div>

        {/* Card 2: Saldo */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-[18px] w-[18px] text-purple-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-purple-500 mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoData?.saldo || 0)} /></div>
            )}
          </div>
        </div>

        {/* Card 3: Saldo Disponível */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-[18px] w-[18px] text-green-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Disponível</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-green-500 mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoData?.saldoDisponivel || 0)} /></div>
            )}
          </div>
        </div>

        {/* Card 4: Saldo Bloqueado */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-[18px] w-[18px] text-orange-500 group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Bloqueado</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-orange-500 mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoData?.saldoBloqueado || saldoData?.limiteBloqueado || 0)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}