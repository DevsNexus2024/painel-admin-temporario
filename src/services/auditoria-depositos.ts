/**
 * 🔍 Serviço de Auditoria de Depósitos
 * API para verificar e auditar depósitos via endToEnd
 */

const API_BASE_URL = import.meta.env.X_DIAGNOSTICO_API_URL;

// ===================================
// TYPES
// ===================================

export interface AuditoriaDepositoRequest {
  endToEnd?: string;
  endToEnds?: string[];
  incluir_detalhes?: boolean;
  incluir_logs?: boolean;
  salvar_auditoria?: boolean;
}

export interface EtapaAuditoria {
  status: 'concluido' | 'pendente' | 'erro';
  timestamp?: string;
  detalhes?: Record<string, any>;
  logs?: LogAuditoria[];
  erro?: string;
}

export interface LogAuditoria {
  id: number;
  id_usuario: number;
  id_deposito: number;
  descricao_log: string;
  quantia: number;
  created_at: string;
}

export interface MovimentacaoAuditoria {
  existe: boolean;
  id_movimentacao?: number;
  id_transacao?: number;
  status?: number;
  hash?: string;
  created_at?: string;
  compensacao_visual?: boolean;
}

export interface TransferenciaCaasAuditoria {
  aplicavel: boolean;
  realizada: boolean;
  status?: string;
  via_compensacao_manual?: boolean;
  transfer_id_brbtc?: string | null;
  movimentacao_existe?: boolean;
}

export interface CompensacaoManualAuditoria {
  existe: boolean;
  status?: string;
  transfer_id_brbtc?: string | null;
  data_compensacao?: string | null;
  provider?: string;
  admin_executor?: {
    nome: string;
    email: string;
  };
  valor_deposito?: number;
  observacoes?: string;
}

export interface ResumoAuditoria {
  todas_etapas_concluidas: boolean;
  credito_finalizado: boolean;
  disponivel_para_usuario: boolean;
  etapa_atual?: string | null;
  tempo_processamento_minutos?: number;
  metodo_finalizacao?: 'fluxo_normal' | 'compensacao_manual' | 'compensacao_visual' | null;
  transferencia_caas_realizada?: boolean;
  movimentacao_criada?: boolean;
}

export interface ErroAuditoria {
  codigo: string;
  mensagem: string;
  etapa?: string;
  detalhes?: string;
  acao_sugerida?: string;
  sugestao?: string;
}

export interface AvisoAuditoria {
  codigo: string;
  mensagem: string;
  minutos_pendente?: number;
  acao_sugerida?: string;
}

export interface DadosDepositoAuditoria {
  id_deposito: number;
  id_usuario: number;
  quantia: number;
  status_deposito: string;
  step: string;
  pix_operationId?: string;
  pix_transaction_id_brbtc?: string;
  pix_movementId?: string;
  created_at: string;
  updated_at: string;
}

export interface ResultadoAuditoria {
  endToEnd: string;
  deposito_encontrado: boolean;
  id_deposito?: number;
  status_geral: 'finalizado' | 'pendente' | 'erro' | 'nao_encontrado';
  dados_deposito?: DadosDepositoAuditoria;
  etapas?: Record<string, EtapaAuditoria>;
  movimentacao?: MovimentacaoAuditoria;
  transferencia_caas?: TransferenciaCaasAuditoria;
  compensacao_manual?: CompensacaoManualAuditoria;
  resumo?: ResumoAuditoria;
  logs?: LogAuditoria[];
  erros?: ErroAuditoria[];
  avisos?: AvisoAuditoria[];
}

export interface EstatisticasAuditoria {
  total: number;
  finalizados: number;
  pendentes: number;
  com_erro: number;
  nao_encontrados: number;
}

export interface AuditoriaDepositoResponse {
  sucesso: boolean;
  mensagem: string;
  total_verificados: number;
  total_processados: number;
  resultados: ResultadoAuditoria[];
  estatisticas?: EstatisticasAuditoria;
}

// ===================================
// API FUNCTIONS
// ===================================

/**
 * Verificar um ou múltiplos depósitos
 */
export async function verificarDepositos(
  request: AuditoriaDepositoRequest
): Promise<AuditoriaDepositoResponse> {
  try {
    if (!API_BASE_URL) {
      throw new Error('X_DIAGNOSTICO_API_URL não configurada');
    }

    // Validar que pelo menos um endToEnd foi fornecido
    if (!request.endToEnd && (!request.endToEnds || request.endToEnds.length === 0)) {
      throw new Error('É necessário fornecer endToEnd ou endToEnds');
    }

    // Validar limite de 100 endToEnds
    if (request.endToEnds && request.endToEnds.length > 100) {
      throw new Error('Máximo de 100 endToEnds por requisição');
    }

    const url = `${API_BASE_URL}/api/depositos/auditoria/verificar`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endToEnd: request.endToEnd,
        endToEnds: request.endToEnds,
        incluir_detalhes: request.incluir_detalhes ?? true,
        incluir_logs: request.incluir_logs ?? false,
        salvar_auditoria: request.salvar_auditoria ?? true,
      }),
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

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[AUDITORIA-DEPOSITOS] Erro ao verificar depósitos:', error);
    throw new Error(error.message || 'Erro ao verificar depósitos');
  }
}

/**
 * Verificar depósito via GET (método alternativo)
 */
export async function verificarDepositoGET(
  endToEnd: string,
  options?: {
    incluir_detalhes?: boolean;
    incluir_logs?: boolean;
    salvar_auditoria?: boolean;
  }
): Promise<AuditoriaDepositoResponse> {
  try {
    if (!API_BASE_URL) {
      throw new Error('X_DIAGNOSTICO_API_URL não configurada');
    }

    const params = new URLSearchParams();
    if (options?.incluir_detalhes !== undefined) {
      params.append('incluir_detalhes', String(options.incluir_detalhes));
    }
    if (options?.incluir_logs !== undefined) {
      params.append('incluir_logs', String(options.incluir_logs));
    }
    if (options?.salvar_auditoria !== undefined) {
      params.append('salvar_auditoria', String(options.salvar_auditoria));
    }

    const url = `${API_BASE_URL}/api/depositos/auditoria/verificar/${endToEnd}${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {},
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

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[AUDITORIA-DEPOSITOS] Erro ao verificar depósito via GET:', error);
    throw new Error(error.message || 'Erro ao verificar depósito');
  }
}

