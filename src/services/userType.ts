import { otcService } from './otc';

/**
 * Tipos de usuário no sistema
 */
export type UserType = 'otc' | 'admin';

/**
 * Interface para resultado da verificação de tipo de usuário
 */
export interface UserTypeResult {
  type: UserType;
  isOTC: boolean;
  isAdmin: boolean;
  otcClient?: any;
}

/**
 * Serviço para identificar o tipo de usuário
 */
export class UserTypeService {
  /**
   * Verifica se o usuário é do tipo OTC (tem cliente OTC vinculado)
   */
  async checkUserType(user: { id: string | number; email: string; name?: string }): Promise<UserTypeResult> {
    try {
      console.log('🔍 UserTypeService: Verificando tipo para usuário:', user.id, user.email);
      
      // Buscar clientes OTC para verificar se o usuário tem vinculação
      const clientsResponse = await otcService.getClients({ 
        limit: 200 // Buscar todos os clientes para encontrar o correto
      });
      
      if (!clientsResponse.data?.clientes || clientsResponse.data.clientes.length === 0) {
        console.log('ℹ️ UserTypeService: Nenhum cliente OTC encontrado - usuário é Admin');
        return {
          type: 'admin',
          isOTC: false,
          isAdmin: true
        };
      }

      // Buscar cliente específico vinculado ao usuário logado
      const otcClient = clientsResponse.data.clientes.find(c => {
        // Verificar se o cliente está vinculado ao usuário logado
        return String(c.user?.id) === String(user.id) || 
               c.user?.email === user.email ||
               c.user?.name === user.name;
      });

      if (otcClient) {
        console.log('✅ UserTypeService: Usuário é OTC, cliente encontrado:', otcClient);
        return {
          type: 'otc',
          isOTC: true,
          isAdmin: false,
          otcClient
        };
      } else {
        console.log('ℹ️ UserTypeService: Usuário não tem cliente OTC vinculado - é Admin');
        return {
          type: 'admin',
          isOTC: false,
          isAdmin: true
        };
      }
    } catch (error) {
      console.error('❌ UserTypeService: Erro ao verificar tipo do usuário:', error);
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