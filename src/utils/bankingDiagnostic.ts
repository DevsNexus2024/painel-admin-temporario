/**
 * 🔍 FERRAMENTA DE DIAGNÓSTICO DO SISTEMA BANCÁRIO
 * 
 * Identifica problemas de roteamento e alternância de contas
 * Usado para debug e solução de problemas no sistema unificado
 */

import { unifiedBankingService } from '@/services/banking';
import { bankManager } from '@/services/banking/BankManager';
import { bankConfigManager } from '@/services/banking/config/BankConfigs';

interface DiagnosticResult {
  timestamp: string;
  unified: {
    isInitialized: boolean;
    activeAccount: any;
    availableAccounts: any[];
    stats: any;
    error?: string;
  };
  bankManager: {
    activeProvider: any;
    registeredProviders: any[];
    stats: any;
    error?: string;
  };
  legacy: {
    apiRouterExists: boolean;
    currentAccount: any;
    accountsList: any[];
    error?: string;
  };
  localStorage: {
    selectedAccountId: string | null;
    hasStoredSelection: boolean;
  };
  conflicts: string[];
  recommendations: string[];
}

export class BankingDiagnostic {
  
  static async runFullDiagnostic(): Promise<DiagnosticResult> {
    const timestamp = new Date().toISOString();
    const conflicts: string[] = [];
    const recommendations: string[] = [];
    
    // Diagnóstico do Sistema Unificado
    const unified = await this.diagnoseUnifiedSystem();
    
    // Diagnóstico do BankManager
    const bankManagerDiag = this.diagnoseBankManager();
    
    // Diagnóstico do Sistema Legado
    const legacy = this.diagnoseLegacySystem();
    
    // Diagnóstico do localStorage
    const localStorage = this.diagnoseLocalStorage();
    
    // Detectar conflitos
    if (unified.activeAccount && legacy.currentAccount) {
      if (unified.activeAccount.id !== legacy.currentAccount.id) {
        conflicts.push('Conta ativa diverge entre sistema unificado e legado');
        recommendations.push('Sincronizar conta ativa entre sistemas');
      }
    }
    
    if (localStorage.selectedAccountId && unified.activeAccount) {
      if (localStorage.selectedAccountId !== unified.activeAccount.id) {
        conflicts.push('Conta no localStorage difere da conta ativa');
        recommendations.push('Atualizar localStorage ou restaurar conta salva');
      }
    }
    
    if (unified.availableAccounts.length === 0) {
      conflicts.push('Nenhuma conta disponível no sistema unificado');
      recommendations.push('Verificar inicialização do bankManager e providers');
    }
    
    return {
      timestamp,
      unified,
      bankManager: bankManagerDiag,
      legacy,
      localStorage,
      conflicts,
      recommendations
    };
  }
  
  private static async diagnoseUnifiedSystem() {
    try {
      const isInitialized = (unifiedBankingService as any).isInitialized;
      const activeAccount = unifiedBankingService.getActiveAccount();
      const availableAccounts = unifiedBankingService.getAvailableAccounts();
      const stats = unifiedBankingService.getSystemStats();
      
      return {
        isInitialized,
        activeAccount,
        availableAccounts,
        stats
      };
    } catch (error) {
      return {
        isInitialized: false,
        activeAccount: null,
        availableAccounts: [],
        stats: null,
        error: error.message
      };
    }
  }
  
  private static diagnoseBankManager() {
    try {
      const activeProvider = bankManager.getActiveProviderType();
      const registeredProviders = bankManager.getAllProviders().map(p => ({
        provider: p.provider,
        isConfigured: p.isConfigured()
      }));
      const stats = bankManager.getStats();
      
      return {
        activeProvider,
        registeredProviders,
        stats
      };
    } catch (error) {
      return {
        activeProvider: null,
        registeredProviders: [],
        stats: null,
        error: error.message
      };
    }
  }
  
  private static diagnoseLegacySystem() {
    try {
      const apiRouter = (window as any).apiRouter;
      const apiRouterExists = !!apiRouter;
      
      if (!apiRouterExists) {
        return {
          apiRouterExists: false,
          currentAccount: null,
          accountsList: [],
          error: 'ApiRouter não encontrado na window'
        };
      }
      
      const currentAccount = apiRouter.getCurrentAccount();
      const accountsList = apiRouter.constructor.ACCOUNTS || [];
      
      return {
        apiRouterExists: true,
        currentAccount,
        accountsList
      };
    } catch (error) {
      return {
        apiRouterExists: false,
        currentAccount: null,
        accountsList: [],
        error: error.message
      };
    }
  }
  
  private static diagnoseLocalStorage() {
    const selectedAccountId = localStorage.getItem('selected_account_id');
    return {
      selectedAccountId,
      hasStoredSelection: !!selectedAccountId
    };
  }
  
  /**
   * Força sincronização entre sistemas
   */
  static async forceSynchronization(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Inicializar sistema unificado se necessário
      if (!(unifiedBankingService as any).isInitialized) {
        await unifiedBankingService.initialize();
      }
      
      // 2. Verificar conta salva no localStorage
      const savedAccountId = localStorage.getItem('selected_account_id');
      
      // 3. Tentar definir conta ativa
      if (savedAccountId) {
        const success = unifiedBankingService.setActiveAccount(savedAccountId);
        if (success) {
          return { 
            success: true, 
            message: `Conta ${savedAccountId} restaurada com sucesso` 
          };
        }
      }
      
      // 4. Se não tem conta salva, usar primeira disponível
      const accounts = unifiedBankingService.getAvailableAccounts();
      if (accounts.length > 0) {
        const success = unifiedBankingService.setActiveAccount(accounts[0].id);
        if (success) {
          localStorage.setItem('selected_account_id', accounts[0].id);
          return { 
            success: true, 
            message: `Conta padrão ${accounts[0].id} definida` 
          };
        }
      }
      
      return { 
        success: false, 
        message: 'Nenhuma conta disponível para ativar' 
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: `Erro na sincronização: ${error.message}` 
      };
    }
  }
  
  /**
   * Força troca de conta com validação completa
   */
  static async forceAccountSwitch(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Verificar se conta existe
      const accounts = unifiedBankingService.getAvailableAccounts();
      const targetAccount = accounts.find(acc => acc.id === accountId);
      
      if (!targetAccount) {
        return { 
          success: false, 
          message: `Conta ${accountId} não encontrada. Disponíveis: ${accounts.map(a => a.id).join(', ')}` 
        };
      }
      
      // 2. Trocar no sistema unificado
      const unifiedSuccess = unifiedBankingService.setActiveAccount(accountId);
      if (!unifiedSuccess) {
        return { 
          success: false, 
          message: `Falha ao ativar conta ${accountId} no sistema unificado` 
        };
      }
      
      // 3. Sincronizar com sistema legado se existe
      const apiRouter = (window as any).apiRouter;
      if (apiRouter && apiRouter.switchToAccount) {
        apiRouter.switchToAccount(accountId);
      }
      
      // 4. Salvar no localStorage
      localStorage.setItem('selected_account_id', accountId);
      
      return { 
        success: true, 
        message: `Conta ${accountId} (${targetAccount.displayName}) ativada com sucesso` 
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: `Erro ao trocar conta: ${error.message}` 
      };
    }
  }
  
  /**
   * Limpa todos os caches relacionados ao sistema bancário
   */
  static clearAllCaches(): void {
    // Limpar localStorage
    localStorage.removeItem('selected_account_id');
    
    // Limpar query cache se disponível
    const queryClient = (window as any).queryClient;
    if (queryClient) {
      queryClient.clear();
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Todos os caches bancários foram limpos');
    }
  }
  
  /**
   * Exposição de métodos para debug no console (apenas em desenvolvimento)
   */
  static exposeToWindow(): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).bankingDiagnostic = {
        run: this.runFullDiagnostic.bind(this),
        sync: this.forceSynchronization.bind(this),
        switch: this.forceAccountSwitch.bind(this),
        clear: this.clearAllCaches.bind(this),
        
        // Atalhos para debug
        getActiveAccount: () => unifiedBankingService.getActiveAccount(),
        getAvailableAccounts: () => unifiedBankingService.getAvailableAccounts(),
        getBankManagerStats: () => bankManager.getStats(),
        getLegacyAccount: () => (window as any).apiRouter?.getCurrentAccount?.(),
        
        // Helpers
        help: () => {
          console.log(`
🔍 FERRAMENTAS DE DIAGNÓSTICO BANCÁRIO (DESENVOLVIMENTO)

Comandos disponíveis:
  bankingDiagnostic.run()              - Diagnóstico completo
  bankingDiagnostic.sync()             - Forçar sincronização
  bankingDiagnostic.switch(accountId)  - Trocar conta
  bankingDiagnostic.clear()            - Limpar caches
  
Consultas:
  bankingDiagnostic.getActiveAccount()     - Conta ativa (sistema unificado)
  bankingDiagnostic.getAvailableAccounts() - Contas disponíveis
  bankingDiagnostic.getBankManagerStats()  - Stats do bank manager
  bankingDiagnostic.getLegacyAccount()     - Conta ativa (sistema legado)
          `);
        }
      };
    }
  }
}

// Auto-exposição para debug
BankingDiagnostic.exposeToWindow();

export default BankingDiagnostic;
