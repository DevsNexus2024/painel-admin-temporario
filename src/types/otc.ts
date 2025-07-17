// Tipos para o sistema OTC (Over-the-Counter)

// Tipos de chave PIX
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

// Tipos de operações
export type OperationType = 'credit' | 'debit' | 'convert';

// Tipos de moeda para operações
export type CurrencyType = 'BRL' | 'USD';

// Tipos de transações
export type TransactionType = 'deposit' | 'withdrawal' | 'manual_credit' | 'manual_debit' | 'manual_adjustment';

// Status de transação
export type TransactionStatus = 'pending' | 'processed' | 'failed' | 'cancelled';

// Interface para usuário básico
export interface User {
  id: number;
  name: string;
  email: string;
}

// Interface para cliente OTC
export interface OTCClient {
  id: number;
  name: string;
  document: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  is_active: boolean;
  current_balance: number;      // BRL
  usd_balance: number;          // USD - NOVO
  last_conversion_rate?: number; // NOVO
  total_transactions: number;
  user: User;
  created_at: string;
  updated_at: string;
}

// Interface para saldo do cliente
export interface OTCBalance {
  client_id: number;
  client_name: string;
  current_balance: number;      // BRL
  usd_balance: number;          // USD - NOVO
  last_updated: string;
  last_transaction_id?: number;
  last_usd_transaction_id?: number; // NOVO
  last_conversion_rate?: number; // NOVO
}

// Interface para transação
export interface OTCTransaction {
  id: number;
  type: TransactionType;
  amount: number;
  date: string;
  status: TransactionStatus;
  payer_name?: string;
  payer_document?: string;
  bmp_identifier?: string;
  notes?: string;
  is_conversion?: boolean;
  description?: string;
  processed_by?: string;
  // Campos adicionados do histórico de saldo
  history_id?: number;
  checked_by_client?: boolean;
  operation_type?: string;
  operation_description?: string;
  amount_change?: number;
  usd_amount_change?: number;
  usd_balance_before?: number;
  usd_balance_after?: number;
  conversion_rate?: number;
  saldo_anterior?: number;
  saldo_posterior?: number;
  sort_date?: string;
}

// Interface para histórico de saldo
export interface OTCBalanceHistory {
  id: number;
  balance_before: number;
  balance_after: number;
  amount_change: number;
  usd_balance_before: number;
  usd_balance_after: number;
  usd_amount_change: number;
  conversion_rate?: number;
  operation_type: string;
  description: string;
  checked_by_client?: boolean;
  created_at: string;
  transaction_id?: number;
  created_by: string;
}

// Interface para extrato do cliente
export interface OTCStatement {
  cliente: {
    id: number;
    name: string;
    document: string;
    pix_key: string;
    current_balance: number;      // BRL
    usd_balance: number;          // USD - NOVO
    last_conversion_rate?: number; // NOVO
    last_updated: string;
  };
  transacoes: OTCTransaction[];
  historico_saldo: OTCBalanceHistory[];
  paginacao: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Interface para estatísticas
export interface OTCStats {
  clientes: {
    total: number;
    ativos: number;
    inativos: number;
  };
  transacoes: {
    total: number;
    hoje: number;
  };
  valores: {
    total_depositos: number;
    total_saques: number;
    saldo_total: number;
  };
}

// Interface para operação manual
export interface OTCOperation {
  id: number;
  otc_client_id: number;
  operation_type: OperationType;
  amount?: number;
  description: string;
  created_at: string;
  created_by: string;
}

// Interface para conversão BRL → USD
export interface OTCConversion {
  id: number;
  otc_client_id: number;
  admin_user_id: number;
  brl_amount: number;
  usd_amount: number;
  conversion_rate: number;
  brl_balance_before: number;
  brl_balance_after: number;
  usd_balance_before: number;
  usd_balance_after: number;
  description: string;
  created_at: string;
  admin: User;
  client: {
    id: number;
    name: string;
    document: string;
  };
}

// Interface para resposta de conversões
export interface OTCConversionsResponse {
  success: boolean;
  data: {
    conversions: OTCConversion[];
    pagination: {
      current_page: number;
      total_pages: number;
      total_items: number;
      items_per_page: number;
    };
  };
}

// Interface para criar cliente OTC (método antigo - com user_id)
export interface CreateOTCClientRequest {
  user_id: number;
  client_name: string;
  client_document: string;
  pix_key: string;
  pix_key_type: PixKeyType;
}

// Interface para criar cliente OTC completo (novo método simplificado)
export interface CreateCompleteOTCClientRequest {
  user_name: string;
  user_email: string;
  user_password: string;
  user_document?: string;
  user_phone?: string;
  client_name: string;
  client_document?: string;
  pix_key: string;
  pix_key_type: PixKeyType;
}

// Interface para criar operação
export interface CreateOTCOperationRequest {
  otc_client_id: number;
  operation_type: OperationType;
  currency?: CurrencyType; // Nova: moeda para operações de crédito/débito
  amount?: number;
  description: string;
  // Campos específicos para conversão
  brl_amount?: number;
  usd_amount?: number;
  conversion_rate?: number;
}

// Interface para resposta da API de clientes
export interface OTCClientsResponse {
  success: boolean;
  data: {
    clientes: OTCClient[];
    estatisticas: {
      total_clientes: number;
      clientes_ativos: number;
      clientes_inativos: number;
      total_saldo: number;
      total_transacoes: number;
    };
  };
}

// Interface para parâmetros de busca de clientes
export interface OTCClientsParams {
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// Interface para parâmetros de extrato
export interface OTCStatementParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

// Interface para parâmetros de operações
export interface OTCOperationsParams {
  otc_client_id?: number;
  page?: number;
  limit?: number;
}

// Interface para resposta padrão da API
export interface OTCApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

// Interface para formulário de filtros
export interface OTCFilters {
  search: string;
  isActive: boolean | null;
  page: number;
  limit: number;
}

// Interface para dados do gráfico
export interface OTCChartData {
  date: string;
  deposits: number;
  withdrawals: number;
  balance: number;
}