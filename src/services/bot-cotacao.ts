import { createApiRequest, API_CONFIG } from '@/config/api';

// Base URL específica para o Bot de Cotação
const BOT_COTACAO_BASE_URL = import.meta.env.X_DIAGNOSTICO_API_URL;
import {
  OtcUser,
  OtcUserGroup,
  WhatsAppGroup,
  BotStatus,
  CreateOtcUserDto,
  CreateOtcUserGroupDto,
  UpdateGroupFeeDto,
  ApiResponse,
  PaginatedResponse,
  GroupFilters,
  PaginationParams,
  GroupWithClient
} from '@/types/bot-cotacao';

// Configuração dos endpoints específicos do Bot de Cotação
const BOT_ENDPOINTS = {
  GET_ALL_BOT_GROUPS: '/bot-cotacao/getAllBotGroups',
  STATUS: '/bot-cotacao/status',
  ADD_CLIENT: '/bot-cotacao/addBotClient',
  ADD_GROUP_TO_CLIENT: '/bot-cotacao/addBotGroupToClient',
  GET_GROUPS: '/bot-cotacao/groups',
  UPDATE_GROUP: '/bot-cotacao/groups',
} as const;

// Função para criar requisição para o Bot de Cotação
const createBotApiRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${BOT_COTACAO_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    },
    mode: 'cors', // Adicionar CORS
    signal: AbortSignal.timeout(30000) // 30 segundos
  };

  try {
    const response = await fetch(url, config);
    
    // Verificar se a resposta é OK
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

class BotCotacaoService {
  /**
   * Buscar todos os grupos do WhatsApp disponíveis (Z-API)
   */
  async getAllWhatsAppGroups(params?: PaginationParams): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('pageSize', params.limit.toString());

      const response = await createBotApiRequest(
        `${BOT_ENDPOINTS.GET_ALL_BOT_GROUPS}?${queryParams.toString()}`,
        { method: 'GET' }
      );

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        return {
          sucesso: false,
          mensagem: 'Erro na comunicação com a API - resposta inválida',
          data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }
        };
      }
      
      // Adaptar response da API para o formato esperado
      const grupos = result.response?.grupos || [];
      
      const mappedGroups = grupos.map((grupo: any, index: number) => {
        return {
          id: grupo.phone || `grupo-${index}`,
          name: grupo.name || `Grupo ${index + 1}`,
          participants_count: parseInt(grupo.messagesUnread || grupo.unread || '0') || 0,
          is_registered: false
        };
      });
      
      return {
        sucesso: true,
        mensagem: result.mensagem || 'Grupos obtidos com sucesso',
        data: {
          items: mappedGroups,
          total: result.response?.estatisticas?.totalGrupos || grupos.length,
          page: result.response?.paginacao?.paginaAtual || 1,
          limit: result.response?.paginacao?.tamanhoPagina || 20,
          totalPages: Math.ceil((result.response?.estatisticas?.totalGrupos || grupos.length) / (result.response?.paginacao?.tamanhoPagina || 20))
        }
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro ao buscar grupos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }
      };
    }
  }

  /**
   * Verificar status do bot
   */
  async getBotStatus(): Promise<any> {
    try {
      const response = await createBotApiRequest(BOT_ENDPOINTS.STATUS, {
        method: 'GET'
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        return {
          sucesso: false,
          mensagem: 'Erro na comunicação com a API - resposta inválida',
          data: {
            is_active: false,
            last_activity: new Date().toISOString(),
            total_groups: 0,
            total_clients: 0,
            status_message: 'Erro de comunicação'
          }
        };
      }
      
      return {
        sucesso: true,
        mensagem: result.mensagem || 'Status obtido com sucesso',
        data: {
          is_active: result.response?.botAtivo || false,
          last_activity: result.response?.ultimaVerificacao || new Date().toISOString(),
          total_groups: 0,
          total_clients: 0,
          status_message: result.response?.configurado ? 'Bot configurado e ativo' : 'Bot não configurado'
        }
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro ao verificar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: {
          is_active: false,
          last_activity: new Date().toISOString(),
          total_groups: 0,
          total_clients: 0,
          status_message: 'Erro de comunicação'
        }
      };
    }
  }

  /**
   * Testar conectividade básica com a API
   */
  async testConnectivity(): Promise<any> {
    try {
      // Teste simples sem parâmetros
      const response = await fetch(`${BOT_COTACAO_BASE_URL}/bot-cotacao/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors'
      });
      
      if (response.ok) {
        const text = await response.text();
        
        try {
          const json = JSON.parse(text);
          return {
            sucesso: true,
            mensagem: 'Conectividade OK',
            data: json
          };
        } catch (e) {
          return {
            sucesso: false,
            mensagem: 'Resposta não é JSON válido',
            data: { rawResponse: text.substring(0, 500) }
          };
        }
      } else {
        const errorText = await response.text();
        return {
          sucesso: false,
          mensagem: `HTTP ${response.status}: ${response.statusText}`,
          data: { error: errorText.substring(0, 500) }
        };
      }
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro de conexão: ${error instanceof Error ? error.message : 'Desconhecido'}`,
        data: { error: error }
      };
    }
  }

  /**
   * Cadastrar novo cliente OTC
   */
  async createClient(clientData: CreateOtcUserDto): Promise<any> {
    try {
      const response = await createBotApiRequest(BOT_ENDPOINTS.ADD_CLIENT, {
        method: 'POST',
        body: JSON.stringify(clientData)
      });

      const result = await response.json();
      
      return {
        sucesso: response.ok,
        mensagem: result.mensagem,
        data: result.response
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Buscar grupos cadastrados com filtros
   */
  async getRegisteredGroups(
    filters?: GroupFilters,
    params?: PaginationParams
  ): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      
      // Parâmetros de paginação
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('pageSize', params.limit.toString());

      const response = await createBotApiRequest(
        `${BOT_ENDPOINTS.GET_GROUPS}?${queryParams.toString()}`,
        { method: 'GET' }
      );

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        return {
          sucesso: false,
          mensagem: 'Erro na comunicação com a API - resposta inválida',
          data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }
        };
      }
      
      // Adaptar response da API para o formato esperado
      return {
        sucesso: true,
        mensagem: result.mensagem || 'Grupos cadastrados obtidos com sucesso',
        data: {
          items: result.response?.grupos?.map((grupo: any) => ({
            id: grupo.id,
            whatsapp_group_name: grupo.whatsapp_group_name,
            whatsapp_group_id: grupo.whatsapp_group_id,
            fee_percentual: grupo.fee_percentual,
            id_otc_user: grupo.otc_user?.id,
            client_name: grupo.otc_user?.user_name || grupo.otc_user?.user_friendly_name,
            effective_fee: grupo.fee_percentual || 0,
            otc_user: grupo.otc_user
          })) || [],
          total: result.response?.paginacao?.totalGrupos || 0,
          page: result.response?.paginacao?.paginaAtual || 1,
          limit: result.response?.paginacao?.tamanhoPagina || 20,
          totalPages: result.response?.paginacao?.totalPaginas || 1
        }
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro ao buscar grupos cadastrados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }
      };
    }
  }

  /**
   * Cadastrar múltiplos grupos do WhatsApp em lote
   */
  async addGroupsFromWhatsApp(groupsData: {
    id_otc_user: string;
    grupos_whatsapp: Array<{ name: string; phone: string }>;
    fee_percentual_padrao?: number;
  }): Promise<any> {
    try {
      const response = await createBotApiRequest('/bot-cotacao/addGroupsFromWhatsApp', {
        method: 'POST',
        body: JSON.stringify(groupsData)
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        return {
          sucesso: false,
          mensagem: 'Erro na comunicação com a API - resposta inválida',
          data: null
        };
      }
      
      return {
        sucesso: response.ok,
        mensagem: result.mensagem || 'Grupos processados',
        data: result.response,
        statusCode: response.status
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: `Erro ao cadastrar grupos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        data: null
      };
    }
  }

  /**
   * Vincular grupo do WhatsApp a um cliente
   */
  async addGroupToClient(groupData: CreateOtcUserGroupDto): Promise<any> {
    try {
      // Adaptar dados para o formato da API
      const apiData = {
        id_otc_user: groupData.id_otc_user,
        whatsapp_group_name: groupData.whatsapp_group_name,
        whatsapp_group_id: groupData.whatsapp_group_id,
        id_moeda: 2, // Sempre USDT
        fee_percentual: groupData.fee_percentual
      };

      const response = await createBotApiRequest(BOT_ENDPOINTS.ADD_GROUP_TO_CLIENT, {
        method: 'POST',
        body: JSON.stringify(apiData)
      });

      const result = await response.json();
      
      return {
        sucesso: response.ok,
        mensagem: result.mensagem,
        data: result.response
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Atualizar taxa de um grupo específico
   */
  async updateGroupFee(groupId: string, feeData: UpdateGroupFeeDto): Promise<any> {
    try {
      const response = await createBotApiRequest(`${BOT_ENDPOINTS.UPDATE_GROUP}/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(feeData)
      });

      const result = await response.json();
      
      return {
        sucesso: response.ok,
        mensagem: result.mensagem,
        data: result.response
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remover grupo (desvincular do cliente)
   */
  async removeGroup(groupId: string): Promise<any> {
    try {
      const response = await createBotApiRequest(`${BOT_ENDPOINTS.UPDATE_GROUP}/${groupId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      return {
        sucesso: response.ok,
        mensagem: result.mensagem || 'Grupo removido com sucesso',
        data: null
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Buscar estatísticas para o dashboard
   */
  async getDashboardStats(): Promise<any> {
    try {
      // Como não há endpoint específico, vamos buscar dos grupos cadastrados
      const groupsResponse = await this.getRegisteredGroups({}, { page: 1, limit: 500 });
      
      if (groupsResponse.sucesso) {
        const groups = groupsResponse.data?.items || [];
        const totalGroups = groups.length;
        const totalClients = new Set(groups.map((g: any) => g.id_otc_user)).size;
        const averageFee = groups.length > 0 
          ? groups.reduce((sum: number, g: any) => sum + (g.effective_fee || 0), 0) / groups.length 
          : 0;
        
        return {
          sucesso: true,
          mensagem: 'Estatísticas calculadas com sucesso',
          data: {
            total_clients: totalClients,
            total_groups: totalGroups,
            total_active_groups: totalGroups,
            average_fee: averageFee,
            last_activity: new Date().toISOString()
          }
        };
      }
      
      return {
        sucesso: false,
        mensagem: 'Erro ao calcular estatísticas'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sincronizar grupos do WhatsApp com o sistema
   */
  async syncWhatsAppGroups(): Promise<any> {
    try {
      // Buscar grupos do WhatsApp (limite aumentado para 500)
      const whatsappResponse = await this.getAllWhatsAppGroups({ page: 1, limit: 500 });
      
      // Buscar grupos já cadastrados (limite aumentado para 500)
      const registeredResponse = await this.getRegisteredGroups({}, { page: 1, limit: 500 });

      if (whatsappResponse.sucesso && registeredResponse.sucesso) {
        const whatsappGroups = whatsappResponse.data?.items || [];
        const registeredGroups = registeredResponse.data?.items || [];
        
        // Identificar grupos não registrados
        const registeredGroupIds = new Set(
          registeredGroups.map((group: any) => group.whatsapp_group_id)
        );
        
        const unregisteredGroups = whatsappGroups.filter(
          (group: any) => !registeredGroupIds.has(group.id)
        );

        return {
          sucesso: true,
          mensagem: 'Sincronização realizada com sucesso',
          data: {
            whatsapp_groups: whatsappGroups,
            registered_groups: registeredGroups,
            unregistered_groups: unregisteredGroups
          }
        };
      } else {
        throw new Error('Erro ao sincronizar grupos');
      }
    } catch (error) {
      return {
        sucesso: false,
        mensagem: 'Erro ao sincronizar grupos do WhatsApp'
      };
    }
  }
}

// Instância única do serviço
export const botCotacaoService = new BotCotacaoService();
export default botCotacaoService; 