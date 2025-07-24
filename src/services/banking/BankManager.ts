/**
 * 🏛️ GERENCIADOR PRINCIPAL DE BANCOS
 * 
 * Coordena todos os providers bancários
 * Facilita operações multi-banco e roteamento dinâmico
 */

import type { IBankProvider, IBankManager } from './interfaces';
import { bankConfigManager } from './config/BankConfigs';
import { BmpProvider } from './providers/BmpProvider';
import { BitsoProvider } from './providers/BitsoProvider';
import {
  BankProvider,
  BankFeature
} from './types';
import type {
  BankCredentials,
  StandardBalance,
  StandardStatementResponse,
  StandardFilters
} from './types';

/**
 * Factory para criação de providers
 */
class BankProviderFactory {
  
  /**
   * Cria instância de um provider específico
   */
  public static createProvider(
    provider: BankProvider,
    customCredentials?: BankCredentials
  ): IBankProvider {
    
    const config = bankConfigManager.getBankConfig(provider, customCredentials);

    switch (provider) {
      case BankProvider.BMP:
        return new BmpProvider(config);
        
      case BankProvider.BITSO:
        return new BitsoProvider(config);
        
      // Futuros bancos serão adicionados aqui
      case BankProvider.BRADESCO:
      case BankProvider.ITAU:
      case BankProvider.SANTANDER:
      case BankProvider.CAIXA:
      case BankProvider.BB:
      case BankProvider.NUBANK:
      case BankProvider.INTER:
      case BankProvider.C6:
        throw new Error(`Provider ${provider} ainda não implementado - template disponível`);
        
      default:
        throw new Error(`Provider ${provider} não reconhecido`);
    }
  }
}

/**
 * Gerenciador principal de múltiplos bancos
 */
export class BankManager implements IBankManager {
  
  private static instance: BankManager;
  private providers: Map<BankProvider, IBankProvider> = new Map();
  private activeProvider?: BankProvider;

  private constructor() {
    console.log('[BANK-MANAGER] Gerenciador iniciado');
  }

  /**
   * Singleton
   */
  public static getInstance(): BankManager {
    if (!BankManager.instance) {
      BankManager.instance = new BankManager();
    }
    return BankManager.instance;
  }

  // ===============================
  // GESTÃO DE PROVIDERS
  // ===============================

  /**
   * Registra um novo provider
   */
  public registerProvider(provider: IBankProvider): void {
    this.providers.set(provider.provider, provider);
    console.log(`[BANK-MANAGER] Provider ${provider.provider} registrado`);
  }

  /**
   * Registra provider com configuração automática
   */
  public registerProviderByType(
    providerType: BankProvider,
    customCredentials?: BankCredentials
  ): void {
    try {
      const provider = BankProviderFactory.createProvider(providerType, customCredentials);
      this.registerProvider(provider);
    } catch (error) {
      console.error(`[BANK-MANAGER] Erro ao registrar ${providerType}:`, error);
      throw error;
    }
  }

  /**
   * Remove um provider
   */
  public unregisterProvider(provider: BankProvider): void {
    this.providers.delete(provider);
    
    if (this.activeProvider === provider) {
      this.activeProvider = undefined;
    }
    
    console.log(`[BANK-MANAGER] Provider ${provider} removido`);
  }

  /**
   * Obtém um provider específico
   */
  public getProvider(provider: BankProvider): IBankProvider | null {
    return this.providers.get(provider) || null;
  }

  /**
   * Lista todos os providers registrados
   */
  public getAllProviders(): IBankProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Obtém providers que suportam uma funcionalidade
   */
  public getProvidersByFeature(feature: BankFeature): IBankProvider[] {
    return this.getAllProviders().filter(provider => provider.hasFeature(feature));
  }

  // ===============================
  // PROVIDER ATIVO
  // ===============================

  /**
   * Define o provider ativo
   */
  public setActiveProvider(provider: BankProvider): boolean {
    if (!this.providers.has(provider)) {
      console.error(`[BANK-MANAGER] Provider ${provider} não registrado`);
      return false;
    }
    
    this.activeProvider = provider;
    console.log(`[BANK-MANAGER] Provider ativo: ${provider}`);
    return true;
  }

  /**
   * Obtém o provider ativo
   */
  public getActiveProvider(): IBankProvider | null {
    if (!this.activeProvider) return null;
    return this.getProvider(this.activeProvider);
  }

  /**
   * Obtém o tipo do provider ativo
   */
  public getActiveProviderType(): BankProvider | null {
    return this.activeProvider || null;
  }

  // ===============================
  // OPERAÇÕES UNIFICADAS
  // ===============================

  /**
   * Consulta saldo no provider ativo
   */
  public async getBalance(accountId?: string) {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('Nenhum provider ativo definido');
    }
    
    return provider.getBalance(accountId);
  }

  /**
   * Consulta extrato no provider ativo
   */
  public async getStatement(filters?: StandardFilters, accountId?: string) {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('Nenhum provider ativo definido');
    }
    
    return provider.getStatement(filters, accountId);
  }

  // ===============================
  // OPERAÇÕES PIX UNIFICADAS
  // ===============================

  /**
   * Envia PIX via provider ativo
   */
  public async sendPix(pixData: {
    key: string;
    amount: number;
    description?: string;
    keyType?: string;
  }, accountId?: string) {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('Nenhum provider ativo definido');
    }

    if (!provider.sendPix) {
      throw new Error(`Provider ${provider.provider} não suporta envio PIX`);
    }
    
    return provider.sendPix(pixData, accountId);
  }

  /**
   * Lista chaves PIX no provider ativo
   */
  public async getPixKeys(accountId?: string) {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('Nenhum provider ativo definido');
    }

    if (!provider.getPixKeys) {
      throw new Error(`Provider ${provider.provider} não suporta listagem de chaves PIX`);
    }
    
    return provider.getPixKeys(accountId);
  }

  /**
   * Gera QR Code PIX no provider ativo
   */
  public async generatePixQR(amount: number, description?: string, accountId?: string) {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('Nenhum provider ativo definido');
    }

    if (!provider.generatePixQR) {
      throw new Error(`Provider ${provider.provider} não suporta geração de QR Code PIX`);
    }
    
    return provider.generatePixQR(amount, description, accountId);
  }

  /**
   * Consulta saldo em todos os providers
   */
  public async getBalanceFromAll(): Promise<Array<{
    provider: BankProvider;
    result?: StandardBalance;
    error?: any;
  }>> {
    const results = await this.executeOnMultiple(
      Array.from(this.providers.keys()),
      (provider) => provider.getBalance()
    );

    return results.map(result => ({
      provider: result.provider,
      result: result.result?.success ? result.result.data : undefined,
      error: result.error || (!result.result?.success ? result.result?.error : undefined)
    }));
  }

  /**
   * Consulta extrato em todos os providers
   */
  public async getStatementFromAll(filters?: StandardFilters): Promise<Array<{
    provider: BankProvider;
    result?: StandardStatementResponse;
    error?: any;
  }>> {
    const results = await this.executeOnMultiple(
      Array.from(this.providers.keys()),
      (provider) => provider.getStatement(filters)
    );

    return results.map(result => ({
      provider: result.provider,
      result: result.result?.success ? result.result.data : undefined,
      error: result.error || (!result.result?.success ? result.result?.error : undefined)
    }));
  }

  // ===============================
  // OPERAÇÕES MULTI-PROVIDER
  // ===============================

  /**
   * Executa operação em múltiplos providers
   */
  public async executeOnMultiple<T>(
    providerTypes: BankProvider[],
    operation: (provider: IBankProvider) => Promise<T>
  ): Promise<Array<{ provider: BankProvider; result: T; error?: any }>> {
    
    const promises = providerTypes.map(async (providerType) => {
      const provider = this.getProvider(providerType);
      
      if (!provider) {
        return {
          provider: providerType,
          result: null as T,
          error: `Provider ${providerType} não registrado`
        };
      }

      try {
        const result = await operation(provider);
        return {
          provider: providerType,
          result,
          error: undefined
        };
      } catch (error) {
        return {
          provider: providerType,
          result: null as T,
          error: error
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Health check de todos os providers
   */
  public async healthCheckAll(): Promise<Record<BankProvider, boolean>> {
    const results: Record<BankProvider, boolean> = {} as any;
    
    const healthChecks = await this.executeOnMultiple(
      Array.from(this.providers.keys()),
      (provider) => provider.healthCheck()
    );

    healthChecks.forEach(({ provider, result, error }) => {
      if (error) {
        results[provider] = false;
      } else if (result && typeof result === 'object' && 'success' in result) {
        results[provider] = (result as any).success;
      } else {
        results[provider] = false;
      }
    });

    return results;
  }

  // ===============================
  // UTILITÁRIOS
  // ===============================

  /**
   * Auto-registra providers padrão
   */
  public async autoRegisterDefaultProviders(): Promise<void> {
    console.log('[BANK-MANAGER] Auto-registrando providers padrão...');
    
    // 🚨 PRESERVAR PROVIDER ATIVO ANTES DE REGISTRAR
    const currentActiveProvider = this.activeProvider;
    if (currentActiveProvider) {
      console.log(`[BANK-MANAGER] 🔒 Preservando provider ativo: ${currentActiveProvider}`);
    }
    
    // Registrar BMP e Bitso por padrão
    const defaultProviders = [BankProvider.BMP, BankProvider.BITSO];
    
    for (const providerType of defaultProviders) {
      try {
        this.registerProviderByType(providerType);
        console.log(`[BANK-MANAGER] ✅ ${providerType} registrado com sucesso`);
      } catch (error) {
        console.warn(`[BANK-MANAGER] ⚠️ Falha ao registrar ${providerType}:`, error);
      }
    }

    // 🚨 RESTAURAR PROVIDER ATIVO OU DEFINIR PADRÃO
    if (currentActiveProvider && this.providers.has(currentActiveProvider)) {
      console.log(`[BANK-MANAGER] 🔄 Restaurando provider ativo: ${currentActiveProvider}`);
      this.setActiveProvider(currentActiveProvider);
    } else {
      // Definir BMP como ativo por padrão apenas se não havia provider ativo
      console.log('[BANK-MANAGER] Definindo provider padrão (nenhum ativo anterior)');
      if (this.providers.has(BankProvider.BMP)) {
        this.setActiveProvider(BankProvider.BMP);
      } else if (this.providers.has(BankProvider.BITSO)) {
        this.setActiveProvider(BankProvider.BITSO);
      }
    }
  }

  /**
   * Lista informações de todos os bancos disponíveis
   */
  public listAvailableBanks() {
    const availableProviders = bankConfigManager.getAvailableProviders();
    
    return availableProviders.map(provider => {
      const info = bankConfigManager.getBankInfo(provider);
      const isRegistered = this.providers.has(provider);
      const isActive = this.activeProvider === provider;
      
      return {
        ...info,
        isRegistered,
        isActive,
        isConfigured: isRegistered ? this.getProvider(provider)?.isConfigured() : false
      };
    });
  }

  /**
   * Estatísticas do gerenciador
   */
  public getStats() {
    const total = bankConfigManager.getAvailableProviders().length;
    const registered = this.providers.size;
    const active = this.activeProvider ? 1 : 0;
    
    return {
      totalBanks: total,
      registeredProviders: registered,
      activeProvider: this.activeProvider,
      registeredList: Array.from(this.providers.keys()),
      environment: bankConfigManager.getCurrentEnvironment()
    };
  }
}

/**
 * Instância singleton para uso global
 */
export const bankManager = BankManager.getInstance(); 