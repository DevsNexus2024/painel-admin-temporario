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
   * Resolve o tipo/role do usuário baseado em RBAC (roles do JWT /auth/me)
   *
   * Mapeamento:
   * - PLATFORM:SUPER_ADMIN -> super_admin
   * - PLATFORM:ADMIN       -> admin
   * - PLATFORM:TCR_USER    -> tcr_user
   * - PLATFORM:OTC_USER    -> otc_user
   */
  private resolveRoleFromPlatformRoles(platformRoles: string[] = []): UserRole {
    if (platformRoles.includes('PLATFORM:SUPER_ADMIN')) return 'super_admin';
    if (platformRoles.includes('PLATFORM:ADMIN')) return 'admin';
    if (platformRoles.includes('PLATFORM:TCR_USER')) return 'tcr_user';
    if (platformRoles.includes('PLATFORM:OTC_USER')) return 'otc_user';
    return 'viewer';
  }

  /**
   * Verifica o tipo de usuário usando o endpoint do backend
   */
  async checkUserType(user: { id: string | number; email: string; name?: string }): Promise<UserTypeResult> {
    try {
      const rolesFromProfile = (user as any)?.roles || [];
      const resolvedRole = this.resolveRoleFromPlatformRoles(rolesFromProfile);

      return {
        type: resolvedRole,
        isOTC: resolvedRole === 'otc_user',
        isAdmin: resolvedRole === 'admin' || resolvedRole === 'super_admin',
        isEmployee: false,
        permissions: [] // Será preenchido pelo AuthContext
      };
    } catch (error) {
      // Em caso de erro, cair para viewer (fail-closed para UI)
      return {
        type: 'viewer' as UserRole,
        isOTC: false,
        isAdmin: false,
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
