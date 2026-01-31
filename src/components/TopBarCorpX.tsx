import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, DollarSign, Lock, CheckCircle, AlertCircle, FileText, Banknote, Wifi, WifiOff } from "lucide-react";
import { useCorpXSaldo } from "@/hooks/useCorpXSaldo";
import { CorpXService } from "@/services/corpx";
import { useCorpX, CORPX_ACCOUNTS } from "@/contexts/CorpXContext";
import AnimatedBalance from "@/components/AnimatedBalance";
import { useCorpxRealtime } from "@/hooks/useCorpxRealtime";

export default function TopBarCorpX() {
  const { taxDocument, selectedAccount } = useCorpX();
  
  // Remove formatação do CNPJ para usar apenas números na API
  const cnpjNumerico = taxDocument.replace(/\D/g, '');

  const isAllAccounts = selectedAccount.id === 'ALL';

  // Estado para saldo consolidado (ALL)
  const [consolidatedSaldo, setConsolidatedSaldo] = useState<{
    globalBalance: number;
    saldo: number;
    saldoDisponivel: number;
    saldoBloqueado: number;
  } | null>(null);
  const [consolidatedLastUpdated, setConsolidatedLastUpdated] = useState<Date | null>(null);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);
  const [consolidatedError, setConsolidatedError] = useState<string | null>(null);
  const consolidatedAbortRef = useRef<AbortController | null>(null);
  
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
  const selectedTaxDocumentForRealtime = useMemo(() => {
    if (isAllAccounts) return null;
    const digits = (selectedAccount.cnpj || '').replace(/\D/g, '');
    return digits.length === 14 ? digits : null;
  }, [isAllAccounts, selectedAccount.cnpj]);

  const { isConnected, isReconnecting } = useCorpxRealtime({
    enabled: true,
    filterTransaction: (tx) => {
      if (!selectedTaxDocumentForRealtime) return true;
      return (tx.taxDocument || '').replace(/\D/g, '') === selectedTaxDocumentForRealtime;
    },
  });

  const accountsForConsolidation = useMemo(
    () =>
      CORPX_ACCOUNTS.filter((acc) => acc.id !== 'ALL' && acc.available)
        .map((acc) => ({ ...acc, cnpjNumerico: (acc.cnpj || '').replace(/\D/g, '') }))
        .filter((acc) => acc.cnpjNumerico.length === 14),
    []
  );

  const refreshConsolidatedSaldo = useCallback(async () => {
    consolidatedAbortRef.current?.abort();
    const controller = new AbortController();
    consolidatedAbortRef.current = controller;

    setConsolidatedLoading(true);
    setConsolidatedError(null);

    try {
      const results = await Promise.allSettled(
        accountsForConsolidation.map(async (acc) => {
          const resp = await CorpXService.consultarSaldo(acc.cnpjNumerico, { signal: controller.signal });
          if (!resp || resp.erro) return null;
          return resp;
        })
      );

      const valid = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter(Boolean);

      const totals = valid.reduce(
        (sum, item) => {
          const global = Number(item.globalBalance ?? item.saldo ?? 0) || 0;
          const saldo = Number(item.saldo ?? 0) || 0;
          const disponivel = Number(item.saldoDisponivel ?? 0) || 0;
          const bloqueado = Number(item.saldoBloqueado ?? item.limiteBloqueado ?? 0) || 0;

          return {
            globalBalance: sum.globalBalance + global,
            saldo: sum.saldo + saldo,
            saldoDisponivel: sum.saldoDisponivel + disponivel,
            saldoBloqueado: sum.saldoBloqueado + bloqueado,
          };
        },
        { globalBalance: 0, saldo: 0, saldoDisponivel: 0, saldoBloqueado: 0 }
      );

      setConsolidatedSaldo(totals);
      setConsolidatedLastUpdated(new Date());
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setConsolidatedError(err?.message || 'Erro ao consultar saldo consolidado');
      setConsolidatedSaldo(null);
    } finally {
      setConsolidatedLoading(false);
    }
  }, [accountsForConsolidation]);

  // Carregar saldo consolidado quando ALL estiver selecionado
  useEffect(() => {
    if (isAllAccounts) {
      refreshConsolidatedSaldo();
    }
    return () => {
      consolidatedAbortRef.current?.abort();
      consolidatedAbortRef.current = null;
    };
  }, [isAllAccounts, refreshConsolidatedSaldo]);

  const formatCurrency = (value: number) => {
    return CorpXService.formatarValor(value);
  };

  // Funções para exibir saldos baseadas na nova API
  const effectiveLoading = isAllAccounts ? consolidatedLoading : isLoadingSaldo;
  const effectiveError = isAllAccounts ? consolidatedError : errorSaldo;
  const effectiveLastUpdated = isAllAccounts ? consolidatedLastUpdated : lastUpdated;

  const effectiveGlobalBalance = isAllAccounts
    ? consolidatedSaldo?.globalBalance ?? 0
    : (saldoData as any)?.globalBalance ?? saldoData?.saldo ?? 0;

  const effectiveSaldo = isAllAccounts
    ? consolidatedSaldo?.saldo ?? 0
    : saldoData?.saldo ?? 0;

  const effectiveSaldoDisponivel = isAllAccounts
    ? consolidatedSaldo?.saldoDisponivel ?? 0
    : saldoData?.saldoDisponivel ?? 0;

  const effectiveSaldoBloqueado = isAllAccounts
    ? consolidatedSaldo?.saldoBloqueado ?? 0
    : (saldoData as any)?.saldoBloqueado ?? saldoData?.limiteBloqueado ?? 0;

  const getSaldoDisplay = () => {
    if (effectiveLoading) return 'Carregando...';
    if (effectiveError) return 'Erro ao consultar saldo CORPX';
    if (!isAllAccounts && saldoData?.erro) return 'Erro na API CORPX';
    return formatCurrency(effectiveSaldo);
  };

  const getSaldoDisponivelDisplay = () => {
    if (effectiveLoading) return 'Carregando...';
    if (effectiveError) return 'Erro';
    if (!isAllAccounts && saldoData?.erro) return 'Erro';
    return formatCurrency(effectiveSaldoDisponivel);
  };

  const getLimiteBloqueadoDisplay = () => {
    if (effectiveLoading) return 'Carregando...';
    if (effectiveError) return 'Erro';
    if (!isAllAccounts && saldoData?.erro) return 'Erro';
    return formatCurrency(effectiveSaldoBloqueado);
  };

  const parseValue = (value: string | number): number => {
    const numValue = parseFloat(String(value));
    return isNaN(numValue) ? 0 : numValue;
  };

  const getStatusIcon = () => {
    if (effectiveLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (effectiveError || (!isAllAccounts && saldoData?.erro)) {
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
            onClick={isAllAccounts ? refreshConsolidatedSaldo : handleRefresh}
            disabled={effectiveLoading}
            className="hover:bg-muted rounded-xl"
          >
            {effectiveLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-sm text-muted-foreground">
              {effectiveLoading ? "Atualizando..." : "Atualizar"}
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
            {effectiveLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : effectiveError ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(effectiveGlobalBalance)} /></div>
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
            {effectiveLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : effectiveError ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(effectiveSaldo)} /></div>
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
            {effectiveLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : effectiveError ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(effectiveSaldoDisponivel)} /></div>
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
            {effectiveLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : effectiveError ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(effectiveSaldoBloqueado)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}