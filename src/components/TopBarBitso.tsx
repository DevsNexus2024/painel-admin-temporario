import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendHorizontal, RefreshCcw, Loader2, DollarSign, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useBitsoSaldo } from "@/hooks/useBitsoSaldo";
import { BitsoService } from "@/services/bitso";

export default function TopBarBitso() {
  const {
    saldo: saldoData,
    loading: isLoadingSaldo,
    error: errorSaldo,
    refetch: handleRefresh
  } = useBitsoSaldo();

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return BitsoService.formatarValor(numValue);
  };

  // Funções para exibir saldos
  const getSaldoDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro ao consultar saldo Bitso';
    if (!saldoData) return 'Sem dados';
    return formatCurrency(saldoData.total || '0');
  };

  const getSaldoDisponivelDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro';
    if (!saldoData) return 'Sem dados';
    return formatCurrency(saldoData.available || '0');
  };

  const getSaldoBloqueadoDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro';
    if (!saldoData) return 'Sem dados';
    return formatCurrency(saldoData.locked || '0');
  };

  const getContaInfo = () => {
    return (
      <div className="text-xs text-muted-foreground">
        <span>
          Bitso • BRL • {new Date().toLocaleTimeString('pt-BR')}
        </span>
      </div>
    );
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
    <div className="sticky top-0 z-30 bg-gradient-to-r from-blue-600/10 to-purple-600/10 backdrop-blur-xl border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-xl">
            <SendHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Bitso</h1>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                Banking
              </Badge>
              {getStatusIcon()}
            </div>
            <p className="text-muted-foreground text-sm">Central de transferências PIX</p>
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

      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Total */}
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-blue-500/50 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">Saldo Total</span>
            <DollarSign className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {getSaldoDisplay()}
          </div>
          {getContaInfo()}
        </div>

        {/* Saldo Disponível */}
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-green-500/50 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">Disponível</span>
            <CheckCircle className="h-4 w-4 text-green-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {getSaldoDisponivelDisplay()}
          </div>
          <div className="text-xs text-muted-foreground">Livre para usar</div>
        </div>

        {/* Saldo Bloqueado */}
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-orange-500/50 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">Bloqueado</span>
            <Lock className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {getSaldoBloqueadoDisplay()}
          </div>
          <div className="text-xs text-muted-foreground">Em processamento</div>
        </div>
      </div>
    </div>
  );
}



