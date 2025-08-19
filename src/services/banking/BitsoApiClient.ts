/**
 * 🚀 CLIENTE API BITSO - CONFORME GUIA OFICIAL
 * 
 * Cliente reutilizável para todas as funcionalidades da Bitso
 * Implementa os 3 headers obrigatórios e endpoints atualizados
 */

import { PUBLIC_ENV } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Tipos de dados para Bitso
 */
export interface BitsoPixData {
  amount: string;
  pix_key: string;
  pix_key_type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  origin_id?: string;
  remittanceInformation?: string;
}

export interface BitsoBalance {
  currency: string;
  total: string;
  locked: string;
  available: string;
  pending_deposit: string;
  pending_withdrawal: string;
}

export interface BitsoTransaction {
  id: string;
  tipo: 'pay_in' | 'pay_out';
  valor: string;
  status: string;
  data_criacao: string;
  data_atualizacao?: string;
  detalhes: any;
}

export interface BitsoFilters {
  start_date?: string;
  end_date?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface BitsoResponse<T> {
  sucesso: boolean;
  mensagem?: string;
  data?: T;
  error?: string;
}

/**
 * Cliente API centralizado para Bitso
 * ✅ Implementa padrão do guia com 3 headers obrigatórios
 */
export class BitsoApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = PUBLIC_ENV.API_BASE_URL;
    
    // ✅ HEADERS BÁSICOS - Credenciais adicionadas pelo backend
    this.defaultHeaders = {
      'Content-Type': 'application/json'
      // Backend adiciona: X-API-Key, X-API-Secret baseado no JWT
    };
  }

  /**
   * Método base para fazer requisições com autenticação completa
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<BitsoResponse<T>> {
    const jwt = this.getJwtToken();
    
    if (!jwt) {
      throw new Error('Token JWT não encontrado. Faça login novamente.');
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        'Authorization': `Bearer ${jwt}`,
        ...options.headers
      }
    };

    const url = `${this.baseUrl}${endpoint}`;

    try {
      // Log seguro sem exposição de dados sensíveis
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[BITSO API] ${config.method || 'GET'} ${endpoint}`);
      }

      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.mensagem || data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error: any) {
      // Log de erro sem exposição de dados sensíveis
      if (process.env.NODE_ENV === 'development') {
        logger.error(`[BITSO API] Erro na requisição ${endpoint}`, { 
          status: error.status,
          message: error.message 
        });
      }
      throw error;
    }
  }

  /**
   * Obtém JWT Token do storage (conforme padrão do guia)
   */
  private getJwtToken(): string | null {
    try {
      return sessionStorage.getItem('jwt_token') || 
             localStorage.getItem('jwt_token') ||
             sessionStorage.getItem('auth_token') || 
             localStorage.getItem('auth_token');
    } catch (error) {
      logger.warn('[BITSO API] Erro ao obter JWT token', error);
      return null;
    }
  }

  // ===============================
  // MÉTODOS PIX
  // ===============================

  /**
   * Enviar PIX via Bitso
   */
  async enviarPix(dados: BitsoPixData): Promise<BitsoResponse<any>> {
    const requestData = {
      ...dados,
      origin_id: dados.origin_id || `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    return this.request('/api/bitso/pix/transferencia', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Consultar extrato PIX
   */
  async consultarExtrato(filtros: BitsoFilters = {}): Promise<BitsoResponse<any>> {
    const params = new URLSearchParams();
    
    if (filtros.start_date) params.append('start_date', filtros.start_date);
    if (filtros.end_date) params.append('end_date', filtros.end_date);
    if (filtros.status) params.append('status', filtros.status);
    if (filtros.limit) params.append('limit', filtros.limit.toString());
    if (filtros.cursor) params.append('cursor', filtros.cursor);

    const query = params.toString() ? `?${params.toString()}` : '';
    
    return this.request(`/api/bitso/pix/extrato/conta${query}`);
  }

  // ===============================
  // MÉTODOS DE SALDO
  // ===============================

  /**
   * Consultar saldos disponíveis (apenas moedas com atividade)
   */
  async consultarSaldosDisponiveis(): Promise<BitsoResponse<{ balances: BitsoBalance[] }>> {
    return this.request('/api/bitso/balance/saldos-disponiveis');
  }

  /**
   * Consultar todos os saldos
   */
  async consultarTodosSaldos(): Promise<BitsoResponse<{ balances: BitsoBalance[] }>> {
    return this.request('/api/bitso/balance/todos-saldos');
  }

  /**
   * Consultar saldo de moeda específica
   */
  async consultarSaldoMoeda(currency: string): Promise<BitsoResponse<BitsoBalance>> {
    return this.request(`/api/bitso/balance/moeda/${currency.toLowerCase()}`);
  }

  // ===============================
  // MÉTODOS DE QR CODE
  // ===============================

  /**
   * Criar QR Code dinâmico (com valor fixo)
   */
  async criarQRCodeDinamico(dados: {
    valor: number;
    chavePix: string;
    tipoChave: string;
    descricao?: string;
  }): Promise<BitsoResponse<{ qrCode: string; txId: string }>> {
    const requestData = {
      amount: dados.valor.toString(),
      currency: 'brl',
      pix_key: dados.chavePix,
      pix_key_type: dados.tipoChave.toUpperCase(),
      reference: `QR-${Date.now()}`,
      remittanceInformation: dados.descricao || `QR Code dinâmico - R$ ${dados.valor}`
    };

    return this.request('/api/bitso/pix/qr-dinamico', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Criar QR Code estático (sem valor fixo)
   */
  async criarQRCodeEstatico(dados: {
    chavePix: string;
    tipoChave: string;
    descricao?: string;
  }): Promise<BitsoResponse<{ qrCode: string; txId: string }>> {
    const requestData = {
      currency: 'brl',
      pix_key: dados.chavePix,
      pix_key_type: dados.tipoChave.toUpperCase(),
      reference: `QR-STATIC-${Date.now()}`,
      remittanceInformation: dados.descricao || 'QR Code estático'
    };

    return this.request('/api/bitso/pix/qr-estatico', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  // ===============================
  // MÉTODOS UTILITÁRIOS
  // ===============================

  /**
   * Verificar se usuário está autenticado e token é válido
   */
  hasValidToken(): boolean {
    const token = this.getJwtToken();
    if (!token) return false;
    
    try {
      // Verificação básica de expiração
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Detectar tipo de chave PIX automaticamente
   */
  detectPixKeyType(key: string): string {
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
    if (onlyNumbers.length >= 10 && onlyNumbers.length <= 13 && 
        keyTrimmed.match(/^\(?[0-9]{2}\)?[\s\-]?[0-9]{4,5}[\s\-]?[0-9]{4}$/)) {
      return 'PHONE';
    }
    
    // Padrão: EVP
    return 'EVP';
  }

  /**
   * Validar dados PIX antes do envio
   */
  validarDadosPix(dados: BitsoPixData): string[] {
    const erros: string[] = [];

    // Validar valor
    const valor = parseFloat(dados.amount);
    if (isNaN(valor) || valor <= 0) {
      erros.push('Valor deve ser um número positivo');
    }
    if (valor > 50000) {
      erros.push('Valor máximo de R$ 50.000 por transação');
    }

    // Validar chave PIX
    if (!dados.pix_key || dados.pix_key.trim() === '') {
      erros.push('Chave PIX é obrigatória');
    }

    // Validações específicas por tipo de chave
    if (dados.pix_key_type === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dados.pix_key)) {
        erros.push('Email inválido');
      }
    }

    if (dados.pix_key_type === 'CPF') {
      const cpf = dados.pix_key.replace(/\D/g, '');
      if (cpf.length !== 11) {
        erros.push('CPF deve ter 11 dígitos');
      }
    }

    if (dados.pix_key_type === 'CNPJ') {
      const cnpj = dados.pix_key.replace(/\D/g, '');
      if (cnpj.length !== 14) {
        erros.push('CNPJ deve ter 14 dígitos');
      }
    }

    return erros;
  }
}

/**
 * Instância única do cliente (singleton)
 */
export const bitsoApi = new BitsoApiClient();

/**
 * Export default para compatibilidade
 */
export default bitsoApi;
