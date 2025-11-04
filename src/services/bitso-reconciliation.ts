/**
 * 🔄 Bitso Reconciliation Service
 * Serviço para reconciliação manual de depósitos Bitso
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export interface BitsoReconciliationTransaction {
  transactionId: string;
  endToEndId: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  reconciliationId: string | null;
  currentTenant: 'otc' | 'tcr';
  payerName: string;
  payerDocument: string;
  payerBank: string;
  payeeDocument: string;
  journals?: Array<{
    id: number;
    type: string;
    tenant: string;
    postings: Array<{
      account: string;
      side: string;
      amount: string;
    }>;
  }>;
}

export interface BitsoUnreconciledTransaction {
  endToEndId: string;
  transactionId: string;
  amount: string;
  currency: string;
  createdAt: string;
  currentTenant: 'otc' | 'tcr';
  payerName: string;
  payerDocument: string;
}

export interface ReconciliationRequest {
  endToEndId: string;
  reconciliationId: string;
  correctTenantId: 2 | 3; // 2 = TCR, 3 = OTC
  force?: boolean; // Opcional: permite sobrescrever reconciliação existente (SUPER_ADMIN apenas)
}

export interface ReconciliationResponse {
  success: boolean;
  originalTenant: string;
  correctTenant: string;
  amount: string;
  reversalJournalId: number;
  newJournalId: number;
  message: string;
}

// ===================================
// API FUNCTIONS
// ===================================

/**
 * Obter token de autenticação (mesmo padrão dos outros serviços)
 */
function getAuthToken(): string | null {
  return sessionStorage.getItem('jwt_token') || 
         localStorage.getItem('jwt_token') ||
         sessionStorage.getItem('auth_token') || 
         localStorage.getItem('auth_token');
}

/**
 * Buscar depósito por endToEndId
 * GET /bitso/reconciliation/search/:endToEndId
 */
export async function searchDeposit(endToEndId: string): Promise<BitsoReconciliationTransaction> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/reconciliation/search/${endToEndId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao buscar depósito');
  }
}

/**
 * Listar depósitos não reconciliados
 * GET /bitso/reconciliation/unreconciled?limit=50
 */
export async function listUnreconciled(limit: number = 50): Promise<BitsoUnreconciledTransaction[]> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/reconciliation/unreconciled?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao listar depósitos não reconciliados');
  }
}

/**
 * Reconciliar depósito
 * POST /bitso/reconciliation
 * ⚠️ Requer SUPER_ADMIN
 */
export async function reconcileDeposit(data: ReconciliationRequest): Promise<ReconciliationResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/reconciliation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao reconciliar depósito');
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Formatar valor monetário
 * A API retorna valores já em reais (ex: "48.05"), não em centavos
 */
export function formatCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Formatar data
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Obter nome do tenant
 */
export function getTenantName(tenant: string): string {
  return tenant === 'otc' ? 'OTC' : tenant === 'tcr' ? 'TCR' : tenant.toUpperCase();
}

