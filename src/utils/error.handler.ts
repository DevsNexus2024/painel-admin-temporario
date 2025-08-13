// src/utils/error.handler.ts
import { authService } from '@/services/auth';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

// Códigos de erro padronizados conforme documentação
export const ERROR_CODES = {
  // Erros de autenticação
  AUTH_001: 'Token não fornecido',
  AUTH_002: 'Formato de token inválido', 
  AUTH_003: 'Conta inativa',
  AUTH_004: 'Token inválido',
  AUTH_005: 'Token expirado',
  AUTH_006: 'Usuário não encontrado',
  AUTH_009: 'Permissões insuficientes',
  
  // Erros PIX
  PIX_001: 'Chave PIX obrigatória',
  PIX_002: 'Valor inválido',
  PIX_003: 'Valor excede limite máximo',
  PIX_004: 'Chave PIX inválida',
  PIX_005: 'Saldo insuficiente',
  PIX_006: 'Operação não permitida',
  
  // Erros de sistema
  SYS_001: 'Erro de conexão',
  SYS_002: 'Timeout de requisição',
  SYS_003: 'Serviço indisponível',
  
  // Rate limiting
  RATE_001: 'Limite de requisições excedido'
} as const;

// Interface para erro de API
export interface ApiError {
  codigo?: string;
  mensagem?: string;
  message?: string;
  status?: number;
  details?: any;
}

/**
 * Handler centralizado de erros de API
 */
export const handleApiError = (error: ApiError | Error, context: string = ''): string => {
  logger.error(`[ERROR] ${context}:`, error);

  // Se é um erro padrão do JavaScript
  if (error instanceof Error) {
    // Verificar se é erro de rede
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet.';
    }
    
    // Verificar se é timeout
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return 'Timeout da requisição. Tente novamente.';
    }
    
    return error.message || 'Erro interno. Tente novamente.';
  }

  // Tratar erro de API com código
  const apiError = error as ApiError;

  // Erros de autenticação
  if (apiError.codigo?.startsWith('AUTH_')) {
    return handleAuthError(apiError);
  }

  // Erros de validação PIX
  if (apiError.codigo?.startsWith('PIX_')) {
    return handlePixError(apiError);
  }

  // Rate limiting
  if (apiError.codigo === 'RATE_001' || 
      apiError.mensagem?.includes('Rate limit') ||
      apiError.message?.includes('Limite de requisições')) {
    return 'Muitas requisições. Aguarde alguns minutos e tente novamente.';
  }

  // Erro HTTP baseado no status
  if (apiError.status) {
    return handleHttpError(apiError.status);
  }

  // Erro genérico
  return apiError.mensagem || apiError.message || 'Erro interno. Tente novamente.';
};

/**
 * Tratar erros específicos de autenticação
 */
const handleAuthError = (error: ApiError): string => {
  const { codigo } = error;
  
  switch (codigo) {
    case 'AUTH_001':
    case 'AUTH_002':
    case 'AUTH_004':
    case 'AUTH_005':
    case 'AUTH_006':
      // Token inválido ou expirado - fazer logout automático
      authService.logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return 'Sessão expirada. Faça login novamente.';
      
    case 'AUTH_003':
      return 'Sua conta está inativa. Entre em contato com o suporte.';
      
    case 'AUTH_009':
      return 'Você não tem permissão para acessar este recurso.';
      
    default:
      return error.mensagem || 'Erro de autenticação. Faça login novamente.';
  }
};

/**
 * Tratar erros específicos de PIX
 */
const handlePixError = (error: ApiError): string => {
  const { codigo, mensagem } = error;
  
  switch (codigo) {
    case 'PIX_001':
      return 'Chave PIX é obrigatória.';
    case 'PIX_002':
      return 'Valor deve ser um número positivo.';
    case 'PIX_003':
      return 'Valor excede o limite máximo de R$ 100.000.';
    case 'PIX_004':
      return 'Chave PIX inválida. Verifique o formato.';
    case 'PIX_005':
      return 'Saldo insuficiente para esta operação.';
    case 'PIX_006':
      return 'Operação não permitida neste momento.';
    default:
      return mensagem || 'Erro na operação PIX. Tente novamente.';
  }
};

/**
 * Tratar erros baseados no status HTTP
 */
const handleHttpError = (status: number): string => {
  switch (status) {
    case 400:
      return 'Dados inválidos. Verifique as informações enviadas.';
    case 401:
      return 'Não autorizado. Faça login novamente.';
    case 403:
      return 'Acesso negado. Você não tem permissão.';
    case 404:
      return 'Recurso não encontrado.';
    case 409:
      return 'Conflito de dados. Operação já realizada.';
    case 422:
      return 'Dados inválidos. Verifique os campos obrigatórios.';
    case 429:
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 500:
      return 'Erro interno do servidor. Tente novamente.';
    case 502:
      return 'Serviço temporariamente indisponível.';
    case 503:
      return 'Serviço em manutenção. Tente mais tarde.';
    default:
      return `Erro HTTP ${status}. Tente novamente.`;
  }
};

/**
 * Exibir erro como toast com severidade apropriada
 */
export const showErrorToast = (error: ApiError | Error, context: string = ''): void => {
  const message = handleApiError(error, context);
  
  // Determinar tipo de toast baseado no erro
  const apiError = error as ApiError;
  
  if (apiError.codigo?.startsWith('AUTH_')) {
    toast.warning(message, {
      duration: 5000,
      description: 'Redirecionando para login...'
    });
  } else if (apiError.codigo?.startsWith('PIX_')) {
    toast.error(message, {
      duration: 4000,
      description: 'Verifique os dados e tente novamente'
    });
  } else if (apiError.codigo === 'RATE_001') {
    toast.warning(message, {
      duration: 6000,
      description: 'Aguarde para fazer nova tentativa'
    });
  } else {
    toast.error(message, {
      duration: 4000
    });
  }
};

/**
 * Verificar se erro deve forçar logout
 */
export const shouldLogout = (error: ApiError): boolean => {
  const authLogoutCodes = ['AUTH_001', 'AUTH_002', 'AUTH_004', 'AUTH_005', 'AUTH_006'];
  return authLogoutCodes.includes(error.codigo || '');
};

/**
 * Extrair informações de debugging do erro
 */
export const getErrorDebugInfo = (error: any): Record<string, any> => {
  return {
    message: error.message || error.mensagem,
    code: error.codigo || error.code,
    status: error.status,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
};
