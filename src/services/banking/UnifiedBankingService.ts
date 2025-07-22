/**
 * 🎯 SERVIÇO BANCÁRIO UNIFICADO
 * 
 * Interface única para o frontend acessar qualquer banco
 * Substitui os serviços antigos com arquitetura escalável
 */

import { bankManager } from './BankManager';
import {
  BankProvider
} from './types';
import type {
  StandardBalance,
  StandardStatementResponse,
  StandardFilters,
  StandardTransaction,
  BankResponse
} from './types';

/**
 * Configuração de conta para o frontend
 */
export interface AccountConfig {
  id: string;
  provider: BankProvider;
  displayName: string;
  isActive: boolean;
}

/**
 * Serviço unificado para operações bancárias
 * 
 * ✅ Interface única para todos os bancos
 * ✅ Roteamento automático baseado na conta ativa
 * ✅ Dados padronizados independente do banco
 * ✅ Preparado para 10+ bancos
 */
export class UnifiedBankingService {
  
  private static instance: UnifiedBankingService;
  private isInitialized = false;

  private constructor() {
    console.log('[UNIFIED-BANKING] Serviço iniciado');
  }

  /**
   * Singleton
   */
  public static getInstance(): UnifiedBankingService {
    if (!UnifiedBankingService.instance) {
      UnifiedBankingService.instance = new UnifiedBankingService();
    }
    return UnifiedBankingService.instance;
  }

  /**
   * Inicializa o serviço (chamado uma vez no início da aplicação)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[UNIFIED-BANKING] Inicializando serviço...');

    try {
      // Auto-registra providers padrão (BMP, Bitso)
      await bankManager.autoRegisterDefaultProviders();
      
      // Health check inicial
      const healthStatus = await bankManager.healthCheckAll();
      console.log('[UNIFIED-BANKING] Status dos bancos:', healthStatus);
      
      this.isInitialized = true;
      console.log('[UNIFIED-BANKING] ✅ Serviço inicializado com sucesso');
      
    } catch (error) {
      console.error('[UNIFIED-BANKING] ❌ Erro na inicialização:', error);
      throw error;
    }
  }

  // ===============================
  // GESTÃO DE CONTAS
  // ===============================

  /**
   * Lista todas as contas disponíveis
   */
  public getAvailableAccounts(): AccountConfig[] {
    const banks = bankManager.listAvailableBanks();
    
    return banks
      .filter(bank => bank.isRegistered) // Apenas bancos registrados
      .map(bank => {
        // 🚨 USAR MESMOS IDs DO SISTEMA ANTIGO PARA COMPATIBILIDADE
        const legacyIdMap: Record<string, string> = {
          'bmp': 'bmp-main',
          'bitso': 'bitso-crypto'
        };
        
        const legacyDisplayNameMap: Record<string, string> = {
          'bmp': 'Conta Principal BMP',
          'bitso': 'Bitso - Pagamentos PIX'
        };
        
        return {
          id: legacyIdMap[bank.provider] || `${bank.provider}-account`,
          provider: bank.provider!,
          displayName: legacyDisplayNameMap[bank.provider] || bank.displayName!,
          isActive: bank.isActive!
        };
      });
  }

  /**
   * Define a conta ativa
   */
  public setActiveAccount(accountId: string): boolean {
    console.log(`[UNIFIED-BANKING] Tentando ativar conta: ${accountId}`);
    
    // 🚨 MAPEAR IDs DO SISTEMA ANTIGO PARA PROVIDERS
    const legacyToProviderMap: Record<string, BankProvider> = {
      'bmp-main': BankProvider.BMP,
      'bitso-crypto': BankProvider.BITSO
    };
    
    const provider = legacyToProviderMap[accountId];
    
    if (!provider) {
      console.error(`[UNIFIED-BANKING] ID de conta não mapeado: ${accountId}`);
      console.log(`[UNIFIED-BANKING] IDs suportados:`, Object.keys(legacyToProviderMap));
      return false;
    }
    
    console.log(`[UNIFIED-BANKING] Mapeando ${accountId} → ${provider}`);
    
    const success = bankManager.setActiveProvider(provider);
    
    if (success) {
      console.log(`[UNIFIED-BANKING] Conta ativa: ${accountId} (${provider})`);
    } else {
      console.error(`[UNIFIED-BANKING] Falha ao ativar provider: ${provider}`);
    }
    
    return success;
  }

  /**
   * Obtém a conta ativa
   */
  public getActiveAccount(): AccountConfig | null {
    const activeProvider = bankManager.getActiveProviderType();
    if (!activeProvider) return null;

    const accounts = this.getAvailableAccounts();
    return accounts.find(acc => acc.provider === activeProvider) || null;
  }

  // ===============================
  // OPERAÇÕES FINANCEIRAS
  // ===============================

  /**
   * Consulta saldo da conta ativa
   */
  public async getBalance(): Promise<StandardBalance> {
    await this.ensureInitialized();
    
    const result = await bankManager.getBalance();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao consultar saldo');
    }

    console.log(`[UNIFIED-BANKING] Saldo obtido: ${result.data?.provider} - R$ ${result.data?.available}`);
    return result.data!;
  }

  /**
   * Consulta extrato da conta ativa
   */
  public async getStatement(filters?: StandardFilters): Promise<StandardStatementResponse> {
    await this.ensureInitialized();
    
    const result = await bankManager.getStatement(filters);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao consultar extrato');
    }

    console.log(`[UNIFIED-BANKING] Extrato obtido: ${result.data?.provider} - ${result.data?.transactions.length} transações`);
    return result.data!;
  }

  /**
   * Consulta saldo de todas as contas
   */
  public async getBalanceFromAllAccounts(): Promise<Array<{
    account: AccountConfig;
    balance?: StandardBalance;
    error?: string;
  }>> {
    await this.ensureInitialized();
    
    const results = await bankManager.getBalanceFromAll();
    const accounts = this.getAvailableAccounts();
    
    return results.map(result => {
      const account = accounts.find(acc => acc.provider === result.provider);
      
      return {
        account: account!,
        balance: result.result,
        error: result.error?.message || result.error
      };
    }).filter(item => item.account); // Apenas contas válidas
  }

  /**
   * Consulta extrato de todas as contas
   */
  public async getStatementFromAllAccounts(filters?: StandardFilters): Promise<Array<{
    account: AccountConfig;
    statement?: StandardStatementResponse;
    error?: string;
  }>> {
    await this.ensureInitialized();
    
    const results = await bankManager.getStatementFromAll(filters);
    const accounts = this.getAvailableAccounts();
    
    return results.map(result => {
      const account = accounts.find(acc => acc.provider === result.provider);
      
      return {
        account: account!,
        statement: result.result,
        error: result.error?.message || result.error
      };
    }).filter(item => item.account); // Apenas contas válidas
  }

  // ===============================
  // OPERAÇÕES ESPECÍFICAS POR PROVIDER
  // ===============================

  /**
   * Força consulta em um provider específico
   */
  public async getBalanceFromProvider(provider: BankProvider): Promise<StandardBalance> {
    await this.ensureInitialized();
    
    const bankProvider = bankManager.getProvider(provider);
    if (!bankProvider) {
      throw new Error(`Provider ${provider} não registrado`);
    }

    const result = await bankProvider.getBalance();
    
    if (!result.success) {
      throw new Error(result.error?.message || `Erro ao consultar saldo do ${provider}`);
    }

    return result.data!;
  }

  /**
   * Força consulta de extrato em um provider específico
   */
  public async getStatementFromProvider(
    provider: BankProvider,
    filters?: StandardFilters
  ): Promise<StandardStatementResponse> {
    await this.ensureInitialized();
    
    const bankProvider = bankManager.getProvider(provider);
    if (!bankProvider) {
      throw new Error(`Provider ${provider} não registrado`);
    }

    const result = await bankProvider.getStatement(filters);
    
    if (!result.success) {
      throw new Error(result.error?.message || `Erro ao consultar extrato do ${provider}`);
    }

    return result.data!;
  }

  // ===============================
  // UTILITÁRIOS E DIAGNÓSTICOS
  // ===============================

  /**
   * Health check de todos os bancos
   */
  public async healthCheckAll(): Promise<Record<BankProvider, boolean>> {
    await this.ensureInitialized();
    return bankManager.healthCheckAll();
  }

  /**
   * Estatísticas do sistema
   */
  public getSystemStats() {
    return {
      ...bankManager.getStats(),
      isInitialized: this.isInitialized,
      availableAccounts: this.getAvailableAccounts().length,
      activeAccount: this.getActiveAccount()
    };
  }

  /**
   * Adiciona um novo banco (para expansão futura)
   */
  public async addBank(provider: BankProvider, credentials?: any): Promise<void> {
    await this.ensureInitialized();
    
    try {
      bankManager.registerProviderByType(provider, credentials);
      console.log(`[UNIFIED-BANKING] ✅ Banco ${provider} adicionado com sucesso`);
    } catch (error) {
      console.error(`[UNIFIED-BANKING] ❌ Erro ao adicionar banco ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Remove um banco
   */
  public removeBank(provider: BankProvider): void {
    bankManager.unregisterProvider(provider);
    console.log(`[UNIFIED-BANKING] 🗑️ Banco ${provider} removido`);
  }

  /**
   * Sincroniza contas do sistema antigo (apiRouter) com a nova arquitetura
   */
  public syncWithLegacySystem(): void {
    try {
      console.log('[UNIFIED-BANKING] Sincronizando com sistema legado...');
      
      // Verificar se apiRouter existe
      const apiRouter = (window as any).apiRouter;
      if (!apiRouter || !apiRouter.getCurrentAccount) {
        console.warn('[UNIFIED-BANKING] Sistema legado não disponível');
        return;
      }
      
      const legacyAccount = apiRouter.getCurrentAccount();
      console.log('[UNIFIED-BANKING] Conta legada detectada:', {
        id: legacyAccount.id,
        provider: legacyAccount.provider,
        displayName: legacyAccount.displayName
      });
      
      // Usar diretamente o ID da conta legada (já está no formato correto)
      console.log(`[UNIFIED-BANKING] Sincronizando conta legada: ${legacyAccount.id}`);
      const success = this.setActiveAccount(legacyAccount.id);
      
      if (success) {
        console.log(`[UNIFIED-BANKING] ✅ Sincronização concluída: ${legacyAccount.id} → ${legacyAccount.provider}`);
      } else {
        console.warn(`[UNIFIED-BANKING] ⚠️ Falha na sincronização da conta: ${legacyAccount.id}`);
      }
      
    } catch (error) {
      console.error('[UNIFIED-BANKING] Erro na sincronização com sistema legado:', error);
    }
  }

  // ===============================
  // MÉTODOS PRIVADOS
  // ===============================

  /**
   * Garante que o serviço está inicializado
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Valida se há provider ativo
   */
  private validateActiveProvider(): void {
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider) {
      throw new Error('Nenhuma conta ativa selecionada. Use setActiveAccount() primeiro.');
    }
  }
}

/**
 * Instância singleton para uso global
 */
export const unifiedBankingService = UnifiedBankingService.getInstance();

// ===============================
// FUNÇÕES DE CONVENIÊNCIA
// ===============================

/**
 * Inicializa o sistema bancário (chame no início da aplicação)
 */
export const initializeBankingSystem = async (): Promise<void> => {
  try {
    console.log('[INIT] 🏦 Inicializando sistema bancário unificado...');
    
    await unifiedBankingService.initialize();
    
    // Sincronizar com sistema legado após inicialização
    setTimeout(() => {
      unifiedBankingService.syncWithLegacySystem();
    }, 1000); // Aguardar apiRouter estar disponível
    
    console.log('[INIT] ✅ Sistema bancário inicializado com sucesso!');
  } catch (error) {
    console.error('[INIT] ❌ Erro na inicialização:', error);
    throw error;
  }
};

/**
 * Obtém saldo da conta ativa
 */
export const getBalance = (): Promise<StandardBalance> => {
  return unifiedBankingService.getBalance();
};

/**
 * Obtém extrato da conta ativa
 */
export const getStatement = (filters?: StandardFilters): Promise<StandardStatementResponse> => {
  return unifiedBankingService.getStatement(filters);
};

/**
 * Troca conta ativa
 */
export const switchAccount = (accountId: string): boolean => {
  return unifiedBankingService.setActiveAccount(accountId);
};

/**
 * Lista contas disponíveis
 */
export const getAvailableAccounts = (): AccountConfig[] => {
  return unifiedBankingService.getAvailableAccounts();
}; 