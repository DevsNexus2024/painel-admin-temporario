// ===============================================
// 🔒 CONFIGURAÇÃO DE SEGURANÇA - BaaS TCR
// ===============================================

/**
 * Configurações de segurança para proteger dados sensíveis
 * no frontend - NUNCA EXPOR CHAVES/TOKENS REAIS NO BROWSER
 */

// 🚨 CRÍTICO: Dados que JAMAIS devem aparecer no console/network
const SENSITIVE_KEYWORDS = [
  'password', 'senha', 'secret', 'key', 'token', 'auth',
  'api_key', 'api_secret', 'x-api-key', 'x-api-secret',
  'authorization', 'bearer', 'jwt', 'credential'
];

/**
 * Remove dados sensíveis de objetos antes de logar
 */
export const sanitizeForLog = (data: any): any => {
  if (!data) return data;
  
  // Se é string, verificar se contém dados sensíveis
  if (typeof data === 'string') {
    for (const keyword of SENSITIVE_KEYWORDS) {
      if (data.toLowerCase().includes(keyword)) {
        return '***DADOS_SENSIVEIS_REMOVIDOS***';
      }
    }
    return data;
  }
  
  // Se é objeto, sanitizar recursivamente
  if (typeof data === 'object' && !Array.isArray(data)) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Se a chave contém palavra sensível, esconder valor
      if (SENSITIVE_KEYWORDS.some(keyword => lowerKey.includes(keyword))) {
        sanitized[key] = '***HIDDEN***';
      } else {
        sanitized[key] = sanitizeForLog(value);
      }
    }
    return sanitized;
  }
  
  // Se é array, sanitizar cada item
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item));
  }
  
  return data;
};

/**
 * Remove headers sensíveis das requisições para log
 */
export const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Lista de headers que devem ser escondidos
    if (lowerKey.includes('authorization') || 
        lowerKey.includes('x-api-key') ||
        lowerKey.includes('x-api-secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret')) {
      sanitized[key] = '***HIDDEN***';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Remove dados sensíveis de URLs (query params)
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    
    // Verificar cada query param
    for (const [key, value] of urlObj.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYWORDS.some(keyword => lowerKey.includes(keyword))) {
        urlObj.searchParams.set(key, '***HIDDEN***');
      }
    }
    
    return urlObj.toString();
  } catch {
    // Se não conseguir fazer parse, apenas remover parâmetros sensíveis
    return url.replace(/([?&])(token|key|secret|auth)=[^&]*/gi, '$1$2=***HIDDEN***');
  }
};

/**
 * Configurações de produção para segurança máxima
 */
export const SECURITY_CONFIG = {
  // Em produção, desabilitar completamente logs sensíveis
  DISABLE_SENSITIVE_LOGS: import.meta.env.PROD,
  
  // Headers que nunca devem aparecer em logs
  FORBIDDEN_HEADERS: [
    'x-api-key', 'x-api-secret', 'authorization', 
    'token', 'secret', 'credential'
  ],
  
  // Máscara para dados sensíveis
  MASK: '***PROTECTED***',
  
  // Verificar se estamos em modo desenvolvimento
  IS_DEVELOPMENT: import.meta.env.DEV,
  
  // Limitar logs apenas em desenvolvimento
  ALLOW_DEBUG_LOGS: import.meta.env.DEV && import.meta.env.X_ENABLE_DEBUG_LOGS === 'true'
};

/**
 * Console seguro - substitui console nativo em produção
 */
export const secureConsole = {
  log: (...args: any[]) => {
    if (SECURITY_CONFIG.IS_DEVELOPMENT) {
      console.log(...args.map(sanitizeForLog));
    }
  },
  
  info: (...args: any[]) => {
    if (SECURITY_CONFIG.IS_DEVELOPMENT) {
      console.info(...args.map(sanitizeForLog));
    }
  },
  
  warn: (...args: any[]) => {
    if (SECURITY_CONFIG.IS_DEVELOPMENT) {
      console.warn(...args.map(sanitizeForLog));
    }
  },
  
  error: (...args: any[]) => {
    // Sempre permitir errors, mas sanitizados
    console.error(...args.map(sanitizeForLog));
  },
  
  debug: (...args: any[]) => {
    if (SECURITY_CONFIG.ALLOW_DEBUG_LOGS) {
      console.debug(...args.map(sanitizeForLog));
    }
  }
};

/**
 * Verificar se uma string contém dados sensíveis
 */
export const containsSensitiveData = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

/**
 * Mascarar dados sensíveis em strings
 */
export const maskSensitiveData = (text: string): string => {
  if (!text) return text;
  
  // Mascarar tokens JWT
  text = text.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'JWT_***MASKED***');
  
  // Mascarar chaves API (padrões comuns)
  text = text.replace(/[A-Za-z0-9]{32,}/g, match => {
    if (match.length > 20) return '***API_KEY_MASKED***';
    return match;
  });
  
  // Mascarar outros padrões sensíveis
  text = text.replace(/(secret|key|token|password)[\s]*[:=][\s]*[^\s,;}]*/gi, '$1: ***MASKED***');
  
  return text;
};

export default {
  sanitizeForLog,
  sanitizeHeaders,
  sanitizeUrl,
  secureConsole,
  containsSensitiveData,
  maskSensitiveData,
  SECURITY_CONFIG
};
