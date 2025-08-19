import { useState, useEffect } from "react";
import { RefreshCcw, SendHorizontal, TrendingUp, Clock, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AccountSelector } from "@/pages/payments/AccountSelector";
// ✅ CORRIGIDO: Usar apenas sistema unificado
import { unifiedBankingService, getAvailableAccounts, switchAccount } from "@/services/banking";
import type { AccountConfig } from "@/services/banking/UnifiedBankingService";
import type { Account } from "@/pages/payments/apiRouter";
import { useCacheManager } from "@/hooks/useCacheManager";
import { useSaldo } from "@/hooks/useSaldo";

export default function TopBarPayments() {
  // ✅ CORRIGIDO: Usar sistema unificado com hook useSaldo otimizado
  const { data: saldoData, isLoading: isLoadingSaldo, error: saldoError } = useSaldo();
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  
  // Hook para gerenciar cache
  const { invalidateExtrato, queryClient } = useCacheManager();

  // Converter erro para string para compatibilidade
  const error = saldoError?.message || null;

  // ✅ CORRIGIDO: Usar invalidação de cache ao invés de loadSaldo
  const handleRefresh = async () => {
    if (!currentAccount) return;
    
    // Invalidar cache do saldo para forçar nova consulta
    queryClient.invalidateQueries({ queryKey: ['saldo-unified'] });
    
    toast.success("Saldo atualizado!", {
      description: `${currentAccount.displayName}`,
      duration: 3000
    });
  };

  const handleAccountChange = (account: Account) => {
    // 1. Trocar no sistema unificado
    const unifiedSuccess = unifiedBankingService.setActiveAccount(account.id);
    
    if (!unifiedSuccess) {
      toast.error("Erro ao trocar conta", {
        description: "Falha na arquitetura bancária",
        duration: 3000
      });
      return;
    }
    
    // 2. Sincronizar com sistema legado (apiRouter) para manter compatibilidade
    const apiRouter = (window as any).apiRouter;
    if (apiRouter && apiRouter.switchToAccount) {
      apiRouter.switchToAccount(account.id);
    }
    
    // 3. Atualizar estado local
    setCurrentAccount(account);
    
    // 4. Limpar cache para evitar dados da conta anterior
    queryClient.clear();
    
    // 5. Salvar conta ativa no localStorage
    localStorage.setItem('selected_account_id', account.id);
    
    // 6. Feedback para usuário
    toast.success("Conta alterada!", {
      description: `Agora usando: ${account.displayName} (${account.provider.toUpperCase()})`,
      duration: 3000
    });
    
    // 7. Forçar recarregamento do saldo da nova conta
    queryClient.invalidateQueries({ queryKey: ['saldo-unified'] });
  };

  // ✅ REMOVIDO: Hook useSaldo já carrega automaticamente

  // ✅ CORRIGIDO: Usar sistema unificado para gerenciar conta ativa
  useEffect(() => {
    const initializeAccount = async () => {
      try {
        // 1. Inicializar sistema unificado
        await unifiedBankingService.initialize();
        
        // 2. Verificar se há conta salva no localStorage e tentar restaurar
        const savedAccountId = localStorage.getItem('selected_account_id');
        if (savedAccountId) {
          const restoreSuccess = unifiedBankingService.setActiveAccount(savedAccountId);
          if (!restoreSuccess) {
            localStorage.removeItem('selected_account_id');
          }
        }
        
        // 3. Sincronizar estado com apiRouter
        const apiRouter = (window as any).apiRouter;
        if (apiRouter) {
          // Se não tem conta salva, pegar do apiRouter
          if (!savedAccountId) {
            const legacyAccount = apiRouter.getCurrentAccount();
            if (legacyAccount) {
              unifiedBankingService.setActiveAccount(legacyAccount.id);
            }
          } else {
            // Se tem conta salva, sincronizar apiRouter
            apiRouter.switchToAccount(savedAccountId);
          }
          
          // Atualizar estado local
          const activeAccount = apiRouter.getCurrentAccount();
          setCurrentAccount(activeAccount);
        }
        
        // 4. Fallback: se não tem conta ativa, usar primeira disponível
        const unifiedActiveAccount = unifiedBankingService.getActiveAccount();
        if (!unifiedActiveAccount) {
          const availableAccounts = unifiedBankingService.getAvailableAccounts();
          if (availableAccounts.length > 0) {
            const firstAccount = availableAccounts[0];
            unifiedBankingService.setActiveAccount(firstAccount.id);
            localStorage.setItem('selected_account_id', firstAccount.id);
          }
        }
        
      } catch (error) {
        // Error handled silently in production
      }
    };

    initializeAccount();
  }, []);

  const getSaldoDisplay = () => {
    if (isLoadingSaldo) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      );
    }
    
    if (error) {
      return "Erro ao carregar";
    }
    
    if (!saldoData) {
      return "R$ 0,00";
    }

    // ✅ Processar StandardBalance do sistema unificado
    
    // StandardBalance tem: available, blocked, total, currency, provider
    if (saldoData && typeof (saldoData as any).available === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: (saldoData as any).currency || 'BRL'
      }).format((saldoData as any).available);
      
      return formatted;
    }

    // Fallback para compatibilidade com formato antigo (enquanto migração não estiver completa)
    if (saldoData && typeof (saldoData as any).saldoDisponivel === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency', 
        currency: 'BRL'
      }).format((saldoData as any).saldoDisponivel);
      
      return formatted;
    }

    if (saldoData && (saldoData as any).saldoFormatado) {
      return (saldoData as any).saldoFormatado;
    }

    if (saldoData && typeof (saldoData as any).saldo === 'number') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format((saldoData as any).saldo);
      
      return formatted;
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

      {/* Cards de métricas - Layout padronizado com ações PIX */}
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl p-4 border border-border shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Saldo disponível</p>
                <p className={`font-bold text-xl font-mono mt-1 ${error ? 'text-destructive' : 'text-foreground'}`}>
                  {getSaldoDisplay()}
                </p>
                {saldoData && currentAccount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentAccount.provider.toUpperCase()} • {(saldoData as any).moeda || 'BRL'} • {new Date().toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="w-full">
            <AccountSelector onAccountChange={handleAccountChange} />
          </div>
        </div>
      </div>
    </div>
  );
} 