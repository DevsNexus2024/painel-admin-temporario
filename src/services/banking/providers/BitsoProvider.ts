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
import { PUBLIC_ENV } from '@/config/env';

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
      await this.makeRequest('GET', '/balance/saldos-disponiveis');
      
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

      this.logger.info('Consultando saldo Bitso', { hasAccountId: !!accountId });
      
      const response = await this.makeRequest('GET', '/balance/saldos-disponiveis');
      
      // Processar resposta do Bitso (formato: { success: true, data: { balances: [...] } })
      const balances = response.data?.balances || response.balances;
      
      if (!balances || !Array.isArray(balances)) {
        return this.createErrorResponse('INVALID_RESPONSE', 'Resposta inválida da API Bitso');
      }
      
      // Encontrar saldo BRL
      const brlBalance = balances.find((b: any) => b.currency?.toLowerCase() === 'brl');
      
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
      this.logger.info('Consultando extrato Bitso', { 
        hasFilters: !!filters, 
        hasAccountId: !!accountId 
      });

      // Validar filtros
      const validation = this.validateFilters(filters || {});
      if (!validation.valid) {
        return this.createErrorResponse('INVALID_FILTERS', validation.error!);
      }

      // Preparar parâmetros para API Bitso
      const params: any = {
        currency: 'brl', // Focar em PIX BRL
        limit: filters?.limit || 1000 // ✅ CORRIGIDO: Aumentar limite padrão para 1000
      };

      // Bitso pode ter parâmetros específicos
      if (filters?.cursor) params.cursor = filters.cursor;
      if (filters?.dateFrom) params.start_date = filters.dateFrom;
      if (filters?.dateTo) params.end_date = filters.dateTo;

      const response = await this.makeRequest('GET', '/pix/extrato/conta', params);

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
      this.logger.info('Buscando transação específica Bitso', { 
        hasTransactionId: !!transactionId, 
        hasAccountId: !!accountId 
      });
      
      // Bitso pode não ter endpoint específico para transação única
      // Implementar busca no extrato seria a solução
      
      return this.createErrorResponse('NOT_IMPLEMENTED', 'Busca de transação específica não implementada para Bitso');
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ===============================
  // OPERAÇÕES PIX DA BITSO
  // ===============================

  /**
   * Lista chaves PIX (simulado - Bitso não armazena chaves)
   */
  async getPixKeys(accountId?: string): Promise<BankResponse<any[]>> {
    try {
      this.logger.info('Listando chaves PIX Bitso', { hasAccountId: !!accountId });
      
      // Bitso não armazena chaves PIX - retorna lista vazia ou chaves configuráveis
      const mockKeys = [
        {
          id: 'bitso-cpf-key',
          tipo: 'CPF',
          chave: import.meta.env.X_BITSO_MOCK_CPF_KEY || 'Configure sua chave CPF',
          status: 'ATIVA',
          provider: 'bitso'
        },
        {
          id: 'bitso-email-key', 
          tipo: 'EMAIL',
          chave: import.meta.env.X_BITSO_MOCK_EMAIL_KEY || 'Configure sua chave Email',
          status: 'ATIVA',
          provider: 'bitso'
        }
      ];

      return this.createSuccessResponse(mockKeys);
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Envia PIX via Bitso
   */
  async sendPix(
    pixData: {
      key: string;
      amount: number;
      description?: string;
      keyType?: string;
    },
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>> {
    try {

      this.logger.info('Enviando PIX via Bitso', { 
        keyType: pixData.keyType, 
        amount: pixData.amount,
        hasKey: !!pixData.key,
        accountId: accountId ? 'presente' : 'ausente' 
      });

      // Validar dados básicos
      if (!pixData.key || !pixData.amount) {

        return this.createErrorResponse('INVALID_PARAMETERS', 'Chave PIX e valor são obrigatórios');
      }

      if (pixData.amount <= 0) {
        return this.createErrorResponse('INVALID_AMOUNT', 'Valor deve ser maior que zero');
      }

      // Detectar tipo de chave se não fornecido (melhorado)
      const keyType = pixData.keyType || this.detectPixKeyType(pixData.key);
      
      // Validar tipo de chave detectado
      const validKeyTypes = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'];
      if (!validKeyTypes.includes(keyType.toUpperCase())) {
        return this.createErrorResponse('INVALID_KEY_TYPE', `Tipo de chave inválido: ${keyType}`);
      }

      // Preparar dados para API Bitso (conforme documentação)
      const requestData = {
        pix_key: pixData.key.trim(),
        pix_key_type: keyType.toUpperCase(),
        amount: pixData.amount.toString(),
        currency: 'brl',
        origin_id: `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        remittanceInformation: pixData.description || `PIX para ${pixData.key}`
      };


      this.logger.info('Dados padronizados para envio PIX Bitso', {
        amount: requestData.amount,
        currency: requestData.currency,
        origin_id: requestData.origin_id,
        hasKey: !!requestData.pix_key
      });


      
      // Chamada para endpoint da Bitso conforme guia
      const response = await this.makeRequest('POST', '/pix/transferencia', requestData);
      


      if (!response.sucesso) {
        // Melhor tratamento de erros específicos da Bitso
        let errorCode = 'PIX_SEND_FAILED';
        let errorMessage = response.mensagem || 'Erro ao enviar PIX';

        if (response.erro?.includes('saldo insuficiente') || response.mensagem?.includes('Insufficient')) {
          errorCode = 'INSUFFICIENT_FUNDS';
          errorMessage = 'Saldo insuficiente para realizar a transferência';
        } else if (response.erro?.includes('chave não encontrada') || response.mensagem?.includes('Key not found')) {
          errorCode = 'INVALID_PIX_KEY';
          errorMessage = 'Chave PIX não encontrada ou inválida';
        } else if (response.erro?.includes('dados inválidos') || response.mensagem?.includes('Invalid API request')) {
          errorCode = 'INVALID_PARAMETERS';
          errorMessage = 'Dados fornecidos são inválidos';
        }

        this.logger.error('Erro específico no envio PIX Bitso', {
          errorCode,
          originalError: response.erro,
          originalMessage: response.mensagem
        });

        return this.createErrorResponse(errorCode, errorMessage);
      }

      // Padronizar resposta para StandardTransaction
      const standardTransaction: StandardTransaction = {
        provider: BankProvider.BITSO,
        id: response.data?.wid || `bitso-pix-${Date.now()}`,
        externalId: response.data?.end_to_end_id,
        accountId: accountId || 'bitso-crypto',
        amount: pixData.amount,
        currency: 'BRL',
        type: TransactionType.DEBIT,
        status: this.mapBitsoStatus(response.data?.status || 'pending'),
        description: pixData.description || `PIX para ${pixData.key} (${keyType})`,
        date: new Date().toISOString(),
        counterparty: {
          name: response.data?.destinatario?.nome,
          document: response.data?.destinatario?.documento,
          bank: response.data?.destinatario?.banco
        },
        pixInfo: {
          key: pixData.key,
          keyType: keyType,
          endToEndId: response.data?.end_to_end_id
        },
        metadata: {
          provider: 'bitso',
          wid: response.data?.wid,
          origin_id: response.data?.origin_id,
          frontend_generated_origin_id: requestData.origin_id
        },
        raw: response
      };


      
      this.logger.info('PIX enviado com sucesso via Bitso', {
        wid: response.data?.wid,
        status: response.data?.status,
        endToEndId: response.data?.end_to_end_id,
        keyType: keyType,
        amount: pixData.amount
      });


      return this.createSuccessResponse(standardTransaction);

    } catch (error) {
      this.logger.error('Erro ao enviar PIX via Bitso', {
        error: error.message,
        pixData,
        accountId
      });
      return this.handleError(error);
    }
  }

  /**
   * Gera QR Code PIX via Bitso
   */
  async generatePixQR(
    amount: number,
    description?: string,
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>> {
    try {
      this.logger.info('Gerando QR Code PIX via Bitso', { 
        amount, 
        hasDescription: !!description, 
        hasAccountId: !!accountId 
      });

      // Para gerar QR Code, precisa de uma chave PIX própria
      // Como Bitso não armazena, vamos precisar que seja informada
      return this.createErrorResponse(
        'PIX_KEY_REQUIRED', 
        'Para gerar QR Code é necessário configurar uma chave PIX. Use o método criarQRCodeDinamico com chave específica.'
      );

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Cria QR Code dinâmico específico da Bitso
   */
  async criarQRCodeDinamico(
    dados: {
      valor: number;
      chavePix: string;
      tipoChave: string;
      descricao?: string;
    },
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>> {
    try {
      this.logger.info('Criando QR Code dinâmico Bitso', { 
        valor: dados.valor,
        tipoChave: dados.tipoChave,
        hasAccountId: !!accountId 
      });

      const requestData = {
        amount: dados.valor.toString(),
        currency: 'brl',
        pix_key: dados.chavePix,
        pix_key_type: dados.tipoChave.toUpperCase(),
        reference: `QR-${Date.now()}`,
        remittanceInformation: dados.descricao || `QR Code dinâmico - ${dados.valor}`
      };

      const response = await this.makeRequest('POST', '/pix/qr-dinamico', requestData);

      if (!response.sucesso) {
        return this.createErrorResponse('QR_CODE_FAILED', response.mensagem || 'Erro ao criar QR Code');
      }

      return this.createSuccessResponse({
        qrCode: response.data?.qrCode || response.data?.qr_code_payload || '',
        txId: response.data?.fid || `qr-${Date.now()}`
      });

    } catch (error) {
      this.logger.error('Erro ao criar QR Code dinâmico Bitso', error);
      return this.handleError(error);
    }
  }

  /**
   * Cria QR Code estático específico da Bitso
   */
  async criarQRCodeEstatico(
    dados: {
      chavePix: string;
      tipoChave: string;
      descricao?: string;
    },
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>> {
    try {
      this.logger.info('Criando QR Code estático Bitso', { 
        tipoChave: dados.tipoChave,
        hasAccountId: !!accountId 
      });

      const requestData = {
        currency: 'brl',
        pix_key: dados.chavePix,
        pix_key_type: dados.tipoChave.toUpperCase(),
        reference: `QR-STATIC-${Date.now()}`,
        remittanceInformation: dados.descricao || 'QR Code estático'
      };

      const response = await this.makeRequest('POST', '/pix/qr-estatico', requestData);

      if (!response.sucesso) {
        return this.createErrorResponse('QR_CODE_FAILED', response.mensagem || 'Erro ao criar QR Code');
      }

      return this.createSuccessResponse({
        qrCode: response.data?.qrCode || response.data?.qr_code_payload || '',
        txId: response.data?.fid || `qr-static-${Date.now()}`
      });

    } catch (error) {
      this.logger.error('Erro ao criar QR Code estático Bitso', error);
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
   * Detecta o tipo de chave PIX fornecida (melhorado e alinhado com backend)
   */
  private detectPixKeyType(key: string): string {
    if (!key) return 'EVP';
    
    const keyTrimmed = key.toString().trim();
    
    // EMAIL: deve conter @ e pelo menos um ponto
    if (keyTrimmed.includes('@') && keyTrimmed.includes('.')) {
      return 'EMAIL';
    }
    
    // PHONE: inicia com + (formato internacional)
    if (keyTrimmed.startsWith('+')) {
      return 'PHONE';
    }
    
    // Remover caracteres não numéricos para análise de CPF/CNPJ
    const onlyNumbers = keyTrimmed.replace(/\D/g, '');
    
    // CPF: exatamente 11 dígitos numéricos
    if (onlyNumbers.length === 11 && /^[0-9]+$/.test(onlyNumbers)) {
      return 'CPF';
    }
    
    // CNPJ: exatamente 14 dígitos numéricos  
    if (onlyNumbers.length === 14 && /^[0-9]+$/.test(onlyNumbers)) {
      return 'CNPJ';
    }
    
    // EVP: 32 caracteres alfanuméricos (pode conter hífens)
    if (keyTrimmed.length === 32 && /^[a-zA-Z0-9-]+$/.test(keyTrimmed)) {
      return 'EVP';
    }
    
    // Para números com formatação de telefone brasileiro
    if (onlyNumbers.length >= 10 && onlyNumbers.length <= 13 && keyTrimmed.match(/^\(?[0-9]{2}\)?[\s\-]?[0-9]{4,5}[\s\-]?[0-9]{4}$/)) {
      return 'PHONE';
    }
    
    // Padrão: EVP (para chaves que não se encaixam nos outros padrões)
    this.logger.info('Tipo de chave não detectado automaticamente, usando EVP como padrão', { hasKey: !!keyTrimmed });
    return 'EVP';
  }

  /**
   * Faz requisição para API Bitso com os 3 headers obrigatórios
   * ✅ Implementa padrão do guia: X-API-Key, X-API-Secret, Authorization
   */
  protected async makeRequest(method: string, endpoint: string, params?: any): Promise<any> {
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

    // ✅ HEADERS BÁSICOS - Backend adiciona credenciais via JWT
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders
      // Backend adiciona automaticamente: X-API-Key, X-API-Secret baseado no JWT
    };

    // ✅ ADICIONAR JWT TOKEN DO USUÁRIO LOGADO
    const token = this.getJwtToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.logger.info(`Requisição Bitso: ${method} ${url}`, { 
      hasParams: !!params,
      hasToken: !!token,
      endpoint 
    });

    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000) // 60 segundos
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
      
    } catch (error: any) {
      // Tratamento específico para timeout
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        const timeoutError = new Error(`Timeout: Requisição para ${url} demorou mais de 60 segundos`);
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }
      
      // Re-lançar outros erros
      throw error;
    }
  }

  /**
   * Obtém JWT Token do storage (conforme guia)
   */
  private getJwtToken(): string | null {
    try {
      // Tenta sessionStorage primeiro, depois localStorage
      return sessionStorage.getItem('jwt_token') || 
             localStorage.getItem('jwt_token') || 
             sessionStorage.getItem('auth_token') || 
             localStorage.getItem('auth_token');
    } catch (error) {
      this.logger.warn('Erro ao obter JWT token', error);
      return null;
    }
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