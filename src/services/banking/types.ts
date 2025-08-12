/**
 * 🏦 TIPOS PADRONIZADOS PARA ARQUITETURA MULTI-BANK
 * 
 * Estrutura escalável para suportar N bancos diferentes
 * Cada banco implementa estas interfaces de forma consistente
 */

// ===============================
// ENUMS E CONSTANTES
// ===============================

export enum BankProvider {
  BMP = 'bmp',
  BMP_531 = 'bmp-531',
  BITSO = 'bitso',
  BRADESCO = 'bradesco',
  ITAU = 'itau',
  SANTANDER = 'santander',
  CAIXA = 'caixa',
  BB = 'bb',
  NUBANK = 'nubank',
  INTER = 'inter',
  C6 = 'c6'
  // Facilmente extensível para novos bancos
}

export enum TransactionType {
  CREDIT = 'CRÉDITO',
  DEBIT = 'DÉBITO'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// ===============================
// INTERFACES PADRONIZADAS
// ===============================

/**
 * Configuração básica que todo banco deve implementar
 */
export interface BankConfig {
  provider: BankProvider;
  name: string;
  displayName: string;
  apiUrl: string;
  timeout: number;
  features: BankFeature[];
  credentials: BankCredentials;
  rateLimit?: RateLimit;
  customHeaders?: Record<string, string>;
}

/**
 * Credenciais flexíveis por banco
 */
export interface BankCredentials {
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  token?: string;
  // Campos customizados por banco
  [key: string]: any;
}

/**
 * Funcionalidades disponíveis por banco
 */
export enum BankFeature {
  BALANCE = 'balance',
  STATEMENT = 'statement', 
  PIX_SEND = 'pix_send',
  PIX_RECEIVE = 'pix_receive',
  PIX_KEYS = 'pix_keys',
  BOLETO = 'boleto',
  TRANSFER = 'transfer',
  WEBHOOK = 'webhook'
}

/**
 * Rate limiting por banco
 */
export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit?: number;
}

// ===============================
// DADOS PADRONIZADOS
// ===============================

/**
 * Saldo padronizado
 */
export interface StandardBalance {
  provider: BankProvider;
  accountId: string;
  currency: string;
  available: number;
  blocked: number;
  total: number;
  lastUpdate: string;
  raw?: any; // Dados originais do banco
}

/**
 * Transação padronizada
 */
export interface StandardTransaction {
  provider: BankProvider;
  id: string;
  externalId?: string;
  accountId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  date: string;
  counterparty?: {
    name?: string;
    document?: string;
    bank?: string;
    account?: string;
  };
  pixInfo?: {
    key?: string;
    keyType?: string;
    endToEndId?: string;
  };
  metadata?: Record<string, any>;
  raw?: any; // Dados originais do banco
}

/**
 * Resposta padronizada do extrato
 */
export interface StandardStatementResponse {
  provider: BankProvider;
  accountId: string;
  transactions: StandardTransaction[];
  pagination?: {
    cursor?: string | number;
    hasNext: boolean;
    total?: number;
  };
  summary?: {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
  };
  raw?: any; // Resposta original do banco
}

/**
 * Filtros padronizados
 */
export interface StandardFilters {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string | number;
  transactionType?: TransactionType;
  status?: TransactionStatus;
  minAmount?: number;
  maxAmount?: number;
  // Filtros específicos por banco
  [key: string]: any;
}

// ===============================
// INTERFACES DE RESPOSTA
// ===============================

/**
 * Resposta base para todas as operações
 */
export interface BankResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  provider: BankProvider;
  timestamp: string;
  requestId?: string;
}

/**
 * Resultado de operações assíncronas
 */
export interface BankOperation {
  id: string;
  provider: BankProvider;
  type: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: any;
  createdAt: string;
  completedAt?: string;
} 