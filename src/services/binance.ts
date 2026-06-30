/**
 * 🪙 Binance Service
 * Serviço centralizado para todas as APIs da Binance
 * 
 * ✅ Seguindo o padrão CORPX/BMP531
 * ✅ Usando o mesmo endpoint base que o sistema usa para CORPX
 */

import { API_CONFIG, TOKEN_STORAGE } from '@/config/api';
import { logger } from '@/utils/logger';
import { fetchWithTotp } from '@/services/totpBridge';
import type {
  BinanceQuoteRequest,
  BinanceQuoteResponse,
  BinanceExecuteTradeRequest,
  BinanceTradeResponse,
  BinanceOrderStatusResponse,
  BinanceTradeHistoryResponse,
  BinanceOrderHistoryResponse,
  BinanceSecureWithdrawalRequest,
  BinanceSecureWithdrawalResponse,
  BinanceForwardStatusResponse,
  BinanceForwardStatusData,
  BinanceForwardStatus,
  BinanceWithdrawalHistoryResponse,
  BinanceWithdrawalAddressesResponse,
  BinanceDepositAddressesResponse,
  BinanceDepositHistoryResponse,
  BinanceSpotBalancesResponse,
  BinanceNetworkFeeResponse,
} from '@/types/binance';

// ==================== CONFIGURAÇÕES ====================

const BINANCE_CONFIG = {
  endpoints: {
    // 💰 TRADING
    cotacao: '/api/binance/trade/cotacao',
    executarTrade: '/api/binance/trade/executar',
    statusOrdem: '/api/binance/trade/ordem', // GET /api/binance/trade/ordem/:orderId
    cancelarOrdem: '/api/binance/trade/ordem', // DELETE /api/binance/trade/ordem/:orderId
    historicoTrades: '/api/binance/trade/historico',
    historicoOrdens: '/api/binance/trade/ordens', // GET /api/binance/trade/ordens
    
    // 💸 WITHDRAWAL
    saldos: '/api/binance/withdrawal/saldos',
    historicoSaques: '/api/binance/withdrawal/historico',
    criarSaqueSeguro: '/api/binance/withdrawal/criar-seguro',
    forwardStatus: '/api/binance/withdrawal/forward-status',
    statusSaque: '/api/binance/withdrawal/status', // GET /api/binance/withdrawal/status/:withdrawId
    enderecosSaque: '/api/binance/withdrawal/enderecos',
    enderecosDeposito: '/api/binance/withdrawal/enderecos-deposito',
    historicoDepositos: '/api/binance/withdrawal/historico-depositos',
    networkFee: '/api/binance/withdrawal/network-fee',
  }
} as const;

// ==================== HELPERS DE CONFIGURAÇÃO ====================

/**
 * Valida se a configuração da API está adequada
 */
function validateApiConfiguration(): { isValid: boolean; error?: string } {
  if (!API_CONFIG.BASE_URL) {
    return {
      isValid: false,
      error: 'API_CONFIG.BASE_URL não está configurada. Verifique as variáveis de ambiente: X_API_BASE_URL, X_API_URL_DEV ou X_API_URL_PROD.'
    };
  }

  // Validar formato da URL
  try {
    new URL(API_CONFIG.BASE_URL);
  } catch (e) {
    return {
      isValid: false,
      error: `API_CONFIG.BASE_URL contém uma URL inválida: "${API_CONFIG.BASE_URL}"`
    };
  }

  return { isValid: true };
}

// ==================== HELPERS DE AUTENTICAÇÃO ====================

/**
 * Verifica se o token JWT está válido
 */
async function checkTokenStatus(): Promise<{
  isValid: boolean;
  isExpired: boolean;
  timeToExpiry: number;
  details: any;
}> {
  try {
    const token = TOKEN_STORAGE.get();
    
    if (!token) {
      return {
        isValid: false,
        isExpired: true,
        timeToExpiry: 0,
        details: { error: 'No token found' }
      };
    }
    
    // Decodificar payload do JWT
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < now;
    const timeToExpiry = payload.exp - now;
    
    return {
      isValid: !isExpired,
      isExpired,
      timeToExpiry,
      details: {
        userId: payload.sub || payload.id || payload.user_id,
        exp: payload.exp,
        iat: payload.iat,
        currentTime: now,
        tokenLength: token.length
      }
    };
  } catch (error) {
    return {
      isValid: false,
      isExpired: true,
      timeToExpiry: 0,
      details: { error: error.message }
    };
  }
}

// ==================== TRADING FUNCTIONS ====================

/**
 * 📈 Calcular Cotação
 * Endpoint: POST /api/binance/trade/cotacao
 */
export async function calcularCotacaoBinance(dados: BinanceQuoteRequest): Promise<BinanceQuoteResponse | null> {
  try {
    logger.debug('[BINANCE-QUOTE] Calculando cotação...', dados);

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.cotacao}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-QUOTE] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(dados)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-QUOTE] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-QUOTE] Resposta recebida:', responseData);
    
    return responseData as BinanceQuoteResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-QUOTE] Erro ao calcular cotação:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 🚀 Executar Trade
 * Endpoint: POST /api/binance/trade/executar
 */
export async function executarTradeBinance(dados: BinanceExecuteTradeRequest): Promise<BinanceTradeResponse | null> {
  try {
    logger.debug('[BINANCE-TRADE] Executando trade...', dados);

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.executarTrade}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-TRADE] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(dados)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-TRADE] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-TRADE] Resposta recebida:', responseData);
    
    return responseData as BinanceTradeResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-TRADE] Erro ao executar trade:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 📊 Consultar Status da Ordem
 * Endpoint: GET /api/binance/trade/ordem/:orderId
 */
export async function consultarStatusOrdemBinance(orderId: number, symbol: string = 'USDTBRL'): Promise<BinanceOrderStatusResponse | null> {
  try {
    logger.debug('[BINANCE-ORDER-STATUS] Consultando status...', { orderId, symbol });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.statusOrdem}/${orderId}?symbol=${symbol}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-ORDER-STATUS] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-ORDER-STATUS] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-ORDER-STATUS] Resposta recebida:', responseData);
    
    return responseData as BinanceOrderStatusResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-ORDER-STATUS] Erro ao consultar status:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * ❌ Cancelar Ordem
 * Endpoint: DELETE /api/binance/trade/ordem/:orderId
 */
export async function cancelarOrdemBinance(orderId: number, symbol: string = 'USDTBRL'): Promise<BinanceOrderStatusResponse | null> {
  try {
    logger.debug('[BINANCE-ORDER-CANCEL] Cancelando ordem...', { orderId, symbol });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.cancelarOrdem}/${orderId}?symbol=${symbol}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-ORDER-CANCEL] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-ORDER-CANCEL] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-ORDER-CANCEL] Resposta recebida:', responseData);
    
    return responseData as BinanceOrderStatusResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-ORDER-CANCEL] Erro ao cancelar ordem:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 📜 Histórico de Trades
 * Endpoint: GET /api/binance/trade/historico
 */
export async function consultarHistoricoTradesBinance(symbol: string = 'USDTBRL', limit: number = 500): Promise<BinanceTradeHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-TRADE-HISTORY] Consultando histórico...', { symbol, limit });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();

    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }

    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.historicoTrades}?symbol=${symbol}&limit=${limit}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };

    logger.debug('[BINANCE-TRADE-HISTORY] Request URL:', requestUrl);

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-TRADE-HISTORY] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    logger.debug('[BINANCE-TRADE-HISTORY] Resposta recebida:', responseData);

    return responseData as BinanceTradeHistoryResponse;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-TRADE-HISTORY] Erro ao consultar histórico:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 📋 Consultar Histórico de ORDENS (Novo)
 * Endpoint: GET /api/binance/trade/ordens
 * 
 * Retorna ordens completas (não execuções individuais)
 * Cada ordem pode ter múltiplas execuções
 */
export async function consultarHistoricoOrdensBinance(
  symbol: string = 'USDTBRL',
  limit: number = 500
): Promise<BinanceOrderHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-ORDER-HISTORY] Consultando histórico de ordens...', { symbol, limit });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();

    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }

    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.historicoOrdens}?symbol=${symbol}&limit=${limit}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };

    logger.debug('[BINANCE-ORDER-HISTORY] Request URL:', requestUrl);

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-ORDER-HISTORY] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    logger.debug('[BINANCE-ORDER-HISTORY] Resposta recebida:', responseData);

    return responseData as BinanceOrderHistoryResponse;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-ORDER-HISTORY] Erro ao consultar histórico de ordens:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

// ==================== WITHDRAWAL FUNCTIONS ====================

/**
 * 💰 Consultar Saldos SPOT
 * Endpoint: GET /api/binance/withdrawal/saldos
 */
export async function consultarSaldosBinance(): Promise<BinanceSpotBalancesResponse | null> {
  try {
    logger.debug('[BINANCE-BALANCES] Consultando saldos...');

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();

    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }

    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.saldos}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };

    logger.debug('[BINANCE-BALANCES] Request URL:', requestUrl);

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-BALANCES] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    logger.debug('[BINANCE-BALANCES] Resposta recebida:', responseData);

    return responseData as BinanceSpotBalancesResponse;

  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-BALANCES] Erro ao consultar saldos:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 📜 Histórico de Saques
 * Endpoint: GET /api/binance/withdrawal/historico
 */
export async function consultarHistoricoSaquesBinance(
  coin?: string, 
  status?: number,
  startTime?: number,
  endTime?: number
): Promise<BinanceWithdrawalHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-WITHDRAWAL-HISTORY] Consultando histórico de saques...', { coin, status, startTime, endTime });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (status !== undefined) params.append('status', status.toString());
    if (startTime !== undefined) params.append('startTime', startTime.toString());
    if (endTime !== undefined) params.append('endTime', endTime.toString());
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.historicoSaques}${params.toString() ? `?${params.toString()}` : ''}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-WITHDRAWAL-HISTORY] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-WITHDRAWAL-HISTORY] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-WITHDRAWAL-HISTORY] Resposta recebida:', responseData);
    
    return responseData as BinanceWithdrawalHistoryResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-WITHDRAWAL-HISTORY] Erro ao consultar histórico de saques:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 💸 Criar Saque Seguro (2 etapas: Binance → escrow TCR → cliente)
 * Endpoint: POST /api/binance/withdrawal/criar-seguro
 */
export async function criarSaqueSeguroBinance(
  dados: BinanceSecureWithdrawalRequest,
): Promise<BinanceSecureWithdrawalResponse> {
  logger.debug('[BINANCE-WITHDRAWAL-SECURE] Criando saque seguro...', {
    ...dados,
    pin: '***',
  });

  const configValidation = validateApiConfiguration();
  if (!configValidation.isValid) {
    throw new Error(configValidation.error);
  }

  const tokenStatus = await checkTokenStatus();
  if (!tokenStatus.isValid) {
    throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
  }

  const userToken = TOKEN_STORAGE.get();
  if (!userToken) {
    throw new Error('Token de autenticação não encontrado. Faça login novamente.');
  }

  const idempotencyKey = crypto.randomUUID();
  const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.criarSaqueSeguro}`;
  const { addressTag, ...bodyFields } = dados;
  const requestBody = {
    coin: bodyFields.coin,
    amount: bodyFields.amount,
    address: bodyFields.address,
    network: bodyFields.network,
    otc_client_id: bodyFields.otc_client_id,
    pin: bodyFields.pin,
    ...(bodyFields.otc_binance_config_id != null
      ? { otc_binance_config_id: bodyFields.otc_binance_config_id }
      : {}),
    ...(addressTag ? { addressTag } : {}),
  };

  const response = await fetchWithTotp(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${userToken}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let mensagem = `HTTP error! status: ${response.status}`;
    try {
      const body = await response.clone().json();
      mensagem = body?.mensagem || body?.message || body?.erro || body?.error || mensagem;
    } catch {
      /* corpo não-JSON */
    }
    logger.error('[BINANCE-WITHDRAWAL-SECURE] Erro HTTP:', { status: response.status });
    throw new Error(mensagem);
  }

  const responseData = (await response.json()) as BinanceSecureWithdrawalResponse;
  logger.debug('[BINANCE-WITHDRAWAL-SECURE] Resposta recebida:', responseData);
  return responseData;
}

/** @deprecated Alias — use criarSaqueSeguroBinance */
export const criarSaqueBinance = criarSaqueSeguroBinance;

const TERMINAL_FORWARD_STATUSES: BinanceForwardStatus[] = ['concluido', 'falhou'];

/**
 * 📡 Consultar status de repasse (etapa 2)
 * GET /api/binance/withdrawal/forward-status/:withdrawId
 */
export async function consultarForwardStatusBinance(
  withdrawId: string,
): Promise<BinanceForwardStatusResponse | null> {
  try {
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    const tokenStatus = await checkTokenStatus();
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }

    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.forwardStatus}/${encodeURIComponent(withdrawId)}`;
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-FORWARD-STATUS] Erro HTTP:', {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    return (await response.json()) as BinanceForwardStatusResponse;
  } catch (error: any) {
    logger.error('[BINANCE-FORWARD-STATUS] Erro:', error?.message || error);
    return null;
  }
}

export interface PollForwardStatusOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onUpdate?: (data: BinanceForwardStatusData) => void;
  /** Cancela o loop de polling (ex.: modal fechado / componente desmontado). */
  signal?: AbortSignal;
}

/**
 * Polling do forward_status até estado terminal (concluido / falhou).
 * Cancelável via AbortSignal — sem isso, o loop seguiria fazendo requests
 * por até maxAttempts*intervalMs mesmo após fechar a tela.
 */
export async function pollForwardStatusBinance(
  withdrawId: string,
  options: PollForwardStatusOptions = {},
): Promise<BinanceForwardStatusData | null> {
  const { intervalMs = 7000, maxAttempts = 120, onUpdate, signal } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) return null;

    const response = await consultarForwardStatusBinance(withdrawId);
    const data = response?.success ? response.data : null;

    if (data) {
      if (!signal?.aborted) onUpdate?.(data);
      if (TERMINAL_FORWARD_STATUSES.includes(data.forward_status)) {
        return data;
      }
    }

    if (signal?.aborted) return null;

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return null;
}

/**
 * 📍 Endereços de Saque Salvos
 * Endpoint: GET /api/binance/withdrawal/enderecos
 */
export async function listarEnderecosSaqueBinance(): Promise<BinanceWithdrawalAddressesResponse | null> {
  try {
    logger.debug('[BINANCE-ADDRESSES] Listando endereços de saque...');

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.enderecosSaque}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-ADDRESSES] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-ADDRESSES] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-ADDRESSES] Resposta recebida:', responseData);
    
    return responseData as BinanceWithdrawalAddressesResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-ADDRESSES] Erro ao listar endereços:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 📥 Endereços de Depósito
 * Endpoint: GET /api/binance/withdrawal/enderecos-deposito
 */
export async function listarEnderecosDepositoBinance(coin?: string, network?: string): Promise<BinanceDepositAddressesResponse | null> {
  try {
    logger.debug('[BINANCE-DEPOSIT-ADDRESSES] Listando endereços de depósito...', { coin, network });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (network) params.append('network', network);
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.enderecosDeposito}${params.toString() ? `?${params.toString()}` : ''}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-DEPOSIT-ADDRESSES] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-DEPOSIT-ADDRESSES] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-DEPOSIT-ADDRESSES] Resposta recebida:', responseData);
    
    return responseData as BinanceDepositAddressesResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-DEPOSIT-ADDRESSES] Erro ao listar endereços de depósito:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}

/**
 * 💰 Consultar Taxa de Rede para Saque
 * Endpoint: GET /api/binance/withdrawal/network-fee
 * 
 * Busca a taxa de rede para uma combinação específica de moeda e rede.
 * Se a API falhar, retorna valores fixos como fallback.
 */
export async function consultarTaxaRedeBinance(
  coin: string,
  network: string
): Promise<BinanceNetworkFeeResponse | null> {
  // Valores fixos como fallback
  const FALLBACK_FEES: Record<string, string> = {
    'TRX': '1.0',
    'MATIC': '0.013',
    'ETH': '1.5',
    'BTC': '0.0005',
  };

  try {
    logger.debug('[BINANCE-NETWORK-FEE] Consultando taxa de rede...', { coin, network });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const params = new URLSearchParams();
    params.append('coin', coin);
    params.append('network', network);
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.networkFee}?${params.toString()}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-NETWORK-FEE] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('[BINANCE-NETWORK-FEE] Erro HTTP, usando fallback:', { status: response.status, error: errorText });
      
      // Se não for erro 400/404, tentar fallback
      if (response.status !== 400 && response.status !== 404) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Para 400/404, usar fallback direto
      const fallbackFee = FALLBACK_FEES[network.toUpperCase()];
      if (!fallbackFee) {
        logger.error('[BINANCE-NETWORK-FEE] Taxa de fallback não disponível para rede:', network);
        return null;
      }
      
      logger.info('[BINANCE-NETWORK-FEE] Usando taxa de fallback:', { coin, network, fee: fallbackFee });
      
      return {
        success: true,
        message: 'Taxa de rede recuperada (fallback)',
        data: {
          coin: coin.toUpperCase(),
          network: network.toUpperCase(),
          networkName: `${network.toUpperCase()} (Fallback)`,
          withdrawFee: fallbackFee,
          withdrawMin: '1.0',
          withdrawMax: '1000000.0',
          withdrawEnable: true,
          depositEnable: true,
        },
        timestamp: new Date().toISOString(),
      } as BinanceNetworkFeeResponse;
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-NETWORK-FEE] Resposta recebida:', responseData);
    
    return responseData as BinanceNetworkFeeResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.warn('[BINANCE-NETWORK-FEE] Erro ao consultar taxa, usando fallback:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    
    // Usar fallback em caso de erro
    const fallbackFee = FALLBACK_FEES[network.toUpperCase()];
    if (!fallbackFee) {
      logger.error('[BINANCE-NETWORK-FEE] Taxa de fallback não disponível para rede:', network);
      return null;
    }
    
    logger.info('[BINANCE-NETWORK-FEE] Usando taxa de fallback devido a erro:', { coin, network, fee: fallbackFee });
    
    return {
      success: true,
      message: 'Taxa de rede recuperada (fallback)',
      data: {
        coin: coin.toUpperCase(),
        network: network.toUpperCase(),
        networkName: `${network.toUpperCase()} (Fallback)`,
        withdrawFee: fallbackFee,
        withdrawMin: '1.0',
        withdrawMax: '1000000.0',
        withdrawEnable: true,
        depositEnable: true,
      },
      timestamp: new Date().toISOString(),
    } as BinanceNetworkFeeResponse;
  }
}

/**
 * 📜 Histórico de Depósitos
 * Endpoint: GET /api/binance/withdrawal/historico-depositos
 */
export async function consultarHistoricoDepositosBinance(coin?: string, status?: number): Promise<BinanceDepositHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-DEPOSIT-HISTORY] Consultando histórico de depósitos...', { coin, status });

    // Validar configuração da API
    const configValidation = validateApiConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    // Verificar status do token
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // Obter token JWT
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const params = new URLSearchParams();
    if (coin) params.append('coin', coin);
    if (status !== undefined) params.append('status', status.toString());
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.historicoDepositos}${params.toString() ? `?${params.toString()}` : ''}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-DEPOSIT-HISTORY] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-DEPOSIT-HISTORY] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-DEPOSIT-HISTORY] Resposta recebida:', responseData);
    
    return responseData as BinanceDepositHistoryResponse;
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error('[BINANCE-DEPOSIT-HISTORY] Erro ao consultar histórico de depósitos:', {
      message: errorMessage,
      isNetworkError: error instanceof TypeError,
      type: error?.name
    });
    return null;
  }
}
