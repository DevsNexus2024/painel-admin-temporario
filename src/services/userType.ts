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
    const has = (r: string) => platformRoles.includes(r);
    const hasPrefix = (p: string) => platformRoles.some((r) => r.startsWith(p));

    if (has('PLATFORM:SUPER_ADMIN')) return 'super_admin';
    if (has('PLATFORM:ADMIN')) return 'admin';
    // [MIGRAÇÃO 2026-06] PLATFORM:FINANCIAL_ADMIN é novo no contrato v2 e não tem
    // equivalente 1:1 no front. DECIDIDO (Felipe, 2026-06-23): manter CONSERVADOR como
    // 'tcr_user' (leitura financeira: saldos/extratos/relatórios), sem escrita/IAM/pix.
    // Revisar só se um FINANCIAL_ADMIN precisar operar (OTC/pix-out).
    if (has('PLATFORM:FINANCIAL_ADMIN')) return 'tcr_user';
    if (has('PLATFORM:TCR_USER')) return 'tcr_user';
    if (has('PLATFORM:OTC_USER')) return 'otc_user';
    // [MIGRAÇÃO 2026-06] Roles de tenant (de-para §2.1 do doc de integração):
    // otc_client → TENANT:ADMIN, otc_employee → TENANT:MEMBER. TENANT:OWNER = admin do tenant.
    if (hasPrefix('TENANT:ADMIN') || hasPrefix('TENANT:OWNER')) return 'otc_client';
    if (hasPrefix('TENANT:MEMBER')) return 'otc_employee';
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
