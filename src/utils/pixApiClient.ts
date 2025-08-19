// utils/pixApiClient.ts

import { TOKEN_STORAGE } from '@/config/api';
import { logger } from '@/utils/logger';

/**
 * 🔐 PixApiClient - Implementação da Nova Autenticação Híbrida
 * 
 * Conforme especificações do guia de segurança:
 * - API Key + Secret (como antes)
 * - JWT Token do usuário logado (NOVO)
 * - Validação cruzada no backend
 * - Tratamento de novos códigos de erro de segurança
 */
class PixApiClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    // ✅ Obter configurações do ambiente
    this.apiKey = import.meta.env.VITE_PIX_API_KEY || '';
    this.apiSecret = import.meta.env.VITE_PIX_API_SECRET || '';
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '';

    // ⚠️ Validar configurações críticas
    if (!this.apiKey || !this.apiSecret || !this.baseUrl) {
      // Log seguro sem exposição de dados sensíveis
      if (process.env.NODE_ENV === 'development') {
        console.error('🚨 [PIX-API-CLIENT] Configurações de ambiente incompletas! Verifique variáveis de ambiente.');
      }
    }
  }

  /**
   * 🔒 Faz requisição PIX com autenticação híbrida
   * @param endpoint - Endpoint da API (ex: '/pix/enviar')
   * @param method - Método HTTP (POST, GET, etc.)
   * @param data - Dados para envio (para POST/PUT)
   * @returns Promise com resposta da API
   */
  async makePixRequest(endpoint: string, method: string = 'POST', data: any = null): Promise<any> {
    // 🔒 Obter token do usuário logado
    const userToken = this.getUserToken();
    
    if (!userToken) {
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }

    // ✅ Preparar headers com autenticação híbrida
    const config: RequestInit = {
      method,
      headers: {
              // Backend adiciona automaticamente: X-API-Key, X-API-Secret via JWT
        'Authorization': `Bearer ${userToken}`, // 🔥 CRÍTICO - JWT obrigatório
        'Content-Type': 'application/json'
      }
    };

    // ✅ Adicionar body se necessário
    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    try {


      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      
      // ✅ Processar resposta
      if (!response.ok) {
        const error = await this.extractErrorFromResponse(response);
        throw new Error(error);
      }

      const result = await response.json();
      
      logger.info('[PIX-API-CLIENT] Requisição PIX bem-sucedida', {
        endpoint,
        status: response.status
      });

      return result;

    } catch (error) {
      logger.error('[PIX-API-CLIENT] Erro na requisição PIX:', error);
      
      // 🔄 Tratar erros específicos de segurança
      const treatedError = this.handleSecurityErrors(error as Error);
      throw treatedError;
    }
  }

  /**
   * 🔒 Obter token do usuário logado
   * @returns Token JWT ou null se não autenticado
   */
  private getUserToken(): string | null {
    try {
      // Opção 1: Via TOKEN_STORAGE (método preferido)
      const token = TOKEN_STORAGE.get();
      if (token) return token;

      // Opção 2: Fallback para localStorage direto
      return localStorage.getItem('auth_token') || 
             localStorage.getItem('authToken') ||
             sessionStorage.getItem('userToken') ||
             null;

    } catch (error) {
      logger.error('[PIX-API-CLIENT] Erro ao obter token do usuário:', error);
      return null;
    }
  }

  /**
   * 🛠️ Extrair mensagem de erro da resposta HTTP
   * @param response - Response da requisição HTTP
   * @returns Mensagem de erro tratada
   */
  private async extractErrorFromResponse(response: Response): Promise<string> {
    try {
      const errorData = await response.json();
      
      // 🔍 Tentar diferentes formatos de erro
      const errorMessage = 
        errorData.mensagem ||
        errorData.message ||
        errorData.error ||
        errorData.errorMessage ||
        errorData.response?.message ||
        errorData.response?.mensagem ||
        errorData.data?.message ||
        errorData.data?.mensagem ||
        `Erro HTTP ${response.status}: ${response.statusText}`;

      return errorMessage;

    } catch (parseError) {
      // Se não conseguir fazer parse do JSON
      return `Erro HTTP ${response.status}: ${response.statusText}`;
    }
  }

  /**
   * 🚨 Tratar códigos de erro específicos de segurança
   * @param error - Erro original
   * @returns Erro tratado com mensagem amigável
   */
  private handleSecurityErrors(error: Error): Error {
    const errorMessage = error.message.toLowerCase();

    // 📋 Códigos de erro conforme guia de segurança
    const securityErrorCodes: Record<string, string> = {
      'sec_001': 'Credenciais da API estão em falta. Contate o suporte.',
      'sec_002': 'Chave da API é inválida. Verifique suas configurações.',
      'sec_005': 'Token de autenticação é obrigatório. Faça login novamente.',
      'sec_006': 'Formato do token de autenticação é inválido. Faça login novamente.',
      'sec_007': 'Token não corresponde à conta selecionada. Tente fazer logout e login novamente.',
      'sec_009': 'Sua sessão expirou. Faça login novamente.'
    };

    // 🔍 Verificar se é um erro de segurança conhecido
    for (const [code, message] of Object.entries(securityErrorCodes)) {
      if (errorMessage.includes(code.toLowerCase())) {
        logger.warn(`[PIX-API-CLIENT] Erro de segurança detectado: ${code}`);
        return new Error(message);
      }
    }

    // 🔄 Tratar outros erros comuns
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return new Error('Sua sessão expirou. Faça login novamente.');
    }

    if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
      return new Error('Você não tem permissão para esta operação.');
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    }

    if (errorMessage.includes('timeout')) {
      return new Error('A requisição demorou muito para responder. Tente novamente.');
    }

    // 🔄 Retorna erro original se não for específico
    return error;
  }

  /**
   * ✅ Verificar se o usuário está autenticado
   * @returns true se autenticado, false caso contrário
   */
  public isUserAuthenticated(): boolean {
    const token = this.getUserToken();
    return !!token;
  }

  /**
   * ⚙️ Configurar credenciais dinamicamente (para testes ou ambiente específico)
   * @param apiKey - Nova API Key
   * @param apiSecret - Novo API Secret
   * @param baseUrl - Nova URL base (opcional)
   */
  public setCredentials(apiKey: string, apiSecret: string, baseUrl?: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }

    logger.info('[PIX-API-CLIENT] Credenciais atualizadas', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasBaseUrl: !!baseUrl
    });
  }

  /**
   * 📊 Obter estatísticas da configuração
   * @returns Objeto com informações de configuração (sem dados sensíveis)
   */
  public getConfigInfo(): {
    hasApiKey: boolean;
    hasApiSecret: boolean;
    hasBaseUrl: boolean;
    isUserAuthenticated: boolean;
  } {
    return {
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      hasBaseUrl: !!this.baseUrl,
      isUserAuthenticated: this.isUserAuthenticated()
    };
  }
}

// ✅ Instância única para uso global
export const pixApiClient = new PixApiClient();
export default pixApiClient;

// 📝 Exemplos de uso (comentados para documentação):
/*
// ✅ Enviar PIX
try {
  const resultado = await pixApiClient.makePixRequest('/pix/enviar', 'POST', {
    chave: 'usuario@email.com',
    valor: 100.00,
    descricao: 'Pagamento teste'
  });
  
  console.log('PIX enviado:', resultado);
} catch (error) {
  console.error('Erro ao enviar PIX:', error.message);
}

// ✅ Listar chaves PIX
try {
  const chaves = await pixApiClient.makePixRequest('/pix/chaves/listar', 'GET');
  console.log('Chaves PIX:', chaves);
} catch (error) {
  console.error('Erro ao listar chaves:', error.message);
}

// ✅ Criar QR Code
try {
  const qrCode = await pixApiClient.makePixRequest('/pix/qrcode/estatico', 'POST', {
    valor: 50.00,
    informacoesAdicionais: 'Pagamento de produto'
  });
  
  console.log('QR Code criado:', qrCode);
} catch (error) {
  console.error('Erro ao criar QR Code:', error.message);
}
*/
