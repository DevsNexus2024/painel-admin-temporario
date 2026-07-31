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

// ✅ NOVO: Interface atualizada conforme documentação COMPENSACAO_MANUAL_CENTRALIZADA.md
export interface CompensacaoBRBTCRequest {
  valor_deposito: number;
  id_usuario: number;
  id_transacao: string; // ⚠️ OBRIGATÓRIO: EndToEndId do PIX (usado para idempotência)
  data_hora_deposito: string; // ISO 8601 format
  nome_depositante: string;
  provider: string;
  documento_depositante?: string; // Opcional: CPF/CNPJ do depositante (11-14 caracteres)
  observacoes?: string; // Opcional
}

// ✅ NOVO: Interface de resposta atualizada conforme documentação
export interface CompensacaoBRBTCResponse {
  sucesso: boolean;
  mensagem: string;
  dados?: {
    id_compensacao?: number;
    transfer_id?: string;
    usuario_email?: string;
    valor_compensado?: number;
    provider?: string;
    data_compensacao?: string;
    reprocessamento?: boolean;
    deposito?: {
      criado: boolean;
      atualizado: boolean;
      id: number;
    };
    movimentacao?: {
      criada: boolean;
      atualizada: boolean;
      id_movimentacao: number;
      id_transacao: number;
    };
    admin_executor?: {
      nome: string;
      email: string;
    };
  };
  erro?: string;
}

// ============================== CONFIGURAÇÃO ==============================

// ✅ RESTAURADO: Rota e autenticação originais
const BRBTC_API_CONFIG = {
  baseUrl: 'https://vps80270.cloudpublic.com.br:8081',
  endpoint: '/BRBTC/compensacao-manual' // Rota original
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
  
  // ✅ Função atualizada para reconhecer TODOS os formatos (igual ao modal)
  const textoParaPesquisar = extractRecord.descCliente || '';
  
  if (textoParaPesquisar) {
    // 1. ✅ NOVO: Padrão "Usuario 1122;" (busca automática por endtoend TCR)
    const matchUsuario = textoParaPesquisar.match(/Usuario\s+(\d+)/i);
    if (matchUsuario) {
      return parseInt(matchUsuario[1], 10);
    }
    
    // 2. ✅ ANTIGO: Padrão "caas436344xU1122;" (formato original BMP-531)
    const matchXU = textoParaPesquisar.match(/xU(\d+)/i);
    if (matchXU) {
      return parseInt(matchXU[1], 10);
    }
  }
  
  // 3. Fallback: Tentar extrair da descrição da operação
  if (extractRecord.descricaoOperacao) {
    const matchOp = extractRecord.descricaoOperacao.match(/Usuario\s+(\d+)|xU(\d+)|U(\d+)/i);
    if (matchOp) {
      // Pegar o primeiro grupo que não é undefined
      const id = matchOp[1] || matchOp[2] || matchOp[3];
      if (id) return parseInt(id, 10);
    }
  }
  
  // 4. Último fallback: busca geral
  const allText = [
    extractRecord.client,
    extractRecord.descCliente,
    extractRecord.descricaoOperacao
  ].filter(Boolean).join(' ');
  
  if (allText) {
    const match = allText.match(/(?:usuario|user)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  
  return 0;
};

/**
 * 🏷️ Determinar o provider baseado nos dados do extrato
 */
export const determinarProvider = (extractRecord: MovimentoExtrato): string => {
  if (!extractRecord) return 'unknown';

  // Provider explícito vence a heurística — obrigatório pra NTX, cujo externalId
  // (caas436344xU{id}) colidiria com o check do BMP-531 abaixo
  if (extractRecord._providerCompensacao) {
    return extractRecord._providerCompensacao;
  }

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
 * 🔍 Extrair EndToEnd do registro do extrato
 * 
 * Tenta obter o endtoend de várias fontes possíveis:
 * - Dados originais da API (idEndToEnd, endToEndId, identificadorOperacao, etc)
 * - Dados Bitso específicos (metadados.end_to_end_id)
 * - Campo code (que geralmente contém o endToEndId)
 * 
 * ⚠️ IMPORTANTE: Para BMP-531, o endtoend geralmente está em identificadorOperacao
 */
export const extrairEndToEnd = (extractRecord: MovimentoExtrato): string => {
  // 1. Tentar extrair dos dados originais da API (múltiplos campos possíveis)
  const endtoendOriginal = extractRecord._original?.idEndToEnd || 
                          extractRecord._original?.endToEndId ||
                          extractRecord._original?.e2eId ||
                          extractRecord._original?.endtoend ||
                          extractRecord._original?.end_to_end_id ||
                          extractRecord._original?.identificadorOperacao || // ✅ BMP-531: campo principal
                          extractRecord._original?.EndToEndId ||
                          extractRecord._original?.codigoTransacao; // Fallback BMP-531
  
  if (endtoendOriginal) {
    return endtoendOriginal;
  }
  
  // 2. Para Bitso: tentar dos metadados
  if (extractRecord.bitsoData?.metadados?.end_to_end_id) {
    return extractRecord.bitsoData.metadados.end_to_end_id;
  }
  
  // 3. Fallback: usar o code (que geralmente é mapeado do endToEndId)
  if (extractRecord.code) {
    return extractRecord.code;
  }
  
  // 4. Último fallback: usar o id
  return extractRecord.id;
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
  const endtoend = extrairEndToEnd(extractRecord);
  
  // Converter data para ISO 8601
  const dataHoraDeposito = new Date(extractRecord.dateTime).toISOString();
  
  // ✅ NOVO: Incluir documento_depositante se disponível
  const documentoDepositante = extractRecord.document?.replace(/\D/g, '') || undefined;
  
  return {
    valor_deposito: Math.abs(extractRecord.value), // Sempre valor positivo
    id_usuario: idUsuario,
    id_transacao: endtoend, // ⚠️ OBRIGATÓRIO: EndToEndId para idempotência
    data_hora_deposito: dataHoraDeposito,
    nome_depositante: extractRecord.client || 'Não informado',
    provider: provider,
    documento_depositante: documentoDepositante && documentoDepositante.length >= 11 && documentoDepositante.length <= 14 
      ? documentoDepositante 
      : undefined,
    observacoes: observacoes || undefined
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

    // ✅ NOVO: Validar que temos o id_transacao (endToEndId) obrigatório
    const endtoend = extrairEndToEnd(extractRecord);
    if (!endtoend || endtoend === extractRecord.id) {
      throw new Error('EndToEndId (id_transacao) é obrigatório para compensação manual. Não foi possível extrair do registro.');
    }
    
    // Obter token JWT do usuário logado
    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }
    
    // Preparar dados da requisição
    const requestData = converterParaBRBTCRequest(extractRecord, observacoes);
    
    // ✅ RESTAURADO: Autenticação e rota originais
    const url = `${BRBTC_API_CONFIG.baseUrl}${BRBTC_API_CONFIG.endpoint}`;
    
    // Fazer requisição para API BRBTC (autenticação original)
    const response = await fetch(url, {
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
      
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      responseData = { error: `Resposta inválida da API: ${responseText}` };
    }
    
    if (!response.ok) {
      // ✅ NOVO: Tratamento de erros conforme documentação (erros 409 para conflitos)
      let errorMessage = 'Erro desconhecido na API';
      
      if (responseData) {
        // Verificar formato de resposta do novo endpoint
        errorMessage = responseData.mensagem || 
                     responseData.erro || 
                     responseData.error || 
                     responseData.message || 
                     responseData.msg || 
                     responseData.detail || 
                     responseData.details ||
                     `Erro HTTP ${response.status}: ${response.statusText}`;
        
        // Se ainda não encontrou uma mensagem específica, tentar extrair de arrays de erros
        if (!errorMessage && responseData.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.map((err: any) => 
            typeof err === 'string' ? err : err.message || err.msg || JSON.stringify(err)
          ).join('; ');
        }
      }
      
      // ✅ NOVO: Tratamento específico para erros 409 (conflitos)
      if (response.status === 409) {
        // Erros 409 indicam que já foi processado ou não pode ser processado
        throw new Error(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
    
    // ✅ NOVO: Verificar resposta do novo formato
    const responseFormatted = responseData as CompensacaoBRBTCResponse;
    
    if (!responseFormatted.sucesso) {
      throw new Error(responseFormatted.mensagem || 'Compensação não foi bem-sucedida');
    }
    
    // ✅ NOVO: Toast de sucesso mais informativo com detalhes da resposta
    const depositoInfo = responseFormatted.dados?.deposito;
    const movimentacaoInfo = responseFormatted.dados?.movimentacao;
    
    let description = `Valor: R$ ${requestData.valor_deposito.toFixed(2)} | Usuário: ${requestData.id_usuario}`;
    if (depositoInfo?.criado) {
      description += ` | Depósito criado (ID: ${depositoInfo.id})`;
    } else if (depositoInfo?.atualizado) {
      description += ` | Depósito atualizado (ID: ${depositoInfo.id})`;
    }
    if (movimentacaoInfo?.criada) {
      description += ` | Movimentação criada`;
    } else if (movimentacaoInfo?.atualizada) {
      description += ` | Movimentação atualizada`;
    }
    
    toast.success('Compensação realizada com sucesso!', {
      description,
      duration: 5000
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
