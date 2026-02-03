// Tipos para Cash Closure Dashboard

// Estatísticas PIX-OUT TTF (apenas para conta TTF)
export interface TtfPixOutDestination {
  pixKey: string | null; // null para transferências internas/tarifas
  transactionCount: number;
  totalAmount: number; // Sempre negativo
  beneficiaryDocument: string | null; // Sempre preenchido quando disponível
  beneficiaryName: string | null; // Sempre preenchido quando disponível
}

export interface TtfPixOutStats {
  byDestination: TtfPixOutDestination[];
  totalDestinations: number;
  totalTransactions: number; // Inclui TODAS as transações (com e sem pixKey)
  totalAmount: number; // Sempre negativo, inclui TODAS as transações
  calculatedAt?: string; // Timestamp ISO (opcional)
}

export interface CashClosure {
  id: string;
  closureDate: string; // YYYY-MM-DD
  accountName: string;
  taxDocument: string;
  openingBalance: number;
  closingBalance: number;
  variation: number;
  totalCredits: number;
  totalDebits: number; // NEGATIVO
  totalCreditTransactions: number; // Quantidade de transações de crédito
  totalDebitTransactions: number; // Quantidade de transações de débito
  pixReceivedCount: number;
  pixReceivedAmount: number;
  pixSentCount: number;
  pixSentAmount: number; // NEGATIVO
  status: 'completed' | 'pending' | 'error';
  accountType?: 'operational' | 'client' | 'treasury';
  closureType?: 'daily' | 'monthly';
  currency?: string;
  processedAt?: string;
  dataSource?: {
    provider: string;
    syncedAt: string;
  };
  ttfPixOutStats?: TtfPixOutStats; // Apenas para conta TTF (14283885000198)
}

export interface CashClosureDetail {
  id: string;
  closureDate: string;
  accountType: string;
  closureType: string;
  accountName: string;
  taxDocument: string;
  currency: string;
  openingBalance: {
    total: number;
    blocked: number;
    available: number;
  };
  closingBalance: {
    total: number;
    blocked: number;
    available: number;
  };
  variation: {
    total: number;
    blocked: number;
    available: number;
  };
  transactions: {
    credits: number;
    debits: number;
    creditCount: number;
    debitCount: number;
  };
  pix: {
    receivedAmount: number;
    receivedCount: number;
    sentAmount: number;
    sentCount: number;
  };
  status: string;
  processedAt: string | null;
  dataSource: {
    provider: string;
    corpxAccountId: string;
    taxDocument: string;
    syncedAt: string;
  };
}

export interface CashClosureListParams {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  taxDocument?: string;
  accountType?: 'operational' | 'client' | 'treasury';
  page?: number;
  limit?: number;
}

export interface CashClosureListResponse {
  data: CashClosure[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CashClosureSummary {
  period: {
    start: string;
    end: string;
  };
  totals: {
    closures: number;
    totalCredits: number;
    totalDebits: number; // NEGATIVO
    netVariation: number;
    pixReceivedCount: number;
    pixReceivedAmount: number;
    pixSentCount: number;
    pixSentAmount: number; // NEGATIVO
  };
  byAccount: Array<{
    accountName: string;
    taxDocument: string;
    totalCredits: number;
    totalDebits: number; // NEGATIVO
    closuresCount: number;
    lastBalance: number;
  }>;
}

export interface DailyEvolutionData {
  date: string; // YYYY-MM-DD
  closingBalance: number;
  credits: number;
  debits: number; // NEGATIVO
  variation: number;
}

export interface DailyEvolutionResponse {
  data: DailyEvolutionData[];
}

export interface CashClosureAccount {
  taxDocument: string;
  accountName: string;
  lastClosureDate: string;
  lastBalance: number;
}

export interface CashClosureAccountsResponse {
  accounts: CashClosureAccount[];
}
