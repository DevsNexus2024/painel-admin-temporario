import { authService } from './auth';

/**
 * Tipos de usuário no sistema
 */
export type UserType = 'otc_client' | 'admin' | 'otc_employee';

/**
 * Resultado da verificação de tipo de usuário
 */
export interface UserTypeResult {
  type: UserType;
  isOTC: boolean;
  isAdmin: boolean;
  isEmployee?: boolean;
  otcClient?: any;
  hasOTCRole?: boolean;
  otcAccess?: {
    client_id: number;
    client_name: string;
    client_document: string;
  };
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
    isOTCEmployee?: boolean;
    otcClient?: any;
    hasOTCRole?: boolean;
    otcAccess?: {
      client_id: number;
      client_name: string;
      client_document: string;
    };
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
      // Fazer chamada para a API do backend
      const response = await authService.getUserType();
      
      if (response.sucesso && response.data) {
        const { type, isAdmin, isOTCClient, isOTCEmployee, otcClient, hasOTCRole, otcAccess } = response.data;
        
        return {
          type,
          isOTC: isOTCClient,
          isAdmin,
          isEmployee: isOTCEmployee,
          otcClient,
          hasOTCRole,
          otcAccess
        };
      } else {
        // console.warn('⚠️ UserTypeService: Resposta inválida da API, assumindo admin');
        return {
          type: 'admin',
          isOTC: false,
          isAdmin: true
        };
      }
    } catch (error) {
      // console.error('❌ UserTypeService: Erro ao verificar tipo do usuário via API:', error);
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

  /**
   * Verifica se o usuário é Funcionário OTC (método simplificado)
   */
  async isEmployeeUser(user: { id: string | number; email: string; name?: string }): Promise<boolean> {
    const result = await this.checkUserType(user);
    return result.isEmployee || false;
  }
}

// Instância singleton do serviço
export const userTypeService = new UserTypeService(); 