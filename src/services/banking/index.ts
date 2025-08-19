/**
 * 🏦 ÍNDICE DA ARQUITETURA BANCÁRIA ESCALÁVEL
 * 
 * Exporta todas as APIs necessárias para o frontend
 * Facilita importação e uso da nova arquitetura
 */

import { BankProvider, StandardFilters, StandardStatementResponse, TransactionStatus } from './types';

// ===============================
// SERVIÇO PRINCIPAL (MAIS USADO)
// ===============================

export {
  UnifiedBankingService,
  unifiedBankingService,
  initializeBankingSystem,
  getBalance,
  getStatement,
  switchAccount,
  getAvailableAccounts,
  type AccountConfig
} from './UnifiedBankingService';

// ===============================
// FUNÇÕES PIX UNIFICADAS
// ===============================

/**
 * Envia PIX via conta ativa
 */
export const sendPix = async (pixData: {
  key: string;
  amount: number;
  description?: string;
  keyType?: string;
}) => {
  const { unifiedBankingService } = await import('./UnifiedBankingService');
  return unifiedBankingService.sendPix(pixData);
};

/**
 * Lista chaves PIX da conta ativa
 */
export const getPixKeys = async () => {
  const { unifiedBankingService } = await import('./UnifiedBankingService');
  return unifiedBankingService.getPixKeys();
};

/**
 * Gera QR Code PIX via conta ativa
 */
export const generatePixQR = async (amount: number, description?: string) => {
  const { unifiedBankingService } = await import('./UnifiedBankingService');
  return unifiedBankingService.generatePixQR(amount, description);
};

/**
 * Cria QR Code dinâmico via Bitso (requer conta Bitso ativa)
 */
export const criarQRCodeDinamicoBitso = async (dados: {
  valor: number;
  chavePix: string;
  tipoChave: string;
  descricao?: string;
}) => {
  const { unifiedBankingService } = await import('./UnifiedBankingService');
  return unifiedBankingService.criarQRCodeDinamicoBitso(dados);
};

/**
 * Cria QR Code estático via Bitso (requer conta Bitso ativa)
 */
export const criarQRCodeEstaticoBitso = async (dados: {
  chavePix: string;
  tipoChave: string;
  descricao?: string;
}) => {
  const { unifiedBankingService } = await import('./UnifiedBankingService');
  return unifiedBankingService.criarQRCodeEstaticoBitso(dados);
};

// ===============================
// TIPOS PADRONIZADOS
// ===============================

export {
  BankProvider,
  BankFeature,
  TransactionType,
  TransactionStatus
} from './types';

export type {
  BankConfig,
  BankCredentials,
  StandardBalance,
  StandardTransaction,
  StandardStatementResponse,
  StandardFilters,
  BankResponse,
  BankOperation
} from './types';

// ===============================
// INTERFACES (PARA EXTENSÃO)
// ===============================

export type {
  IBankProvider,
  IBankProviderFactory,
  IBankManager
} from './interfaces';

// ===============================
// GERENCIADORES (AVANÇADO)
// ===============================

export {
  BankManager,
  bankManager
} from './BankManager';

export {
  BankConfigManager,
  bankConfigManager
} from './config/BankConfigs';

// ===============================
// CLASSE BASE (PARA NOVOS BANCOS)
// ===============================

export { BaseBankProvider } from './BaseBankProvider';

// ===============================
// PROVIDERS ESPECÍFICOS
// ===============================

export { BmpProvider } from './providers/BmpProvider';
export { BitsoProvider } from './providers/BitsoProvider';

// ✅ NOVO CLIENTE API BITSO
export { BitsoApiClient, bitsoApi } from './BitsoApiClient';

// ===============================
// UTILITÁRIOS
// ===============================

/**
 * Lista de todos os bancos configurados no sistema
 */
export const SUPPORTED_BANKS = [
  BankProvider.BMP,
  BankProvider.BITSO,
  BankProvider.BRADESCO,
  BankProvider.ITAU,
  BankProvider.SANTANDER,
  BankProvider.CAIXA,
  BankProvider.BB,
  BankProvider.NUBANK,
  BankProvider.INTER,
  BankProvider.C6
];

/**
 * Bancos atualmente implementados e funcionais
 */
export const IMPLEMENTED_BANKS = [
  BankProvider.BMP,
  BankProvider.BITSO
];

/**
 * Bancos com templates prontos para implementação
 */
export const TEMPLATE_BANKS = [
  BankProvider.BRADESCO,
  BankProvider.ITAU,
  BankProvider.SANTANDER,
  BankProvider.CAIXA,
  BankProvider.BB,
  BankProvider.NUBANK,
  BankProvider.INTER,
  BankProvider.C6
];

// ===============================
// HELPERS DE MIGRAÇÃO
// ===============================

/**
 * Helper para migração gradual do sistema antigo
 */
export class MigrationHelper {
  
  /**
   * Converte provider string para enum
   */
  static stringToProvider(providerStr: string): BankProvider | null {
    const mapping: Record<string, BankProvider> = {
      'bmp': BankProvider.BMP,
      'bitso': BankProvider.BITSO,
      'bradesco': BankProvider.BRADESCO,
      'itau': BankProvider.ITAU,
      'santander': BankProvider.SANTANDER,
      'caixa': BankProvider.CAIXA,
      'bb': BankProvider.BB,
      'nubank': BankProvider.NUBANK,
      'inter': BankProvider.INTER,
      'c6': BankProvider.C6
    };
    
    return mapping[providerStr.toLowerCase()] || null;
  }

  /**
   * Valida se um filtro de extrato é compatível
   */
  static validateLegacyFilters(filters: any): StandardFilters {
    const standardFilters: StandardFilters = {};
    
    // Mapear campos comuns
    if (filters.de) standardFilters.dateFrom = filters.de;
    if (filters.ate) standardFilters.dateTo = filters.ate;
    if (filters.limit) standardFilters.limit = filters.limit;
    if (filters.cursor) standardFilters.cursor = filters.cursor;
    
    return standardFilters;
  }

  /**
   * Converte resposta nova para formato antigo (compatibilidade)
   */
  static convertToLegacyFormat(response: StandardStatementResponse) {
    return {
      items: response.transactions.map(tx => ({
        id: tx.id,
        dateTime: tx.date,
        value: tx.amount,
        type: tx.type,
        document: tx.counterparty?.document || '',
        client: tx.counterparty?.name || tx.description,
        identified: tx.status === TransactionStatus.COMPLETED,
        code: tx.metadata?.code || ''
      })),
      provider: response.provider,
      hasMore: response.pagination?.hasNext || false,
      next_cursor: response.pagination?.cursor,
      total: response.pagination?.total
    };
  }
}

// ===============================
// EXEMPLO DE USO
// ===============================

/*

// 1. INICIALIZAÇÃO (no App.tsx ou main.tsx)
import { initializeBankingSystem } from '@/services/banking';

await initializeBankingSystem();

// 2. USO BÁSICO (mais comum)
import { getBalance, getStatement, switchAccount, getAvailableAccounts } from '@/services/banking';

// Listar contas disponíveis
const accounts = getAvailableAccounts();

// Trocar conta
switchAccount('bmp-account');

// Consultar dados
const balance = await getBalance();
const statement = await getStatement({ limit: 10 });

// 3. USO AVANÇADO
import { unifiedBankingService, BankProvider } from '@/services/banking';

// Consultar saldo de um banco específico
const bitsoBalance = await unifiedBankingService.getBalanceFromProvider(BankProvider.BITSO);

// Consultar todos os bancos simultaneamente
const allBalances = await unifiedBankingService.getBalanceFromAllAccounts();

// 4. ADICIONAR NOVO BANCO (futuro)
import { unifiedBankingService, BankProvider } from '@/services/banking';

await unifiedBankingService.addBank(BankProvider.BRADESCO, {
  clientId: 'xxx',
  clientSecret: 'yyy'
});

*/ 