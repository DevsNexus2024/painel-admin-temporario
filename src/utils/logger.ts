/**
 * 🔧 LOGGER CENTRALIZADO - Sistema de logs seguro
 * 
 * ✅ Resolve problemas graves de console.logs em produção
 * ✅ Protege dados sensíveis
 * ✅ Configurável por ambiente
 * ✅ Performance otimizada
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableInProduction: boolean;
  enableSensitiveData: boolean;
  enablePerformanceLogs: boolean;
}

/**
 * Configuração de logs baseada em variáveis de ambiente
 */
const LOG_CONFIG: LogConfig = {
  level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'error',
  enableInProduction: import.meta.env.VITE_ENABLE_LOGS_PROD === 'true',
  enableSensitiveData: import.meta.env.VITE_ENABLE_SENSITIVE_LOGS === 'true',
  enablePerformanceLogs: import.meta.env.VITE_ENABLE_PERFORMANCE_LOGS === 'true'
};

/**
 * Hierarchy de níveis de log
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Classe principal do logger
 */
class Logger {
  private isProduction = import.meta.env.PROD;
  private isDevelopment = import.meta.env.DEV;
  
  /**
   * Verifica se deve logar baseado no nível e ambiente
   */
  private shouldLog(level: LogLevel): boolean {
    // Em produção, só logs de erro por padrão
    if (this.isProduction && !LOG_CONFIG.enableInProduction) {
      return level === 'error';
    }
    
    // Verificar hierarchy de níveis
    return LOG_LEVELS[level] >= LOG_LEVELS[LOG_CONFIG.level];
  }
  
  /**
   * Sanitiza dados sensíveis antes de logar
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sensitiveKeys = [
      'password', 'senha', 'token', 'secret', 'api_key', 'api_secret',
      'authorization', 'x-api-key', 'x-api-secret', 'chave', 'cpf', 'cnpj',
      'documento', 'email', 'telefone', 'phone', 'pix_key', 'account',
      'conta', 'agencia', 'valor', 'amount', 'saldo', 'balance'
    ];
    
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        if (typeof sanitized[key] === 'string') {
          sanitized[key] = sanitized[key] ? '***' : null;
        } else if (typeof sanitized[key] === 'number') {
          sanitized[key] = sanitized[key] ? '***' : 0;
        } else {
          sanitized[key] = '***';
        }
      }
    });
    
    return sanitized;
  }
  
  /**
   * Formatador de timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString().substr(11, 8);
  }
  
  /**
   * Log de debug - apenas desenvolvimento
   */
  debug(message: string, data?: any, component?: string) {
    if (this.shouldLog('debug')) {
      const prefix = component ? `[${component}]` : '';
      const sanitizedData = data ? this.sanitizeData(data) : undefined;
      console.log(`🔍 ${this.getTimestamp()} ${prefix} ${message}`, sanitizedData);
    }
  }
  
  /**
   * Log informativo
   */
  info(message: string, data?: any, component?: string) {
    if (this.shouldLog('info')) {
      const prefix = component ? `[${component}]` : '';
      const sanitizedData = data ? this.sanitizeData(data) : undefined;
      console.log(`ℹ️ ${this.getTimestamp()} ${prefix} ${message}`, sanitizedData);
    }
  }
  
  /**
   * Log de aviso
   */
  warn(message: string, data?: any, component?: string) {
    if (this.shouldLog('warn')) {
      const prefix = component ? `[${component}]` : '';
      const sanitizedData = data ? this.sanitizeData(data) : undefined;
      console.warn(`⚠️ ${this.getTimestamp()} ${prefix} ${message}`, sanitizedData);
    }
  }
  
  /**
   * Log de erro - sempre aparece
   */
  error(message: string, error?: any, component?: string) {
    if (this.shouldLog('error')) {
      const prefix = component ? `[${component}]` : '';
      console.error(`❌ ${this.getTimestamp()} ${prefix} ${message}`, error);
    }
  }
  
  /**
   * Log de dados sensíveis - APENAS desenvolvimento
   */
  sensitive(message: string, data?: any, component?: string) {
    if (this.isDevelopment && LOG_CONFIG.enableSensitiveData) {
      const prefix = component ? `[${component}]` : '';
      console.log(`🔐 ${this.getTimestamp()} ${prefix} [SENSITIVE] ${message}`, data);
    }
  }
  
  /**
   * Log de performance
   */
  performance(operation: string, startTime: number, component?: string) {
    if (LOG_CONFIG.enablePerformanceLogs && this.shouldLog('debug')) {
      const duration = Date.now() - startTime;
      const prefix = component ? `[${component}]` : '';
      console.log(`⚡ ${this.getTimestamp()} ${prefix} ${operation} completed in ${duration}ms`);
    }
  }
  
  /**
   * Log de API request (sanitizado)
   */
  apiRequest(method: string, url: string, component?: string) {
    if (this.shouldLog('debug')) {
      const prefix = component ? `[${component}]` : '';
      // Remove query parameters sensíveis da URL
      const sanitizedUrl = url.replace(/([?&])(token|key|secret)=[^&]*/gi, '$1$2=***');
      console.log(`🌐 ${this.getTimestamp()} ${prefix} ${method} ${sanitizedUrl}`);
    }
  }
  
  /**
   * Log de API response (sanitizado)
   */
  apiResponse(status: number, message: string, component?: string) {
    if (this.shouldLog('debug')) {
      const prefix = component ? `[${component}]` : '';
      const emoji = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
      console.log(`${emoji} ${this.getTimestamp()} ${prefix} ${status} ${message}`);
    }
  }
  
  /**
   * Configuração atual do logger
   */
  getConfig() {
    return {
      ...LOG_CONFIG,
      isProduction: this.isProduction,
      isDevelopment: this.isDevelopment
    };
  }
}

/**
 * Instância singleton do logger
 */
export const logger = new Logger();

/**
 * Hook para performance timing
 */
export const usePerformanceTimer = (operation: string, component?: string) => {
  const startTime = Date.now();
  return () => logger.performance(operation, startTime, component);
};

/**
 * Função utilitária para log condicional em desenvolvimento
 */
export const devLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`🔧 [DEV] ${message}`, data);
  }
};

/**
 * Função utilitária para log de estado React
 */
export const stateLog = (componentName: string, stateName: string, value: any) => {
  if (import.meta.env.DEV && LOG_CONFIG.enableSensitiveData) {
    console.log(`🔄 [STATE] ${componentName}.${stateName}:`, value);
  }
};

export default logger;
