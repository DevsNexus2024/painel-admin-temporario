/**
 * API Router - Sistema de Roteamento Simples
 * Isolado para página de pagamentos - BMP vs Bitso
 */

import { API_CONFIG } from '@/config/api';

// Tipos básicos
export type Provider = 'bmp' | 'bitso';

export interface Account {
  id: string;
  name: string;
  provider: Provider;
  displayName: string;
  bankInfo: {
    bank: string;
    agency?: string;
    account?: string;
  };
}

// Configuração de contas disponíveis
export const ACCOUNTS: Account[] = [
  {
    id: 'bmp-main',
    name: 'BMP Principal',
    provider: 'bmp',
    displayName: 'Conta Principal BMP',
    bankInfo: {
      bank: 'Banco 274',
      agency: '0001',
      account: '902486-0'
    }
  },
  {
    id: 'bmp-531-main',
    name: 'BMP 531',
    provider: 'bmp-531',
    displayName: 'BMP 531 - Pagamentos',
    bankInfo: {
      bank: 'Banco 531',
      agency: '0001',
      account: '531001-0'
    }
  },
  {
    id: 'bitso-crypto',
    name: 'Bitso PIX',
    provider: 'bitso', 
    displayName: 'Bitso - Pagamentos PIX',
    bankInfo: {
      bank: 'Bitso PIX Brazil',
      agency: 'Digital',
      account: 'BRL-001'
    }
  }
];

// Mapeamento de rotas por provedor
const API_ROUTES = {
  bmp: {
    baseUrl: API_CONFIG.BASE_URL,
    saldo: '/internal/account/saldo',
    extrato: '/internal/account/extrato',
    pixEnviar: '/internal/pix/enviar',
    pixConsultar: '/internal/pix/consultar-chave',
    pixChaves: '/internal/pix/chaves/listar'
  },
  'bmp-531': {
    baseUrl: API_CONFIG.BASE_URL,
    saldo: '/bmp-531/account/saldo',
    extrato: '/bmp-531/account/extrato',
    pixEnviar: '/bmp-531/pix/enviar',
    pixConsultar: '/bmp-531/pix/consultar-chave',
    pixChaves: '/bmp-531/pix/chaves/listar'
  },
  bitso: {
    baseUrl: `${API_CONFIG.BASE_URL}/api/bitso`,
    saldo: '/balance/active',
    extrato: '/pix/extrato',
    pixEnviar: '/pix/enviar', // TODO: implementar
    pixConsultar: '/pix/consultar-chave', // TODO: implementar
    pixChaves: '/pix/chaves/listar' // TODO: implementar
  }
} as const;

/**
 * Classe principal do roteador de APIs
 */
export class ApiRouter {
  private currentAccount: Account;

  constructor(initialAccount?: Account) {
    this.currentAccount = initialAccount || ACCOUNTS[0];
  }

  /**
   * Troca a conta ativa
   */
  switchAccount(accountId: string): boolean {
    console.log(`🔄 [ApiRouter] Tentando trocar para conta: ${accountId}`);
    console.log(`🏦 [ApiRouter] Conta atual: ${this.currentAccount.id} (${this.currentAccount.provider})`);
    
    const account = ACCOUNTS.find(acc => acc.id === accountId);
    if (account) {
      const oldAccount = this.currentAccount;
      this.currentAccount = account;
      
      console.log(`✅ [ApiRouter] Conta alterada com sucesso:`);
      console.log(`   Anterior: ${oldAccount.displayName} (${oldAccount.provider})`);
      console.log(`   Atual: ${account.displayName} (${account.provider})`);
      console.log(`   ID: ${account.id}`);
      
      return true;
    }
    
    console.error(`❌ [ApiRouter] Conta não encontrada: ${accountId}`);
    console.log(`📋 [ApiRouter] Contas disponíveis:`, ACCOUNTS.map(acc => ({
      id: acc.id,
      provider: acc.provider,
      displayName: acc.displayName
    })));
    
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
      'User-Agent': 'baas-frontend/1.0.0'
    };

    if (this.currentAccount.provider === 'bmp') {
      const token = localStorage.getItem('auth_token');
      return {
        ...commonHeaders,
        ...(token && { Authorization: `Bearer ${token}` })
      };
    }

    // Para Bitso a autenticação HMAC é feita no backend
    return commonHeaders;
  }

  /**
   * Executa chamada HTTP com roteamento automático
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders();

    console.log(`🌐 [${this.currentAccount.provider.toUpperCase()}] ${options.method || 'GET'} ${url}`);

    // Agora todas as chamadas usam requisições reais

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
      console.error(`❌ [${this.currentAccount.provider.toUpperCase()}] Erro:`, error);
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
      if (data.success && data.data && data.data.balances) {
        const brlBalance = data.data.balances.find((b: any) => b.currency === 'BRL');
        
        if (!brlBalance) {
          return {
            saldo: 0,
            saldoFormatado: 'R$ 0,00',
            moeda: 'BRL',
            provider: 'bitso'
          };
        }

        return {
          saldo: brlBalance.available,
          saldoFormatado: `R$ ${brlBalance.available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          saldoBloqueado: brlBalance.locked,
          moeda: 'BRL',
          provider: 'bitso',
          total: brlBalance.total,
          ultimaAtualizacao: new Date().toISOString()
        };
      }
      throw new Error('Resposta inválida do backend Bitso');
    }

    // BMP já retorna no formato correto
    return data;
  }

  /**
   * API de Extrato
   */
  async getExtrato(params?: Record<string, string>): Promise<any> {
    console.log(`📋 [ApiRouter.getExtrato] Iniciando consulta de extrato...`);
    console.log(`🏦 [ApiRouter.getExtrato] Conta ativa: ${this.currentAccount.displayName} (${this.currentAccount.provider})`);
    console.log(`📊 [ApiRouter.getExtrato] Parâmetros:`, params);
    
    if (!this.hasFeature('extrato')) {
      const error = `Extrato não disponível para ${this.currentAccount.provider}`;
      console.error(`❌ [ApiRouter.getExtrato] ${error}`);
      throw new Error(error);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    let endpoint = routes.extrato;
    
    console.log(`🛣️ [ApiRouter.getExtrato] Endpoint base: ${endpoint}`);
    console.log(`🌐 [ApiRouter.getExtrato] Base URL: ${routes.baseUrl}`);
    
    // Adicionar parâmetros de consulta se fornecidos
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      endpoint += `?${queryString}`;
    }
    
    console.log(`🎯 [ApiRouter.getExtrato] Endpoint completo: ${endpoint}`);
    console.log(`📞 [ApiRouter.getExtrato] URL final será: ${routes.baseUrl}${endpoint}`);

    const data = await this.makeRequest(endpoint);
    
    console.log(`📥 [ApiRouter.getExtrato] Resposta recebida:`, {
      success: data?.sucesso || data?.success,
      provider: this.currentAccount.provider,
      hasTransacoes: !!(data?.transacoes || data?.items),
      totalItems: (data?.transacoes || data?.items)?.length || 0
    });

    // Normalizar resposta baseada no provedor
    if (this.currentAccount.provider === 'bitso') {
      console.log(`🔄 [ApiRouter.getExtrato] Processando resposta Bitso...`);
      // Backend Bitso já retorna no formato normalizado
      if (data.sucesso && data.data) {
        console.log(`✅ [ApiRouter.getExtrato] Resposta Bitso válida:`, {
          transacoes: data.data.transacoes?.length || 0,
          provider: data.data.provider
        });
        return data.data;
      }
      console.error(`❌ [ApiRouter.getExtrato] Resposta Bitso inválida:`, data);
      throw new Error('Resposta inválida do backend Bitso');
    }

    console.log(`🔄 [ApiRouter.getExtrato] Processando resposta BMP...`);
    // BMP já retorna no formato correto
    console.log(`✅ [ApiRouter.getExtrato] Resposta BMP retornada`);
    return data;
  }

  /**
   * API de PIX - Enviar
   */
  async enviarPix(dados: { chave: string; valor: number; descricao?: string }): Promise<any> {
    if (!this.hasFeature('pix')) {
      throw new Error(`PIX não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixEnviar;
    
    if (!endpoint) {
      throw new Error(`PIX não implementado para ${this.currentAccount.provider}`);
    }

    // Backend Bitso já espera dados no formato padrão
    const requestData = dados;

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    // Normalizar resposta baseada no provedor
    if (this.currentAccount.provider === 'bitso') {
      // Backend Bitso já retorna no formato normalizado
      if (response.sucesso && response.data) {
        return response.data;
      }
      throw new Error('Resposta inválida do backend Bitso');
    }

    return response;
  }

  /**
   * API de Consulta PIX
   */
  async consultarChavePix(chave: string): Promise<any> {
    if (!this.hasFeature('pix')) {
      throw new Error(`Consulta PIX não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixConsultar;
    
    if (!endpoint) {
      throw new Error(`Consulta PIX não implementada para ${this.currentAccount.provider}`);
    }

    if (this.currentAccount.provider === 'bitso') {
      // Backend Bitso espera formato padrão
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ chave })
      });

      // Backend Bitso já retorna no formato normalizado
      if (response.sucesso && response.data) {
        return response.data;
      }
      throw new Error('Resposta inválida do backend Bitso');
    } else {
      // BMP usa GET
      const url = `${endpoint}?chave=${encodeURIComponent(chave)}`;
      return this.makeRequest(url);
    }
  }

  /**
   * API de Listar Chaves PIX
   */
  async listarChavesPix(): Promise<any> {
    if (!this.hasFeature('chaves')) {
      throw new Error(`Listagem de chaves não disponível para ${this.currentAccount.provider}`);
    }

    const routes = API_ROUTES[this.currentAccount.provider];
    const endpoint = routes.pixChaves;
    
    if (!endpoint) {
      throw new Error(`Listagem de chaves não implementada para ${this.currentAccount.provider}`);
    }

    const data = await this.makeRequest(endpoint);

    // Normalizar resposta baseada no provedor
    if (this.currentAccount.provider === 'bitso') {
      // Backend Bitso já retorna no formato normalizado
      if (data.sucesso && data.data) {
        return data.data;
      }
      throw new Error('Resposta inválida do backend Bitso');
    }

    // BMP já retorna no formato correto
    return data;
  }
}

// Instância global do roteador (singleton simples)
export const apiRouter = new ApiRouter(); 