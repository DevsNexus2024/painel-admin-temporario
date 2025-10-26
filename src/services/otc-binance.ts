/**
 * 🪙 OTC Binance Service
 * Serviço para integração Binance OTC
 */

import { api } from '@/config/api';
import { logger } from '@/utils/logger';

const OTC_BINANCE_BASE_URL = '/api/otc/binance';

// ==================== TYPES ====================

export interface BinanceConfig {
  id: number;
  id_binance_account: string;
  fee: number; // Taxa em decimal (0.001 = 0.1%)
  account_email: string;
  created_at: string;
  updated_at: string;
}

export interface BinanceTransaction {
  id?: number;
  binance_account?: {
    id: number;
    account_id: string;
    email: string;
  };
  otc_client_id: number;
  binance_transaction_id: string;
  transaction_type: 'BUY' | 'SELL' | 'WITHDRAW' | 'DEPOSIT';
  binance_price_average_no_fees: number;
  binance_fee_percentage?: number;
  binance_fee_amount?: number;
  binance_price_average_with_fees?: number;
  client_fee_percentage_applied?: number;
  client_fee_amount_applied?: number;
  client_final_price?: number;
  input_coin_id: number;
  input_coin_amount?: number;
  output_coin_id: number;
  output_coin_amount?: number;
  binance_transaction_date: string;
  transaction_status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  transaction_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BinanceConfigsResponse {
  success: boolean;
  data: BinanceConfig[];
}

export interface BinanceTransactionResponse {
  success: boolean;
  message?: string;
  data: BinanceTransaction;
}

// ==================== SERVICES ====================

/**
 * Buscar configurações Binance disponíveis
 */
export async function getBinanceConfigs(): Promise<BinanceConfig[]> {
  try {
    logger.debug('[BINANCE-CONFIG] Buscando configurações...');
    
    const response = await api.get<BinanceConfigsResponse>(
      `${OTC_BINANCE_BASE_URL}/configs`
    );
    
    if (response.data.success) {
      logger.debug('[BINANCE-CONFIG] Configurações obtidas:', response.data.data);
      return response.data.data;
    }
    
    throw new Error('Resposta inválida da API');
  } catch (error: any) {
    logger.error('[BINANCE-CONFIG] Erro ao buscar configurações:', error);
    return [];
  }
}

/**
 * Criar transação Binance OTC
 */
export async function createBinanceTransaction(
  transactionData: BinanceTransaction
): Promise<BinanceTransaction | null> {
  try {
    logger.debug('[BINANCE-TRANSACTION] Criando transação...', transactionData);
    
    const response = await api.post<BinanceTransactionResponse>(
      `${OTC_BINANCE_BASE_URL}/transactions`,
      transactionData
    );
    
    if (response.data.success) {
      logger.debug('[BINANCE-TRANSACTION] Transação criada:', response.data.data);
      return response.data.data;
    }
    
    throw new Error(response.data.message || 'Erro ao criar transação');
  } catch (error: any) {
    logger.error('[BINANCE-TRANSACTION] Erro ao criar transação:', error);
    return null;
  }
}

/**
 * Listar transações Binance OTC
 */
export async function getBinanceTransactions(params?: {
  otc_client_id?: number;
  transaction_type?: string;
  transaction_status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  transactions: BinanceTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
} | null> {
  try {
    logger.debug('[BINANCE-TRANSACTIONS] Buscando transações...', params);
    
    const searchParams = new URLSearchParams();
    if (params?.otc_client_id) searchParams.append('otc_client_id', String(params.otc_client_id));
    if (params?.transaction_type) searchParams.append('transaction_type', params.transaction_type);
    if (params?.transaction_status) searchParams.append('transaction_status', params.transaction_status);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    
    const url = `${OTC_BINANCE_BASE_URL}/transactions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await api.get<{
      success: boolean;
      data: {
        transactions: BinanceTransaction[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          total_pages: number;
        };
      };
    }>(url);
    
    if (response.data.success) {
      logger.debug('[BINANCE-TRANSACTIONS] Transações obtidas:', response.data.data);
      return response.data.data;
    }
    
    throw new Error('Resposta inválida da API');
  } catch (error: any) {
    logger.error('[BINANCE-TRANSACTIONS] Erro ao buscar transações:', error);
    return null;
  }
}

/**
 * Atualizar anotação de uma transação Binance OTC por ID interno
 */
export async function updateBinanceTransactionNotes(
  transactionId: number,
  notes: string
): Promise<BinanceTransaction | null> {
  try {
    logger.debug('[BINANCE-TRANSACTION] Atualizando anotação por ID interno...', { transactionId, notes });
    
    const response = await api.patch<BinanceTransactionResponse>(
      `${OTC_BINANCE_BASE_URL}/transactions/${transactionId}/notes`,
      { transaction_notes: notes }
    );
    
    if (response.data.success) {
      logger.debug('[BINANCE-TRANSACTION] Anotação atualizada:', response.data.data);
      return response.data.data;
    }
    
    throw new Error(response.data.message || 'Erro ao atualizar anotação');
  } catch (error: any) {
    logger.error('[BINANCE-TRANSACTION] Erro ao atualizar anotação:', error);
    return null;
  }
}

/**
 * Atualizar anotação de uma transação Binance OTC por binance_transaction_id
 */
export async function updateBinanceTransactionNotesByBinanceId(
  binanceTransactionId: string,
  notes: string
): Promise<BinanceTransaction | null> {
  try {
    logger.debug('[BINANCE-TRANSACTION] Atualizando anotação por binance_transaction_id...', { binanceTransactionId, notes });
    
    const response = await api.patch<BinanceTransactionResponse>(
      `${OTC_BINANCE_BASE_URL}/transactions/0/notes`,
      { 
        binance_transaction_id: binanceTransactionId,
        transaction_notes: notes 
      }
    );
    
    if (response.data.success) {
      logger.debug('[BINANCE-TRANSACTION] Anotação atualizada:', response.data.data);
      return response.data.data;
    }
    
    throw new Error(response.data.message || 'Erro ao atualizar anotação');
  } catch (error: any) {
    logger.error('[BINANCE-TRANSACTION] Erro ao atualizar anotação:', error);
    return null;
  }
}

