import { authService } from './auth';

/**
 * Tipos de usuário no sistema
 */
export type UserType = 'otc_client' | 'admin';

/**
 * Resultado da verificação de tipo de usuário
 */
export interface UserTypeResult {
  type: UserType;
  isOTC: boolean;
  isAdmin: boolean;
  otcClient?: any;
  hasOTCRole?: boolean;
}

/**
 * Resposta da API de tipo de usuário
 */
interface UserTypeAPIResponse {
  sucesso: boolean;
  data: {
    userId: number;
    type: UserType;
    isAdmin: boolean;
    isOTCClient: boolean;
    otcClient?: any;
    hasOTCRole?: boolean;
  };
}

/**
 * Serviço para identificar o tipo de usuário
 */
export class UserTypeService {
  /**
   * Verifica o tipo de usuário usando o endpoint do backend
   */
  async checkUserType(user: { id: string | number; email: string; name?: string }): Promise<UserTypeResult> {
    try {
      console.log('🔍 UserTypeService: Verificando tipo para usuário via API:', user.id, user.email);
      
      // Fazer chamada para a API do backend
      const response = await authService.getUserType();
      
      if (response.sucesso && response.data) {
        const { type, isAdmin, isOTCClient, otcClient, hasOTCRole } = response.data;
        
        console.log('✅ UserTypeService: Tipo obtido da API:', {
          type,
          isAdmin,
          isOTCClient,
          hasOTCClient: !!otcClient
        });
        
        return {
          type,
          isOTC: isOTCClient,
          isAdmin,
          otcClient,
          hasOTCRole
        };
      } else {
        console.warn('⚠️ UserTypeService: Resposta inválida da API, assumindo admin');
        return {
          type: 'admin',
          isOTC: false,
          isAdmin: true
        };
      }
    } catch (error) {
      console.error('❌ UserTypeService: Erro ao verificar tipo do usuário via API:', error);
      // Em caso de erro, assumir como admin para não bloquear acesso
      return {
        type: 'admin',
        isOTC: false,
        isAdmin: true
      };
    }
  }

  /**
   * Verifica se o usuário é OTC (método simplificado)
   */
  async isOTCUser(user: { id: string | number; email: string; name?: string }): Promise<boolean> {
    const result = await this.checkUserType(user);
    return result.isOTC;
  }

  /**
   * Verifica se o usuário é Admin (método simplificado)
   */
  async isAdminUser(user: { id: string | number; email: string; name?: string }): Promise<boolean> {
    const result = await this.checkUserType(user);
    return result.isAdmin;
  }
}

// Instância singleton do serviço
export const userTypeService = new UserTypeService(); 