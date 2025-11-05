/**
 * 🔄 Bitso Failed Withdrawals Service
 * Serviço para gerenciar PIX falhados (withdrawals)
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export interface FailedWithdrawal {
  journal_id: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  end_to_end_id: string;
  created_at: string;
  failed_at: string;
  amount: string;
  currency: string;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_qr_code: string | null;
  payment_method: string;
  withdrawal_status: string;
  failure_reason: string | null;
  can_retry: boolean;
  bitso_transaction_id: string | null;
  bitso_status: string | null;
  payee_name: string | null;
  payee_tax_id: string | null;
  is_reversed: boolean;
  reversal_journal_id: string | null;
  auth_method: string | null;
  created_via: string | null;
  user_email: string | null;
}

export interface FailedWithdrawalsListResponse {
  success: boolean;
  total: number;
  failed_withdrawals: FailedWithdrawal[];
}

export interface FailedWithdrawalDetail {
  success: boolean;
  journal: {
    id: string;
    journal_type: string;
    end_to_end_id: string;
    created_at: string;
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    metadata: {
      amount: string;
      pix_qr_code: string | null;
      payment_method: string;
      withdrawal_status: string;
      failed_at: string | null;
      can_retry: boolean;
      [key: string]: any;
    };
    postings: Array<{
      account_id: string;
      account_type: string;
      account_purpose: string;
      side: string;
      amount: string;
      currency: string;
    }>;
  };
  bitso_transaction: {
    transaction_id: string;
    status: string;
    amount: string;
    payee_name: string | null;
    payee_tax_id: string | null;
    created_at: string;
  } | null;
  reversal: {
    journal_id: string;
    created_at: string;
  } | null;
  can_retry: boolean;
  can_reverse: boolean;
}

export interface RetryResponse {
  success: boolean;
  message: string;
  original_journal_id: string;
  new_journal_id: string;
  new_end_to_end_id: string;
  wid: string;
  status: string;
}

export interface ReverseResponse {
  success: boolean;
  message: string;
  journal_id: string;
  end_to_end_id: string;
  amount: string;
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
 * Listar PIX falhados
 * GET /bitso/failed-withdrawals
 */
export async function listFailedWithdrawals(params?: {
  tenantId?: string;
  limit?: number;
}): Promise<FailedWithdrawalsListResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const queryParams = new URLSearchParams();
    if (params?.tenantId) queryParams.append('tenantId', params.tenantId);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${API_BASE_URL}/bitso/failed-withdrawals${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
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
    throw new Error(error.message || 'Erro ao listar PIX falhados');
  }
}

/**
 * Obter detalhes de um PIX falhado
 * GET /bitso/failed-withdrawals/:id
 */
export async function getFailedWithdrawalDetails(journalId: string): Promise<FailedWithdrawalDetail> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/failed-withdrawals/${journalId}`, {
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
    throw new Error(error.message || 'Erro ao obter detalhes do PIX falhado');
  }
}

/**
 * Refazer PIX
 * POST /bitso/failed-withdrawals/:id/retry
 */
export async function retryFailedWithdrawal(journalId: string): Promise<RetryResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/failed-withdrawals/${journalId}/retry`, {
      method: 'POST',
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
    throw new Error(error.message || 'Erro ao refazer PIX');
  }
}

/**
 * Estornar PIX manualmente
 * POST /bitso/failed-withdrawals/:id/reverse
 */
export async function reverseFailedWithdrawal(journalId: string): Promise<ReverseResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/failed-withdrawals/${journalId}/reverse`, {
      method: 'POST',
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
    throw new Error(error.message || 'Erro ao estornar PIX');
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Formatar valor monetário
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
export function getTenantName(tenant: { slug: string; name: string } | string): string {
  if (typeof tenant === 'string') {
    return tenant === 'otc' ? 'OTC' : tenant === 'tcr' ? 'TCR' : tenant.toUpperCase();
  }
  return tenant.name || tenant.slug.toUpperCase();
}

