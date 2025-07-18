import { API_CONFIG, createApiRequest, TOKEN_STORAGE, USER_STORAGE } from '@/config/api';

// Tipos
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  sucesso: boolean;
  mensagem: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
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
      }

      return result;
    } catch (error) {
      console.error('Erro no registro:', error);
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
      console.log('🔐 AuthService: Fazendo login para:', credentials.email);
      
      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      const result: AuthResponse = await response.json();
      
      console.log('🔐 AuthService: Resposta da API:', result);

      if (result.sucesso && result.data) {
        // Dados sensíveis removidos dos logs por segurança
        
        // Salvar token e usuário
        TOKEN_STORAGE.set(result.data.token);
        USER_STORAGE.set(result.data.user);
        
        console.log('✅ AuthService: Token e usuário salvos com sucesso');
      } else {
        console.log('❌ AuthService: Login falhou:', result.mensagem);
      }

      return result;
    } catch (error) {
      console.error('❌ AuthService: Erro no login:', error);
      return {
        sucesso: false,
        mensagem: 'Erro de conexão. Tente novamente.'
      };
    }
  }

  /**
   * Logout do usuário
   */
  logout(): void {
    TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
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
      console.error('Erro ao buscar perfil:', error);
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
      console.log('🔍 AuthService: Buscando tipo do usuário via API');
      
      const response = await createApiRequest(API_CONFIG.ENDPOINTS.AUTH.USER_TYPE, {
        method: 'GET'
      });

      const result = await response.json();
      
      console.log('🔍 AuthService: Resposta do getUserType:', result);

      return result;
    } catch (error) {
      console.error('❌ AuthService: Erro ao buscar tipo do usuário:', error);
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
    const isAuth = !!(token && user);
    
    console.log('🔍 AuthService: Verificando autenticação:', {
      hasToken: !!token,
      hasUser: !!user,
      isAuthenticated: isAuth
    });
    
    return isAuth;
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
      console.error('Erro na validação do token:', error);
      return false;
    }
  }
}

// Instância única do serviço
export const authService = new AuthService();
export default authService; 