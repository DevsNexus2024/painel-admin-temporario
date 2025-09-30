import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendHorizontal, RefreshCcw, Loader2, DollarSign, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useTCRSaldo } from "@/hooks/useTCRSaldo";
import { TCRService } from "@/services/tcr";

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

  // Funções para exibir saldos baseadas na nova API
  const getSaldoDisplay = () => {
    if (isLoadingSaldo) return 'Carregando...';
    if (errorSaldo) return 'Erro ao consultar saldo TCR';
    if (saldoData?.erro) return 'Erro na API TCR';
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

  const getContaInfo = () => {
    return (
      <div className="text-xs text-muted-foreground">
        <span>
          TCR • BRL • {lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR') : 'Nunca atualizado'}
        </span>
      </div>
    );
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
    <div className="sticky top-0 z-30 bg-tcr-dark/95 backdrop-blur-xl border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 shadow-xl">
            <SendHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">TCR</h1>
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
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
            <span className="ml-2 text-sm text-muted-foreground">
              {isLoadingSaldo ? "Atualizando..." : "Atualizar"}
            </span>
          </Button>
        </div>
      </div>

      {/* Cards de saldo - TCR Nova API */}
      <div className="w-full max-w-7xl mx-auto">
        {errorSaldo && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 text-sm">{errorSaldo}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card: Saldo Principal */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo principal</p>
                <p className={`font-bold text-lg font-mono mt-1 ${errorSaldo || saldoData?.erro ? 'text-destructive' : 'text-foreground'}`}>
                  {getSaldoDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Saldo total</p>
              </div>
            </div>
          </div>

          {/* Card: Saldo Disponível */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20">
                <CheckCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo disponível</p>
                <p className={`font-bold text-lg font-mono mt-1 ${errorSaldo || saldoData?.erro ? 'text-destructive' : 'text-foreground'}`}>
                  {getSaldoDisponivelDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Para transferências</p>
              </div>
            </div>
          </div>

          {/* Card: Limite Bloqueado */}
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/20">
                <Lock className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Limite bloqueado</p>
                <p className="font-bold text-lg font-mono mt-1 text-foreground">
                  {getLimiteBloqueadoDisplay()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Reservado</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Informações da conta */}
        <div className="mt-4 text-center">
          {getContaInfo()}
        </div>

        
      </div>
    </div>
  );
}
