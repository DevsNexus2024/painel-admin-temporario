import { API_CONFIG, createApiRequest, TOKEN_STORAGE, USER_STORAGE, LAST_ACTIVITY_STORAGE } from '@/config/api';
import { logger } from '@/utils/logger';
import { handleApiError } from '@/utils/error.handler';
import { User, LoginCredentials, RegisterData } from '@/types/auth';

// Tipos de resposta da API
export interface AuthResponse {
  sucesso: boolean;
  mensagem: string;
  data?: {
    user: User;
    token: string;
  };
}

// Classe de serviços de autenticação
class AuthService {
  /**
   * Registrar novo usuário
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      const result: AuthResponse = await response.json();

      if (result.sucesso && result.data) {
        // Salvar token e usuário
        TOKEN_STORAGE.set(result.data.token);
        USER_STORAGE.set(result.data.user);
        
        // Registrar atividade inicial do registro
        LAST_ACTIVITY_STORAGE.set();
      }

      return result;
    } catch (error) {
      // console.error('Erro no registro:', error);
      return {
        sucesso: false,
        mensagem: 'Erro de conexão. Tente novamente.'
      };
    }
  }

  /**
   * Login de usuário
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logger.info('[AUTH] Tentativa de login', { email: credentials.email });

      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      const result: AuthResponse = await response.json();

      if (result.sucesso && result.data) {
        // Validar token recebido
        if (!this.isTokenValid(result.data.token)) {
          logger.error('[AUTH] Token recebido é inválido');
          return {
            sucesso: false,
            mensagem: 'Token de autenticação inválido.'
          };
        }

        // Salvar token e usuário
        TOKEN_STORAGE.set(result.data.token);
        USER_STORAGE.set(result.data.user);
        
        // Registrar atividade inicial do login
        LAST_ACTIVITY_STORAGE.set();

        logger.info('[AUTH] Login realizado com sucesso', { 
          userId: result.data.user.id,
          email: result.data.user.email 
        });
      } else {
        logger.warn('[AUTH] Login falhou', { 
          email: credentials.email,
          mensagem: result.mensagem 
        });
      }

      return result;
    } catch (error) {
      logger.error('[AUTH] Erro no login:', error);
      const errorMessage = handleApiError(error as any, 'Login');
      
      return {
        sucesso: false,
        mensagem: errorMessage
      };
    }
  }

  /**
   * Logout do usuário
   */
  logout(): void {
    const user = this.getCurrentUser();
    
    logger.info('[AUTH] Logout do usuário', { 
      userId: user?.id,
      email: user?.email 
    });

    TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
    LAST_ACTIVITY_STORAGE.remove();
  }

  /**
   * Obter perfil do usuário logado
   */
  async getProfile(): Promise<{ sucesso: boolean; data?: User; mensagem?: string }> {
    try {
      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.PROFILE, {
        method: 'GET'
      });

      const result = await response.json();

      if (result.sucesso && result.data) {
        // Atualizar dados do usuário no storage
        USER_STORAGE.set(result.data);
      }

      return result;
    } catch (error) {
      // console.error('Erro ao buscar perfil:', error);
      return {
        sucesso: false,
        mensagem: 'Erro de conexão. Tente novamente.'
      };
    }
  }

  /**
   * Obter tipo do usuário (admin ou cliente OTC)
   */
  async getUserType(): Promise<{ sucesso: boolean; data?: any; mensagem?: string }> {
    try {
      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.USER_TYPE, {
        method: 'GET'
      });

      const result = await response.json();

      return result;
    } catch (error) {
      // console.error('❌ AuthService: Erro ao buscar tipo do usuário:', error);
      return {
        sucesso: false,
        mensagem: 'Erro de conexão. Tente novamente.'
      };
    }
  }

  /**
   * Verificar se usuário está logado
   */
  isAuthenticated(): boolean {
    const token = TOKEN_STORAGE.get();
    const user = USER_STORAGE.get();
    
    if (!token || !user) {
      return false;
    }

    // Validar JWT e verificar expiração
    if (!this.isTokenValid(token)) {
      logger.warn('[AUTH] Token inválido ou expirado, fazendo logout');
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Validar JWT no frontend (decodificar e verificar expiração)
   */
  private isTokenValid(token: string): boolean {
    try {
      // Decodificar JWT para verificar expiração
      const payload = this.decodeJWT(token);
      const now = Date.now() / 1000;
      
      if (payload.exp && payload.exp < now) {
        logger.warn('[AUTH] Token expirado:', {
          exp: new Date(payload.exp * 1000).toISOString(),
          now: new Date(now * 1000).toISOString()
        });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('[AUTH] Erro ao validar token:', error);
      return false;
    }
  }

  /**
   * Decodificar JWT sem validar assinatura (apenas para verificar payload)
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token JWT inválido');
      }

      const payload = parts[1];
      // Adicionar padding se necessário
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decodedPayload = atob(paddedPayload);
      
      return JSON.parse(decodedPayload);
    } catch (error) {
      throw new Error('Não foi possível decodificar o token JWT');
    }
  }

  /**
   * Obter informações do token JWT
   */
  getTokenInfo(): { userId?: string; email?: string; role?: string; exp?: number } | null {
    try {
      const token = TOKEN_STORAGE.get();
      if (!token) return null;

      const payload = this.decodeJWT(token);
      
      return {
        userId: payload.sub || payload.userId,
        email: payload.email,
        role: payload.role,
        exp: payload.exp
      };
    } catch (error) {
      logger.error('[AUTH] Erro ao obter informações do token:', error);
      return null;
    }
  }

  /**
   * Verificar se token expira em breve (próximos 5 minutos)
   */
  isTokenExpiringSoon(): boolean {
    try {
      const token = TOKEN_STORAGE.get();
      if (!token) return true;

      const payload = this.decodeJWT(token);
      if (!payload.exp) return false;

      const now = Date.now() / 1000;
      const fiveMinutesFromNow = now + (5 * 60); // 5 minutos
      
      return payload.exp < fiveMinutesFromNow;
    } catch (error) {
      logger.error('[AUTH] Erro ao verificar expiração do token:', error);
      return true;
    }
  }

  /**
   * Obter usuário atual do storage
   */
  getCurrentUser(): User | null {
    const user = USER_STORAGE.get();
    return user;
  }

  /**
   * Obter token atual
   */
  getCurrentToken(): string | null {
    const token = TOKEN_STORAGE.get();
    return token;
  }

  /**
   * Validar token (opcional - para verificação manual)
   */
  async validateToken(): Promise<boolean> {
    try {
      const token = TOKEN_STORAGE.get();
      if (!token) return false;

      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.VALIDATE, {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      const result = await response.json();
      return result.sucesso && result.valid;
    } catch (error) {
      // console.error('Erro na validação do token:', error);
      return false;
    }
  }
}

// Instância única do serviço
export const authService = new AuthService();
export default authService; 