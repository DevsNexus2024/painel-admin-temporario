import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, Wifi, WifiOff, CheckCircle, AlertCircle, FileText, Banknote, Lock, DollarSign } from "lucide-react";
import { useTCRSaldo } from "@/hooks/useTCRSaldo";
import { TCRService } from "@/services/tcr";
import AnimatedBalance from "@/components/AnimatedBalance";

export default function TopBarTCR() {
  // CNPJ da TCR
  const cnpjDefault = "53781325000115"; // CNPJ da TCR
  
  const {
    saldo: saldoData,
    isLoading: isLoadingSaldo,
    error: errorSaldo,
    refresh: handleRefresh,
    lastUpdated
  } = useTCRSaldo({ 
    cnpj: cnpjDefault,
    autoRefresh: false // Refresh manual via botão
  });

  const formatCurrency = (value: number) => {
    return TCRService.formatarValor(value);
  };

  const parseValue = (value: number | string): number => {
    if (typeof value === 'string') {
      const numValue = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.'));
      return isNaN(numValue) ? 0 : numValue;
    }
    return isNaN(value) ? 0 : value;
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

  // Valores dos saldos
  const saldoGlobal = saldoData?.globalBalance || 0;
  const saldoTotal = saldoData?.saldo || 0;
  const saldoDisponivel = saldoData?.saldoDisponivel || 0;
  const saldoBloqueado = saldoData?.saldoBloqueado || saldoData?.limiteBloqueado || 0;

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 shadow-xl">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-green-600" />
              <h1 className="text-2xl font-bold text-foreground">TCR</h1>
              <Badge className="bg-[rgba(34,197,94,0.2)] text-green-600 border-[rgba(34,197,94,0.4)] text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
            </div>
            <p className="text-muted-foreground text-sm">
              Central de transferências PIX
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

      {/* Cards lado a lado - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Card 1: Saldo Global */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-[18px] w-[18px] text-[rgb(0,105,209)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Global</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(0,105,209)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo || saldoData?.erro ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoData?.globalBalance || 0)} /></div>
            )}
          </div>
        </div>

        {/* Card 2: Saldo */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-[18px] w-[18px] text-[rgb(0,105,209)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(0,105,209)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo || saldoData?.erro ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoTotal)} /></div>
            )}
          </div>
        </div>

        {/* Card 3: Saldo Disponível */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-[18px] w-[18px] text-[rgb(56,209,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Disponível</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(56,209,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo || saldoData?.erro ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoDisponivel)} /></div>
            )}
          </div>
        </div>

        {/* Card 4: Saldo Bloqueado */}
        <div className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-[18px] w-[18px] text-[rgb(184,0,0)] group-hover:opacity-80 transition-opacity" />
            <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">Saldo Bloqueado</span>
          </div>
          <div className="text-[1.3rem] lg:text-[1.5rem] font-bold text-[rgb(184,0,0)] mt-1 overflow-hidden">
            {isLoadingSaldo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : errorSaldo || saldoData?.erro ? (
              <span className="text-lg text-red-500">Erro</span>
            ) : (
              <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(saldoBloqueado)} /></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}