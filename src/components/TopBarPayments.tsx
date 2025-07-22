import { useState, useEffect } from "react";
import { RefreshCcw, SendHorizontal, TrendingUp, Clock, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AccountSelector } from "@/pages/payments/AccountSelector";
import { apiRouter, type Account } from "@/pages/payments/apiRouter";
import { useCacheManager } from "@/hooks/useCacheManager";
import { unifiedBankingService } from "@/services/banking";

export default function TopBarPayments() {
  const [saldoData, setSaldoData] = useState<any>(null);
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<Account>(apiRouter.getCurrentAccount());
  
  // Hook para gerenciar cache
  const { invalidateExtrato, queryClient } = useCacheManager();

  // Carregar saldo usando apiRouter
  const loadSaldo = async () => {
    if (!apiRouter.hasFeature('saldo')) {
      setError('Saldo não disponível para esta conta');
      return;
    }

    setIsLoadingSaldo(true);
    setError(null);
    
    try {
      const data = await apiRouter.getSaldo();
      setSaldoData(data);
      console.log("✅ Saldo carregado:", data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar saldo';
      setError(errorMsg);
      console.error("❌ Erro ao carregar saldo:", err);
    } finally {
      setIsLoadingSaldo(false);
    }
  };

  // Atualizar saldo
  const handleRefresh = async () => {
    console.log("Atualizando saldo da conta:", currentAccount.displayName);
    
    await loadSaldo();
    
    if (!error) {
      toast.success("Saldo atualizado!", {
        description: `${currentAccount.displayName}`,
        duration: 3000
      });
    } else {
      toast.error("Erro ao atualizar saldo", {
        description: "Verifique sua conexão e tente novamente",
        duration: 4000
      });
    }
  };

  const handleAccountChange = (account: Account) => {
    console.log("💳 [TopBarPayments] ===== MUDANÇA DE CONTA =====");
    console.log("💳 [TopBarPayments] Nova conta:", account.displayName);
    console.log("💳 [TopBarPayments] Provider:", account.provider);
    
    // 🚨 USAR NOVA ARQUITETURA EXCLUSIVAMENTE
    const success = unifiedBankingService.setActiveAccount(account.id);
    
    if (!success) {
      console.error("❌ [TopBarPayments] Falha ao trocar conta na nova arquitetura!");
      toast.error("Erro ao trocar conta", {
        description: "Falha na nova arquitetura bancária",
        duration: 3000
      });
      return;
    }
    
    console.log("✅ [TopBarPayments] Conta trocada com sucesso na NOVA ARQUITETURA");
    
    // ⚠️ MANTER apiRouter APENAS para compatibilidade com sistema legado (será removido)
    const legacySuccess = apiRouter.switchAccount(account.id);
    if (legacySuccess) {
      console.log("✅ [TopBarPayments] Sistema legado também atualizado (compatibilidade)");
    } else {
      console.warn("⚠️ [TopBarPayments] Sistema legado falhou, mas nova arquitetura está funcionando");
    }
    
    setCurrentAccount(account);
    
    // INVALIDAR TODO O CACHE para evitar contaminação
    console.log("🗑️ [TopBarPayments] Invalidando TODOS os caches para nova conta...");
    queryClient.clear(); // Limpar tudo
    
    // Salvar conta ativa
    localStorage.setItem('selected_account_id', account.id);
    
    toast.success("Conta alterada!", {
      description: `Agora usando: ${account.displayName} (${account.provider.toUpperCase()}) via NOVA ARQUITETURA`,
      duration: 3000
    });
    
    // Log da nova arquitetura
    const activeAccount = unifiedBankingService.getActiveAccount();
    console.log("🏦 [TopBarPayments] Estado da nova arquitetura:", {
      ativa: !!activeAccount,
      conta: activeAccount?.displayName,
      provider: activeAccount?.provider,
      id: activeAccount?.id
    });
    
    // Recarregar saldo da nova conta
    loadSaldo();
  };

  // Carregar saldo inicial
  useEffect(() => {
    loadSaldo();
  }, []);

  // Recuperar conta salva no localStorage
  useEffect(() => {
    const savedAccountId = localStorage.getItem('selected_account_id');
    if (savedAccountId && apiRouter.switchAccount(savedAccountId)) {
      setCurrentAccount(apiRouter.getCurrentAccount());
    }
  }, []);

  const getSaldoDisplay = () => {
    console.log('🔍 [getSaldoDisplay] Debugging saldo:', {
      isLoadingSaldo,
      error,
      saldoData,
      provider: currentAccount.provider,
      saldoDataKeys: saldoData ? Object.keys(saldoData) : null
    });

    if (isLoadingSaldo) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      );
    }
    
    if (error) {
      console.log('🔍 [getSaldoDisplay] Erro:', error);
      return "Erro ao carregar";
    }
    
    if (!saldoData) {
      console.log('🔍 [getSaldoDisplay] Sem saldoData, retornando R$ 0,00');
      return "R$ 0,00";
    }

    console.log('🔍 [getSaldoDisplay] Processando saldoData:', {
      saldoFormatado: saldoData.saldoFormatado,
      saldo: saldoData.saldo,
      saldoDisponivel: saldoData.saldoDisponivel,
      saldoType: typeof saldoData.saldo,
      provider: currentAccount.provider
    });

    // 🔧 CORREÇÃO: Para BMP, usar saldoDisponivel que é onde vem o valor real
    if (currentAccount.provider === 'bmp' && typeof saldoData.saldoDisponivel === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(saldoData.saldoDisponivel);
      
      console.log('🔍 [getSaldoDisplay] Usando saldoDisponivel BMP:', {
        valor: saldoData.saldoDisponivel,
        formatted
      });
      
      return formatted;
    }

    // Para BMP: usar saldoFormatado se existir (fallback)
    if (saldoData.saldoFormatado) {
      console.log('🔍 [getSaldoDisplay] Usando saldoFormatado:', saldoData.saldoFormatado);
      return saldoData.saldoFormatado;
    }

    // Para Bitso ou outros: usar o saldo formatado retornado pelo apiRouter
    if (typeof saldoData.saldo === 'number') {
      const formatted = currentAccount.provider === 'bmp' 
        ? `R$ ${saldoData.saldo.toFixed(2)}`
        : saldoData.saldoFormatado || `$${saldoData.saldo.toFixed(2)}`;
      
      console.log('🔍 [getSaldoDisplay] Formatando número:', {
        saldo: saldoData.saldo,
        formatted,
        provider: currentAccount.provider
      });
      
      return formatted;
    }

    console.log('🔍 [getSaldoDisplay] Nenhuma condição atendida, retornando R$ 0,00');
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
              {saldoData && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentAccount.provider.toUpperCase()} • {saldoData.moeda || 'BRL'} • {new Date().toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

                 <AccountSelector onAccountChange={handleAccountChange} />
      </div>
    </div>
  );
} 