/**
 * 🎯 INTERFACE BASE PARA TODOS OS BANCOS
 * 
 * Contrato que TODOS os bancos devem implementar
 * Garante consistência e facilita integração de novos bancos
 */

import {
  BankProvider,
  BankConfig,
  StandardBalance,
  StandardStatementResponse,
  StandardTransaction,
  StandardFilters,
  BankResponse,
  BankFeature
} from './types';

/**
 * Interface base que TODOS os bancos devem implementar
 */
export interface IBankProvider {
  // ===============================
  // PROPRIEDADES BÁSICAS
  // ===============================
  
  readonly provider: BankProvider;
  readonly config: BankConfig;
  readonly features: BankFeature[];

  // ===============================
  // MÉTODOS DE VALIDAÇÃO
  // ===============================
  
  /**
   * Verifica se o banco suporta uma funcionalidade
   */
  hasFeature(feature: BankFeature): boolean;

  /**
   * Valida se as credenciais estão configuradas
   */
  isConfigured(): boolean;

  /**
   * Testa a conectividade com o banco
   */
  healthCheck(): Promise<BankResponse<{ status: string; latency: number }>>;

  // ===============================
  // OPERAÇÕES FINANCEIRAS
  // ===============================

  /**
   * Consulta saldo da conta
   */
  getBalance(accountId?: string): Promise<BankResponse<StandardBalance>>;

  /**
   * Consulta extrato/histórico de transações
   */
  getStatement(
    filters?: StandardFilters,
    accountId?: string
  ): Promise<BankResponse<StandardStatementResponse>>;

  /**
   * Busca detalhes de uma transação específica
   */
  getTransaction(
    transactionId: string,
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>>;

  // ===============================
  // OPERAÇÕES PIX (SE SUPORTADO)
  // ===============================

  /**
   * Lista chaves PIX (se suportado)
   */
  getPixKeys?(accountId?: string): Promise<BankResponse<any[]>>;

  /**
   * Envia PIX (se suportado)
   */
  sendPix?(
    pixData: {
      key: string;
      amount: number;
      description?: string;
    },
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>>;

  /**
   * Gera QR Code PIX (se suportado)
   */
  generatePixQR?(
    amount: number,
    description?: string,
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>>;

  // ===============================
  // OPERAÇÕES DE TRANSFERÊNCIA
  // ===============================

  /**
   * Transferência TED/DOC (se suportado)
   */
  transfer?(
    transferData: {
      bank: string;
      branch: string;
      account: string;
      document: string;
      name: string;
      amount: number;
      description?: string;
    },
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>>;

  // ===============================
  // OPERAÇÕES DE BOLETO
  // ===============================

  /**
   * Gera boleto (se suportado)
   */
  generateBoleto?(
    boletoData: {
      amount: number;
      dueDate: string;
      payerDocument: string;
      payerName: string;
      description?: string;
    },
    accountId?: string
  ): Promise<BankResponse<any>>;

  // ===============================
  // WEBHOOK E NOTIFICAÇÕES
  // ===============================

  /**
   * Configura webhook (se suportado)
   */
  configureWebhook?(
    webhookUrl: string,
    events: string[],
    accountId?: string
  ): Promise<BankResponse<any>>;

  /**
   * Processa notificação de webhook
   */
  processWebhook?(payload: any): Promise<BankResponse<StandardTransaction[]>>;

  // ===============================
  // MÉTODOS UTILITÁRIOS
  // ===============================

  /**
   * Normaliza valores monetários conforme padrão do banco
   */
  normalizeAmount(amount: number): number;

  /**
   * Formata data conforme padrão do banco
   */
  formatDate(date: Date | string): string;

  /**
   * Trata erros específicos do banco
   */
  handleError(error: any): BankResponse<never>;

  /**
   * Logs específicos do banco
   */
  log(level: 'info' | 'warn' | 'error', message: string, data?: any): void;
}

/**
 * Factory para criação de providers bancários
 */
export interface IBankProviderFactory {
  /**
   * Cria uma instância do provider
   */
  createProvider(config: BankConfig): IBankProvider;

  /**
   * Lista todos os providers disponíveis
   */
  getAvailableProviders(): BankProvider[];

  /**
   * Verifica se um provider está disponível
   */
  isProviderAvailable(provider: BankProvider): boolean;
}

/**
 * Gerenciador de múltiplos bancos
 */
export interface IBankManager {
  /**
   * Registra um novo provider
   */
  registerProvider(provider: IBankProvider): void;

  /**
   * Remove um provider
   */
  unregisterProvider(provider: BankProvider): void;

  /**
   * Obtém um provider específico
   */
  getProvider(provider: BankProvider): IBankProvider | null;

  /**
   * Lista todos os providers registrados
   */
  getAllProviders(): IBankProvider[];

  /**
   * Obtém providers que suportam uma funcionalidade
   */
  getProvidersByFeature(feature: BankFeature): IBankProvider[];

  /**
   * Executa operação em múltiplos providers
   */
  executeOnMultiple<T>(
    providers: BankProvider[],
    operation: (provider: IBankProvider) => Promise<T>
  ): Promise<Array<{ provider: BankProvider; result: T; error?: any }>>;

  /**
   * Health check de todos os providers
   */
  healthCheckAll(): Promise<Record<BankProvider, boolean>>;
} 