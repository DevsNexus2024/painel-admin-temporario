import { RefreshCcw, SendHorizontal, TrendingUp, Clock, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSaldo } from "@/hooks/useSaldo";
import { formatarValorMonetario, SaldoResponse } from "@/services/account";

export default function TopBarPayments() {
  // Usar hook de cache para saldo
  const { 
    data: saldoData, 
    isLoading: isLoadingSaldo, 
    error,
    refetch 
  } = useSaldo({
    staleTime: 2 * 60 * 1000 // 2 minutos
  });

  const handleRefresh = async () => {
    console.log("Atualizando saldo...");
    try {
      const result = await refetch();
      const data = result.data as SaldoResponse;
      if (data) {
        toast.success("Saldo atualizado!", {
          description: `${formatarValorMonetario(data.saldoDisponivel)}`,
          duration: 3000
        });
      }
    } catch (error) {
      toast.error("Erro ao atualizar saldo", {
        description: "Verifique sua conexão e tente novamente",
        duration: 4000
      });
    }
  };

  const getSaldoDisplay = () => {
    if (isLoadingSaldo) {
      return "Carregando...";
    }
    if (error) {
      return "Erro ao carregar";
    }
    const data = saldoData as SaldoResponse;
    if (data) {
      return formatarValorMonetario(data.saldoDisponivel);
    }
    return "R$ 0,00";
  };

  return (
    <div className="sticky top-0 z-30 bg-tcr-dark/95 backdrop-blur-xl border-b border-border h-auto p-6">
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-tcr-orange to-primary shadow-xl">
            <SendHorizontal className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pagamentos Pix</h1>
            <p className="text-muted-foreground text-sm">Central de transferências</p>
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

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Saldo disponível</p>
              <p className={`font-bold text-xl font-mono ${error ? 'text-destructive' : 'text-foreground'}`}>
                {getSaldoDisplay()}
              </p>
              {(saldoData as SaldoResponse) && (
                <p className="text-xs text-muted-foreground mt-1">
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">Dados Bancários</p>
              <div className="space-y-1">
                <p className="text-foreground font-bold text-sm">
                  Banco 274 • Ag: 0001 • Conta: 902486-0
                </p>
                <p className="text-xs text-muted-foreground">
                  Conta Pagamento: 09024860 • Tipo: 3
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 