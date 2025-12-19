/**
 * 📦 Serviço de Monitoramento e Reprocessamento de Lotes
 * API para gerenciar depósitos processados em lote (batch)
 */

const API_BASE_URL = 'https://vps80270.cloudpublic.com.br:8081';

// ===================================
// TYPES
// ===================================

export interface ItemRecebido {
  sequenceNumber: number;
  value: number;
  customId: string;
  confirmedAt: string;
}

export interface Lote {
  id: number;
  id_usuario: number;
  batch_id: number;
  batch_identifier: string;
  total_items: number;
  items_received: number;
  items_pendentes: number;
  total_amount: number;
  items_confirmed_amount: number;
  diferenca: number;
  progresso_percentual: number;
  status_progresso: 'pendente' | 'em_andamento' | 'completo';
  step: string;
  status_deposito: 'processing' | 'finished' | 'error';
  pix_operationId: string | null;
  criado_em: string;
  precisa_reprocessar: boolean;
}

export interface LoteDetalhes extends Lote {
  items_received_history: ItemRecebido[];
  quantia: number;
  pix_transactionId: string | null;
  pix_movementId: string | null;
  createdAt: string;
  is_completo: boolean;
  valor_esperado: number;
  valor_confirmado: number;
  proximo_item: number | null;
}

export interface Movimentacao {
  id: number;
  quantia: number;
  status: string;
  moeda: string;
  created_at: string;
  updated_at: string;
}

export interface Transacao {
  id: number;
  id_movimentacao: number;
  id_externo_bb: number | null;
  tipo_transacao_bb: string;
  quantia_bruta: number;
  quantia_liquida: number;
  hash: string;
  status: string;
}

export interface ListaLotesParams {
  id_usuario?: number;
  status?: 'processing' | 'finished' | 'error';
  step?: string;
  progresso?: 'pendente' | 'em_andamento' | 'completo';
  limit?: number;
  offset?: number;
}

export interface ListaLotesResponse {
  success: boolean;
  mensagem: string;
  total: number;
  limit: number;
  offset: number;
  lotes: Lote[];
}

export interface DetalhesLoteResponse {
  success: boolean;
  mensagem: string;
  deposito: LoteDetalhes;
  movimentacao: Movimentacao | null;
  transacoes: Transacao[];
  historico_itens: ItemRecebido[];
}

export interface ReprocessarLoteResponse {
  success: boolean;
  mensagem: string;
  deposito_id: number;
  item_processado: number | null;
  total_items: number;
  items_received: number;
  proximo_item: number | null;
}

// ===================================
// SERVICE CLASS
// ===================================

class LotesService {
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

  /**
   * Lista lotes com filtros opcionais
   */
  async listarLotes(params: ListaLotesParams = {}): Promise<ListaLotesResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.id_usuario) queryParams.append('id_usuario', String(params.id_usuario));
      if (params.status) queryParams.append('status', params.status);
      if (params.step) queryParams.append('step', params.step);
      if (params.progresso) queryParams.append('progresso', params.progresso);
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.offset !== undefined) queryParams.append('offset', String(params.offset));

      const url = `${API_BASE_URL}/api/tcr-baas/lotes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
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
      console.error('[LOTES] Erro ao listar lotes:', error);
      throw new Error(error.message || 'Erro ao listar lotes');
    }
  }

  /**
   * Obtém detalhes completos de um lote específico
   */
  async obterDetalhes(depositoId: number): Promise<DetalhesLoteResponse> {
    try {
      const url = `${API_BASE_URL}/api/tcr-baas/lotes/${depositoId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Lote não encontrado: ${depositoId}`);
        }
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
      console.error('[LOTES] Erro ao obter detalhes do lote:', error);
      throw new Error(error.message || 'Erro ao obter detalhes do lote');
    }
  }

  /**
   * Reprocessa um lote pendente
   */
  async reprocessarLote(depositoId: number): Promise<ReprocessarLoteResponse> {
    try {
      const url = `${API_BASE_URL}/api/tcr-baas/lotes/${depositoId}/reprocessar`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.mensagem || data.erro || 'Erro ao reprocessar lote');
      }

      return data;
    } catch (error: any) {
      console.error('[LOTES] Erro ao reprocessar lote:', error);
      throw new Error(error.message || 'Erro ao reprocessar lote');
    }
  }
}

export const lotesService = new LotesService();

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Formata valor monetário para exibição em reais (BRL)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
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
 * Retorna label do status do depósito
 */
export function getStatusDepositoLabel(status: string): string {
  const labels: Record<string, string> = {
    processing: 'Processando',
    finished: 'Finalizado',
    error: 'Erro',
  };
  return labels[status] || status;
}

/**
 * Retorna label do status de progresso
 */
export function getStatusProgressoLabel(status: string): string {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    completo: 'Completo',
  };
  return labels[status] || status;
}

/**
 * Retorna cor do badge baseado no status
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    processing: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    finished: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    error: 'bg-red-500/20 text-red-400 border-red-500/50',
    pendente: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    em_andamento: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    completo: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}


