/**
 * 🔴 Serviço de PIX Falhados - Auditoria e Retry
 * API para gerenciar operações PIX que falharam
 */
import { fetchWithTotp } from '@/services/totpBridge';

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export enum PixOperationStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export enum PixOperationType {
  TRANSFER_CREATE = 'TRANSFER_CREATE',
  CONFIRM = 'CONFIRM',
  QR_CODE = 'QR_CODE',
  SEND = 'SEND',
  RECEIVE = 'RECEIVE',
}

export interface PixFailure {
  id: string;
  provider: string;
  operationType: PixOperationType | string;
  operationStatus: PixOperationStatus | string;
  endpoint: string;
  httpMethod: string;
  pixValue: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  endToEndId: string | null;
  providerTransactionId: string | null;
  referenceId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestPayload: Record<string, any> | null;
  responsePayload: Record<string, any> | null;
  retry_count: number | null;
  retry_blocked: boolean | null;
  retry_blocked_reason: string | null;
  retried_at: string | null;
  createdAt: string;
  updatedAt: string | null;
  _retryInfo: {
    canRetry: boolean;
    retriesRemaining: number;
    isBlocked: boolean;
    blockReason: string | null;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
  tags?: {
    flow?: string;
    [key: string]: any;
  };
}

export interface PixFailureDetails extends PixFailure {
  retryInfo: {
    canRetry: boolean;
    reason: string | null;
    retryCount: number;
    maxRetries: number;
    retriesRemaining: number;
    isBlocked: boolean;
    blockReason: string | null;
    retriedAt: string | null;
  };
}

export interface PixFailuresResponse {
  success: boolean;
  data: PixFailure[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    current_page: number;
    total_pages: number;
  };
  retryConfig: {
    maxRetries: number;
    retryableStatuses: string[];
  };
}

export interface PixFailureDetailsResponse {
  success: boolean;
  data: PixFailureDetails;
  retryInfo: {
    canRetry: boolean;
    reason: string | null;
    retryCount: number;
    maxRetries: number;
    retriesRemaining: number;
    isBlocked: boolean;
    blockReason: string | null;
    retriedAt: string | null;
  };
}

export interface RetryRequest {
  qr_code?: string;
  amount?: number;
  x_account_id?: string;
}

export interface RetryResponse {
  success: boolean;
  message: string;
  original_failure_id: string;
  retry_audit_id: string | null;
  new_result?: {
    pix_id: string;
    endToEndId?: string;
    status: string;
    amount: number;
    created_at: string;
  };
}

export interface RetryErrorResponse {
  success: false;
  message: string;
  reason?: string;
  auditId?: string;
  retry_count?: number;
  max_retries?: number;
  error?: any;
}

export interface ListFailuresParams {
  startDate?: string;
  endDate?: string;
  operationType?: string;
  errorCode?: string;
  onlyRetryable?: boolean;
  limit?: number;
  offset?: number;
}

// ===================================
// SERVICE CLASS
// ===================================

class PixAuditService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Lista falhas de PIX
   */
  async listFailures(params: ListFailuresParams = {}): Promise<PixFailuresResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.operationType) queryParams.append('operationType', params.operationType);
      if (params.errorCode) queryParams.append('errorCode', params.errorCode);
      if (params.onlyRetryable !== undefined) queryParams.append('onlyRetryable', String(params.onlyRetryable));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.offset !== undefined) queryParams.append('offset', String(params.offset));

      const url = `${API_BASE_URL}/api/brasilcash/audit/failures${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[PIX-AUDIT] Erro ao listar falhas:', error);
      throw new Error(error.message || 'Erro ao listar falhas de PIX');
    }
  }

  /**
   * Busca detalhes de uma falha específica
   */
  async getFailureDetails(id: string): Promise<PixFailureDetailsResponse> {
    try {
      const url = `${API_BASE_URL}/api/brasilcash/audit/failures/${id}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Falha não encontrada: ${id}`);
        }
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[PIX-AUDIT] Erro ao buscar detalhes da falha:', error);
      throw new Error(error.message || 'Erro ao buscar detalhes da falha');
    }
  }

  /**
   * Refaz uma operação falhada
   */
  async retryFailure(id: string, retryData?: RetryRequest): Promise<RetryResponse> {
    try {
      const url = `${API_BASE_URL}/api/brasilcash/audit/failures/${id}/retry`;

      // [TOTP] Reprocessar PIX falhado (BrasilCash, provider ativo) move dinheiro → pode
      // exigir TOTP. fetchWithTotp é pass-through fora do 403-TOTP, então é seguro mesmo
      // se a rota ainda não estiver guardada.
      const response = await fetchWithTotp(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(retryData || {}),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.reason || data.message || 'Erro ao refazer operação');
      }

      return data;
    } catch (error: any) {
      console.error('[PIX-AUDIT] Erro ao refazer operação:', error);
      throw new Error(error.message || 'Erro ao refazer operação');
    }
  }
}

export const pixAuditService = new PixAuditService();

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Formata valor monetário para exibição em reais (BRL)
 * O pixValue já vem em reais do backend (ex: "108.6" = R$ 108,60)
 * Não precisa converter de centavos - apenas formata o valor
 */
export function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return 'N/A';
  
  // Converte string para número - o valor já está em reais
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return 'N/A';
  
  // Formata diretamente - backend já retorna em reais
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Formata data para exibição
 */
export function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Retorna mensagem de erro amigável
 */
export function getRetryErrorMessage(error: any): string {
  const reason = error.response?.data?.reason || error.response?.data?.message || error.message;

  if (reason?.includes('Já existe um registro SUCCESS')) {
    return 'Esta operação já foi processada com sucesso anteriormente.';
  }

  if (reason?.includes('Limite de retries atingido')) {
    return 'Limite de tentativas de retry atingido (3 tentativas). Entre em contato com o suporte.';
  }

  if (reason?.includes('QR Code é necessário')) {
    return 'É necessário fornecer o QR Code para refazer esta operação.';
  }

  if (reason?.includes('Status') && reason?.includes('não permite retry')) {
    return 'Esta operação não pode ser retentada devido ao seu status atual.';
  }

  return reason || 'Erro ao refazer operação. Tente novamente mais tarde.';
}

/**
 * Retorna o tipo de operação formatado
 */
export function getOperationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TRANSFER_CREATE: 'Transferência',
    CONFIRM: 'Confirmação',
    QR_CODE: 'QR Code',
    SEND: 'Envio',
    RECEIVE: 'Recebimento',
  };
  return labels[type] || type;
}

/**
 * Retorna o status formatado
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SUCCESS: 'Sucesso',
    FAILED: 'Falhou',
    PENDING: 'Pendente',
    TIMEOUT: 'Timeout',
    CANCELLED: 'Cancelado',
  };
  return labels[status] || status;
}

