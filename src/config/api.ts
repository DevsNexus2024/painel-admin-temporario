import { User } from '@/services/auth';

// 🔧 CONFIGURAÇÃO DE AMBIENTE - Altere para 'development' ou 'production'
const FORCE_ENVIRONMENT: 'development' | 'production' = 'production';

// URLs para cada ambiente
const API_URLS = {
  development: 'http://localhost:3000',
  production: 'https://api-bank.gruponexus.com.br'
} as const;

// URL específica para APIs de diagnóstico
const DIAGNOSTICO_API_URL = 'https://vps80270.cloudpublic.com.br:8081';

// Função para determinar URL base
const getBaseUrl = (): string => {
  const baseUrl = API_URLS[FORCE_ENVIRONMENT];
  
  console.log(`🔧 Ambiente: ${FORCE_ENVIRONMENT.toUpperCase()} (FORÇADO)`);
  console.log(`🔧 API Base URL: ${baseUrl}`);
  console.log(`🔍 API Diagnóstico URL: ${DIAGNOSTICO_API_URL}`);
  
  return baseUrl;
};

// Configurações da API
export const API_CONFIG = {
  // URL base do backend
  BASE_URL: getBaseUrl(),
  
  // URL específica para diagnóstico
  DIAGNOSTICO_URL: DIAGNOSTICO_API_URL,
  
  // Token de admin para operações especiais (vem do .env)
  ADMIN_TOKEN: import.meta.env.VITE_ADMIN_TOKEN || 'ISRVdeWTZ5jYFKJQytjH9ZylF1ZrwhTdrrdKY4uFqXm041XIL3aVjCwojSH1EeYbUOQjPx0aO',
  
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
    },
    DIAGNOSTICO: {
      // ✨ Nova API simplificada (RECOMENDADA)
      DIAGNOSTICAR_DEPOSITO_SIMPLIFICADO: '/diagnosticar_deposito_simplificado',
      // API de compatibilidade
      DIAGNOSTICAR_DEPOSITO: '/diagnosticar_deposito',
      // Ações de reprocessamento
      REPROCESSAR_PIX_BMP531: '/reprocessar_pix_bmp531',
      REPROCESSAR_TRANSFERENCIA_ADMIN: '/reprocessar_transferencia_admin',
      COMPENSAR_DEPOSITO_DIRETO: '/compensar_deposito_direto'
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
  USER: 'auth_user',
  LAST_ACTIVITY: 'last_activity'
};

// Login timeout configuration
export const LOGIN_TIMEOUT_CONFIG = {
  // Tempo de inatividade em minutos antes do logout automático
  TIMEOUT_MINUTES: 3000,
  // Intervalo de verificação em milissegundos
  CHECK_INTERVAL_MS: 6000000000000, // 1 minuto
  // Tempo de aviso antes do logout (em minutos)
  WARNING_MINUTES: 5,
  // Eventos que contam como atividade do usuário
  ACTIVITY_EVENTS: ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'] as const
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

// Last Activity Storage utilities
export const LAST_ACTIVITY_STORAGE = {
  get: (): number | null => {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error('Erro ao recuperar última atividade:', error);
      return null;
    }
  },
  
  set: (timestamp: number = Date.now()): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, timestamp.toString());
    } catch (error) {
      console.error('Erro ao salvar última atividade:', error);
    }
  },
  
  remove: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    } catch (error) {
      console.error('Erro ao remover última atividade:', error);
    }
  },
  
  // Verificar se o usuário está inativo há mais tempo que o configurado
  isInactive: (): boolean => {
    try {
      const lastActivity = LAST_ACTIVITY_STORAGE.get();
      if (!lastActivity) return true;
      
      const now = Date.now();
      const timeoutMs = LOGIN_TIMEOUT_CONFIG.TIMEOUT_MINUTES * 60 * 1000;
      const timeSinceLastActivity = now - lastActivity;
      
      return timeSinceLastActivity > timeoutMs;
    } catch (error) {
      console.error('Erro ao verificar inatividade:', error);
      return true;
    }
  },
  
  // Obter tempo restante antes do timeout (em minutos)
  getTimeUntilTimeout: (): number => {
    try {
      const lastActivity = LAST_ACTIVITY_STORAGE.get();
      if (!lastActivity) return 0;
      
      const now = Date.now();
      const timeoutMs = LOGIN_TIMEOUT_CONFIG.TIMEOUT_MINUTES * 60 * 1000;
      const timeSinceLastActivity = now - lastActivity;
      const timeRemaining = timeoutMs - timeSinceLastActivity;
      
      return Math.max(0, Math.ceil(timeRemaining / (60 * 1000)));
    } catch (error) {
      console.error('Erro ao calcular tempo restante:', error);
      return 0;
    }
  }
};

// Função utilitária para construir URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Função específica para construir URLs de diagnóstico
export const buildDiagnosticoApiUrl = (endpoint: string): string => {
  return `${DIAGNOSTICO_API_URL}${endpoint}`;
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

// Função específica para headers de admin
export const getAdminHeaders = (additionalHeaders?: Record<string, string>) => {
  return {
    ...API_CONFIG.DEFAULT_HEADERS,
    'xPassRouteTCR': API_CONFIG.ADMIN_TOKEN,
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

// Função específica para requisições de admin
export const createAdminApiRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  // Verificar se é uma operação de diagnóstico
  const isDiagnosticoOperation = Object.values(API_CONFIG.ENDPOINTS.DIAGNOSTICO).includes(endpoint);
  const url = isDiagnosticoOperation ? buildDiagnosticoApiUrl(endpoint) : buildApiUrl(endpoint);
  const headers = getAdminHeaders(options.headers as Record<string, string>);
  
  const config: RequestInit = {
    ...options,
    headers,
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  };

  try {
    console.log(`🔍 Fazendo requisição de diagnóstico para: ${url}`);
    console.log(`📋 Headers:`, headers);
    console.log(`📦 Body:`, options.body);
    
    const response = await fetch(url, config);
    
    console.log(`📥 Resposta recebida:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
    
    return response;
  } catch (error) {
    console.error('❌ Erro na requisição admin:', error);
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
      // Tentar extrair mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse do JSON, manter a mensagem padrão
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status, 
        data: { message: errorMessage } 
      };
      throw error;
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
      // Tentar extrair mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse do JSON, manter a mensagem padrão
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status, 
        data: { message: errorMessage } 
      };
      throw error;
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
      // Tentar extrair mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse do JSON, manter a mensagem padrão
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status, 
        data: { message: errorMessage } 
      };
      throw error;
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
      // Tentar extrair mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse do JSON, manter a mensagem padrão
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status, 
        data: { message: errorMessage } 
      };
      throw error;
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
      // Tentar extrair mensagem de erro da resposta
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse do JSON, manter a mensagem padrão
      }
      
      const error = new Error(errorMessage);
      (error as any).response = { 
        status: response.status, 
        data: { message: errorMessage } 
      };
      throw error;
    }

    const data = await response.json();
    return { data };
  }
}; 