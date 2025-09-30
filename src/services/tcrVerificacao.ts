/**
 * 🔍 Serviço de Verificação TCR - Busca de Usuários por EndToEnd
 * 
 * Responsável por:
 * - Buscar usuário por endtoend na API de diagnóstico  
 * - Fornecer funcionalidades de verificação específicas para TCR
 * - Integrar com as funcionalidades de duplicatas
 */

import { PUBLIC_ENV } from "@/config/env";

// ==================== INTERFACES ====================

export interface BuscarUsuarioPorEndToEndRequest {
  endtoend: string;
}

export interface BuscarUsuarioPorEndToEndResponse {
  sucesso: boolean;
  mensagem?: string;
  message?: string;
  dados?: {
    id_usuario: number;
    endtoend_consultado?: string;
  };
  id_usuario?: number; // Mantido para compatibilidade
  usuario?: {
    id: number;
    nome?: string;
    email?: string;
    documento?: string;
  };
  erro?: string;
}

export interface VerificacaoTCRResult {
  encontrou: boolean;
  id_usuario?: number;
  usuario?: {
    id: number;
    nome?: string;
    email?: string;
    documento?: string;
  };
  erro?: string;
}

// ==================== CONFIGURAÇÃO ====================

const TCR_VERIFICACAO_CONFIG = {
  baseUrl: PUBLIC_ENV.DIAGNOSTICO_API_URL,
  endpoints: {
    buscarUsuarioPorEndToEnd: '/brbtc/buscar-usuario-por-endtoend'
  },
  timeout: 15000 // 15 segundos
} as const;

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Obter headers de autenticação
 */
function getAuthHeaders() {
  const token = localStorage.getItem('jwt_token') || sessionStorage.getItem('jwt_token');
  
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Validar endtoend
 */
function validarEndToEnd(endtoend: string): boolean {
  if (!endtoend || typeof endtoend !== 'string') {
    return false;
  }
  
  // EndToEnd geralmente tem pelo menos 10 caracteres
  const endtoendLimpo = endtoend.trim();
  return endtoendLimpo.length >= 10;
}

/**
 * Fazer requisição HTTP com tratamento de erro
 */
async function makeRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${TCR_VERIFICACAO_CONFIG.baseUrl}${endpoint}`;
  
  const headers = getAuthHeaders();
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(TCR_VERIFICACAO_CONFIG.timeout)
  };
  
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    
    return data;
    
  } catch (error) {
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: A requisição demorou muito para responder');
      }
      throw error;
    }
    
    throw new Error('Erro desconhecido na requisição');
  }
}

// ==================== SERVIÇOS PRINCIPAIS ====================

/**
 * 🔍 Buscar usuário por endtoend
 * 
 * @param endtoend - EndToEnd da transação PIX
 * @returns Dados do usuário encontrado ou erro
 */
export async function buscarUsuarioPorEndToEnd(
  endtoend: string
): Promise<BuscarUsuarioPorEndToEndResponse> {
  
  // Validar entrada
  if (!validarEndToEnd(endtoend)) {
    const erro = 'EndToEnd inválido ou muito curto';
    return {
      sucesso: false,
      erro
    };
  }
  
  try {
    const request: BuscarUsuarioPorEndToEndRequest = {
      endtoend: endtoend.trim()
    };
    
    // Fazer requisição GET para a API (passando endtoend como query parameter)
    const queryParams = new URLSearchParams({
      endtoend: request.endtoend
    });
    
    const response = await makeRequest<BuscarUsuarioPorEndToEndResponse>(
      `${TCR_VERIFICACAO_CONFIG.endpoints.buscarUsuarioPorEndToEnd}?${queryParams}`,
      {
        method: 'GET'
        // GET não pode ter body
      }
    );
    
    // ✅ CORRETO: Verificar se encontrou usuário (dados estão dentro de response.dados)
    if (response.sucesso && response.dados?.id_usuario) {
      return {
        sucesso: true,
        id_usuario: response.dados.id_usuario,
        usuario: {
          id: response.dados.id_usuario
        },
        message: response.mensagem || 'Usuário encontrado com sucesso'
      };
    }
    
    // ✅ RETORNAR MENSAGEM CLARA: Usuário não encontrado 
    const mensagemErro = response.mensagem || response.message || response.erro || 'Usuário não encontrado para este EndToEnd';
    
    return {
      sucesso: false,
      erro: mensagemErro
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // ✅ SEMPRE retornar mensagem clara para o usuário
    const mensagemParaUsuario = `Erro na busca do usuário: ${errorMessage}`;
    
    return {
      sucesso: false,
      erro: mensagemParaUsuario
    };
  }
}

/**
 * 🎯 Verificação completa de transação TCR
 * 
 * Combina busca por endtoend com fallback para entrada manual
 * 
 * @param transaction - Dados da transação
 * @returns Resultado da verificação
 */
export async function verificarTransacaoTCR(
  transaction: {
    id: string;
    code?: string;
    descCliente?: string;
    _original?: any;
  }
): Promise<VerificacaoTCRResult> {
  // Tentar extrair endtoend da transação com múltiplas estratégias
  
  let endtoend = '';
  
  // 1. Buscar nos dados originais da API (vários formatos possíveis)
  endtoend = transaction._original?.idEndToEnd || // Campo original da API CorpX
             transaction._original?.endToEndId ||  // Campo mapeado
             transaction._original?.e2eId ||       // Alias
             transaction._original?.endtoend ||
             transaction._original?.end_to_end ||
             transaction._original?.transaction_id ||
             transaction._original?.pixId ||
             transaction._original?.referenceId ||
             '';
  
  // 2. Se não encontrou, tentar extrair da descrição (endtoend às vezes vem na descrição)
  if (!endtoend && transaction.descCliente) {
    const descricao = transaction.descCliente;
    // Buscar padrão como E2E123456... ou similar na descrição
    const endtoendMatch = descricao.match(/E[0-9]+[A-Z0-9]+/i);
    if (endtoendMatch) {
      endtoend = endtoendMatch[0];
    }
  }
  
  // 3. Fallback para code ou id (pode não ser o endtoend real, mas é melhor que nada)
  if (!endtoend) {
    endtoend = transaction.code || transaction.id || '';
  }

  
  if (!endtoend) {
    const mensagemErro = 'EndToEnd não encontrado na transação. Será necessário informar o ID do usuário manualmente.';
    return {
      encontrou: false,
      erro: mensagemErro
    };
  }
  
  // Buscar usuário por endtoend
  const resultadoBusca = await buscarUsuarioPorEndToEnd(endtoend);
  
  // ✅ CORRETO: Verificar se sucesso e se tem id_usuario
  if (resultadoBusca.sucesso && resultadoBusca.id_usuario) {
    return {
      encontrou: true,
      id_usuario: resultadoBusca.id_usuario,
      usuario: resultadoBusca.usuario
    };
  }
  
  // ✅ SEMPRE mostrar mensagem clara para o usuário
  const mensagemErro = resultadoBusca.erro || 'Usuário não encontrado. Será necessário informar o ID do usuário manualmente.';
  
  return {
    encontrou: false,
    erro: mensagemErro
  };
}

// ==================== SERVIÇO EXPORTADO ====================

export const TCRVerificacaoService = {
  buscarUsuarioPorEndToEnd,
  verificarTransacaoTCR,
  validarEndToEnd,
} as const;

export default TCRVerificacaoService;
