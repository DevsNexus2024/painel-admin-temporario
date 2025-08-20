/**
 * 🏢 Serviço para gerenciamento de funcionários OTC
 * 
 * Permite aos clientes OTC:
 * - Conceder acesso aos seus funcionários
 * - Gerenciar permissões de acesso
 * - Revogar acessos quando necessário
 */

import { api } from '@/config/api';
import { logger } from '@/utils/logger';

// ==================== INTERFACES ====================

export interface EmployeeAccess {
  id: number;
  employee_name: string;
  employee_email: string;
  employee_document?: string;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  permissions: string[];
  granted_at: string;
  activated_at?: string;
  last_access?: string;
  access_notes?: string;
  granted_by: string;
  user_info?: {
    name: string;
    email: string;
    created_at: string;
  };
}

export interface GrantAccessRequest {
  otc_client_id: number;
  employee_user_id: number;
  employee_name: string;
  employee_email: string;
  employee_document?: string;
  permissions?: string[];
  access_notes?: string;
}

export interface PendingAccess {
  id: number;
  client_name: string;
  client_document: string;
  granted_by: string;
  granted_at: string;
  permissions: string[];
  access_notes?: string;
}

// ==================== SERVIÇO ====================

export class OTCEmployeeService {

  /**
   * Conceder acesso de funcionário a um cliente OTC
   */
  static async grantAccess(data: GrantAccessRequest) {
    try {
      logger.info('Concedendo acesso de funcionário', {
        otc_client_id: data.otc_client_id,
        employee_email: data.employee_email
      });

      const response = await api.post('/api/otc/employees/grant-access', data);

      if (response.data.sucesso) {
        logger.info('Acesso concedido com sucesso', {
          access_id: response.data.dados?.id
        });
        
        return {
          success: true,
          data: response.data.dados,
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao conceder acesso');
      }

    } catch (error: any) {
      logger.error('Erro ao conceder acesso de funcionário', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao conceder acesso';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Listar funcionários de um cliente OTC
   */
  static async listClientEmployees(clientId: number) {
    try {
      logger.info('Listando funcionários do cliente', { clientId });

      const response = await api.get(`/api/otc/employees/client/${clientId}`);

      if (response.data.sucesso) {
        return {
          success: true,
          data: response.data.dados?.employees || [],
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao listar funcionários');
      }

    } catch (error: any) {
      logger.error('Erro ao listar funcionários', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao listar funcionários';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Revogar acesso de funcionário
   */
  static async revokeAccess(accessId: number, reason: string) {
    try {
      logger.info('Revogando acesso de funcionário', { accessId, reason });

      const response = await api.post(`/api/otc/employees/revoke-access/${accessId}`, {
        reason
      });

      if (response.data.sucesso) {
        logger.info('Acesso revogado com sucesso', { accessId });
        
        return {
          success: true,
          data: response.data.dados,
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao revogar acesso');
      }

    } catch (error: any) {
      logger.error('Erro ao revogar acesso', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao revogar acesso';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Ativar acesso de funcionário (pelo próprio funcionário)
   */
  static async activateAccess(accessId?: number) {
    try {
      logger.info('Ativando acesso de funcionário', { accessId });

      const response = await api.post('/api/otc/employee/activate-access', {
        access_id: accessId
      });

      if (response.data.sucesso) {
        logger.info('Acesso ativado com sucesso');
        
        return {
          success: true,
          data: response.data.dados,
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao ativar acesso');
      }

    } catch (error: any) {
      logger.error('Erro ao ativar acesso', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao ativar acesso';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Obter informações de acesso do funcionário
   */
  static async getEmployeeAccessInfo() {
    try {
      logger.info('Obtendo informações de acesso do funcionário');

      const response = await api.get('/api/otc/employee/access-info');

      if (response.data.sucesso) {
        return {
          success: true,
          data: response.data.dados,
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao obter informações de acesso');
      }

    } catch (error: any) {
      logger.error('Erro ao obter informações de acesso', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao obter informações de acesso';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Obter acessos pendentes para um funcionário
   */
  static async getPendingAccess(): Promise<{ success: boolean; data?: PendingAccess[]; message: string }> {
    try {
      logger.info('Obtendo acessos pendentes');

      const response = await api.get('/api/otc/employee/pending-access');

      if (response.data.sucesso) {
        return {
          success: true,
          data: response.data.dados?.pending_access || [],
          message: response.data.mensagem
        };
      } else {
        throw new Error(response.data.mensagem || 'Erro ao obter acessos pendentes');
      }

    } catch (error: any) {
      logger.error('Erro ao obter acessos pendentes', error);
      
      const message = error.response?.data?.mensagem || 
                     error.message || 
                     'Erro ao obter acessos pendentes';
      
      return {
        success: false,
        message,
        error: error.response?.data || error
      };
    }
  }

  /**
   * Verificar se o usuário tem role de funcionário OTC
   */
  static async checkEmployeeRole(): Promise<boolean> {
    try {
      // Verificar através do endpoint de informações de acesso
      const result = await this.getEmployeeAccessInfo();
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Formatar permissões para exibição
   */
  static formatPermissions(permissions: string[]): string {
    const permissionLabels: Record<string, string> = {
      'view_transactions': 'Visualizar Transações',
      'view_balance_summary': 'Visualizar Resumo de Saldo',
      'view_full_balance': 'Visualizar Saldo Completo',
      'export_statements': 'Exportar Extratos'
    };

    return permissions
      .map(perm => permissionLabels[perm] || perm)
      .join(', ');
  }

  /**
   * Formatar status para exibição
   */
  static formatStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Pendente', color: 'yellow' },
      'active': { label: 'Ativo', color: 'green' },
      'suspended': { label: 'Suspenso', color: 'orange' },
      'revoked': { label: 'Revogado', color: 'red' }
    };

    return statusMap[status] || { label: status, color: 'gray' };
  }
}

// ==================== EXPORT DEFAULT ====================

export const otcEmployeeService = OTCEmployeeService;
