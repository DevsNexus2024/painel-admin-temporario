import { API_CONFIG, createApiRequest, TOKEN_STORAGE, REFRESH_TOKEN_STORAGE, USER_STORAGE, LAST_ACTIVITY_STORAGE } from '@/config/api';
import { setTokenRefresher } from '@/services/totpBridge';
import { logger } from '@/utils/logger';
import { handleApiError } from '@/utils/error.handler';
import { User, LoginCredentials } from '@/types/auth';

// Tipos de resposta da API
export interface AuthResponse {
  sucesso: boolean;
  mensagem: string;
  data?: {
    user: User;
    token: string;
  };
}

// Resposta do BaaS-W3Build (/auth/login)
interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Classe de serviços de autenticação
class AuthService {
  /**
   * Base URL do BaaS v2 APENAS para login (pedido do usuário).
   * Todo o restante continua usando a base configurada do sistema legado.
   */
  private readonly BAAS_V2_BASE_URL = (import.meta.env.X_BAAS_V2_API_URL as string) || 'https://api-bank-v2.gruponexus.com.br';
  private readonly BAAS_V2_LOGIN_PATH = '/auth/login';
  private readonly BAAS_V2_PROFILE_PATH = '/auth/me';
  private readonly BAAS_V2_REFRESH_PATH = '/auth/refresh';

  /** Serializa o refresh: evita duas chamadas simultâneas reusarem o mesmo refresh
   *  (o backend rotaciona single-use e revoga a família inteira em caso de reuso). */
  private refreshInFlight: Promise<boolean> | null = null;

  /**
   * Login de usuário
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logger.info('[AUTH] Tentativa de login', { email: credentials.email });

      // ✅ Login deve ir para o BaaS v2, independentemente da base URL do legado
      const response = await fetch(`${this.BAAS_V2_BASE_URL}${this.BAAS_V2_LOGIN_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const json: any = await response.json();

      // Novo contrato (BaaS-W3Build)
      if (json?.accessToken) {
        const tokenPair = json as TokenPairResponse;

        if (!this.isTokenValid(tokenPair.accessToken)) {
          logger.error('[AUTH] Token recebido é inválido');
          return { sucesso: false, mensagem: 'Token de autenticação inválido.' };
        }

        TOKEN_STORAGE.set(tokenPair.accessToken);
        // [REFRESH] Guardar o refresh token rotativo (antes era descartado → o front
        // dependia só do access de curta duração e deslogava ao expirar).
        if (tokenPair.refreshToken) REFRESH_TOKEN_STORAGE.set(tokenPair.refreshToken);
        LAST_ACTIVITY_STORAGE.set();

        const profile = await this.getProfile();
        if (profile.sucesso && profile.data) {
          logger.info('[AUTH] Login realizado com sucesso (RBAC)', {
            userId: profile.data.id,
            email: profile.data.email,
            rolesCount: profile.data.roles?.length || 0,
          });
          return {
            sucesso: true,
            mensagem: 'Login realizado com sucesso',
            data: {
              user: profile.data,
              token: tokenPair.accessToken,
            },
          };
        }

        return {
          sucesso: false,
          mensagem: profile.mensagem || 'Não foi possível carregar o perfil após login.',
        };
      }

      // Contrato legado (fallback)
      const result: AuthResponse = json as AuthResponse;
      if (result.sucesso && result.data) {
        if (!this.isTokenValid(result.data.token)) {
          logger.error('[AUTH] Token recebido é inválido');
          return { sucesso: false, mensagem: 'Token de autenticação inválido.' };
        }
        TOKEN_STORAGE.set(result.data.token);
        USER_STORAGE.set(result.data.user);
        LAST_ACTIVITY_STORAGE.set();
        logger.info('[AUTH] Login realizado com sucesso', {
          userId: result.data.user.id,
          email: result.data.user.email,
        });
      } else {
        logger.warn('[AUTH] Login falhou', {
          email: credentials.email,
          mensagem: result.mensagem,
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
   * Renova o access token usando o refresh token rotativo (BaaS-W3Build).
   * Single-use: o backend devolve um NOVO par e invalida o anterior; por isso
   * salvamos sempre o novo refresh. Serializado para evitar reuso concorrente
   * (reuso dispara revogação da família inteira no backend).
   * @returns true se renovou; false se não há refresh ou ele é inválido/revogado.
   */
  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async (): Promise<boolean> => {
      const refreshToken = REFRESH_TOKEN_STORAGE.get();
      if (!refreshToken) return false;

      try {
        const response = await fetch(`${this.BAAS_V2_BASE_URL}${this.BAAS_V2_REFRESH_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          // 401 = refresh inválido/revogado (logout-all, troca de senha, reuso) → sessão morta.
          logger.warn('[AUTH] Refresh falhou', { status: response.status });
          return false;
        }

        const json: any = await response.json();
        if (!json?.accessToken || !this.isTokenValid(json.accessToken)) {
          logger.warn('[AUTH] Refresh devolveu token inválido');
          return false;
        }

        TOKEN_STORAGE.set(json.accessToken);
        // Salvar SEMPRE o novo refresh rotacionado (o anterior já foi invalidado).
        if (json.refreshToken) REFRESH_TOKEN_STORAGE.set(json.refreshToken);
        LAST_ACTIVITY_STORAGE.set();
        logger.info('[AUTH] Access token renovado via refresh');
        return true;
      } catch (error) {
        logger.error('[AUTH] Erro ao renovar token:', error);
        return false;
      }
    })();

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
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
    REFRESH_TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
    LAST_ACTIVITY_STORAGE.remove();
  }

  /**
   * Obter perfil do usuário logado
   */
  async getProfile(): Promise<{ sucesso: boolean; data?: User; mensagem?: string }> {
    try {
      // ✅ Perfil precisa acompanhar o login no BaaS v2 (mesma origem do token)
      const response = await fetch(`${this.BAAS_V2_BASE_URL}${this.BAAS_V2_PROFILE_PATH}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TOKEN_STORAGE.get()}`,
        },
      });

      const json: any = await response.json();

      // Novo contrato (BaaS-W3Build): {id,email,name,roles,scopes}
      if (json?.id && json?.email && Array.isArray(json?.roles)) {
        const user: User = {
          id: json.id,
          email: json.email,
          name: json.name,
          roles: json.roles,
          scopes: json.scopes || [],
        };

        USER_STORAGE.set(user);
        return { sucesso: true, data: user };
      }

      // Contrato legado: {sucesso,data}
      if (json?.sucesso) {
        const result = json as { sucesso: boolean; data?: User; mensagem?: string };
        if (result.sucesso && result.data) {
          USER_STORAGE.set(result.data);
        }
        return result;
      }

      return { sucesso: false, mensagem: 'Resposta inválida ao buscar perfil' };
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

// [AUTH] Liga o refresh REATIVO: o fetchWithTotp chama isto ao tomar 401 → renova →
// repete a requisição. Complementa o refresh proativo do AuthContext (que não roda
// com a aba em background / timer pausado). O single-flight em refreshAccessToken()
// deduplica a corrida entre os dois caminhos.
setTokenRefresher(async () => {
  // [GATE] Só renova se HÁ access token e ele está de fato perto de vencer (≤5min,
  // folga p/ skew de relógio). Um 401 com token ainda válido NÃO é expiração — é
  // recurso proibido, backend que não aceita o JWT, ou rota admin (xPassRouteTCR, sem
  // JWT). Nesses casos refresh não ajuda: só gastaria /auth/refresh (rate-limit 10/min,
  // estourá-lo derruba o refresh proativo legítimo) e repetiria em backend cujo
  // guard-order não foi verificado. Sem token / sem exp → não é problema nosso de expiração.
  const info = authService.getTokenInfo();
  if (!info?.exp) return null;
  if (info.exp > Date.now() / 1000 + 300) return null;

  const ok = await authService.refreshAccessToken();
  return ok ? TOKEN_STORAGE.get() : null;
});

export default authService;