import { toast } from "sonner";

// Interface para os dados de compensação
export interface CompensationData {
  id_usuario: number;
  quantia: number;
  id_tipo_movimentacao: number;
  id_status: number;
  id_moeda: number;
  data_movimentacao?: number;
  documento_depositante?: string;
  nome_depositante?: string;
  hash?: string;
}

// Interface para a resposta da API
export interface CompensationResponse {
  mensagem: string;
  response?: {
    id_movimentacao: number;
    id_transacao: number;
    id_usuario: number;
    quantia: number;
    data_processamento: string;
  };
  erro?: string;
}

/**
 * Serviço para consumir API de compensação de depósitos e movimentações
 */
export class CompensationService {
  private static readonly API_URL = `${import.meta.env.X_DIAGNOSTICO_API_URL}/compensa_depositos_movimentacoes`;
  private static readonly AUTH_HEADER = 'ISRVdeWTZ5jYFKJQytjH9ZylF1ZrwhTdrrdKY4uFqXm041XIL3aVjCwojSH1EeYbUOQjPx0aO';

  /**
   * Criar compensação de depósito
   * @param data Dados da compensação
   * @returns Promise com resposta da API
   */
  static async createCompensation(data: CompensationData): Promise<CompensationResponse> {
    try {
      console.log('[COMPENSATION] Enviando compensação manual:', {
        url: this.API_URL,
        data: { ...data, hash: data.hash }
      });

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xPassRouteTCR': this.AUTH_HEADER
        },
        body: JSON.stringify(data)
      });

      let responseData: any;
      let responseText: string = '';
      
      try {
        responseText = await response.text();
        console.log('[COMPENSATION] Resposta bruta da API:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[COMPENSATION] Erro ao fazer parse da resposta:', parseError);
        responseData = { erro: `Resposta inválida da API: ${responseText}` };
      }

      if (!response.ok) {
        let errorMessage = 'Erro desconhecido na API';
        
        if (responseData) {
          errorMessage = responseData.erro || 
                       responseData.mensagem || 
                       responseData.error || 
                       responseData.message || 
                       `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error('[COMPENSATION] Erro detalhado da API:', {
          status: response.status,
          responseData,
          extractedError: errorMessage
        });

        throw new Error(errorMessage);
      }

      console.log('[COMPENSATION] Compensação manual realizada com sucesso:', responseData);
      return responseData;

    } catch (error) {
      console.error('[COMPENSATION] Erro na compensação manual:', error);
      throw error;
    }
  }

  /**
   * Validar dados de compensação
   * @param data Dados para validar
   * @returns objeto com resultado da validação
   */
  static validateCompensationData(data: Partial<CompensationData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Campos obrigatórios
    if (!data.id_usuario) errors.push('ID do usuário é obrigatório');
    if (!data.quantia || data.quantia <= 0) errors.push('Quantia deve ser maior que zero');
    if (!data.id_tipo_movimentacao) errors.push('Tipo de movimentação é obrigatório');
    if (!data.id_status) errors.push('Status é obrigatório');
    if (!data.id_moeda) errors.push('Moeda é obrigatória');

    // Validações adicionais
    if (data.quantia && data.quantia > 1000000) errors.push('Quantia não pode ser maior que R$ 1.000.000,00');
    // REMOVIDO: Validação de documento do depositante (não é obrigatório)

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obter valores padrão para compensação
   * @returns dados padrão
   */
  static getDefaultValues(): Partial<CompensationData> {
    return {
      id_tipo_movimentacao: 1, // Depósito
      id_status: 1, // Processado
      id_moeda: 2, // BRL (corrigido: BRL é ID 2)
      data_movimentacao: Date.now(),
      hash: "compensacao_manual_531" // Hash fixo para identificar compensações manuais BMP-531
    };
  }
}

/**
 * Hook para facilitar o uso do serviço de compensação
 */
export const useCompensation = () => {
  const createCompensation = async (data: CompensationData): Promise<boolean> => {
    try {
      // Validar dados
      const validation = CompensationService.validateCompensationData(data);
      if (!validation.valid) {
        toast.error('Dados inválidos para compensação', {
          description: validation.errors.join(', '),
          duration: 4000
        });
        return false;
      }

      // Criar compensação
      const response = await CompensationService.createCompensation(data);
      
      // Toast de sucesso removido - será mostrado pelo componente principal
      return true;
      
    } catch (error) {
      let errorMessage = 'Erro desconhecido';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Melhorar mensagens específicas para o usuário
        if (errorMessage.includes('usuário não encontrado') || errorMessage.includes('ID do usuário')) {
          errorDetails = 'Verifique se o ID do usuário está correto.';
        } else if (errorMessage.includes('quantia') || errorMessage.includes('valor')) {
          errorDetails = 'Verifique se o valor está correto e dentro dos limites.';
        } else if (errorMessage.includes('saldo insuficiente')) {
          errorDetails = 'Saldo insuficiente na conta para processar a compensação.';
        } else if (errorMessage.includes('limite')) {
          errorDetails = 'Valor pode ter excedido os limites permitidos.';
        } else if (errorMessage.includes('duplicad') || errorMessage.includes('já processad')) {
          errorDetails = 'Esta compensação pode já ter sido realizada.';
        } else if (errorMessage.includes('autenticação') || errorMessage.includes('token')) {
          errorDetails = 'Problema de autenticação. Faça login novamente.';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          errorDetails = 'Verifique sua conexão com a internet.';
        } else if (errorMessage.includes('timeout')) {
          errorDetails = 'Tente novamente em alguns instantes.';
        }
      } else {
        errorMessage = String(error);
      }
      
      console.error('[COMPENSATION-HOOK] Erro na compensação:', {
        error: errorMessage,
        errorDetails,
        fullError: error,
        data
      });
      
      // Toast de erro mais informativo
      toast.error('Erro na Compensação Saldo Visual', {
        description: `${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`,
        duration: 6000
      });
      
      return false;
    }
  };

  return { createCompensation };
};