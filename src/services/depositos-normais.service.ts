/**
 * 💰 Serviço de Monitoramento de Depósitos Normais
 * API para gerenciar depósitos normais (não-lote) travados do novo fluxo tcr-baas
 */

const API_BASE_URL = 'https://vps80270.cloudpublic.com.br:8081';

// ===================================
// TYPES
// ===================================

export interface DepositoNormal {
  id: number;
  id_usuario: number;
  quantia: number;
  step: string;
  status_deposito: 'processing' | 'finished' | 'error';
  situacao: 
    | 'aguardando_geracao_qr_code' 
    | 'aguardando_webhook_brasil_bitcoin'
    | 'pixout_aguardando_bolsao'
    | 'bolsao_sem_transferencia_interna'
    | 'aguardando_transferencia_interna_caas'
    | 'transferencia_ok_status_pendente'
    | 'deposito_finalizado_movimentacao_pendente'
    | 'aguardando_finalizacao'
    | 'finalizado';
  precisa_reprocessar: boolean;
  pix_operationId: string | null;
  pix_transactionId: string | null;
  pix_payment_endtoend: string | null;
  pix_transaction_id_brbtc?: string | null; // ID do depósito na Brasil Bitcoin (webhook de confirmação)
  id_deposito_caas_tcr?: string | null; // ID da transferência interna CaaS (TransferId) - indica que transferência interna FOI EXECUTADA
  id_internal_b8cash?: string | null; // EndToEnd do PIX-OUT (pagamento do QR Code) - indica que QR Code FOI PAGO
  movimentacao_id?: number | null;
  movimentacao_status_id?: number | null;
  movimentacao_status?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface DepositoNormalDetalhes extends DepositoNormal {
  acao_reprocessamento: 
    | 'gerar_qr_code_e_pagar' 
    | 'verificar_webhook_pendente'
    | 'executar_transferencia_interna_caas';
  pix_from_name?: string;
  pix_from_userDocument?: string;
  pix_to_key?: string;
  pix_identifier?: string;
  pix_timestamp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovimentacaoDeposito {
  id: number;
  quantia: number;
  status: string;
  moeda: string;
  created_at: string;
  updated_at: string;
}

export interface TransacaoDeposito {
  id: number;
  id_movimentacao: number;
  id_externo_bb: number | null;
  tipo_transacao_bb: string;
  quantia_bruta: number;
  quantia_liquida: number;
  hash: string;
  status: string;
}

export interface WebhookPayload {
  provider: string;
  eventType: string;
  status: string;
  endToEndId: string;
  amount: number;
  tcrUserId: string;
  pixKey: string;
  payer: {
    name: string;
    document: string;
  };
}

export interface ListaDepositosNormaisParams {
  id_usuario?: number;
  status?: 'processing' | 'error';
  step?: '01newdeposit' | '02internal_transfer_b8cash' | '03bolsao_deposit' | '04internal_transfer_caas';
  limit?: number;
  offset?: number;
}

export interface ListaDepositosNormaisResponse {
  success: boolean;
  mensagem: string;
  total: number;
  limit: number;
  offset: number;
  depositos: DepositoNormal[];
}

export interface DetalhesDepositoNormalResponse {
  success: boolean;
  mensagem: string;
  deposito: DepositoNormalDetalhes;
  movimentacao: MovimentacaoDeposito | null;
  transacao: TransacaoDeposito | null;
  webhook_payload?: WebhookPayload;
}

export interface ReprocessarDepositoNormalResponse {
  success: boolean;
  mensagem: string;
  deposito_id: number;
  depositoId: number;
  status_deposito_anterior?: string;
  step_anterior?: string;
  status_deposito_atual?: string;
  step_atual?: string;
  id_deposito_caas_tcr?: string | null; // NOVO - ID da transferência interna executada
  movimentacao_status_anterior?: string;
  movimentacao_status_atual?: string;
  acao_realizada?: 
    | 'finalizacao_status_step'
    | 'confirmacao_movimentacao'
    | 'transferencia_interna_e_finalizacao'
    | 'reprocessamento_completo';
}

// ===================================
// SERVICE CLASS
// ===================================

class DepositosNormaisService {
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
   * Lista depósitos normais travados com filtros opcionais
   */
  async listarDepositosNormais(params: ListaDepositosNormaisParams = {}): Promise<ListaDepositosNormaisResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.id_usuario) queryParams.append('id_usuario', String(params.id_usuario));
      if (params.status) queryParams.append('status', params.status);
      if (params.step) queryParams.append('step', params.step);
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.offset !== undefined) queryParams.append('offset', String(params.offset));

      const url = `${API_BASE_URL}/api/tcr-baas/depositos-normais${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
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
      console.error('[DEPOSITOS-NORMAIS] Erro ao listar depósitos normais:', error);
      throw new Error(error.message || 'Erro ao listar depósitos normais');
    }
  }

  /**
   * Obtém detalhes completos de um depósito normal específico
   */
  async obterDetalhes(depositoId: number): Promise<DetalhesDepositoNormalResponse> {
    try {
      const url = `${API_BASE_URL}/api/tcr-baas/depositos-normais/${depositoId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Depósito não encontrado: ${depositoId}`);
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
      console.error('[DEPOSITOS-NORMAIS] Erro ao obter detalhes do depósito:', error);
      throw new Error(error.message || 'Erro ao obter detalhes do depósito');
    }
  }

  /**
   * Reprocessa um depósito normal travado
   */
  async reprocessarDeposito(depositoId: number): Promise<ReprocessarDepositoNormalResponse> {
    try {
      const url = `${API_BASE_URL}/api/tcr-baas/depositos-normais/${depositoId}/reprocessar`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.mensagem || data.erro || 'Erro ao reprocessar depósito');
      }

      return data;
    } catch (error: any) {
      console.error('[DEPOSITOS-NORMAIS] Erro ao reprocessar depósito:', error);
      throw new Error(error.message || 'Erro ao reprocessar depósito');
    }
  }
}

export const depositosNormaisService = new DepositosNormaisService();

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
 * Retorna label da situação
 */
export function getSituacaoLabel(situacao: string): string {
  const labels: Record<string, string> = {
    aguardando_geracao_qr_code: 'Aguardando Geração QR Code',
    aguardando_webhook_brasil_bitcoin: 'Aguardando Webhook Brasil Bitcoin',
    pixout_aguardando_bolsao: 'PIX-OUT Aguardando Bolsão',
    bolsao_sem_transferencia_interna: 'Bolsão Sem Transferência Interna',
    aguardando_transferencia_interna_caas: 'Aguardando Transferência Interna CaaS',
    transferencia_ok_status_pendente: 'Transferência OK - Status Pendente',
    deposito_finalizado_movimentacao_pendente: 'Depósito Finalizado - Movimentação Pendente',
    aguardando_finalizacao: 'Aguardando Finalização',
    finalizado: 'Finalizado',
  };
  return labels[situacao] || situacao;
}

/**
 * Retorna label do step
 */
export function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    '01newdeposit': 'Novo Depósito',
    '02internal_transfer_b8cash': 'Transferência Interna B8Cash',
    '03bolsao_deposit': 'Bolsão Deposit',
    '04internal_transfer_caas': 'Transferência Interna CaaS',
  };
  return labels[step] || step;
}

/**
 * Retorna cor do badge baseado no status
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    processing: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    finished: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    error: 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

/**
 * Retorna cor do badge baseado na situação
 */
export function getSituacaoColor(situacao: string): string {
  const colors: Record<string, string> = {
    aguardando_geracao_qr_code: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    aguardando_webhook_brasil_bitcoin: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    pixout_aguardando_bolsao: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    bolsao_sem_transferencia_interna: 'bg-red-500/20 text-red-400 border-red-500/50',
    aguardando_transferencia_interna_caas: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    transferencia_ok_status_pendente: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    deposito_finalizado_movimentacao_pendente: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    aguardando_finalizacao: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    finalizado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  };
  return colors[situacao] || 'bg-muted text-muted-foreground';
}

/**
 * Retorna indicadores visuais do estado do depósito
 */
export function getDepositoIndicadores(deposito: DepositoNormal) {
  const indicadores = [];
  
  if (deposito.id_internal_b8cash) {
    indicadores.push({
      label: 'QR Pago',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      icon: '✓',
    });
  }
  
  if (deposito.pix_transaction_id_brbtc) {
    indicadores.push({
      label: 'No Bolsão',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      icon: '✓',
    });
  }
  
  if (deposito.id_deposito_caas_tcr) {
    indicadores.push({
      label: 'Creditado',
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      icon: '✓',
    });
  }
  
  // Caso crítico: dinheiro no bolsão mas sem transferência interna
  if (deposito.pix_transaction_id_brbtc && !deposito.id_deposito_caas_tcr) {
    indicadores.push({
      label: '⚠️ Ação Necessária',
      color: 'bg-red-500/20 text-red-400 border-red-500/50',
      icon: '⚠️',
    });
  }
  
  return indicadores;
}
