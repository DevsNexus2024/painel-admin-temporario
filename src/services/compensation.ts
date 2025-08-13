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
  private static readonly API_URL = `${import.meta.env.VITE_DIAGNOSTICO_API_URL}/compensa_depositos_movimentacoes`;
  private static readonly AUTH_HEADER = import.meta.env.VITE_ADMIN_TOKEN;

  /**
   * Criar compensação de depósito
   * @param data Dados da compensação
   * @returns Promise com resposta da API
   */
  static async createCompensation(data: CompensationData): Promise<CompensationResponse> {
    try {


      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xPassRouteTCR': this.AUTH_HEADER
        },
        body: JSON.stringify(data)
      });

      const responseData: CompensationResponse = await response.json();

      if (!response.ok) {

        throw new Error(responseData.erro || responseData.mensagem || 'Erro desconhecido');
      }


      return responseData;

    } catch (error) {

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
        toast.error('Dados inválidos', {
          description: validation.errors.join(', ')
        });
        return false;
      }

      // Criar compensação
      const response = await CompensationService.createCompensation(data);
      
      toast.success('Compensação processada!', {
        description: `ID Movimentação: ${response.response?.id_movimentacao}`
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao processar compensação', {
        description: message
      });
      return false;
    }
  };

  return { createCompensation };
};