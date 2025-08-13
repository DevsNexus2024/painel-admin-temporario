/**
 * 🧱 CLASSE BASE PARA TODOS OS PROVIDERS BANCÁRIOS
 * 
 * Implementa funcionalidades comuns e força padronização
 * Novos bancos estendem esta classe e implementam apenas métodos específicos
 */

import {
  BankProvider,
  BankFeature
} from './types';
import type {
  BankConfig,
  BankResponse,
  StandardBalance,
  StandardStatementResponse,
  StandardTransaction,
  StandardFilters
} from './types';
import type { IBankProvider } from './interfaces';

/**
 * Classe base abstrata para providers bancários
 * 
 * ✅ Implementa funcionalidades comuns
 * ✅ Força padronização de logs e erros
 * ✅ Simplifica criação de novos providers
 */
export abstract class BaseBankProvider implements IBankProvider {
  
  // ===============================
  // PROPRIEDADES BÁSICAS
  // ===============================
  
  public readonly provider: BankProvider;
  public readonly config: BankConfig;
  public readonly features: BankFeature[];

  protected readonly logger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };

  // ===============================
  // CONSTRUTOR
  // ===============================
  
  constructor(config: BankConfig) {
    this.provider = config.provider;
    this.config = config;
    this.features = config.features;
    
    // Logger padronizado
    this.logger = {
      info: (message: string, data?: any) => this.log('info', message, data),
      warn: (message: string, data?: any) => this.log('warn', message, data),
      error: (message: string, data?: any) => this.log('error', message, data)
    };

    this.logger.info(`Provider ${this.provider} inicializado`, {
      features: this.features,
      hasCredentials: this.isConfigured()
    });
  }

  // ===============================
  // MÉTODOS IMPLEMENTADOS (COMUM A TODOS)
  // ===============================

  /**
   * Verifica se o banco suporta uma funcionalidade
   */
  hasFeature(feature: BankFeature): boolean {
    return this.features.includes(feature);
  }

  /**
   * Valida se as credenciais estão configuradas
   */
  isConfigured(): boolean {
    const credentials = this.config.credentials;
    
    // Verificação básica - cada banco pode sobrescrever
    if (credentials.apiKey && credentials.apiSecret) return true;
    if (credentials.clientId && credentials.clientSecret) return true;
    if (credentials.username && credentials.password) return true;
    if (credentials.token) return true;
    
    return false;
  }

  /**
   * Cria resposta padronizada de sucesso
   */
  protected createSuccessResponse<T>(data: T): BankResponse<T> {
    return {
      success: true,
      data,
      provider: this.provider,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    };
  }

  /**
   * Cria resposta padronizada de erro
   */
  protected createErrorResponse(code: string, message: string, details?: any): BankResponse<never> {
    return {
      success: false,
      error: { code, message, details },
      provider: this.provider,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    };
  }

  /**
   * Gera ID único para requisição
   */
  protected generateRequestId(): string {
    return `${this.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Logs padronizados
   */
  public log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      provider: this.provider,
      timestamp: new Date().toISOString(),
      message,
      data
    };

    switch (level) {
      case 'info':
        console.log(`[${this.provider.toUpperCase()}] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${this.provider.toUpperCase()}] ⚠️ ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${this.provider.toUpperCase()}] ❌ ${message}`, data || '');
        break;
    }
  }

  /**
   * Tratamento de erro padronizado
   */
  public handleError(error: any): BankResponse<never> {
    this.logger.error('Erro no provider', {
      error: error.message || error,
      stack: error.stack,
      response: error.response?.data
    });

    // Tratamento básico - cada banco pode sobrescrever
    if (error.response) {
      return this.createErrorResponse(
        error.response.status?.toString() || 'HTTP_ERROR',
        error.response.data?.message || error.message || 'Erro na API do banco',
        error.response.data
      );
    }

    if (error.code === 'ECONNABORTED') {
      return this.createErrorResponse('TIMEOUT', 'Timeout na conexão com o banco');
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return this.createErrorResponse('CONNECTION_ERROR', 'Erro de conexão com o banco');
    }

    return this.createErrorResponse(
      'UNKNOWN_ERROR',
      error.message || 'Erro desconhecido',
      error
    );
  }

  /**
   * Normaliza valores monetários (padrão: centavos para reais)
   */
  public normalizeAmount(amount: number): number {
    // Padrão: assume que valor está em centavos, converte para reais
    return Math.round(amount) / 100;
  }

  /**
   * Formata data (padrão: ISO string)
   */
  public formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return date;
    }
    return date.toISOString();
  }

  /**
   * Aplica rate limiting se configurado
   */
  protected async applyRateLimit(): Promise<void> {
    if (this.config.rateLimit) {
      // Implementação básica - pode ser melhorada com redis/cache
      const delay = Math.ceil(60000 / this.config.rateLimit.requestsPerMinute);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Valida filtros básicos
   */
  protected validateFilters(filters: StandardFilters): { valid: boolean; error?: string } {
    if (filters.dateFrom && filters.dateTo) {
      const from = new Date(filters.dateFrom);
      const to = new Date(filters.dateTo);
      
      if (from > to) {
        return { valid: false, error: 'Data inicial não pode ser maior que data final' };
      }
    }

    if (filters.limit && (filters.limit < 1 || filters.limit > 1000)) {
      return { valid: false, error: 'Limite deve estar entre 1 e 1000' };
    }

    return { valid: true };
  }

  // ===============================
  // MÉTODOS ABSTRATOS (IMPLEMENTAR EM CADA BANCO)
  // ===============================

  /**
   * Teste de conectividade - cada banco implementa
   */
  abstract healthCheck(): Promise<BankResponse<{ status: string; latency: number }>>;

  /**
   * Consulta saldo - cada banco implementa
   */
  abstract getBalance(accountId?: string): Promise<BankResponse<StandardBalance>>;

  /**
   * Consulta extrato - cada banco implementa
   */
  abstract getStatement(
    filters?: StandardFilters,
    accountId?: string
  ): Promise<BankResponse<StandardStatementResponse>>;

  /**
   * Busca transação específica - cada banco implementa
   */
  abstract getTransaction(
    transactionId: string,
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>>;

  // ===============================
  // MÉTODOS OPCIONAIS (SOBRESCREVER SE SUPORTADO)
  // ===============================

  /**
   * Implementação padrão para bancos que não suportam PIX
   */
  async getPixKeys?(accountId?: string): Promise<BankResponse<any[]>> {
    return this.createErrorResponse('NOT_SUPPORTED', 'PIX não suportado por este banco');
  }

  async sendPix?(
    pixData: { key: string; amount: number; description?: string },
    accountId?: string
  ): Promise<BankResponse<StandardTransaction>> {
    return this.createErrorResponse('NOT_SUPPORTED', 'Envio de PIX não suportado por este banco');
  }

  async generatePixQR?(
    amount: number,
    description?: string,
    accountId?: string
  ): Promise<BankResponse<{ qrCode: string; txId: string }>> {
    return this.createErrorResponse('NOT_SUPPORTED', 'QR Code PIX não suportado por este banco');
  }

  /**
   * 🔐 Função de requisição HTTP com API credentials
   * ✅ Inclui headers de autenticação obrigatórios
   */
  protected async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<any> {
    const baseUrl = this.config.apiUrl || 'https://api-bank.gruponexus.com.br';
    const url = `${baseUrl}${endpoint}`;

    // ✅ Headers com API credentials para BMP
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': import.meta.env.VITE_API_KEY_BMP_TCR,
      'X-API-Secret': import.meta.env.VITE_API_SECRET_BMP_TCR,
      ...additionalHeaders
    };

    // ✅ Adicionar token JWT se disponível
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      this.logger.info(`${method} ${endpoint}`, { hasBody: !!body });

      const requestInit: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(30000) // 30 segundos
      };

      if (body && method !== 'GET') {
        requestInit.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestInit);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      this.logger.info(`${method} ${endpoint} - sucesso`, { status: response.status });
      
      return data;
      
    } catch (error: any) {
      this.logger.error(`${method} ${endpoint} - erro`, error);
      
      if (error.name === 'TimeoutError') {
        throw new Error('Timeout: A requisição demorou muito para responder');
      }
      
      if (error.name === 'AbortError') {
        throw new Error('Requisição cancelada');
      }
      
      throw error;
    }
  }
} 