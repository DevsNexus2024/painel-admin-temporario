import { User } from '@/services/auth';

// 🔧 CONFIGURAÇÃO DE AMBIENTE - Altere para 'development' ou 'production'
const FORCE_ENVIRONMENT: 'development' | 'production' = 'production';

// URLs para cada ambiente
const API_URLS = {
  development: 'http://localhost:3000',
  production: 'https://api-bank.gruponexus.com.br'
} as const;

// Função para determinar URL base
const getBaseUrl = (): string => {
  const baseUrl = API_URLS[FORCE_ENVIRONMENT];
  
  console.log(`🔧 Ambiente: ${FORCE_ENVIRONMENT.toUpperCase()} (FORÇADO)`);
  console.log(`🔧 API Base URL: ${baseUrl}`);
  
  return baseUrl;
};

// Configurações da API
export const API_CONFIG = {
  // URL base do backend
  BASE_URL: getBaseUrl(),
  
  // Endpoints
  ENDPOINTS: {
    PIX: {
      ENVIAR: '/internal/pix/enviar',
      PAGAR_QR: '/internal/pix/pagar-copia-cola',
      CONSULTAR: '/internal/pix/consultar-chave',
      PENDENCIAS: '/internal/pix/pendencias',
      EXTRATO: '/internal/pix/extrato',
      STATUS: '/internal/pix/status',
      CHAVES_LISTAR: '/internal/pix/chaves/listar',
      CHAVES_CRIAR: '/internal/pix/chaves/criar',
      QRCODE_ESTATICO: '/internal/pix/qrcode/estatico',
      QRCODE_COBRANCA: '/internal/pix/qrcode/cobranca',
      QRCODE_DICASCRIPTO: '/internal/pix/qrcode/dicascripto',
      QRCODE_LER: '/internal/pix/qrcode/ler'
    },
    ACCOUNT: {
      EXTRATO: '/internal/account/extrato',
      SALDO: '/internal/account/saldo'
    },
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      PROFILE: '/api/auth/me',
      USER_TYPE: '/api/auth/user-type',
      VALIDATE: '/api/auth/validate'
    }
  },
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'User-Agent': 'baas-frontend/1.0.0'
  },
  
  // Timeouts
  TIMEOUT: 30000, // 30 segundos
  
  // Configurações de retry
  RETRY: {
    attempts: 3,
    delay: 1000
  }
};

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user'
};

// Token Storage utilities
export const TOKEN_STORAGE = {
  get: (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Erro ao recuperar token:', error);
      return null;
    }
  },
  
  set: (token: string): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } catch (error) {
      console.error('Erro ao salvar token:', error);
    }
  },
  
  remove: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Erro ao remover token:', error);
    }
  }
};

// User Storage utilities
export const USER_STORAGE = {
  get: (): User | null => {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Erro ao recuperar usuário:', error);
      return null;
    }
  },
  
  set: (user: User): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  },
  
  remove: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
    }
  }
};

// Função utilitária para construir URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Função utilitária para headers com possíveis tokens
export const getApiHeaders = (additionalHeaders?: Record<string, string>) => {
  const token = TOKEN_STORAGE.get();
  
  return {
    ...API_CONFIG.DEFAULT_HEADERS,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...additionalHeaders
  };
};

// Função para criar requisições da API
export const createApiRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = buildApiUrl(endpoint);
  const headers = getApiHeaders(options.headers as Record<string, string>);
  
  const config: RequestInit = {
    ...options,
    headers,
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  };

  try {
    const response = await fetch(url, config);
    
    // Se token inválido (401), limpar dados de auth
    if (response.status === 401) {
      TOKEN_STORAGE.remove();
      USER_STORAGE.remove();
      // Redirecionar para login se necessário
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    
    return response;
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
};

// Interceptor para requisições automáticas (hook para React Query)
export const apiInterceptor = {
  request: (config: RequestInit = {}) => {
    return {
      ...config,
      headers: getApiHeaders(config.headers as Record<string, string>)
    };
  },
  
  response: {
    success: (response: Response) => response,
    error: (error: any) => {
      if (error?.response?.status === 401) {
        TOKEN_STORAGE.remove();
        USER_STORAGE.remove();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
      throw error;
    }
  }
};

// Instância da API configurada com fetch
export const api = {
  get: async <T>(url: string): Promise<{ data: T }> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  post: async <T>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  put: async <T>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  patch: async <T>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  },

  delete: async <T>(url: string): Promise<{ data: T }> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  }
}; 