/**
 * 🏦 PROVIDER BITSO
 * 
 * Implementação específica do Bitso usando a arquitetura escalável
 * Conecta com APIs existentes do backend Bitso
 */

import { BaseBankProvider } from '../BaseBankProvider';
import {
  BankProvider,
  BankFeature,
  TransactionType,
  TransactionStatus
} from '../types';
import type {
  BankConfig,
  BankResponse,
  StandardBalance,
  StandardStatementResponse,
  StandardTransaction,
  StandardFilters
} from '../types';

/**
 * Provider específico do Bitso
 */
export class BitsoProvider extends BaseBankProvider {
  
  private readonly baseUrl: string;

  constructor(config: BankConfig) {
    super(config);
    this.baseUrl = config.apiUrl;
    
    this.logger.info('Bitso Provider configurado', {
      baseUrl: this.baseUrl,
      features: this.features
    });
  }

  /**
   * Teste de conectividade com Bitso
   */
  async healthCheck(): Promise<BankResponse<{ status: string; latency: number }>> {
    try {
      const startTime = Date.now();
      
      // Usa endpoint de saldo para testar conectividade
      await this.makeRequest('GET', '/api/bitso/balance/consultar');
      
      const latency = Date.now() - startTime;
      
      return this.createSuccessResponse({
        status: 'healthy',
        latency
      });
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Consulta saldo no Bitso
   */
  async getBalance(accountId?: string): Promise<BankResponse<StandardBalance>> {
    try {
      this.logger.info('Consultando saldo Bitso', { accountId });
      
      const response = await this.makeRequest('GET', '/api/bitso/balance/consultar');
      
      // Encontrar saldo BRL
      const brlBalance = response.payload?.balances?.find((b: any) => b.currency === 'brl');
      
      if (!brlBalance) {
        return this.createErrorResponse('NO_BRL_BALANCE', 'Saldo BRL não encontrado no Bitso');
      }

      // Padronizar resposta do Bitso
      const standardBalance: StandardBalance = {
        provider: BankProvider.BITSO,
        accountId: accountId || 'bitso-crypto',
        currency: 'BRL',
        available: parseFloat(brlBalance.available || '0'),
        blocked: parseFloat(brlBalance.locked || '0'),
        total: parseFloat(brlBalance.total || '0'),
        lastUpdate: new Date().toISOString(),
        raw: response
      };

      this.logger.info('Saldo Bitso obtido com sucesso', {
        available: standardBalance.available,
        total: standardBalance.total
      });

      return this.createSuccessResponse(standardBalance);
      
    } catch (error) {
      this.logger.error('Erro ao consultar saldo Bitso', error);
      return this.handleError(error);
    }
  }

  /**
   * Consulta extrato no Bitso
   */
  async getStatement(
    filters?: StandardFilters,
    accountId?: string
  ): Promise<BankResponse<StandardStatementResponse>> {
    try {
      this.logger.info('Consultando extrato Bitso', { filters, accountId });

      // Validar filtros
      const validation = this.validateFilters(filters || {});
      if (!validation.valid) {
        return this.createErrorResponse('INVALID_FILTERS', validation.error!);
      }

      // Preparar parâmetros para API Bitso
      const params: any = {
        currency: 'brl', // Focar em PIX BRL
        limit: filters?.limit || 50
      };

      // Bitso pode ter parâmetros específicos
      if (filters?.cursor) params.cursor = filters.cursor;
      if (filters?.dateFrom) params.start_date = filters.dateFrom;
      if (filters?.dateTo) params.end_date = filters.dateTo;

      const response = await this.makeRequest('GET', '/api/bitso/pix/extrato', params);

      // Padronizar transações do Bitso
      const allTransactions: StandardTransaction[] = [];

      // Processar fundings (recebimentos)
      if (response.fundings) {
        const fundingTxs = response.fundings.map((item: any) => ({
          provider: BankProvider.BITSO,
          id: item.id || `bitso-funding-${Date.now()}-${Math.random()}`,
          externalId: item.external_id,
          accountId: accountId || 'bitso-crypto',
          amount: parseFloat(item.amount || '0'),
          currency: item.currency?.toUpperCase() || 'BRL',
          type: TransactionType.CREDIT,
          status: this.mapBitsoStatus(item.status),
          description: item.description || item.method || 'Recebimento PIX Bitso',
          date: item.created_at || new Date().toISOString(),
          pixInfo: {
            endToEndId: item.end_to_end_id,
            key: item.pix_key
          },
          metadata: {
            method: item.method,
            status: item.status
          },
          raw: item
        }));
        allTransactions.push(...fundingTxs);
      }

      // Processar withdrawals (envios)
      if (response.withdrawals) {
        const withdrawalTxs = response.withdrawals.map((item: any) => ({
          provider: BankProvider.BITSO,
          id: item.id || `bitso-withdrawal-${Date.now()}-${Math.random()}`,
          externalId: item.external_id,
          accountId: accountId || 'bitso-crypto',
          amount: parseFloat(item.amount || '0'),
          currency: item.currency?.toUpperCase() || 'BRL',
          type: TransactionType.DEBIT,
          status: this.mapBitsoStatus(item.status),
          description: item.description || item.method || 'Envio PIX Bitso',
          date: item.created_at || new Date().toISOString(),
          counterparty: {
            name: item.recipient_name,
            document: item.recipient_document,
            bank: item.bank_name
          },
          pixInfo: {
            key: item.pix_key,
            endToEndId: item.end_to_end_id
          },
          metadata: {
            method: item.method,
            status: item.status
          },
          raw: item
        }));
        allTransactions.push(...withdrawalTxs);
      }

      // Ordenar por data (mais recente primeiro)
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const statementResponse: StandardStatementResponse = {
        provider: BankProvider.BITSO,
        accountId: accountId || 'bitso-crypto',
        transactions: allTransactions,
        pagination: {
          cursor: response.next_cursor,
          hasNext: response.hasMore || false,
          total: allTransactions.length
        },
        summary: {
          totalCredits: allTransactions
            .filter(t => t.type === TransactionType.CREDIT)
            .reduce((sum, t) => sum + t.amount, 0),
          totalDebits: allTransactions
            .filter(t => t.type === TransactionType.DEBIT)
            .reduce((sum, t) => sum + t.amount, 0),
          netAmount: allTransactions.reduce((sum, t) => 
            t.type === TransactionType.CREDIT ? sum + t.amount : sum - t.amount, 0),
          transactionCount: allTransactions.length
        },
        raw: response
      };

      this.logger.info('Extrato Bitso obtido com sucesso', {
        transactionsCount: allTransactions.length,
        totalCredits: statementResponse.summary?.totalCredits,
        totalDebits: statementResponse.summary?.totalDebits
      });

      return this.createSuccessResponse(statementResponse);
      
    } catch (error) {
      this.logger.error('Erro ao consultar extrato Bitso', error);
      return this.handleError(error);
    }
  }

  /**
   * Busca transação específica no Bitso
   */
  async getTransaction(
    transactionId: string,
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>> {
    try {
      this.logger.info('Buscando transação específica Bitso', { transactionId, accountId });
      
      // Bitso pode não ter endpoint específico para transação única
      // Implementar busca no extrato seria a solução
      
      return this.createErrorResponse('NOT_IMPLEMENTED', 'Busca de transação específica não implementada para Bitso');
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Mapeia status do Bitso para padrão
   */
  private mapBitsoStatus(status: string): TransactionStatus {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'settled':
        return TransactionStatus.COMPLETED;
      case 'pending':
      case 'processing':
        return TransactionStatus.PENDING;
      case 'failed':
      case 'error':
        return TransactionStatus.FAILED;
      case 'cancelled':
      case 'canceled':
        return TransactionStatus.CANCELLED;
      default:
        return TransactionStatus.PENDING;
    }
  }

  /**
   * Faz requisição para API Bitso
   */
  private async makeRequest(method: string, endpoint: string, params?: any): Promise<any> {
    await this.applyRateLimit();

    let url = `${this.baseUrl}${endpoint}`;
    let body: string | undefined;

    // Para GET, adicionar parâmetros na URL
    if (method.toUpperCase() === 'GET' && params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    } else if (params) {
      body = JSON.stringify(params);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders
    };

    this.logger.info(`Requisição Bitso: ${method} ${url}`, params);

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body,
      redirect: 'follow'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const error = new Error(`HTTP error! status: ${response.status}`);
      (error as any).response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      };
      throw error;
    }

    return response.json();
  }

  /**
   * Sobrescreve tratamento de erro para Bitso
   */
  public handleError(error: any): BankResponse<never> {
    // Log específico do Bitso
    this.logger.error('Erro específico Bitso', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    // Tratamentos específicos do Bitso
    if (error.response?.status === 400 && error.response?.data?.message?.includes('Invalid API request data')) {
      return this.createErrorResponse(
        'INVALID_PARAMETERS', 
        'Parâmetros inválidos para API Bitso - verifique filtros e configuração'
      );
    }

    // Delegar para tratamento base
    return super.handleError(error);
  }
} 