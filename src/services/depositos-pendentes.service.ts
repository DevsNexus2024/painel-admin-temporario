/**
 * Servico de Depositos Pendentes — Compensacao Manual em Lote
 * API: GET /api/depositos-pendentes/listar + POST /api/depositos-pendentes/compensar-batch
 */

const API_BASE_URL = 'https://vps80270.cloudpublic.com.br:8081';

// ===================================
// TYPES
// ===================================

export interface DepositoPendente {
  id_movimentacao: number;
  id_usuario: number;
  valor_deposito: string;
  id_transacao: string;
  data_hora_deposito: string;
  nome_depositante: string | null;
  documento_depositante: string | null;
  provider_sugerido: string;
  deposito_id: number | null;
  batch_id: string | null;
  ja_tem_transferencia_interna: boolean;
  ja_tem_compensacao_concluida: boolean;
}

export interface ListarPendentesParams {
  id_usuario?: number;
  data_inicio?: string;
  data_fim?: string;
  page?: number;
  limit?: number;
  incluir_total?: boolean;
}

export interface ListarPendentesResponse {
  sucesso: boolean;
  total: number | null;
  total_valor: string | null;
  page: number;
  limit: number;
  dados: DepositoPendente[];
}

export interface CompensarItemRequest {
  id_transacao: string;
  provider?: string;
  observacoes?: string;
}

export interface CompensarBatchRequest {
  itens: CompensarItemRequest[];
}

export interface ResultadoCompensacaoConcluido {
  id_transacao: string;
  status: 'concluido';
  id_compensacao: number;
  transfer_id: string | null;
  transferencia_interna_executada: boolean;
  mensagem: string;
}

export interface ResultadoCompensacaoFalha {
  id_transacao: string;
  status: 'falha';
  erro: string;
  http_status: number;
}

export type ResultadoCompensacao = ResultadoCompensacaoConcluido | ResultadoCompensacaoFalha;

export interface CompensarBatchResponse {
  sucesso: boolean;
  total: number;
  concluidos: number;
  falhas: number;
  resultados: ResultadoCompensacao[];
}

// ===================================
// SERVICE CLASS
// ===================================

class DepositosPendentesService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async listarPendentes(params: ListarPendentesParams = {}): Promise<ListarPendentesResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params.id_usuario) queryParams.append('id_usuario', String(params.id_usuario));
      if (params.data_inicio) queryParams.append('data_inicio', params.data_inicio);
      if (params.data_fim) queryParams.append('data_fim', params.data_fim);
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.incluir_total !== undefined) queryParams.append('incluir_total', String(params.incluir_total));

      const qs = queryParams.toString();
      const url = `${API_BASE_URL}/api/depositos-pendentes/listar${qs ? `?${qs}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.mensagem || errorData.erro || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[DEPOSITOS-PENDENTES] Erro ao listar:', error);
      throw new Error(error.message || 'Erro ao listar depositos pendentes');
    }
  }

  async compensarBatch(itens: CompensarItemRequest[]): Promise<CompensarBatchResponse> {
    try {
      const url = `${API_BASE_URL}/api/depositos-pendentes/compensar-batch`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ itens }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.mensagem || errorData.erro || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[DEPOSITOS-PENDENTES] Erro ao compensar batch:', error);
      throw new Error(error.message || 'Erro ao compensar depositos');
    }
  }
}

export const depositosPendentesService = new DepositosPendentesService();

// ===================================
// UTILITY FUNCTIONS
// ===================================

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

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

export function formatDocumento(doc: string | null): string {
  if (!doc) return '-';
  if (doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}
