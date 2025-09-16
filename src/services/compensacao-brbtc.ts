/**
 * 🏦 Serviço de Compensação Manual BRBTC
 * 
 * Este serviço integra com a API externa BRBTC para compensação de depósitos
 * conforme especificação do usuário.
 * 
 * Endpoint: https://vps80270.cloudpublic.com.br:8081/BRBTC/compensacao-manual
 */

import React from "react";
import { toast } from "sonner";
import { MovimentoExtrato } from "@/services/extrato";
import { TOKEN_STORAGE } from "@/config/api";

// ============================== INTERFACES ==============================

export interface CompensacaoBRBTCRequest {
  valor_deposito: number;
  id_usuario: number;
  id_transacao: string;
  data_hora_deposito: string; // ISO 8601 format
  nome_depositante: string;
  provider: string;
  observacoes: string | null;
}

export interface CompensacaoBRBTCResponse {
  success: boolean;
  message?: string;
  data?: {
    transaction_id?: string;
    status?: string;
    processed_at?: string;
  };
  error?: string;
}

// ============================== CONFIGURAÇÃO ==============================

const BRBTC_API_CONFIG = {
  baseUrl: 'https://vps80270.cloudpublic.com.br:8081',
  endpoint: '/BRBTC/compensacao-manual'
};

// ============================== UTILITÁRIOS ==============================

/**
 * 🎯 Extrair ID do usuário da descrição do cliente
 * 
 * Padrões suportados:
 * - caas436344xU1122; (BMP-531)
 * - Usuario 1948; (outros formatos)
 * - Deposito TCR - Usuario 1122;
 */
export const extrairIdUsuario = (extractRecord: MovimentoExtrato): number => {
  if (!extractRecord) return 0;
  
  // 1. Tentar extrair da descrição do cliente (BMP-531)
  if (extractRecord.descCliente) {
    const match = extractRecord.descCliente.match(/xU(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  
  // 2. Tentar extrair da descrição da operação
  if (extractRecord.descricaoOperacao) {
    const match = extractRecord.descricaoOperacao.match(/U(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  
  // 3. Tentar extrair de qualquer texto relacionado ao usuário
  const allText = [
    extractRecord.client,
    extractRecord.descCliente,
    extractRecord.descricaoOperacao
  ].filter(Boolean).join(' ');
  
  if (allText) {
    const match = allText.match(/(?:usuario|user).*?(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  
  console.warn('[BRBTC] Não foi possível extrair ID do usuário:', extractRecord);
  return 0;
};

/**
 * 🏷️ Determinar o provider baseado nos dados do extrato
 */
export const determinarProvider = (extractRecord: MovimentoExtrato): string => {
  if (!extractRecord) return 'unknown';
  
  // Verificar se é Bitso
  if (extractRecord.bitsoData) {
    return 'bitso';
  }
  
  // Verificar se é BMP-531 (baseado na estrutura)
  if (extractRecord.descCliente?.includes('caas436344x')) {
    return 'bmp 531 tcr';
  }
  
  // Para BMP genérico ou outros
  return 'bmp tcr';
};

/**
 * 🔄 Converter dados do extrato para request BRBTC
 */
export const converterParaBRBTCRequest = (
  extractRecord: MovimentoExtrato,
  observacoes?: string
): CompensacaoBRBTCRequest => {
  const idUsuario = extrairIdUsuario(extractRecord);
  const provider = determinarProvider(extractRecord);
  
  // Converter data para ISO 8601
  const dataHoraDeposito = new Date(extractRecord.dateTime).toISOString();
  
  return {
    valor_deposito: Math.abs(extractRecord.value), // Sempre valor positivo
    id_usuario: idUsuario,
    id_transacao: extractRecord.id,
    data_hora_deposito: dataHoraDeposito,
    nome_depositante: extractRecord.client || 'Não informado',
    provider: provider,
    observacoes: observacoes || null
  };
};

// ============================== SERVIÇO PRINCIPAL ==============================

/**
 * 🚀 Realizar compensação manual via API BRBTC
 * 
 * @param extractRecord - Registro do extrato selecionado
 * @param observacoes - Observações opcionais
 * @returns Promise com resultado da operação
 */
export const realizarCompensacaoBRBTC = async (
  extractRecord: MovimentoExtrato,
  observacoes?: string
): Promise<boolean> => {
  try {
    // Validações básicas
    if (!extractRecord) {
      throw new Error('Registro do extrato é obrigatório');
    }
    
    const idUsuario = extrairIdUsuario(extractRecord);
    if (!idUsuario) {
      throw new Error('Não foi possível extrair o ID do usuário do registro');
    }

    // Obter token JWT do usuário logado
    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }
    
    // Preparar dados da requisição
    const requestData = converterParaBRBTCRequest(extractRecord, observacoes);
    
    console.log('[BRBTC] Enviando compensação:', {
      url: `${BRBTC_API_CONFIG.baseUrl}${BRBTC_API_CONFIG.endpoint}`,
      data: requestData
    });
    
    // Fazer requisição para API BRBTC
    const response = await fetch(`${BRBTC_API_CONFIG.baseUrl}${BRBTC_API_CONFIG.endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    let responseData: any;
    let responseText: string = '';
    
    try {
      responseText = await response.text();
      console.log('[BRBTC] Resposta bruta da API:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });
      
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('[BRBTC] Erro ao fazer parse da resposta:', parseError);
      responseData = { error: `Resposta inválida da API: ${responseText}` };
    }
    
    if (!response.ok) {
      // Tentar extrair a mensagem de erro mais específica possível
      let errorMessage = 'Erro desconhecido na API';
      
      if (responseData) {
        // Verificar diferentes formatos de erro que a API pode retornar
        errorMessage = responseData.error || 
                     responseData.message || 
                     responseData.msg || 
                     responseData.detail || 
                     responseData.details ||
                     (responseData.data && responseData.data.error) ||
                     (responseData.data && responseData.data.message);
        
        // Se ainda não encontrou uma mensagem específica, tentar extrair de arrays de erros
        if (!errorMessage && responseData.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.map((err: any) => 
            typeof err === 'string' ? err : err.message || err.msg || JSON.stringify(err)
          ).join('; ');
        }
        
        // Se ainda não encontrou, usar o status HTTP
        if (!errorMessage) {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
      }
      
      console.error('[BRBTC] Erro detalhado da API:', {
        status: response.status,
        statusText: response.statusText,
        responseData,
        extractedError: errorMessage
      });
      
      throw new Error(errorMessage);
    }
    
    // Log de sucesso
    console.log('[BRBTC] Compensação realizada com sucesso:', responseData);
    
    // Toast de sucesso
    toast.success('Compensação BRBTC realizada com sucesso!', {
      description: `Valor: R$ ${requestData.valor_deposito.toFixed(2)} | Usuário: ${requestData.id_usuario}`
    });
    
    return true;
    
  } catch (error) {
    let errorMessage = 'Erro desconhecido';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Melhorar mensagens específicas para o usuário
      if (errorMessage.includes('saldo insuficiente')) {
        errorDetails = 'Verifique o saldo disponível na conta.';
      } else if (errorMessage.includes('não autenticado') || errorMessage.includes('token')) {
        errorDetails = 'Faça login novamente.';
      } else if (errorMessage.includes('usuário não encontrado')) {
        errorDetails = 'Verifique se o ID do usuário está correto.';
      } else if (errorMessage.includes('valor inválido')) {
        errorDetails = 'Verifique se o valor da transação está correto.';
      } else if (errorMessage.includes('transação já processada')) {
        errorDetails = 'Esta compensação pode já ter sido realizada.';
      } else if (errorMessage.includes('limite')) {
        errorDetails = 'Valor pode ter excedido os limites permitidos.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorDetails = 'Verifique sua conexão com a internet.';
      } else if (errorMessage.includes('timeout')) {
        errorDetails = 'Tente novamente em alguns instantes.';
      }
    } else {
      errorMessage = String(error);
    }
    
    console.error('[BRBTC] Erro na compensação:', {
      error: errorMessage,
      errorDetails,
      fullError: error,
      extractRecord
    });
    
    // Toast de erro mais informativo
    toast.error('Erro na Compensação Saldo Real', {
      description: `${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`,
      duration: 6000 // Mais tempo para ler erros importantes
    });
    
    return false;
  }
};

// ============================== HOOK PARA USO EM COMPONENTES ==============================

/**
 * 🔧 Hook para facilitar o uso da compensação BRBTC em componentes
 */
export const useCompensacaoBRBTC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  
  const executarCompensacao = async (
    extractRecord: MovimentoExtrato,
    observacoes?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const resultado = await realizarCompensacaoBRBTC(extractRecord, observacoes);
      return resultado;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    executarCompensacao,
    isLoading
  };
};

// ============================== VALIDAÇÕES ==============================

/**
 * ✅ Validar se um registro do extrato é elegível para compensação BRBTC
 */
export const validarElegibilidadeBRBTC = (extractRecord: MovimentoExtrato): {
  elegivel: boolean;
  motivos: string[];
} => {
  const motivos: string[] = [];
  
  if (!extractRecord) {
    motivos.push('Registro do extrato não fornecido');
    return { elegivel: false, motivos };
  }
  
  // Verificar se é crédito (depósito)
  if (extractRecord.type !== 'CRÉDITO') {
    motivos.push('Apenas registros de crédito (depósitos) são elegíveis');
  }
  
  // Verificar se tem valor positivo
  if (extractRecord.value <= 0) {
    motivos.push('Valor deve ser positivo');
  }
  
  // Verificar se consegue extrair ID do usuário
  const idUsuario = extrairIdUsuario(extractRecord);
  if (!idUsuario) {
    motivos.push('Não foi possível identificar o ID do usuário no registro');
  }
  
  // Verificar se tem dados mínimos
  if (!extractRecord.id) {
    motivos.push('ID da transação não encontrado');
  }
  
  return {
    elegivel: motivos.length === 0,
    motivos
  };
};
