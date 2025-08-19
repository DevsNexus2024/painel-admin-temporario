import { User } from '@/services/auth';
import { sanitizeForLog, secureConsole, SECURITY_CONFIG } from '@/config/security';

/**
 * 🔐 Logger Seguro - BaaS TCR
 * ✅ Resolve problemas graves de console.logs em produção
 * ✅ Protege dados sensíveis automaticamente
 * ✅ Configurável por ambiente
 * ✅ Integração com sistema de segurança
 */

// Tipos de log disponíveis
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configuração do logger
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
  level: (import.meta.env.X_LOG_LEVEL as LogLevel) || 'error',
  enableInProduction: import.meta.env.X_ENABLE_LOGS_PROD === 'true',
  enableSensitiveData: import.meta.env.X_ENABLE_SENSITIVE_LOGS === 'true',
  enablePerformanceLogs: import.meta.env.X_ENABLE_PERFORMANCE_LOGS === 'true'
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
  private config: LogConfig;
  private isProduction = import.meta.env.PROD;
  private isDevelopment = import.meta.env.DEV;
  
  constructor(config: LogConfig = LOG_CONFIG) {
    this.config = config;
  }
  
  /**
   * Verifica se deve logar baseado no nível e ambiente
   */
  private shouldLog(level: LogLevel): boolean {
    // Em produção, só permitir logs se explicitamente habilitado
    if (this.isProduction && !this.config.enableInProduction) {
      return level === 'error'; // Apenas erros em produção por padrão
    }
    
    const currentLevelValue = LOG_LEVELS[this.config.level] ?? LOG_LEVELS.error;
    const requestedLevelValue = LOG_LEVELS[level] ?? LOG_LEVELS.error;
    
    return requestedLevelValue >= currentLevelValue;
  }

  /**
   * Sanitizar dados sensíveis antes de logar
   * ✅ Integrado com sistema de segurança centralizado
   */
  private sanitizeData(data: any): any {
    // Se em produção, sempre sanitizar independente da configuração
    if (this.isProduction || !this.config.enableSensitiveData) {
      return sanitizeForLog(data);
    }
    
    // Em desenvolvimento, permitir dados sensíveis apenas se habilitado
    return this.config.enableSensitiveData ? data : sanitizeForLog(data);
  }

  /**
   * Gerar timestamp formatado
   */
  private getTimestamp(): string {
    return new Date().toISOString().substring(11, 23); // HH:mm:ss.sss
  }

  /**
   * Log de debug
   */
  debug(message: string, data?: any, prefix?: string): void {
    if (this.shouldLog('debug')) {
      const sanitizedData = this.sanitizeData(data);
      const logPrefix = prefix ? `[${prefix}]` : '';
      secureConsole.debug(`🔍 ${this.getTimestamp()} ${logPrefix} ${message}`, sanitizedData);
    }
  }

  /**
   * Log de informação
   */
  info(message: string, data?: any, prefix?: string): void {
    if (this.shouldLog('info')) {
      const sanitizedData = this.sanitizeData(data);
      const logPrefix = prefix ? `[${prefix}]` : '';
      secureConsole.info(`ℹ️ ${this.getTimestamp()} ${logPrefix} ${message}`, sanitizedData);
    }
  }

  /**
   * Log de aviso
   */
  warn(message: string, data?: any, prefix?: string): void {
    if (this.shouldLog('warn')) {
      const sanitizedData = this.sanitizeData(data);
      const logPrefix = prefix ? `[${prefix}]` : '';
      secureConsole.warn(`⚠️ ${this.getTimestamp()} ${logPrefix} ${message}`, sanitizedData);
    }
  }

  /**
   * Log de erro - sempre sanitizado
   */
  error(message: string, error?: any, prefix?: string): void {
    // Erros sempre são logados, mas sempre sanitizados
    const logPrefix = prefix ? `[${prefix}]` : '';
    const sanitizedError = this.sanitizeData(error);
    secureConsole.error(`❌ ${this.getTimestamp()} ${logPrefix} ${message}`, sanitizedError);
  }

  /**
   * Log para transição de tela/página
   */
  navigation(from: string, to: string, user?: User): void {
    if (this.shouldLog('info')) {
      const userInfo = user ? `User: ${user.id}` : 'No user';
      secureConsole.info(`🧭 ${this.getTimestamp()} [NAVIGATION] ${from} → ${to} (${userInfo})`);
    }
  }

  /**
   * Log para performance (duração de operações)
   */
  performance(operation: string, duration: number, prefix?: string): void {
    if (this.config.enablePerformanceLogs && this.shouldLog('info')) {
      const logPrefix = prefix ? `[${prefix}]` : '';
      secureConsole.info(`⚡ ${this.getTimestamp()} ${logPrefix} ${operation} completed in ${duration}ms`);
    }
  }

  /**
   * Log para requisições de API (método/URL sanitizada)
   */
  apiRequest(method: string, url: string, prefix?: string): void {
    if (this.shouldLog('debug')) {
      const logPrefix = prefix ? `[${prefix}]` : '';
      // Sanitizar URL removendo tokens/keys usando sistema centralizado
      const sanitizedUrl = url.replace(/([?&])(token|key|secret)=[^&]*/gi, '$1$2=***');
      secureConsole.debug(`🌐 ${this.getTimestamp()} ${logPrefix} ${method} ${sanitizedUrl}`);
    }
  }

  /**
   * Log para resposta de API (status/mensagem)
   */
  apiResponse(status: number, message: string, prefix?: string): void {
    if (this.shouldLog('debug')) {
      const logPrefix = prefix ? `[${prefix}]` : '';
      const emoji = status >= 200 && status < 300 ? '✅' : '❌';
      secureConsole.debug(`${emoji} ${this.getTimestamp()} ${logPrefix} ${status} ${message}`);
    }
  }

  /**
   * Log para login/logout de usuário
   */
  auth(action: 'login' | 'logout' | 'register', user?: User): void {
    if (this.shouldLog('info')) {
      const userInfo = user ? `${user.email.substring(0, 3)}***` : 'unknown';
      secureConsole.info(`🔐 ${this.getTimestamp()} [AUTH] ${action.toUpperCase()} - ${userInfo}`);
    }
  }

  /**
   * Log para operações PIX
   */
  pix(operation: string, amount?: number, key?: string): void {
    if (this.shouldLog('info')) {
      const amountStr = amount ? `R$ ${amount.toFixed(2)}` : '';
      const keyStr = key ? `Key: ${key.substring(0, 4)}***` : '';
      secureConsole.info(`💸 ${this.getTimestamp()} [PIX] ${operation} ${amountStr} ${keyStr}`.trim());
    }
  }

  /**
   * Log para operações bancárias
   */
  banking(provider: string, operation: string, success: boolean): void {
    if (this.shouldLog('info')) {
      const emoji = success ? '✅' : '❌';
      secureConsole.info(`🏦 ${this.getTimestamp()} [${provider.toUpperCase()}] ${operation} ${emoji}`);
    }
  }

  /**
   * Log para operações de sistema/infraestrutura
   */
  system(component: string, message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const sanitizedData = this.sanitizeData(data);
      secureConsole.debug(`⚙️ ${this.getTimestamp()} [${component}] ${message}`, sanitizedData);
    }
  }
}

// Instância global do logger
export const logger = new Logger();

// Funções utilitárias para debug rápido - SEMPRE SEGURAS
export const quickLog = {
  /**
   * Log rápido de usuário (sem dados sensíveis)
   */
  user: (user: User | null, action?: string) => {
    if (SECURITY_CONFIG.IS_DEVELOPMENT && user) {
      secureConsole.debug(`👤 [USER] ${action || 'Action'} - ID: ${user.id}, Email: ${user.email.substring(0, 3)}***`);
    } else if (SECURITY_CONFIG.IS_DEVELOPMENT) {
      secureConsole.debug('👤 [USER] No user logged');
    }
  },

  /**
   * Log rápido de estado do componente
   */
  state: (componentName: string, stateName: string, value: any) => {
    if (SECURITY_CONFIG.IS_DEVELOPMENT) {
      const sanitizedValue = sanitizeForLog(value);
      secureConsole.debug(`🔄 [STATE] ${componentName}.${stateName}:`, sanitizedValue);
    }
  }
};

// Exportar configuração para testes
export { LOG_CONFIG, Logger };

// Export default
export default logger;