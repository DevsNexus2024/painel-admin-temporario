/**
 * 🚀 BrasilCash Realtime Service
 * Implementação baseada no guia brasilcash-transactions-api-examples.md
 * APIs que consultam o banco de dados BrasilCash
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// Constante para conta TCR BrasilCash
const TCR_ACCOUNT_ID = '1be0c9de-e87b-4535-b3bb-d0d61515ed9e';

// ===================================
// TYPES
// ===================================

export interface BrasilCashBalance {
  available: number | null;
  blocked: number | null;
  future: number | null;
}

export interface BrasilCashAccountInfo {
  account_id: string;
  name: string;
  tax_id: string;
  email: string;
  api_enabled: boolean;
  created_at: string;
  balance: {
    available: number;
    blocked: number;
    future: number;
  };
  account_number: string;
  branch_code: string;
}

export interface BrasilCashTransaction {
  id: string;
  brasilcash_account_id: string | number;
  pix_id: string;
  end_to_end_id: string;
  status: 'pending' | 'processing' | 'paid' | 'refused';
  amount: number; // em centavos
  currency?: string;
  type: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode';
  method: 'cashin' | 'cashout';
  event_type: string;
  external_id?: string | null;
  account_id: string;
  pix_key: string;
  payer_name?: string | null;
  payer_document?: string | null;
  payer_ispb?: string | null;
  payer_account?: string | null;
  payer_agency?: string | null;
  payer_branch_code?: string | null;
  payer_account_type?: string | null;
  payer_bank_code?: string | null;
  payer_bank_name?: string | null;
  receiver_name?: string | null;
  receiver_document?: string | null;
  receiver_ispb?: string | null;
  receiver_account?: string | null;
  receiver_branch_code?: string | null;
  receiver_account_type?: string | null;
  receiver_bank_code?: string | null;
  receiver_bank_name?: string | null;
  description?: string | null;
  source?: string;
  webhook_processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BrasilCashTransactionDB {
  id: number;
  type: 'FUNDING' | 'WITHDRAWAL';
  transactionId: string;
  endToEndId: string;
  reconciliationId: string; // external_id da API
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
  payeeTaxId?: string;
  payeeBankName?: string;
  description?: string;
  createdAt: string;
  receivedAt?: string;
  updatedAt?: string;
  isReversal: boolean;
  originEndToEndId?: string | null;
  eventType?: string; // event_type da API
  // Campos adicionais para exibição completa
  _original?: BrasilCashTransaction; // Dados originais completos da API
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
  filters_applied?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    method?: string;
    [key: string]: any;
  };
}

export interface BrasilCashTransactionFilters {
  accountId?: string;
  endToEndId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  amount?: number;    // em centavos
  status?: 'pending' | 'processing' | 'paid' | 'refused';
  method?: 'cashin' | 'cashout';
  type?: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode';
  external_id?: string;
  limit?: number;  // Padrão: 50, Máximo: 2000
  offset?: number; // Padrão: 0
}

export interface BrasilCashSyncResult {
  success: boolean;
  startDate: string;
  endDate: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  duration_ms: number;
  errors: any[];
}

// ===================================
// API FUNCTIONS
// ===================================

/**
 * Obter token de autenticação
 */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || 
         localStorage.getItem('jwt_token') || 
         sessionStorage.getItem('auth_token') || 
         sessionStorage.getItem('jwt_token');
}

/**
 * Obter headers de autenticação
 */
function getAuthHeaders(accountId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (accountId) {
    headers['X-Account-Id'] = accountId;
  }

  return headers;
}

/**
 * 💰 Consultar Saldo da Conta BrasilCash
 * GET /api/brasilcash/account/me/balance (deprecated - usar getAccountInfo)
 */
export async function getBalance(accountId?: string): Promise<BrasilCashBalance> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/brasilcash/account/me/balance`,
      {
        method: 'GET',
        headers: getAuthHeaders(accountId),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao consultar saldo');
  }
}

/**
 * 💰 Consultar Informações da Conta BrasilCash (inclui saldo)
 * GET /api/brasilcash/account/me
 * Retorna informações completas da conta autenticada incluindo saldo, número da conta, agência, etc.
 */
export async function getAccountInfo(): Promise<BrasilCashAccountInfo> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'accept': 'application/json',
    };
    
    const response = await fetch(
      `${API_BASE_URL}/api/brasilcash/account/me`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao consultar informações da conta');
  }
}

/**
 * 🔄 Sincronizar Extrato BrasilCash
 * POST /api/brasilcash/transactions/sync
 */
export async function syncTransactions(
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<BrasilCashSyncResult> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/brasilcash/transactions/sync`,
      {
        method: 'POST',
        headers: getAuthHeaders(accountId),
        body: JSON.stringify({
          startDate,
          endDate,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao sincronizar extrato');
  }
}

/**
 * 📊 Listar Transações BrasilCash
 * GET /api/brasilcash/transactions
 */
export async function getTransactions(
  filters?: BrasilCashTransactionFilters
): Promise<BrasilCashTransactionsResponse> {
  try {
    const params = new URLSearchParams();
    
    // Usar accountId padrão se não fornecido
    const accountId = filters?.accountId || TCR_ACCOUNT_ID;
    if (accountId) params.append('accountId', accountId);
    
    // Aplicar outros filtros
    if (filters?.endToEndId) params.append('endToEndId', filters.endToEndId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.amount !== undefined) params.append('amount', filters.amount.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.method) params.append('method', filters.method);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.external_id) params.append('external_id', filters.external_id);
    if (filters?.limit) params.append('limit', Math.min(filters.limit, 2000).toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

    const url = `${API_BASE_URL}/api/brasilcash/transactions?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao consultar transações');
  }
}

/**
 * Converter BrasilCashTransaction para BrasilCashTransactionDB
 */
export function mapBrasilCashToTransactionDB(
  tx: BrasilCashTransaction
): BrasilCashTransactionDB {
  // Converter status
  let status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED' = 'COMPLETE';
  if (tx.status === 'pending' || tx.status === 'processing') {
    status = 'PENDING';
  } else if (tx.status === 'refused') {
    status = 'FAILED';
  } else if (tx.status === 'paid') {
    status = 'COMPLETE';
  }

  // Converter tipo
  const type: 'FUNDING' | 'WITHDRAWAL' = tx.method === 'cashin' ? 'FUNDING' : 'WITHDRAWAL';

  // Valor já vem em reais do backend (não precisa dividir por 100)
  const amountInReais = tx.amount.toString();

  // Determinar nomes corretos baseado no método
  // cashin = recebimento (payer envia para nós, receiver somos nós)
  // cashout = pagamento (payer somos nós, receiver recebe de nós)
  // Para exibição na interface:
  // - FUNDING (cashin): mostrar payer_name (quem enviou)
  // - WITHDRAWAL (cashout): mostrar receiver_name (quem recebeu)
  
  const payerName = tx.payer_name || '';
  const payeeName = tx.receiver_name || '';
  const payerTaxId = tx.payer_document || '';
  const payeeTaxId = tx.receiver_document || '';
  const payerBankName = tx.payer_bank_name || (tx.payer_ispb ? `ISPB: ${tx.payer_ispb}` : '');
  const payeeBankName = tx.receiver_bank_name || (tx.receiver_ispb ? `ISPB: ${tx.receiver_ispb}` : '');

  return {
    id: parseInt(tx.id) || 0,
    type,
    transactionId: tx.pix_id || tx.id,
    endToEndId: tx.end_to_end_id || '',
    reconciliationId: tx.external_id || '', // ✅ external_id é o reconciliation_id
    status,
    amount: amountInReais,
    fee: '0', // BrasilCash não retorna fee separado
    currency: tx.currency || 'BRL',
    method: tx.type || 'pix',
    methodName: getMethodName(tx.type),
    payerName: payerName,
    payerTaxId: payerTaxId,
    payerBankName: payerBankName,
    payeeName: payeeName,
    payeeTaxId: payeeTaxId,
    payeeBankName: payeeBankName,
    description: tx.description || undefined,
    createdAt: tx.created_at,
    receivedAt: tx.created_at,
    updatedAt: tx.updated_at,
    isReversal: false,
    originEndToEndId: null,
    eventType: tx.event_type, // Preservar event_type para filtrar tarifas
    _original: tx, // Preservar dados originais completos
  };
}

/**
 * Obter nome do método
 */
function getMethodName(type: string): string {
  switch (type) {
    case 'staticQrcode':
      return 'QR Code Estático';
    case 'dynamicQrcode':
      return 'QR Code Dinâmico';
    case 'dict':
      return 'DICT';
    case 'manual':
      return 'Manual';
    default:
      return 'PIX';
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
 * Formatar data para exibição local
 * O backend já retorna em horário local (mesmo que tenha .000Z no final)
 * Então tratamos a data como local, não UTC, para evitar conversão incorreta
 */
export function formatUTCToLocalString(
  utcDateString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  // Se a string termina com Z, remover para tratar como horário local
  // O backend já retorna em horário local, então não queremos conversão UTC
  const localDateString = utcDateString.endsWith('Z') 
    ? utcDateString.slice(0, -1) 
    : utcDateString;
  
  // Parsear a data como se fosse local (sem conversão UTC)
  const [datePart, timePart] = localDateString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [time, ms] = timePart.split('.');
  const [hour, minute, second] = time.split(':').map(Number);
  
  // Criar Date object como horário local
  const date = new Date(year, month - 1, day, hour, minute, second);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Usar formato 24h
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
export function getStatusBadge(status: string): { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline' 
} {
  switch (status.toUpperCase()) {
    case 'COMPLETE':
    case 'PAID':
      return { label: 'Completo', variant: 'default' };
    case 'PENDING':
    case 'PROCESSING':
      return { label: 'Pendente', variant: 'secondary' };
    case 'FAILED':
    case 'REFUSED':
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
export const BrasilCashRealtimeService = {
  TCR_ACCOUNT_ID,
  TCR_TENANT_ID: 2,
  getBalance,
  getAccountInfo,
  syncTransactions,
  getTransactions,
  mapBrasilCashToTransactionDB,
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

export default BrasilCashRealtimeService;

