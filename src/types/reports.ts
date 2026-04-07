// Tipos para o módulo de Relatórios OTC

// ===== FILTROS =====

export interface DateRangeFilter {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}

export interface OtcReportFilters extends DateRangeFilter {
  clientId: number;
  operationType?: 'withdrawal' | 'credit' | 'conversion';
  hideReversals?: boolean;
}

export interface BankingReportFilters extends DateRangeFilter {
  provider?: 'corpx' | 'brasilcash' | 'all';
  accountId?: string;
  type?: 'CREDIT' | 'DEBIT';
  search?: string; // documento, nome, pixKey, endToEndId
}

export interface TarifaReportFilters extends DateRangeFilter {
  provider?: 'corpx' | 'brasilcash' | 'all';
  accountId?: string;
  otcId?: string; // header x-otc-id para BrasilCash
}

// ===== RESPONSES (TCR-BAAS) =====

export interface TcrTransaction {
  id: string;
  provider: string;
  accountId: string;
  accountName?: string;
  transactionId: string;
  endToEndId?: string;
  type: 'CREDIT' | 'DEBIT';
  status: string;
  amount: number; // em BRL
  transactionDate: string; // ISO string em UTC
  payerName?: string;
  payerDocument?: string;
  beneficiaryName?: string;
  beneficiaryDocument?: string;
  pixKey?: string;
  description?: string;
}

export interface TcrTransactionsResponse {
  success: boolean;
  data: TcrTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCredits?: number;
  totalDebits?: number;
  countByProvider: Record<string, number>;
  filters: Record<string, unknown>;
  timestamp: string;
}

export interface TcrBalanceResponse {
  success: boolean;
  data: Array<{
    provider: string;
    accountId: string;
    accountName?: string;
    available: number;
    blocked: number;
    currency: string;
  }>;
  totalAvailable: number;
  totalBlocked: number;
  currency: string;
  accountCount: number;
  timestamp: string;
}

// ===== RESPONSES (CORPX TARIFAS - endpoint v1) =====

export interface CorpxTransaction {
  id: number;
  transactionId: string;
  endToEndId?: string;
  transactionType: string;
  transactionDate: string;
  amount: number;
  payerName?: string;
  payerDocument?: string;
  beneficiaryName?: string;
  beneficiaryDocument?: string;
  status?: string;
}

export interface CorpxTransactionsResponse {
  success: boolean;
  data: CorpxTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// ===== RESPONSES (BRASILCASH TARIFAS) =====

export interface BrasilCashTransaction {
  id: number;
  pix_id?: string;
  end_to_end_id?: string;
  status: string;
  amount: number;
  type: string;
  method?: string;
  external_id?: string;
  payer_name?: string;
  payer_document?: string;
  receiver_name?: string;
  receiver_document?: string;
  created_at: string;
  updated_at?: string;
}

export interface BrasilCashTransactionsResponse {
  success: boolean;
  data: BrasilCashTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    current_page: number;
    total_pages: number;
  };
  filters_applied: Record<string, unknown>;
}

// ===== CASH CLOSURE =====

export interface CashClosureResponse {
  success: boolean;
  data: Array<{
    date: string;
    provider: string;
    accountId: string;
    openingBalance: number;
    closingBalance: number;
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
  }>;
}

// ===== TCR-BAAS ACCOUNTS =====

export interface TcrAccount {
  id: string;
  provider: string;
  accountId: string;
  document?: string;
  documentRaw?: string;
  name: string;
  accountNumber?: string;
  branch?: string;
  bankName?: string;
  status: string;
  cachedBalance?: number;
}

export interface TcrAccountsResponse {
  success: boolean;
  data: TcrAccount[];
  total: number;
  countByProvider: Record<string, number>;
  timestamp: string;
}

// ===== DEPOSITS STATS =====

export interface DepositsStatsClientEntry {
  otc_client_id: number;
  client_name: string;
  client_document: string;
  is_active: boolean;
  quantidade: number;
  total_brl: number;
}

export interface DepositsStatsResponse {
  success: boolean;
  data: {
    total_depositos: number;
    total_brl: number;
    periodo: {
      dateFrom: string | null;
      dateTo: string | null;
      tipo: 'filtrado' | 'total';
    };
    clientes: DepositsStatsClientEntry[];
  };
}

// ===== REPORT GENERATOR =====

export interface ReportProgress {
  current: number;
  total: number;
  percentage: number;
  page: number;
  totalPages: number;
  estimatedTimeLeft?: number; // ms
}

// ===== CONSTANTES =====

export const CORPX_TARIFA_CNPJ = '36741675000139';

// ===== CONTAS BRASILCASH =====

export const BRASILCASH_ACCOUNTS = [
  { name: 'TCR Finance LTDA', accountId: '1be0c9de-e87b-4535-b3bb-d0d61515ed9e', otcId: 'DEFAULT' },
  { name: 'TTF SERVIÇOS DIGITAIS LTDA', accountId: '12fb5af7-3b2b-48fc-ac70-631200793887', otcId: '73015092' },
  { name: 'RXP SERVIÇOS DIGITAIS LTDA', accountId: 'b8156e91-063c-4011-991a-8bf6ef869ff6', otcId: '24389222' },
  { name: 'Conta 78027552', accountId: '1fad5c73-c2e9-43c0-9eb0-565105208576', otcId: '78027552' },
  { name: 'Conta 17159172', accountId: 'e8e5502e-208f-4fae-bf45-a7cbd18bf41e', otcId: '17159172' },
] as const;
