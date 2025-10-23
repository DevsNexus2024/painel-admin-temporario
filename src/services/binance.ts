/**
 * 🪙 Binance Service
 * Serviço centralizado para todas as APIs da Binance
 * 
 * ✅ Seguindo o padrão CORPX/BMP531
 * ✅ Usando o mesmo endpoint base que o sistema usa para CORPX
 */

import { API_CONFIG, TOKEN_STORAGE } from '@/config/api';
import { logger } from '@/utils/logger';
import type {
  BinanceQuoteRequest,
  BinanceQuoteResponse,
  BinanceExecuteTradeRequest,
  BinanceTradeResponse,
  BinanceOrderStatusResponse,
  BinanceTradeHistoryResponse,
  BinanceWithdrawalRequest,
  BinanceWithdrawalResponse,
  BinanceWithdrawalHistoryResponse,
  BinanceWithdrawalAddressesResponse,
  BinanceDepositAddressesResponse,
  BinanceDepositHistoryResponse,
  BinanceSpotBalancesResponse,
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
    
    // 💸 WITHDRAWAL
    saldos: '/api/binance/withdrawal/saldos',
    historicoSaques: '/api/binance/withdrawal/historico',
    criarSaque: '/api/binance/withdrawal/criar',
    statusSaque: '/api/binance/withdrawal/status', // GET /api/binance/withdrawal/status/:withdrawId
    enderecosSaque: '/api/binance/withdrawal/enderecos',
    enderecosDeposito: '/api/binance/withdrawal/enderecos-deposito',
    historicoDepositos: '/api/binance/withdrawal/historico-depositos',
  }
} as const;

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
    
  } catch (error) {
    logger.error('[BINANCE-QUOTE] Erro ao calcular cotação:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-TRADE] Erro ao executar trade:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-ORDER-STATUS] Erro ao consultar status:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-ORDER-CANCEL] Erro ao cancelar ordem:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-TRADE-HISTORY] Erro ao consultar histórico:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-BALANCES] Erro ao consultar saldos:', error);
    return null;
  }
}

/**
 * 📜 Histórico de Saques
 * Endpoint: GET /api/binance/withdrawal/historico
 */
export async function consultarHistoricoSaquesBinance(coin?: string, status?: number): Promise<BinanceWithdrawalHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-WITHDRAWAL-HISTORY] Consultando histórico de saques...', { coin, status });
    
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
    
  } catch (error) {
    logger.error('[BINANCE-WITHDRAWAL-HISTORY] Erro ao consultar histórico de saques:', error);
    return null;
  }
}

/**
 * 💸 Criar Saque
 * Endpoint: POST /api/binance/withdrawal/criar
 */
export async function criarSaqueBinance(dados: BinanceWithdrawalRequest): Promise<BinanceWithdrawalResponse | null> {
  try {
    logger.debug('[BINANCE-WITHDRAWAL] Criando saque...', dados);
    
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
    
    const requestUrl = `${API_CONFIG.BASE_URL}${BINANCE_CONFIG.endpoints.criarSaque}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
    };
    
    logger.debug('[BINANCE-WITHDRAWAL] Request URL:', requestUrl);
    
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(dados)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[BINANCE-WITHDRAWAL] Erro HTTP:', { status: response.status, error: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    logger.debug('[BINANCE-WITHDRAWAL] Resposta recebida:', responseData);
    
    return responseData as BinanceWithdrawalResponse;
    
  } catch (error) {
    logger.error('[BINANCE-WITHDRAWAL] Erro ao criar saque:', error);
    return null;
  }
}

/**
 * 📍 Endereços de Saque Salvos
 * Endpoint: GET /api/binance/withdrawal/enderecos
 */
export async function listarEnderecosSaqueBinance(): Promise<BinanceWithdrawalAddressesResponse | null> {
  try {
    logger.debug('[BINANCE-ADDRESSES] Listando endereços de saque...');
    
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
    
  } catch (error) {
    logger.error('[BINANCE-ADDRESSES] Erro ao listar endereços:', error);
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
    
  } catch (error) {
    logger.error('[BINANCE-DEPOSIT-ADDRESSES] Erro ao listar endereços de depósito:', error);
    return null;
  }
}

/**
 * 📜 Histórico de Depósitos
 * Endpoint: GET /api/binance/withdrawal/historico-depositos
 */
export async function consultarHistoricoDepositosBinance(coin?: string, status?: number): Promise<BinanceDepositHistoryResponse | null> {
  try {
    logger.debug('[BINANCE-DEPOSIT-HISTORY] Consultando histórico de depósitos...', { coin, status });
    
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
    
  } catch (error) {
    logger.error('[BINANCE-DEPOSIT-HISTORY] Erro ao consultar histórico de depósitos:', error);
    return null;
  }
}

