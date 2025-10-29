/**
 * 🚀 Bitso Realtime Service
 * Implementação completa do guia FRONTEND-REALTIME-GUIDE.md
 * APIs rápidas que consultam o banco local (não a API Bitso)
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export interface BitsoBalanceCached {
  currency: string;
  total: string;
  fundings_total: string;
  withdrawals_total: string;
  transactions_count: number;
}

export interface BitsoTransactionDB {
  id: number;
  type: 'FUNDING' | 'WITHDRAWAL';
  transactionId: string;
  endToEndId: string;
  reconciliationId: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  amount: string;
  fee: string;
  currency: string;
  method: string;
  methodName: string;
  payerName?: string;
  payerTaxId?: string;
  payerBankName?: string;
  payeeName?: string;
  createdAt: string; // UTC ISO 8601
  receivedAt?: string;
  updatedAt?: string;
  isReversal: boolean;
  originEndToEndId?: string | null;
}

export interface BitsoTransactionsResponse {
  success: boolean;
  data: BitsoTransactionDB[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    current_page: number;
    total_pages: number;
  };
  filters_applied: {
    type?: string;
    status?: string;
    period?: {
      start: string;
      end: string;
    };
    [key: string]: any;
  };
}

export interface BitsoTransactionFilters {
  // Filtros básicos
  type?: 'FUNDING' | 'WITHDRAWAL';
  status?: 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  currency?: string;
  method?: string;
  
  // Filtros de data
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  
  // Filtros de valor
  minAmount?: number;
  maxAmount?: number;
  
  // Busca textual
  search?: string;
  
  // Filtros especiais
  isReversal?: boolean;
  onlyTcr?: boolean; // Somente transações TCR (com reconciliationId)
  
  // Paginação
  limit?: number;  // Padrão: 50, Máximo: 1000
  offset?: number; // Padrão: 0
}

// ===================================
// API FUNCTIONS
// ===================================

/**
 * 💰 Saldo REAL da API Bitso
 * ✅ Consulta direto da API Bitso (saldo real)
 */
export async function getBalanceReal(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bitso/balance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Retornar payload com balances
    if (data.success && data.payload && data.payload.balances) {
      return data.payload.balances;
    }
    
    return data;
  } catch (error: any) {
    console.error('[BITSO-REALTIME] Erro ao buscar saldo real:', error);
    throw new Error(error.message || 'Erro ao consultar saldo');
  }
}

/**
 * 💾 Saldo Calculado (Super Rápido)
 * ✅ SEM autenticação
 * ✅ Consulta banco local (não a API Bitso)
 * ✅ Atualizado em tempo real via webhook
 */
export async function getBalanceCached(currency: string = 'brl'): Promise<BitsoBalanceCached> {
  try {
    const response = await fetch(`${API_BASE_URL}/bitso/balance-cached/${currency}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[BITSO-REALTIME] Erro ao buscar saldo cached:', error);
    throw new Error(error.message || 'Erro ao consultar saldo');
  }
}

/**
 * 📊 Extrato de Transações (do Banco) - COM FILTROS AVANÇADOS
 * ✅ SEM autenticação
 * ✅ Consulta banco local (não a API Bitso)
 * ✅ Paginação eficiente (até 1000 registros por página)
 * ✅ FILTROS AVANÇADOS
 */
export async function getTransactions(filters?: BitsoTransactionFilters): Promise<BitsoTransactionsResponse> {
  try {
    const params = new URLSearchParams();
    
    // Aplicar filtros
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.currency) params.append('currency', filters.currency);
    if (filters?.method) params.append('method', filters.method);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.minAmount !== undefined) params.append('minAmount', filters.minAmount.toString());
    if (filters?.maxAmount !== undefined) params.append('maxAmount', filters.maxAmount.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isReversal !== undefined) params.append('isReversal', filters.isReversal.toString());
    if (filters?.onlyTcr !== undefined) params.append('onlyTcr', filters.onlyTcr.toString());
    if (filters?.limit) params.append('limit', Math.min(filters.limit, 1000).toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

    const url = `${API_BASE_URL}/bitso/transactions?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[BITSO-REALTIME] Erro ao buscar transações:', error);
    throw new Error(error.message || 'Erro ao consultar transações');
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Converter data UTC para local
 */
export function convertUTCToLocal(utcDateString: string): Date {
  return new Date(utcDateString);
}

/**
 * Formatar data UTC para exibição local
 */
export function formatUTCToLocalString(
  utcDateString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(utcDateString);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  };

  return date.toLocaleString('pt-BR', defaultOptions);
}

/**
 * Formatar data UTC para exibição local (apenas data)
 */
export function formatUTCToLocalDate(utcDateString: string): string {
  return formatUTCToLocalString(utcDateString, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatar data UTC para exibição local (apenas hora)
 */
export function formatUTCToLocalTime(utcDateString: string): string {
  return formatUTCToLocalString(utcDateString, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Obter data de hoje no formato YYYY-MM-DD
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Obter data de X dias atrás no formato YYYY-MM-DD
 */
export function getDateStringDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Formatar valor em BRL
 */
export function formatCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Obter badge de status
 */
export function getStatusBadge(status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'COMPLETE':
      return { label: 'Completo', variant: 'default' };
    case 'PENDING':
      return { label: 'Pendente', variant: 'secondary' };
    case 'FAILED':
      return { label: 'Falhou', variant: 'destructive' };
    case 'CANCELLED':
      return { label: 'Cancelado', variant: 'outline' };
    default:
      return { label: status, variant: 'outline' };
  }
}

/**
 * Obter tipo de transação formatado
 */
export function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'FUNDING':
      return '📥 Recebimento';
    case 'WITHDRAWAL':
      return '📤 Envio';
    default:
      return type;
  }
}

// Export principal
export const BitsoRealtimeService = {
  getBalanceReal,
  getBalanceCached,
  getTransactions,
  convertUTCToLocal,
  formatUTCToLocalString,
  formatUTCToLocalDate,
  formatUTCToLocalTime,
  getTodayDateString,
  getDateStringDaysAgo,
  formatCurrency,
  getStatusBadge,
  getTransactionTypeLabel,
} as const;

export default BitsoRealtimeService;

