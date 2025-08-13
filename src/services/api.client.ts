// src/services/api.client.ts
import { API_CONFIG, TOKEN_STORAGE, buildApiUrl } from '@/config/api';
import { authService } from '@/services/auth';
import { handleApiError, showErrorToast } from '@/utils/error.handler';
import { logger } from '@/utils/logger';

// Interface para configuração de requisição
interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  showErrorToast?: boolean;
}

// Interface para resposta da API
interface ApiResponse<T = any> {
  sucesso: boolean;
  mensagem?: string;
  data?: T;
  codigo?: string;
  [key: string]: any;
}

// Interface para headers de rate limiting
interface RateLimitHeaders {
  limit?: number;
  remaining?: number;
  reset?: string;
}

/**
 * Cliente HTTP seguro implementando as especificações da documentação JWT
 */
class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.RETRY.attempts;
  }

  /**
   * Cria headers padrão com autenticação
   */
  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'baas-frontend/1.0.0',
      ...customHeaders
    };

    // Adicionar JWT se usuário estiver logado
    const token = TOKEN_STORAGE.get();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Verificar headers de rate limiting
   */
  private checkRateLimit(response: Response): RateLimitHeaders {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    const rateLimitInfo: RateLimitHeaders = {
      limit: limit ? parseInt(limit, 10) : undefined,
      remaining: remaining ? parseInt(remaining, 10) : undefined,
      reset: reset || undefined
    };

    // Avisar se restam poucas tentativas
    if (rateLimitInfo.remaining && rateLimitInfo.remaining < 10) {
      logger.warn(`[RATE LIMIT] Apenas ${rateLimitInfo.remaining} tentativas restantes até ${rateLimitInfo.reset}`);
      
      if (rateLimitInfo.remaining < 5) {
        // console.warn(`⚠️ Atenção: Apenas ${rateLimitInfo.remaining} requisições restantes até ${rateLimitInfo.reset}`);
      }
    }

    return rateLimitInfo;
  }

  /**
   * Implementar retry com backoff exponencial
   */
  private async retryRequest(
    url: string,
    config: RequestConfig,
    attempt: number = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...config,
        signal: AbortSignal.timeout(config.timeout || this.defaultTimeout)
      });

      return response;
    } catch (error) {
      const maxRetries = config.retries || this.defaultRetries;
      
      if (attempt < maxRetries) {
        const delay = (config.retryDelay || API_CONFIG.RETRY.delay) * Math.pow(2, attempt - 1);
        logger.warn(`[RETRY] Tentativa ${attempt}/${maxRetries} falhou. Tentando novamente em ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryRequest(url, config, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Método genérico para requisições
   */
  async request<T = any>(endpoint: string, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    const url = buildApiUrl(endpoint);
    
    const config: RequestConfig = {
      timeout: this.defaultTimeout,
      retries: this.defaultRetries,
      showErrorToast: true,
      ...options,
      headers: this.getHeaders(options.headers as Record<string, string>)
    };

    try {
      logger.debug(`[API] ${config.method || 'GET'} ${endpoint}`, { url });

      const response = await this.retryRequest(url, config);

      // Verificar rate limiting
      this.checkRateLimit(response);

      const data: ApiResponse<T> = await response.json();

      // Log da resposta (apenas status para não vazar dados)
      logger.debug(`[API] Response ${response.status} for ${endpoint}`, {
        success: data.sucesso,
        hasData: !!data.data
      });

      // Verificar se token expirou
      if (response.status === 401) {
        logger.warn('[API] Token expirado, redirecionando para login');
        
        // Se tem código específico de token expirado
        if (data.codigo === 'AUTH_005') {
          authService.logout();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        
        throw {
          codigo: data.codigo || 'AUTH_001',
          mensagem: data.mensagem || 'Token inválido',
          status: response.status
        };
      }

      // Verificar rate limiting
      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        logger.warn(`[API] Rate limit excedido. Reset em: ${resetTime}`);
        
        throw {
          codigo: 'RATE_001',
          mensagem: 'Limite de requisições excedido. Tente novamente em alguns minutos.',
          status: response.status
        };
      }

      // Verificar outros erros HTTP
      if (!response.ok) {
        throw {
          codigo: data.codigo,
          mensagem: data.mensagem || `Erro HTTP: ${response.status}`,
          status: response.status,
          details: data
        };
      }

      return data;

    } catch (error) {
      logger.error(`[API] Erro em ${endpoint}:`, error);
      
      // Mostrar toast de erro se configurado
      if (config.showErrorToast) {
        showErrorToast(error as any, `API ${endpoint}`);
      }
      
      throw error;
    }
  }

  /**
   * Métodos de conveniência
   */
  async get<T = any>(endpoint: string, params: Record<string, any> = {}, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data: any = {}, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put<T = any>(endpoint: string, data: any = {}, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async patch<T = any>(endpoint: string, data: any = {}, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete<T = any>(endpoint: string, options: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Configurar timeout global
   */
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Configurar retries global
   */
  setRetries(retries: number): void {
    this.defaultRetries = retries;
  }

  /**
   * Verificar conectividade com a API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', {}, { 
        showErrorToast: false,
        timeout: 5000,
        retries: 1
      });
      return true;
    } catch (error) {
      logger.error('[API] Health check failed:', error);
      return false;
    }
  }
}

// Instância única do cliente
export const apiClient = new ApiClient();
export default apiClient;
