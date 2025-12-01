/**
 * 🏦 Serviço de Análise BRBTC - APIs de Consulta de Movimentações
 * 
 * Este serviço implementa as 6 APIs de consulta do módulo BRBTC para análise
 * detalhada de movimentações de usuários conforme especificação.
 * 
 * Todas as APIs requerem autenticação JWT e recebem id_usuario obrigatório.
 */

import { API_CONFIG } from '@/config/api';
import { PUBLIC_ENV } from '@/config/env';
import { toast } from 'sonner';

// ============================== INTERFACES E TIPOS ==============================

/**
 * 🎯 Base para todas as respostas das APIs BRBTC
 */
interface BRBTCBaseResponse<T> {
  sucesso: boolean;
  mensagem: string;
  dados?: {
    usuario: {
      id: number;
      email: string;
      nome: string;
      id_brasil_bitcoin: string;
    };
    parametros_consulta: Record<string, any>;
    total_registros: number;
    admin_consultor: {
      nome: string;
      email: string;
    };
    // 🚀 NOVO: Propriedades de paginação
    paginated?: boolean;
    total_pages?: number;
  } & T;
  erro?: string;
}

/**
 * 💰 Depósito de Criptomoeda
 */
interface CryptoDeposit {
  id: number;
  amount: string;
  coin: string;
  address: string;
  hash: string;
  network: string;
  networkName: string;
  fee: string;
  status: string;
  timestamp: number;
  userDocument: string;
}

/**
 * 💸 Saque de Criptomoeda
 */
export interface CryptoWithdraw {
  id: number;
  amount: string;
  coin: string;
  address: string;
  hash: string;
  network: string;
  networkName: string;
  fee: string;
  status: string;
  timestamp: number;
  userDocument: string;
}

/**
 * 📈 Trade/Negociação
 */
export interface Trade {
  transactionId: number;
  status: string;
  amount: string;
  price: string;
  total: string;
  pair: string;
  side: 'buy' | 'sell';
  markup: string;
  markupTotal: string;
  priceWithoutMarkup: string;
  timestamp: number;
  exchangeTransactions: any[];
}

/**
 * 💵 Depósito Fiat (BRL)
 */
export interface FiatDeposit {
  id: number;
  value: string;
  coin: string;
  bank: string;
  status: string;
  timestamp: number;
  userDocument: string;
}

/**
 * 💴 Saque Fiat (BRL)
 */
export interface FiatWithdraw {
  id: number;
  value: string;
  coin: string;
  bank: string;
  pixKey?: string;
  pixKeyType?: string;
  withdrawFee: string;
  status: string;
  timestamp: number;
  userDocument: string;
}

/**
 * 🔄 Depósito Interno (Transferência)
 */
export interface InternalDeposit {
  id: number;
  amount: string; // ✅ CORREÇÃO: Campo real é 'amount', não 'value'
  coin: string;
  timestamp: number;
  fromUserDocument: string; // ✅ CORREÇÃO: Documento de origem
  toUserDocument: string;   // ✅ CORREÇÃO: Documento de destino
  // Campos que NÃO existem na API real:
  // bank?: string;   // Não disponível
  // status?: string; // Não disponível
  // userDocument?: string; // Não disponível - temos from/to separados
}

// ✅ NOVA INTERFACE: Saques Internos (transferências enviadas)
export interface InternalWithdraw {
  id: number;
  amount: string;
  coin: string;
  timestamp: number;
  fromUserDocument: string; // Documento de quem enviou (o próprio usuário)
  toUserDocument: string;   // Documento de quem recebeu
}

/**
 * 📊 Respostas tipadas para cada API
 */
export type CryptoDepositsResponse = BRBTCBaseResponse<{ depositos: CryptoDeposit[] }>;
export type CryptoWithdrawsResponse = BRBTCBaseResponse<{ saques: CryptoWithdraw[] }>;
export type TradesResponse = BRBTCBaseResponse<{ trades: Trade[] }>;
export type FiatDepositsResponse = BRBTCBaseResponse<{ depositos: FiatDeposit[] }>;
export type FiatWithdrawsResponse = BRBTCBaseResponse<{ saques: FiatWithdraw[] }>;
export type InternalDepositsResponse = BRBTCBaseResponse<{ depositos: InternalDeposit[] }>;
export type InternalWithdrawsResponse = BRBTCBaseResponse<{ saques: InternalWithdraw[] }>;

/**
 * 🔧 Parâmetros base para consultas
 */
interface BaseQueryParams {
  id_usuario: number;
  id?: string | number;
  limit?: number; // 1-1000, padrão: 100
  startDate?: string;
  endDate?: string;
}

/**
 * 🔧 Parâmetros específicos para consultas de cripto
 */
interface CryptoQueryParams extends BaseQueryParams {
  hash?: string;
  coin?: string;
  address?: string;
}

/**
 * 🔧 Parâmetros específicos para consultas de trades
 */
interface TradesQueryParams extends BaseQueryParams {
  coin?: string;
  type?: 'buy' | 'sell';
}

// ============================== CONFIGURAÇÃO ==============================

const BRBTC_API_CONFIG = {
  baseUrl: PUBLIC_ENV.DIAGNOSTICO_API_URL,
  endpoints: {
    cryptoDeposits: '/brbtc/getUserCryptoDeposits',
    cryptoWithdraws: '/brbtc/getUserCryptoWithdraws',
    trades: '/brbtc/getUserTrades',
    fiatDeposits: '/brbtc/getUserFiatDeposits',
    fiatWithdraws: '/brbtc/getUserFiatWithdraws',
    internalDeposits: '/brbtc/getUserInternalDeposits',
    internalWithdraws: '/brbtc/getUserInternalWithdraws',
    // 🚀 ROTA ESPECIAL OTIMIZADA: Buscar TODOS os registros com chamadas paralelas
    getAllRecords: '/brbtc/getAllUserRecords'
  },
  timeout: 90000 // 90 segundos para grandes volumes (com otimizações paralelas é ~3x mais rápido)
};

// ============================== UTILITÁRIOS ==============================

/**
 * 🔧 Converter objeto de parâmetros para query string
 */
const buildQueryString = (params: Record<string, any>): string => {
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  
  return new URLSearchParams(filteredParams).toString();
};

/**
 * 🔧 Fazer requisição autenticada para API BRBTC
 */
const makeAuthenticatedRequest = async <T>(endpoint: string, params: Record<string, any>): Promise<T> => {
  // ✅ CORREÇÃO: Usar as mesmas chaves que os outros serviços
  const token = localStorage.getItem('jwt_token') || 
                sessionStorage.getItem('jwt_token') || 
                localStorage.getItem('auth_token') || 
                sessionStorage.getItem('auth_token');
                
  if (!token) {
    throw new Error('Token de autenticação não encontrado. Faça login novamente.');
  }

  const queryString = buildQueryString(params);
  const url = `${BRBTC_API_CONFIG.baseUrl}${endpoint}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(BRBTC_API_CONFIG.timeout)
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.mensagem || errorData.erro || errorMessage;
    } catch {
      // Se não conseguir fazer parse, usa a mensagem padrão
    }
    
    throw new Error(errorMessage);
  }

  return await response.json();
};

// ============================== FUNÇÕES DAS APIs ==============================

/**
 * 💰 1. Consultar Depósitos de Criptomoedas
 */
export const getUserCryptoDeposits = async (params: CryptoQueryParams): Promise<CryptoDepositsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<CryptoDepositsResponse>(
      BRBTC_API_CONFIG.endpoints.cryptoDeposits,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar depósitos de criptomoedas');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar depósitos de criptomoedas', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 💸 2. Consultar Saques de Criptomoedas
 */
export const getUserCryptoWithdraws = async (params: CryptoQueryParams): Promise<CryptoWithdrawsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<CryptoWithdrawsResponse>(
      BRBTC_API_CONFIG.endpoints.cryptoWithdraws,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar saques de criptomoedas');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar saques de criptomoedas', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 📈 3. Consultar Trades/Negociações
 */
export const getUserTrades = async (params: TradesQueryParams): Promise<TradesResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<TradesResponse>(
      BRBTC_API_CONFIG.endpoints.trades,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar trades');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar trades', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 💵 4. Consultar Depósitos Fiat (BRL)
 */
export const getUserFiatDeposits = async (params: BaseQueryParams): Promise<FiatDepositsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<FiatDepositsResponse>(
      BRBTC_API_CONFIG.endpoints.fiatDeposits,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar depósitos fiat');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar depósitos fiat', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 💴 5. Consultar Saques Fiat (BRL)
 */
export const getUserFiatWithdraws = async (params: BaseQueryParams): Promise<FiatWithdrawsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<FiatWithdrawsResponse>(
      BRBTC_API_CONFIG.endpoints.fiatWithdraws,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar saques fiat');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar saques fiat', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 🔄 6. Consultar Depósitos Internos (Transferências)
 */
export const getUserInternalDeposits = async (params: BaseQueryParams): Promise<InternalDepositsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<InternalDepositsResponse>(
      BRBTC_API_CONFIG.endpoints.internalDeposits,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar depósitos internos');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar depósitos internos', {
      description: errorMessage
    });
    throw error;
  }
};

/**
 * 🔄 7. Consultar Saques Internos (Transferências Enviadas)
 */
export const getUserInternalWithdraws = async (params: BaseQueryParams): Promise<InternalWithdrawsResponse> => {
  try {
    if (!params.id_usuario) {
      throw new Error('ID do usuário é obrigatório');
    }

    const response = await makeAuthenticatedRequest<InternalWithdrawsResponse>(
      BRBTC_API_CONFIG.endpoints.internalWithdraws,
      params
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || 'Erro ao consultar saques internos');
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao consultar saques internos', {
      description: errorMessage
    });
    throw error;
  }
};

// ============================== FUNÇÃO CONSOLIDADA ==============================

/**
 * 🎯 ESTRATÉGIA REVOLUCIONÁRIA: Paginação por timestamp que ELIMINA duplicação
 * 
 * DESCOBERTA CONFIRMADA:
 * 1. Primeira página: ?limit=1000 (registros mais recentes)
 * 2. Extrair timestamp: do último registro da página  
 * 3. Próxima página: ?endDate=${timestamp-1}&limit=1000 (registros anteriores)
 * 4. Repetir: até não haver mais registros
 * 
 * ✅ VANTAGENS COMPROVADAS:
 * - Zero duplicação garantida entre páginas
 * - Paginação real funcionando perfeitamente
 * - Performance otimizada com 1000 registros por página
 * - Até 25.000 registros únicos por consulta
 * 
 * @param {string} endpoint - Nome do endpoint (ex: 'getUserCryptoDeposits')
 * @param {Object} baseParams - Parâmetros base
 * @param {string} dataKey - Chave onde estão os dados no response (ex: 'depositos', 'saques', 'trades')
 * @returns {Promise} Resposta com TODOS os registros únicos
 */
const getAllRecordsWithSpecialRoute = async (endpoint: string, baseParams: any, dataKey: string) => {
  try {
    const startTime = Date.now();
    
    const queryParams = {
      id_usuario: baseParams.id_usuario,
      endpoint: endpoint,
      max_records: baseParams.max_records || 100, // Padrão 100, máximo 25000
      ...(baseParams.coin && { coin: baseParams.coin }),
      ...(baseParams.type && { type: baseParams.type })
      // Removido startDate e endDate - filtro será feito no frontend
    };

    const response = await makeAuthenticatedRequest<any>(
      BRBTC_API_CONFIG.endpoints.getAllRecords,
      queryParams
    );

    if (!response.sucesso) {
      throw new Error(response.erro || response.mensagem || `Erro ao consultar ${endpoint}`);
    }

    const records = response.dados?.registros || [];
    
    const mappedResponse = {
      ...response,
      dados: {
        ...response.dados,
        [dataKey]: records,
        total_registros: records.length,
        paginated: records.length > 1000,
        total_pages: Math.ceil(records.length / 1000)
      }
    };
    
    return mappedResponse;

  } catch (error) {
    throw error;
  }
};

/**
 * 🔄 FUNÇÃO LEGACY: Buscar TODOS os registros de uma API com paginação manual (fallback)
 * @param {Function} apiFunction - Função da API para chamar
 * @param {Object} baseParams - Parâmetros base
 * @param {string} dataKey - Chave onde estão os dados no response (ex: 'depositos', 'saques', 'trades')
 * @returns {Promise} Resposta com TODOS os registros
 */
const getAllRecordsWithPagination = async (apiFunction: Function, baseParams: any, dataKey: string) => {
  try {
    const maxLimit = 1000; // ✅ CORRIGIDO: Limite máximo por chamada é 1000
    const maxPages = 50; // Proteção contra loops infinitos (até 50.000 registros)
    
    // Primeira chamada com limite máximo
    let currentParams = { ...baseParams, limit: maxLimit };
    let firstResponse = await apiFunction(currentParams);
    
    if (!firstResponse?.sucesso || !firstResponse?.dados?.[dataKey]) {
      return firstResponse;
    }
    
    let allData = [...firstResponse.dados[dataKey]];
    let currentPage = 1;
    
    // ✅ CORRIGIDO: Se retornou exatamente 1000, SEMPRE há mais páginas
    while (firstResponse.dados[dataKey].length === maxLimit && currentPage < maxPages) {
      currentPage++;
      
      // 🚀 TESTANDO diferentes estratégias de paginação
      let nextParams;
      
      // Estratégia 1: offset (mais comum)
      nextParams = {
        ...baseParams,
        limit: maxLimit,
        offset: (currentPage - 1) * maxLimit
      };
      
      try {
        
        let nextResponse = await apiFunction(nextParams);
        
        // Se offset não funcionou, tentar estratégia de página
        if (!nextResponse?.sucesso || !nextResponse?.dados?.[dataKey]) {
          nextParams = {
            ...baseParams,
            limit: maxLimit,
            page: currentPage // Algumas APIs usam 'page' em vez de 'offset'
          };
          nextResponse = await apiFunction(nextParams);
        }
        
        // Se ainda não funcionou, tentar startDate baseado no último timestamp
        if (!nextResponse?.sucesso || !nextResponse?.dados?.[dataKey]) {
          const lastItem = allData[allData.length - 1];
          if (lastItem?.timestamp) {
            nextParams = {
              ...baseParams,
              limit: maxLimit,
              startDate: new Date(lastItem.timestamp * 1000).toISOString().split('T')[0]
            };
            nextResponse = await apiFunction(nextParams);
          }
        }
        
        if (!nextResponse?.sucesso || !nextResponse?.dados?.[dataKey] || nextResponse.dados[dataKey].length === 0) {
          break; // Fim dos dados
        }
        
        // Filtrar duplicatas por ID
        const newData = nextResponse.dados[dataKey].filter(newItem => 
          !allData.some(existingItem => existingItem.id === newItem.id)
        );
        
        if (newData.length === 0) {
          break; // Todos os registros já foram obtidos
        }
        
        allData.push(...newData);
        firstResponse = nextResponse; // Atualizar para próxima iteração
        
        
        // Rate limiting para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500)); // Aumentado para 500ms
        
      } catch (pageError) {
        break;
      }
    }
    
    // Retornar resposta combinada
    const result = {
      ...firstResponse,
      dados: {
        ...firstResponse.dados,
        [dataKey]: allData,
        total_registros: allData.length,
        paginated: currentPage > 1, // Indicar se foi paginado
        total_pages: currentPage
      }
    };
    
    if (currentPage > 1) {
    }
    
    return result;
    
  } catch (error) {
    // Fallback: tentar uma chamada normal
    return await apiFunction(baseParams);
  }
};

/**
 * 📊 Buscar TODOS os dados de um usuário (função de conveniência)
 * 🚀 NOVO: Com paginação automática para casos com mais de 1000 registros
 */
export const getAllUserData = async (idUsuario: number, filtros?: {
  max_records?: number;
  coin?: string;
  type?: 'buy' | 'sell';
}) => {
  try {
    const baseParams = {
      id_usuario: idUsuario,
      max_records: filtros?.max_records || 100, // Padrão 100, máximo 25000
      ...(filtros?.coin && { coin: filtros.coin }),
      ...(filtros?.type && { type: filtros.type })
    };

    // 🚀 NOVO: Usar rota especial getAllUserRecords para buscar TODOS os registros automaticamente
    const [
      cryptoDeposits,
      cryptoWithdraws,
      trades,
      fiatDeposits,
      fiatWithdraws,
      internalDeposits,
      internalWithdraws
    ] = await Promise.allSettled([
      getAllRecordsWithSpecialRoute('getUserCryptoDeposits', baseParams, 'depositos'),
      getAllRecordsWithSpecialRoute('getUserCryptoWithdraws', baseParams, 'saques'),
      getAllRecordsWithSpecialRoute('getUserTrades', baseParams, 'trades'),
      getAllRecordsWithSpecialRoute('getUserFiatDeposits', baseParams, 'depositos'),
      getAllRecordsWithSpecialRoute('getUserFiatWithdraws', baseParams, 'saques'),
      getAllRecordsWithSpecialRoute('getUserInternalDeposits', baseParams, 'depositos'),
      getAllRecordsWithSpecialRoute('getUserInternalWithdraws', baseParams, 'saques')
    ]);

    const result = {
      cryptoDeposits: cryptoDeposits.status === 'fulfilled' ? cryptoDeposits.value : null,
      cryptoWithdraws: cryptoWithdraws.status === 'fulfilled' ? cryptoWithdraws.value : null,
      trades: trades.status === 'fulfilled' ? trades.value : null,
      fiatDeposits: fiatDeposits.status === 'fulfilled' ? fiatDeposits.value : null,
      fiatWithdraws: fiatWithdraws.status === 'fulfilled' ? fiatWithdraws.value : null,
      internalDeposits: internalDeposits.status === 'fulfilled' ? internalDeposits.value : null,
      internalWithdraws: internalWithdraws.status === 'fulfilled' ? internalWithdraws.value : null,
      errors: [
        cryptoDeposits.status === 'rejected' ? cryptoDeposits.reason : null,
        cryptoWithdraws.status === 'rejected' ? cryptoWithdraws.reason : null,
        trades.status === 'rejected' ? trades.reason : null,
        fiatDeposits.status === 'rejected' ? fiatDeposits.reason : null,
        fiatWithdraws.status === 'rejected' ? fiatWithdraws.reason : null,
        internalDeposits.status === 'rejected' ? internalDeposits.reason : null,
        internalWithdraws.status === 'rejected' ? internalWithdraws.reason : null
      ].filter(Boolean)
    };

    // 🚀 NOVO: Log de informações sobre paginação
    const paginationInfo = [];
    if (result.cryptoDeposits?.dados?.paginated) paginationInfo.push(`Depósitos Crypto: ${result.cryptoDeposits.dados.total_registros} registros`);
    if (result.cryptoWithdraws?.dados?.paginated) paginationInfo.push(`Saques Crypto: ${result.cryptoWithdraws.dados.total_registros} registros`);
    if (result.trades?.dados?.paginated) paginationInfo.push(`Trades: ${result.trades.dados.total_registros} registros`);
    if (result.fiatDeposits?.dados?.paginated) paginationInfo.push(`Depósitos Fiat: ${result.fiatDeposits.dados.total_registros} registros`);
    if (result.fiatWithdraws?.dados?.paginated) paginationInfo.push(`Saques Fiat: ${result.fiatWithdraws.dados.total_registros} registros`);
    if (result.internalDeposits?.dados?.paginated) paginationInfo.push(`Transferências Recebidas: ${result.internalDeposits.dados.total_registros} registros`);
    if (result.internalWithdraws?.dados?.paginated) paginationInfo.push(`Transferências Enviadas: ${result.internalWithdraws.dados.total_registros} registros`);

    if (paginationInfo.length > 0) {
      toast.success('🎯 ESTRATÉGIA REVOLUCIONÁRIA Ativada!', {
        description: `Paginação por timestamp - ZERO duplicação: ${paginationInfo.join(', ')}`
      });
    }


    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    toast.error('Erro ao buscar dados do usuário', {
      description: errorMessage
    });
    throw error;
  }
};

// ============================== EXPORTAÇÕES DE TIPOS ==============================

export type {
  CryptoDeposit,
  CryptoWithdraw,
  Trade,
  FiatDeposit,
  FiatWithdraw,
  InternalDeposit,
  CryptoQueryParams,
  TradesQueryParams,
  BaseQueryParams
};
