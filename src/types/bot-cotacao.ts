// Tipos para o sistema de Bot de Cotação TCR

export interface OtcUser {
  id: string;
  user_name: string;
  user_document: string;
  user_type: 'business' | 'personal';
  user_friendly_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface OtcUserGroup {
  id: string;
  id_otc_user: string;
  whatsapp_group_name: string;
  whatsapp_group_id: string;
  fee_percentual: number;
  id_moeda: number; // sempre 2 para USDT
  created_at?: string;
  updated_at?: string;
  // Campos calculados/relacionados
  otc_user?: OtcUser;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string;
  participants_count?: number;
  created_at?: string;
  is_registered?: boolean; // se já está cadastrado no sistema
}

export interface BotStatus {
  is_active: boolean;
  last_activity: string;
  total_groups: number;
  total_clients: number;
  status_message: string;
}

// DTOs para criação/atualização
export interface CreateOtcUserDto {
  user_name: string;
  user_document: string;
  user_type: 'business' | 'personal';
  user_friendly_name: string;
}

export interface CreateOtcUserGroupDto {
  id_otc_user: string;
  whatsapp_group_name: string;
  whatsapp_group_id: string;
  fee_percentual?: number; // opcional - usa a taxa do cliente se não fornecida
}

export interface UpdateGroupFeeDto {
  fee_percentual: number;
}

// Respostas da API
export interface ApiResponse<T = any> {
  sucesso: boolean;
  mensagem: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  sucesso: boolean;
  mensagem: string;
  data?: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Filtros e queries
export interface GroupFilters {
  client_id?: string;
  min_fee?: number;
  max_fee?: number;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Estados de loading
export interface LoadingStates {
  groups: boolean;
  clients: boolean;
  whatsappGroups: boolean;
  saving: boolean;
}

// Dados consolidados para a interface
export interface GroupWithClient extends OtcUserGroup {
  client_name: string;
  effective_fee: number; // taxa efetiva do grupo
} 