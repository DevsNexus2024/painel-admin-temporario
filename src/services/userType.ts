import { authService } from './auth';
import { UserRole, UserTypeResult } from '@/types/auth';

// Mantém compatibilidade com código antigo
export type UserType = UserRole;

/**
 * Resposta da API de tipo de usuário
 */
interface UserTypeAPIResponse {
  sucesso: boolean;
  data: {
    userId: number;
    type: UserRole;
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
          otcAccess,
          permissions: [] // Será preenchido pelo AuthContext
        };
      } else {

        return {
          type: 'admin' as UserRole,
          isOTC: false,
          isAdmin: true,
          permissions: [] // Será preenchido pelo AuthContext
        };
      }
    } catch (error) {

      // Em caso de erro, assumir como admin para não bloquear acesso
      return {
        type: 'admin' as UserRole,
        isOTC: false,
        isAdmin: true,
        permissions: [] // Será preenchido pelo AuthContext
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
