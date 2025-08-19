// utils/authHelper.ts

import { TOKEN_STORAGE, USER_STORAGE } from '@/config/api';
import { authService } from '@/services/auth';
import { logger } from '@/utils/logger';

/**
 * 🔐 Helper para Verificações de Autenticação PIX
 * 
 * Implementa verificações obrigatórias antes das operações PIX
 * conforme as novas exigências de segurança
 */
export class AuthHelper {
  
  /**
   * ✅ Verificar se usuário está autenticado para operações PIX
   * @returns Promise<boolean> - true se autenticado, false caso contrário
   */
  static async isUserAuthenticatedForPix(): Promise<boolean> {
    try {
      // 1. Verificar se há token no storage
      const token = TOKEN_STORAGE.get();
      if (!token) {
        logger.warn('[AUTH-HELPER] Token não encontrado');
        return false;
      }

      // 2. Verificar se há usuário no storage
      const user = USER_STORAGE.get();
      if (!user) {
        logger.warn('[AUTH-HELPER] Dados do usuário não encontrados');
        return false;
      }

      // 3. Verificar se token não expirou
      const isTokenValid = authService.isAuthenticated();
      if (!isTokenValid) {
        logger.warn('[AUTH-HELPER] Token inválido ou expirado');
        return false;
      }

      // 4. Verificar se token expira em breve (próximos 5 minutos)
      const isExpiringSoon = authService.isTokenExpiringSoon();
      if (isExpiringSoon) {
        logger.warn('[AUTH-HELPER] Token expira em breve - renovação recomendada');
        // Ainda permite a operação, mas registra aviso
      }

      logger.info('[AUTH-HELPER] Usuário autenticado para operações PIX', {
        userId: user.id,
        email: user.email,
        tokenExpiringSoon: isExpiringSoon
      });

      return true;

    } catch (error) {
      logger.error('[AUTH-HELPER] Erro na verificação de autenticação:', error);
      return false;
    }
  }

  /**
   * 🚨 Verificar e exigir autenticação (com erro se não autenticado)
   * @param operationType - Tipo de operação para logs
   * @throws Error se não autenticado
   */
  static async requireAuthentication(operationType: string = 'PIX'): Promise<void> {
    const isAuthenticated = await this.isUserAuthenticatedForPix();
    
    if (!isAuthenticated) {
      const errorMessage = `Usuário não autenticado para operação ${operationType}. Faça login novamente.`;
      logger.error('[AUTH-HELPER] Tentativa de operação sem autenticação', {
        operationType,
        hasToken: !!TOKEN_STORAGE.get(),
        hasUser: !!USER_STORAGE.get()
      });
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 🔍 Obter informações do token atual (para validação cruzada)
   * @returns Informações do token ou null se não disponível
   */
  static getTokenInfo(): {
    userId?: string;
    email?: string;
    role?: string;
    exp?: number;
    timeUntilExpiration?: number;
  } | null {
    try {
      const tokenInfo = authService.getTokenInfo();
      
      if (tokenInfo && tokenInfo.exp) {
        const now = Date.now() / 1000;
        const timeUntilExpiration = Math.max(0, tokenInfo.exp - now);
        
        return {
          ...tokenInfo,
          timeUntilExpiration: Math.floor(timeUntilExpiration / 60) // em minutos
        };
      }
      
      return tokenInfo;

    } catch (error) {
      logger.error('[AUTH-HELPER] Erro ao obter informações do token:', error);
      return null;
    }
  }

  /**
   * 🔄 Forçar logout se autenticação inválida
   */
  static forceLogoutIfInvalid(): void {
    try {
      const isAuthenticated = authService.isAuthenticated();
      
      if (!isAuthenticated) {
        logger.warn('[AUTH-HELPER] Forçando logout por autenticação inválida');
        
        // Limpar dados
        TOKEN_STORAGE.remove();
        USER_STORAGE.remove();
        
        // Redirecionar para login se não estiver já lá
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
      
    } catch (error) {
      logger.error('[AUTH-HELPER] Erro ao verificar validade da autenticação:', error);
    }
  }

  /**
   * 📊 Obter status de autenticação detalhado
   * @returns Objeto com informações detalhadas de autenticação
   */
  static getAuthStatus(): {
    isAuthenticated: boolean;
    hasToken: boolean;
    hasUser: boolean;
    tokenExpiringSoon: boolean;
    userInfo?: {
      id: string;
      email: string;
      name?: string;
    };
    tokenInfo?: {
      timeUntilExpiration?: number;
      exp?: number;
    };
  } {
    try {
      const token = TOKEN_STORAGE.get();
      const user = USER_STORAGE.get();
      const isAuthenticated = authService.isAuthenticated();
      const tokenExpiringSoon = authService.isTokenExpiringSoon();
      const tokenInfo = this.getTokenInfo();

      return {
        isAuthenticated,
        hasToken: !!token,
        hasUser: !!user,
        tokenExpiringSoon,
        userInfo: user ? {
          id: user.id,
          email: user.email,
          name: user.name
        } : undefined,
        tokenInfo: tokenInfo ? {
          timeUntilExpiration: tokenInfo.timeUntilExpiration,
          exp: tokenInfo.exp
        } : undefined
      };

    } catch (error) {
      logger.error('[AUTH-HELPER] Erro ao obter status de autenticação:', error);
      
      return {
        isAuthenticated: false,
        hasToken: false,
        hasUser: false,
        tokenExpiringSoon: true
      };
    }
  }

  /**
   * ⚠️ Verificar se a sessão está prestes a expirar e avisar usuário
   * @returns true se expira em breve, false caso contrário
   */
  static checkSessionExpiration(): boolean {
    try {
      const tokenExpiringSoon = authService.isTokenExpiringSoon();
      
      if (tokenExpiringSoon) {
        const tokenInfo = this.getTokenInfo();
        const minutesRemaining = tokenInfo?.timeUntilExpiration || 0;
        
        logger.warn('[AUTH-HELPER] Sessão expira em breve', {
          minutesRemaining
        });
        
        // Aqui você pode disparar um toast ou modal de aviso
        // toast.warning(`Sua sessão expira em ${minutesRemaining} minutos`);
        
        return true;
      }
      
      return false;

    } catch (error) {
      logger.error('[AUTH-HELPER] Erro ao verificar expiração da sessão:', error);
      return true; // Assume expiração em caso de erro
    }
  }
}

/**
 * 🎯 Funções de conveniência para uso direto
 */

/**
 * Verificar se usuário está autenticado (conveniente)
 */
export const isUserAuthenticated = (): Promise<boolean> => {
  return AuthHelper.isUserAuthenticatedForPix();
};

/**
 * Verificar autenticação ou disparar erro
 */
export const requireAuth = (operationType?: string): Promise<void> => {
  return AuthHelper.requireAuthentication(operationType);
};

/**
 * Obter status completo de autenticação
 */
export const getAuthStatus = () => {
  return AuthHelper.getAuthStatus();
};

/**
 * Verificar expiração da sessão
 */
export const checkSessionExpiration = (): boolean => {
  return AuthHelper.checkSessionExpiration();
};

/**
 * Interceptador para uso em componentes React
 */
export const useAuthInterceptor = () => {
  return {
    requireAuth,
    isAuthenticated: isUserAuthenticated,
    getStatus: getAuthStatus,
    checkExpiration: checkSessionExpiration,
    forceLogout: AuthHelper.forceLogoutIfInvalid
  };
};

export default AuthHelper;
