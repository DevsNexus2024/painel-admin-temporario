// utils/pixErrorHandler.ts

import { logger } from '@/utils/logger';

/**
 * 🚨 Handler Específico para Erros PIX com Códigos de Segurança
 * 
 * Implementa tratamento dos novos códigos de erro conforme
 * as especificações do guia de segurança híbrida
 */

/**
 * Interface para erro PIX estruturado
 */
export interface PixError {
  codigo?: string;
  mensagem: string;
  tipo: 'SEGURANCA' | 'NEGOCIO' | 'TECNICO' | 'VALIDACAO';
  recomendacao?: string;
  requerLogin?: boolean;
}

/**
 * Códigos de erro de segurança conforme guia
 */
export const SECURITY_ERROR_CODES: Record<string, PixError> = {
  // Erros de Credenciais
  'SEC_001': {
    codigo: 'SEC_001',
    mensagem: 'Credenciais da API estão em falta',
    tipo: 'SEGURANCA',
    recomendacao: 'Contate o suporte técnico - configuração do sistema'
  },
  
  'SEC_002': {
    codigo: 'SEC_002',
    mensagem: 'Chave da API é inválida',
    tipo: 'SEGURANCA',
    recomendacao: 'Verifique as configurações da aplicação'
  },
  
  // Erros de Token JWT
  'SEC_005': {
    codigo: 'SEC_005',
    mensagem: 'Token de autenticação é obrigatório',
    tipo: 'SEGURANCA',
    recomendacao: 'Faça login novamente',
    requerLogin: true
  },
  
  'SEC_006': {
    codigo: 'SEC_006',
    mensagem: 'Formato do token de autenticação é inválido',
    tipo: 'SEGURANCA',
    recomendacao: 'Faça login novamente - token corrompido',
    requerLogin: true
  },
  
  'SEC_007': {
    codigo: 'SEC_007',
    mensagem: 'Token não corresponde à conta selecionada',
    tipo: 'SEGURANCA',
    recomendacao: 'Tente fazer logout e login novamente',
    requerLogin: true
  },
  
  'SEC_009': {
    codigo: 'SEC_009',
    mensagem: 'Sua sessão expirou',
    tipo: 'SEGURANCA',
    recomendacao: 'Faça login novamente',
    requerLogin: true
  }
};

/**
 * Códigos de erro de negócio PIX
 */
export const BUSINESS_ERROR_CODES: Record<string, PixError> = {
  'PIX_001': {
    codigo: 'PIX_001',
    mensagem: 'Chave PIX é obrigatória',
    tipo: 'VALIDACAO',
    recomendacao: 'Informe uma chave PIX válida'
  },
  
  'PIX_002': {
    codigo: 'PIX_002',
    mensagem: 'Valor deve ser um número positivo',
    tipo: 'VALIDACAO',
    recomendacao: 'Informe um valor maior que zero'
  },
  
  'PIX_003': {
    codigo: 'PIX_003',
    mensagem: 'Valor excede o limite máximo permitido',
    tipo: 'NEGOCIO',
    recomendacao: 'Reduza o valor ou consulte os limites da sua conta'
  },
  
  'PIX_004': {
    codigo: 'PIX_004',
    mensagem: 'Formato da chave PIX é inválido',
    tipo: 'VALIDACAO',
    recomendacao: 'Verifique o formato da chave (email, CPF, telefone, etc.)'
  },
  
  'PIX_INSUFFICIENT_BALANCE': {
    codigo: 'PIX_INSUFFICIENT_BALANCE',
    mensagem: 'Saldo insuficiente para a transação',
    tipo: 'NEGOCIO',
    recomendacao: 'Verifique seu saldo disponível'
  },
  
  'PIX_KEY_NOT_FOUND': {
    codigo: 'PIX_KEY_NOT_FOUND',
    mensagem: 'Chave PIX não encontrada',
    tipo: 'NEGOCIO',
    recomendacao: 'Verifique se a chave PIX está correta'
  },
  
  'PIX_DAILY_LIMIT_EXCEEDED': {
    codigo: 'PIX_DAILY_LIMIT_EXCEEDED',
    mensagem: 'Limite diário de PIX excedido',
    tipo: 'NEGOCIO',
    recomendacao: 'Tente novamente amanhã ou consulte os limites da sua conta'
  }
};

/**
 * Códigos de erro técnico
 */
export const TECHNICAL_ERROR_CODES: Record<string, PixError> = {
  'NETWORK_ERROR': {
    codigo: 'NETWORK_ERROR',
    mensagem: 'Erro de conexão com o servidor',
    tipo: 'TECNICO',
    recomendacao: 'Verifique sua conexão com a internet e tente novamente'
  },
  
  'TIMEOUT_ERROR': {
    codigo: 'TIMEOUT_ERROR',
    mensagem: 'A requisição demorou muito para responder',
    tipo: 'TECNICO',
    recomendacao: 'Tente novamente em alguns momentos'
  },
  
  'SERVER_ERROR': {
    codigo: 'SERVER_ERROR',
    mensagem: 'Erro interno do servidor',
    tipo: 'TECNICO',
    recomendacao: 'Tente novamente. Se persistir, contate o suporte'
  }
};

/**
 * 🔧 Classe principal para tratamento de erros PIX
 */
export class PixErrorHandler {
  
  /**
   * Processar erro e retornar informações estruturadas
   * @param error - Erro original (string, Error, ou objeto)
   * @returns PixError estruturado com informações de tratamento
   */
  static processError(error: any): PixError {
    try {
      // 1. Extrair mensagem do erro
      const errorMessage = this.extractErrorMessage(error);
      const errorCode = this.extractErrorCode(error, errorMessage);
      
      // 2. Verificar códigos de segurança primeiro
      if (errorCode && SECURITY_ERROR_CODES[errorCode]) {
        const securityError = SECURITY_ERROR_CODES[errorCode];
        this.logSecurityError(securityError, error);
        return securityError;
      }
      
      // 3. Verificar códigos de negócio
      if (errorCode && BUSINESS_ERROR_CODES[errorCode]) {
        const businessError = BUSINESS_ERROR_CODES[errorCode];
        this.logBusinessError(businessError, error);
        return businessError;
      }
      
      // 4. Verificar códigos técnicos
      if (errorCode && TECHNICAL_ERROR_CODES[errorCode]) {
        const technicalError = TECHNICAL_ERROR_CODES[errorCode];
        this.logTechnicalError(technicalError, error);
        return technicalError;
      }
      
      // 5. Detectar erros comuns por mensagem
      const detectedError = this.detectErrorByMessage(errorMessage);
      if (detectedError) {
        return detectedError;
      }
      
      // 6. Erro genérico
      return this.createGenericError(errorMessage);
      
    } catch (processingError) {
      logger.error('[PIX-ERROR-HANDLER] Erro ao processar erro:', processingError);
      return this.createGenericError('Erro desconhecido');
    }
  }
  
  /**
   * Extrair mensagem de erro de diferentes formatos
   */
  private static extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    // Formatos comuns de resposta de API
    return error?.mensagem ||
           error?.message ||
           error?.error ||
           error?.errorMessage ||
           error?.response?.message ||
           error?.response?.mensagem ||
           error?.data?.message ||
           error?.data?.mensagem ||
           'Erro desconhecido';
  }
  
  /**
   * Extrair código de erro da mensagem ou objeto
   */
  private static extractErrorCode(error: any, errorMessage: string): string | null {
    // 1. Código direto no objeto
    if (error?.codigo) return error.codigo;
    if (error?.code) return error.code;
    if (error?.errorCode) return error.errorCode;
    
    // 2. Buscar código na mensagem (formato: SEC_001, PIX_002, etc.)
    const codeMatch = errorMessage.match(/([A-Z_]+_\d{3})/);
    if (codeMatch) return codeMatch[1];
    
    // 3. Buscar códigos específicos na mensagem
    const specificCodes = [
      'PIX_INSUFFICIENT_BALANCE',
      'PIX_KEY_NOT_FOUND',
      'PIX_DAILY_LIMIT_EXCEEDED',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR'
    ];
    
    for (const code of specificCodes) {
      if (errorMessage.toLowerCase().includes(code.toLowerCase().replace('_', ' '))) {
        return code;
      }
    }
    
    return null;
  }
  
  /**
   * Detectar erro por padrões na mensagem
   */
  private static detectErrorByMessage(message: string): PixError | null {
    const lowercaseMessage = message.toLowerCase();
    
    // Erros de autenticação
    if (lowercaseMessage.includes('unauthorized') || lowercaseMessage.includes('401')) {
      return SECURITY_ERROR_CODES['SEC_005'];
    }
    
    if (lowercaseMessage.includes('token') && lowercaseMessage.includes('invalid')) {
      return SECURITY_ERROR_CODES['SEC_006'];
    }
    
    if (lowercaseMessage.includes('session') && lowercaseMessage.includes('expired')) {
      return SECURITY_ERROR_CODES['SEC_009'];
    }
    
    // Erros de rede
    if (lowercaseMessage.includes('network') || lowercaseMessage.includes('fetch')) {
      return TECHNICAL_ERROR_CODES['NETWORK_ERROR'];
    }
    
    if (lowercaseMessage.includes('timeout')) {
      return TECHNICAL_ERROR_CODES['TIMEOUT_ERROR'];
    }
    
    // Erros de servidor
    if (lowercaseMessage.includes('500') || lowercaseMessage.includes('internal server')) {
      return TECHNICAL_ERROR_CODES['SERVER_ERROR'];
    }
    
    // Erros de negócio
    if (lowercaseMessage.includes('saldo insuficiente') || lowercaseMessage.includes('insufficient balance')) {
      return BUSINESS_ERROR_CODES['PIX_INSUFFICIENT_BALANCE'];
    }
    
    if (lowercaseMessage.includes('chave não encontrada') || lowercaseMessage.includes('key not found')) {
      return BUSINESS_ERROR_CODES['PIX_KEY_NOT_FOUND'];
    }
    
    return null;
  }
  
  /**
   * Criar erro genérico
   */
  private static createGenericError(message: string): PixError {
    return {
      mensagem: message || 'Erro desconhecido',
      tipo: 'TECNICO',
      recomendacao: 'Tente novamente. Se o erro persistir, contate o suporte.'
    };
  }
  
  /**
   * Log de erro de segurança
   */
  private static logSecurityError(error: PixError, originalError: any): void {
    logger.error('[PIX-SECURITY-ERROR] Erro de segurança detectado', {
      codigo: error.codigo,
      mensagem: error.mensagem,
      requerLogin: error.requerLogin,
      originalError: originalError
    });
  }
  
  /**
   * Log de erro de negócio
   */
  private static logBusinessError(error: PixError, originalError: any): void {
    logger.warn('[PIX-BUSINESS-ERROR] Erro de negócio', {
      codigo: error.codigo,
      mensagem: error.mensagem,
      originalError: originalError
    });
  }
  
  /**
   * Log de erro técnico
   */
  private static logTechnicalError(error: PixError, originalError: any): void {
    logger.error('[PIX-TECHNICAL-ERROR] Erro técnico', {
      codigo: error.codigo,
      mensagem: error.mensagem,
      originalError: originalError
    });
  }
  
  /**
   * Verificar se erro requer logout/login
   */
  static requiresReauth(error: PixError): boolean {
    return !!error.requerLogin;
  }
  
  /**
   * Obter mensagem amigável para o usuário
   */
  static getUserFriendlyMessage(error: PixError): string {
    const baseMessage = error.mensagem;
    const recommendation = error.recomendacao;
    
    if (recommendation) {
      return `${baseMessage}. ${recommendation}`;
    }
    
    return baseMessage;
  }
}

/**
 * 🎯 Funções de conveniência para uso direto
 */

/**
 * Processar erro PIX e retornar mensagem amigável
 */
export const handlePixError = (error: any): string => {
  const processedError = PixErrorHandler.processError(error);
  return PixErrorHandler.getUserFriendlyMessage(processedError);
};

/**
 * Verificar se erro requer reautenticação
 */
export const errorRequiresReauth = (error: any): boolean => {
  const processedError = PixErrorHandler.processError(error);
  return PixErrorHandler.requiresReauth(processedError);
};

/**
 * Processar erro completo
 */
export const processPixError = (error: any): PixError => {
  return PixErrorHandler.processError(error);
};

export default PixErrorHandler;
