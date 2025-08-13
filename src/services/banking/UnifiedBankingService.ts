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



    try {
      // 🚨 PRESERVAR CONTA ATIVA ANTES DE REINICIALIZAR
      const currentAccounts = this.getAvailableAccounts();
      const activeAccountId = currentAccounts.find(acc => acc.isActive)?.id;
      
      // Preservar conta ativa se existir
      
      // Auto-registra providers padrão (BMP, Bitso)
      await bankManager.autoRegisterDefaultProviders();
      
      // 🚨 RESTAURAR CONTA ATIVA SE HAVIA UMA SELECIONADA
      if (activeAccountId) {
        this.setActiveAccount(activeAccountId);
      }
      
      // 🚨 REMOVER HEALTH CHECK DURANTE PIX - evita consultas desnecessárias
      // Health check pode ser feito separadamente se necessário
      
      this.isInitialized = true;
      
    } catch (error) {
      // console.error('[UNIFIED-BANKING] ❌ Erro na inicialização:', error);
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
    
    // 🚨 MAPEAR IDs DO SISTEMA ANTIGO PARA PROVIDERS
    const legacyToProviderMap: Record<string, BankProvider> = {
      'bmp-main': BankProvider.BMP,
      'bmp-531-ttf': BankProvider.BMP_531, // ✅ TTF SERVICOS DIGITAIS LTDA
      'bitso-crypto': BankProvider.BITSO
    };
    
    const provider = legacyToProviderMap[accountId];
    
    if (!provider) {
      // console.error(`[UNIFIED-BANKING] ID de conta não mapeado: ${accountId}`);
      // console.log(`[UNIFIED-BANKING] IDs suportados:`, Object.keys(legacyToProviderMap));
      return false;
    }
    

    
    const success = bankManager.setActiveProvider(provider);
    
    if (success) {
      // Conta ativada com sucesso
    } else {
      // console.error(`[UNIFIED-BANKING] Falha ao ativar provider: ${provider}`);
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
      const errorMsg = result.error?.message || 'Falha na comunicação com o servidor bancário';
      const providerName = bankManager.getActiveProviderType() || 'Provedor desconhecido';
      throw new Error(`[${providerName.toUpperCase()}] ${errorMsg}`);
    }


    return result.data!;
  }

  /**
   * Consulta extrato da conta ativa
   */
  public async getStatement(filters?: StandardFilters): Promise<StandardStatementResponse> {
    await this.ensureInitialized();
    
    const result = await bankManager.getStatement(filters);
    
    if (!result.success) {
      const errorMsg = result.error?.message || 'Falha ao carregar dados do extrato bancário';
      const providerName = bankManager.getActiveProviderType() || 'Provedor desconhecido';
      throw new Error(`[${providerName.toUpperCase()}] Extrato: ${errorMsg}`);
    }


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
  // OPERAÇÕES PIX
  // ===============================

  /**
   * Envia PIX via conta ativa
   */
  public async sendPix(pixData: {
    key: string;
    amount: number;
    description?: string;
    keyType?: string;
  }): Promise<StandardTransaction> {
    // 🚨 CRÍTICO: NÃO reinicializar durante PIX - apenas verificar se já foi inicializado
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider) {
      const availableAccounts = this.getAvailableAccounts();
      const accountList = availableAccounts.map(acc => acc.displayName).join(', ');
      throw new Error(`Nenhuma conta ativa selecionada para envio PIX. Contas disponíveis: ${accountList || 'Nenhuma'}`);
    }

    // Verificar se o provider suporta PIX
    if (!activeProvider.sendPix) {
      throw new Error(`[${activeProvider.provider.toUpperCase()}] Conta não suporta envio PIX. Verifique se está usando uma conta bancária com funcionalidades PIX habilitadas.`);
    }



    const result = await activeProvider.sendPix(pixData);
    
    if (!result.success) {
      const errorMsg = result.error?.message || 'Falha no processamento da transferência PIX';
      const providerName = activeProvider.provider || 'Provedor desconhecido';
      throw new Error(`[${providerName.toUpperCase()}] PIX: ${errorMsg} (Chave: ${pixData.key}, Valor: R$ ${pixData.amount.toFixed(2)})`);
    }


    return result.data!;
  }

  /**
   * Lista chaves PIX da conta ativa
   */
  public async getPixKeys(): Promise<any[]> {
    await this.ensureInitialized();
    
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider) {
      throw new Error('Nenhuma conta ativa para consulta de chaves PIX');
    }

    // Verificar se o provider suporta listagem de chaves
    if (!activeProvider.getPixKeys) {
      throw new Error(`Provider ${activeProvider.provider} não suporta listagem de chaves PIX`);
    }

    const result = await activeProvider.getPixKeys();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao consultar chaves PIX');
    }


    return result.data!;
  }

  /**
   * Gera QR Code PIX via conta ativa
   */
  public async generatePixQR(amount: number, description?: string): Promise<{ qrCode: string; txId: string }> {
    await this.ensureInitialized();
    
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider) {
      throw new Error('Nenhuma conta ativa para gerar QR Code PIX');
    }

    // Verificar se o provider suporta geração de QR Code
    if (!activeProvider.generatePixQR) {
      throw new Error(`Provider ${activeProvider.provider} não suporta geração de QR Code PIX`);
    }

    const result = await activeProvider.generatePixQR(amount, description);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao gerar QR Code PIX');
    }


    return result.data!;
  }

  // ===============================
  // OPERAÇÕES ESPECÍFICAS DA BITSO
  // ===============================

  /**
   * Cria QR Code dinâmico via Bitso (requer chave PIX)
   */
  public async criarQRCodeDinamicoBitso(dados: {
    valor: number;
    chavePix: string;
    tipoChave: string;
    descricao?: string;
  }): Promise<{ qrCode: string; txId: string }> {
    await this.ensureInitialized();
    
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider || activeProvider.provider !== BankProvider.BITSO) {
      throw new Error('Operação disponível apenas para conta Bitso ativa');
    }

    // Cast para BitsoProvider para acessar métodos específicos
    const bitsoProvider = activeProvider as any;
    if (!bitsoProvider.criarQRCodeDinamico) {
      throw new Error('Método criarQRCodeDinamico não disponível');
    }

    const result = await bitsoProvider.criarQRCodeDinamico(dados);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao criar QR Code dinâmico');
    }


    return result.data!;
  }

  /**
   * Cria QR Code estático via Bitso (requer chave PIX)
   */
  public async criarQRCodeEstaticoBitso(dados: {
    chavePix: string;
    tipoChave: string;
    descricao?: string;
  }): Promise<{ qrCode: string; txId: string }> {
    await this.ensureInitialized();
    
    const activeProvider = bankManager.getActiveProvider();
    if (!activeProvider || activeProvider.provider !== BankProvider.BITSO) {
      throw new Error('Operação disponível apenas para conta Bitso ativa');
    }

    // Cast para BitsoProvider para acessar métodos específicos
    const bitsoProvider = activeProvider as any;
    if (!bitsoProvider.criarQRCodeEstatico) {
      throw new Error('Método criarQRCodeEstatico não disponível');
    }

    const result = await bitsoProvider.criarQRCodeEstatico(dados);
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao criar QR Code estático');
    }


    return result.data!;
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

    } catch (error) {
      // console.error(`[UNIFIED-BANKING] ❌ Erro ao adicionar banco ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Remove um banco
   */
  public removeBank(provider: BankProvider): void {
    bankManager.unregisterProvider(provider);

  }

  /**
   * Sincroniza contas do sistema antigo (apiRouter) com a nova arquitetura
   */
  public syncWithLegacySystem(): void {
    try {

      
      // Verificar se apiRouter existe
      const apiRouter = (window as any).apiRouter;
      if (!apiRouter || !apiRouter.getCurrentAccount) {
        // console.warn('[UNIFIED-BANKING] Sistema legado não disponível');
        return;
      }
      
      const legacyAccount = apiRouter.getCurrentAccount();

      
      // Usar diretamente o ID da conta legada (já está no formato correto)

      const success = this.setActiveAccount(legacyAccount.id);
      
      if (success) {
        // Sincronização concluída
      } else {
        // console.warn(`[UNIFIED-BANKING] ⚠️ Falha na sincronização da conta: ${legacyAccount.id}`);
      }
      
    } catch (error) {
      // console.error('[UNIFIED-BANKING] Erro na sincronização com sistema legado:', error);
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

    
    await unifiedBankingService.initialize();
    
    // Sincronizar com sistema legado após inicialização
    setTimeout(() => {
      unifiedBankingService.syncWithLegacySystem();
    }, 1000); // Aguardar apiRouter estar disponível
    

  } catch (error) {
    // console.error('[INIT] ❌ Erro na inicialização:', error);
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