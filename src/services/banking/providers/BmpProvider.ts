/**
 * 🏦 PROVIDER BMP
 * 
 * Implementação específica do BMP usando a arquitetura escalável
 * Conecta com APIs existentes do backend BMP
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
 * Provider específico do BMP
 */
export class BmpProvider extends BaseBankProvider {
  
  private readonly baseUrl: string;

  constructor(config: BankConfig) {
    super(config);
    this.baseUrl = config.apiUrl;
    
    this.logger.info('BMP Provider configurado', {
      baseUrl: this.baseUrl,
      features: this.features
    });
  }

  /**
   * Teste de conectividade com BMP
   */
  async healthCheck(): Promise<BankResponse<{ status: string; latency: number }>> {
    try {
      console.log('🩺 [BMP] Health check iniciado (teste de conectividade)');
      const startTime = Date.now();
      
      // Usa endpoint de saldo para testar conectividade
      await this.makeRequest('GET', '/internal/account/balance');
      
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
   * Consulta saldo no BMP
   */
  async getBalance(accountId?: string): Promise<BankResponse<StandardBalance>> {
    try {
      console.log('💰 [BMP] getBalance() chamado - consultando saldo BMP', { accountId });
      this.logger.info('Consultando saldo BMP', { accountId });
      
      const response = await this.makeRequest('GET', '/internal/account/saldo');
      
      // Padronizar resposta do BMP (formato real: { saldoDisponivel: 161512, saldoBloqueado: 0, saldoAgendado: 0, atualizadoEm: "..." })
      const standardBalance: StandardBalance = {
        provider: BankProvider.BMP,
        accountId: accountId || 'bmp-main',
        currency: 'BRL',
        available: response.saldoDisponivel || 0,
        blocked: response.saldoBloqueado || 0,
        total: (response.saldoDisponivel || 0) + (response.saldoBloqueado || 0),
        lastUpdate: response.atualizadoEm || new Date().toISOString(),
        raw: response
      };

      this.logger.info('Saldo BMP obtido com sucesso', {
        available: standardBalance.available,
        total: standardBalance.total
      });

      return this.createSuccessResponse(standardBalance);
      
    } catch (error) {
      this.logger.error('Erro ao consultar saldo BMP', error);
      return this.handleError(error);
    }
  }

  /**
   * Consulta extrato no BMP
   */
  async getStatement(
    filters?: StandardFilters,
    accountId?: string
  ): Promise<BankResponse<StandardStatementResponse>> {
    try {
      this.logger.info('Consultando extrato BMP', { filters, accountId });

      // Validar filtros
      const validation = this.validateFilters(filters || {});
      if (!validation.valid) {
        return this.createErrorResponse('INVALID_FILTERS', validation.error!);
      }

      // Preparar parâmetros para API BMP
      const params: any = {};
      if (filters?.limit) params.limit = filters.limit;
      if (filters?.cursor) params.cursor = filters.cursor;
      if (filters?.dateFrom) params.de = filters.dateFrom;
      if (filters?.dateTo) params.ate = filters.dateTo;

      const response = await this.makeRequest('GET', '/internal/account/extrato', params);

      // Padronizar transações
      const transactions: StandardTransaction[] = (response.items || []).map((item: any) => ({
        provider: BankProvider.BMP,
        id: item.id || `bmp-${Date.now()}-${Math.random()}`,
        externalId: item.external_id,
        accountId: accountId || 'bmp-main',
        amount: this.normalizeAmount(item.value || 0),
        currency: 'BRL',
        type: item.type === 'CRÉDITO' ? TransactionType.CREDIT : TransactionType.DEBIT,
        status: item.identified ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        description: item.client || item.document || 'Transação BMP',
        date: item.dateTime || new Date().toISOString(),
        counterparty: {
          name: item.client,
          document: item.document
        },
        metadata: {
          code: item.code,
          identified: item.identified
        },
        raw: item
      }));

      const statementResponse: StandardStatementResponse = {
        provider: BankProvider.BMP,
        accountId: accountId || 'bmp-main',
        transactions,
        pagination: {
          cursor: response.next_cursor,
          hasNext: !!response.has_more,
          total: response.total
        },
        summary: {
          totalCredits: transactions
            .filter(t => t.type === TransactionType.CREDIT)
            .reduce((sum, t) => sum + t.amount, 0),
          totalDebits: transactions
            .filter(t => t.type === TransactionType.DEBIT)
            .reduce((sum, t) => sum + t.amount, 0),
          netAmount: transactions.reduce((sum, t) => 
            t.type === TransactionType.CREDIT ? sum + t.amount : sum - t.amount, 0),
          transactionCount: transactions.length
        },
        raw: response
      };

      this.logger.info('Extrato BMP obtido com sucesso', {
        transactionsCount: transactions.length,
        totalCredits: statementResponse.summary?.totalCredits,
        totalDebits: statementResponse.summary?.totalDebits
      });

      return this.createSuccessResponse(statementResponse);
      
    } catch (error) {
      this.logger.error('Erro ao consultar extrato BMP', error);
      return this.handleError(error);
    }
  }

  /**
   * Busca transação específica no BMP
   */
  async getTransaction(
    transactionId: string,
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>> {
    try {
      this.logger.info('Buscando transação específica BMP', { transactionId, accountId });
      
      // BMP pode não ter endpoint específico para transação única
      // Usar extrato com filtro por ID seria a implementação aqui
      
      return this.createErrorResponse('NOT_IMPLEMENTED', 'Busca de transação específica não implementada para BMP');
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Faz requisição para API BMP
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

    // Adicionar token de autenticação se disponível
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    this.logger.info(`Requisição BMP: ${method} ${url}`, params);

    // 🚨 TIMEOUT CRÍTICO: Evitar loop infinito se backend não responder
    const timeoutMs = 30000; // 30 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body,
        redirect: 'follow',
        signal: controller.signal // ← ADICIONAR TIMEOUT
      });
      
      clearTimeout(timeoutId); // Limpar timeout se sucesso

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
      
    } catch (error: any) {
      clearTimeout(timeoutId); // Limpar timeout em caso de erro
      
      // Tratamento específico para timeout
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Timeout: Requisição para ${url} demorou mais de ${timeoutMs}ms`);
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }
      
      // Re-lançar outros erros
      throw error;
    }
  }

  /**
   * ✅ REGRA 1: Envia PIX via BMP específico
   */
  async sendPix(pixData: {
    key: string;
    amount: number;
    description?: string;
    keyType?: string;
  }, accountId?: string): Promise<BankResponse<StandardTransaction>> {
    try {
      console.log('🚀 [BMP] sendPix() chamado - enviando PIX via BMP', { 
        key: pixData.key, 
        amount: pixData.amount,
        accountId 
      });
      
      this.logger.info('Enviando PIX via BMP', { 
        amount: pixData.amount,
        keyType: pixData.keyType,
        accountId 
      });

      // Preparar dados para API BMP
      const requestData = {
        chave: pixData.key,
        valor: pixData.amount,
        descricao: pixData.description || 'Transferência PIX'
      };

      const response = await this.makeRequest('POST', '/internal/pix/enviar', requestData);

      // Padronizar resposta do BMP para StandardTransaction
      const standardTransaction: StandardTransaction = {
        provider: BankProvider.BMP,
        id: response.codigoTransacao || `bmp-pix-${Date.now()}`,
        externalId: response.codigoTransacao,
        accountId: accountId || 'bmp-main',
        amount: pixData.amount,
        currency: 'BRL',
        type: TransactionType.DEBIT,
        status: response.sucesso ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
        description: `PIX para ${pixData.key}: ${pixData.description || 'Transferência PIX'}`,
        date: new Date().toISOString(),
        counterparty: {
          account: pixData.key,
          keyType: pixData.keyType
        },
        metadata: {
          pixKey: pixData.key,
          pixKeyType: pixData.keyType,
          status: response.status
        },
        raw: response
      };

      this.logger.info('PIX BMP enviado com sucesso', {
        transactionId: standardTransaction.id,
        amount: pixData.amount,
        status: standardTransaction.status
      });

      return this.createSuccessResponse(standardTransaction);
      
    } catch (error) {
      this.logger.error('Erro ao enviar PIX via BMP', error);
      return this.handleError(error);
    }
  }

  /**
   * ✅ REGRA 1: Lista chaves PIX específicas do BMP
   */
  async getPixKeys(accountId?: string): Promise<BankResponse<any[]>> {
    try {
      console.log('🔑 [BMP] getPixKeys() chamado - listando chaves PIX via BMP', { accountId });
      this.logger.info('Listando chaves PIX via BMP', { accountId });

      const response = await this.makeRequest('GET', '/internal/pix/chaves/listar');

      // BMP retorna as chaves no formato já adequado
      const chaves = response.chaves || [];

      this.logger.info('Chaves PIX BMP obtidas com sucesso', {
        totalChaves: chaves.length
      });

      return this.createSuccessResponse(chaves);
      
    } catch (error) {
      this.logger.error('Erro ao listar chaves PIX via BMP', error);
      return this.handleError(error);
    }
  }

  /**
   * ✅ REGRA 1: Gera QR Code PIX específico do BMP  
   */
  async generatePixQR(
    amount: number, 
    description?: string, 
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>> {
    try {
      console.log('📱 [BMP] generatePixQR() chamado - gerando QR Code via BMP', { 
        amount, 
        description,
        accountId 
      });
      
      this.logger.info('Gerando QR Code PIX via BMP', { amount, description, accountId });

      // BMP pode ter endpoint específico para QR Code
      // Se não tiver, retornar erro informativo
      return this.createErrorResponse(
        'NOT_IMPLEMENTED', 
        'Geração de QR Code PIX não implementada para BMP. Use endpoint específico se disponível.'
      );
      
    } catch (error) {
      this.logger.error('Erro ao gerar QR Code PIX via BMP', error);
      return this.handleError(error);
    }
  }

  /**
   * Sobrescreve normalização para BMP (se necessário)
   */
  public normalizeAmount(amount: number): number {
    // BMP já retorna valores em reais
    return amount;
  }
} 