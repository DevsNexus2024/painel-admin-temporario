/**
 * API Router - Sistema de Roteamento Simples
 * Isolado para página de pagamentos - BMP vs Bitso
 */

import { API_CONFIG } from '@/config/api';

// Tipos básicos
export type Provider = 'bmp' | 'bitso' | 'bmp-531';

export interface Account {
  id: string;
  provider: Provider;
  displayName: string;
  bankInfo: {
    bank: string;
    agency: string;
    account: string;
  };
}

// Configuração das rotas por provedor
const API_ROUTES: Record<Provider, {
  baseUrl: string;
  saldo: string;
  extrato: string;
  pixEnviar: string;
  pixConsultar: string;
  pixChaves: string;
}> = {
  'bmp': {
    baseUrl: import.meta.env.X_API_BASE_URL,
    saldo: '/internal/account/saldo',
    extrato: '/internal/account/extrato',
    pixEnviar: '/internal/pix/enviar',
    pixConsultar: '/internal/pix/consultar',
    pixChaves: '/internal/pix/chaves/listar'
  },
  'bitso': {
    baseUrl: import.meta.env.X_API_BASE_URL,
    saldo: '/api/bitso/balance/consultar',
    extrato: '/api/bitso/pix/extrato',
    pixEnviar: '/api/bitso/pix/enviar',
    pixConsultar: '/api/bitso/pix/consultar',
    pixChaves: '/api/bitso/pix/chaves'
  },
  'bmp-531': {
    baseUrl: import.meta.env.X_API_BASE_URL,
    saldo: '/bmp-531/account/saldo',
    extrato: '/bmp-531/account/extrato',
    pixEnviar: '/bmp-531/pix/enviar',
    pixConsultar: '/bmp-531/pix/consultar',
    pixChaves: '/bmp-531/pix/chaves/listar'
  }
};

// Contas disponíveis
export const ACCOUNTS: Account[] = [
  {
    id: 'bmp-main',
    provider: 'bmp',
    displayName: 'Conta Principal BMP',
    bankInfo: {
      bank: import.meta.env.X_BMP_BANCO_BMP_274_TCR,
      agency: import.meta.env.X_BMP_AGENCIA_BMP_274_TCR,
      account: `${import.meta.env.X_BMP_CONTA_BMP_274_TCR}-${import.meta.env.X_BMP_CONTA_DIGITO_BMP_274_TCR}`
    }
  },
  {
    id: 'bmp-531-ttf',
    provider: 'bmp-531',
    displayName: 'BMP 531 TTF - Pagamentos',
    bankInfo: {
      bank: import.meta.env.X_BMP_531_BANCO,
      agency: import.meta.env.X_531_AGENCIA,
      account: `${import.meta.env.X_BMP_CONTA_TTF}-${import.meta.env.X_BMP_CONTA_DIGITO_TTF}`
    }
  },
  {
    id: 'bitso-crypto',
    provider: 'bitso',
    displayName: 'Bitso - Crypto Payments',
    bankInfo: {
      bank: 'Bitso',
      agency: 'N/A',
      account: 'Crypto Account'
    }
  }
];

/**
 * Classe principal do roteador
 */
export class ApiRouter {
  private currentAccount: Account;

  constructor() {
    // Conta padrão é BMP Principal
    this.currentAccount = ACCOUNTS[0];
  }

  /**
   * Alterna para uma conta específica
   */
  switchToAccount(accountId: string): boolean {
    const account = ACCOUNTS.find(acc => acc.id === accountId);
    
    if (account) {
      this.currentAccount = account;
      return true;
    }
    
    return false;
  }

  /**
   * Obtém a conta ativa
   */
  getCurrentAccount(): Account {
    return this.currentAccount;
  }

  /**
   * Verifica se uma funcionalidade está disponível
   */
  hasFeature(feature: 'saldo' | 'pix' | 'extrato' | 'chaves'): boolean {
    const routes = API_ROUTES[this.currentAccount.provider];
    
    switch (feature) {
      case 'saldo':
        return !!routes.saldo;
      case 'pix':
        return !!(routes.pixEnviar && routes.pixConsultar);
      case 'extrato':
        return !!routes.extrato;
      case 'chaves':
        return !!routes.pixChaves;
      default:
        return false;
    }
  }

  /**
   * Constrói URL para um endpoint específico
   */
  private buildUrl(endpoint: string): string {
    const routes = API_ROUTES[this.currentAccount.provider];
    return `${routes.baseUrl}${endpoint}`;
  }

  /**
   * Headers padrão por provedor
   */
  private getHeaders(): Record<string, string> {
    const commonHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': import.meta.env.X_APP_USER_AGENT || 'BaaS-Frontend/1.0.0'
    };

    // Headers específicos por provedor se necessário
    switch (this.currentAccount.provider) {
      case 'bmp':
        return { ...commonHeaders, 'x-api-version': '1.0' };
      case 'bitso':
        return { ...commonHeaders, 'x-bitso-version': '3.0' };
      case 'bmp-531':
        return { ...commonHeaders, 'x-bmp531-version': '1.0' };
      default:
        return commonHeaders;
    }
  }

  /**
   * Executa chamada HTTP com roteamento automático
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: AbortSignal.timeout(30000)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || response.statusText}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * API de Saldo
   */
  async getSaldo(): Promise<any> {
    if (!this.hasFeature('saldo')) {
      throw new Error(`Saldo não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const data = await this.makeRequest(routes.saldo);

    // Normalizar resposta baseada no provedor
    if (this.currentAccount.provider === 'bitso') {
      // Endpoint /balance/active retorna formato específico
      return {
        saldo: data.available || data.saldoDisponivel || 0,
        saldoFormatado: `R$ ${(data.available || 0).toFixed(2)}`,
        moeda: 'BRL',
        provider: 'bitso'
      };
    }

    // BMP/BMP-531 já retorna formato esperado
    return data;
  }

  /**
   * API de Extrato
   */
  async getExtrato(params?: Record<string, string>): Promise<any> {
    if (!this.hasFeature('extrato')) {
      const error = `Extrato não disponível para ${this.currentAccount.provider}`;
      throw new Error(error);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    let endpoint = routes.extrato;
    
    // Adicionar parâmetros de consulta se fornecidos
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      endpoint += `?${queryString}`;
    }

    const data = await this.makeRequest(endpoint);
    
    // Normalização da resposta para diferentes provedores
    if (this.currentAccount.provider === 'bitso') {
      // Bitso pode ter estrutura diferente
      if (data.sucesso && data.data?.transacoes) {
        return data.data;
      }
      
      throw new Error('Resposta inválida do backend Bitso');
    }

    // BMP já retorna no formato correto
    return data;
  }

  /**
   * API de Envio PIX
   */
  async enviarPix(dados: { chave: string; valor: number; descricao?: string }): Promise<any> {
    if (!this.hasFeature('pix')) {
      throw new Error(`PIX não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixEnviar;

    const payload = {
      key: dados.chave,
      amount: dados.valor,
      description: dados.descricao || '',
      provider: this.currentAccount.provider
    };

    const data = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return data;
  }

  /**
   * API de Consulta de Chave PIX
   */
  async consultarChavePix(chave: string): Promise<any> {
    if (!this.hasFeature('pix')) {
      throw new Error(`PIX não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixConsultar;

    const data = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ chave })
    });

    return data;
  }

  /**
   * API de Listagem de Chaves PIX
   */
  async listarChavesPix(): Promise<any> {
    if (!this.hasFeature('chaves')) {
      throw new Error(`Chaves PIX não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixChaves;

    const data = await this.makeRequest(endpoint);

    return data;
  }
}

// Instância singleton
export const apiRouter = new ApiRouter();

// Exportar para uso global na window
if (typeof window !== 'undefined') {
  (window as any).apiRouter = apiRouter;
}