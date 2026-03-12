// services/corpx.ts - Serviço CORPX Banking
// Baseado no guia oficial de integração frontend
import type {
  CorpXSaldoResponse,
  CorpXExtratoResponse,
  CorpXExtratoParams,
  CorpXPixKeysResponse,
  CorpXCreatePixKeyRequest,
  CorpXCreatePixKeyResponse,
  CorpXEnviarOtpPixRequest, // ✅ NOVO
  CorpXEnviarOtpPixResponse, // ✅ NOVO
  CorpXDeletePixKeyRequest,
  CorpXPixTransferRequest,
  CorpXPixTransferResponse,
  CorpXPixConfirmRequest,
  CorpXPixConfirmResponse,
  CorpXQRCodeRequest,
  CorpXQRCodeResponse,
  CorpXCreateAccountRequest,
  CorpXCreateAccountResponse,
  CorpXErrorResponse,
  CorpXTransactionsParams,
  CorpXTransactionsResponse,
  CorpXSyncRequest,
  CorpXSyncResponse
} from '@/types/corpx';

// Estrutura de resposta padrão do backend CorpX
interface CorpXBackendResponse<T = any> {
  error: boolean;
  message: string;
  data?: T;
  details?: string;
}

const CORPX_CONFIG = {
  endpoints: {
    // 💰 CONTA / SALDO (CorpX v2)
    consultarSaldo: '/api/corpx-v2/balance',
    consultarExtrato: '/api/corpx/account/extrato',
    criarConta: '/api/corpx/account/criar',
    
    // 🔍 CONSULTA DE TRANSAÇÃO POR ENDTOEND
    // NOVO: GET /api/corpx-v2/pix/transactions?endToEndId= (API-CORPX-V2-TRANSACTIONS.md)
    consultarTransacaoV2: '/api/corpx-v2/pix/transactions',
    // LEGADO: POST /api/corpx/account/qtran (fallback)
    consultarTransacao: '/api/corpx/account/qtran',
    
    // 🔑 CHAVES PIX (CorpX v2)
    listarChavesPix: '/api/corpx-v2/pix/keys',
    criarChavePix: '/api/corpx-v2/pix/keys',
    enviarOtpPix: '/api/corpx/pix/chave/otp', // v1 - mantido (não existe na v2)
    cancelarChavePix: '/api/corpx-v2/pix/keys',
    
    // 💸 TRANSFERÊNCIAS PIX (rotas corretas do backend)
    criarTransferenciaPix: '/api/corpx/pix/transferencia',
    confirmarTransferenciaPix: '/api/corpx/pix/transferencia/confirmar',
    
    // 📱 QR CODE PIX (TODO: verificar se existe no backend)
    gerarQRCodePix: '/api/corpx/pix/qrcode',

    // 📊 NOVA API DE TRANSAÇÕES
    listarTransacoes: '/api/corpx/transactions',
    sincronizarExtrato: '/api/corpx/sync',
  }
} as const;

// ==================== HELPERS DE AUTENTICAÇÃO ====================

/**
 * Verifica se o token JWT está válido e não expirou
 * ✅ Debug helper para identificar problemas de autenticação
 */
async function checkTokenStatus(): Promise<{
  isValid: boolean;
  isExpired: boolean;
  timeToExpiry: number;
  details: any;
}> {
  try {
    const { TOKEN_STORAGE } = await import('@/config/api');
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

// ==================== FUNÇÕES DE API ====================

/**
 * 💰 CONTA / SALDO
 */

/**
 * Consultar Saldo (CorpX v2)
 * Endpoint: GET /api/corpx-v2/balance
 * Header: X-Corpx-Account-Context: {alias}
 */
export async function consultarSaldoCorpX(
  alias: string,
  options?: { signal?: AbortSignal }
): Promise<CorpXSaldoResponse | null> {
  try {
    const tokenStatus = await checkTokenStatus();
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }

    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const requestUrl = `${baseUrl}${CORPX_CONFIG.endpoints.consultarSaldo}?includeLocks=true`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'X-Corpx-Account-Context': alias,
    };

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders,
      signal: options?.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    // CorpX v2 response: { available, locked, total, currency, locks }
    const raw = responseData?.data ?? responseData;
    const available = Number(raw?.available ?? raw?.saldo ?? 0);
    const locked = Number(raw?.locked ?? raw?.saldoBloqueado ?? 0);
    const total = Number(raw?.total ?? raw?.globalBalance ?? available + locked);

    if (responseData?.error === false || (typeof raw?.available === 'number' || typeof raw?.total === 'number')) {
      return {
        erro: false,
        globalBalance: total,
        saldo: total,
        saldoDisponivel: available,
        saldoBloqueado: locked,
        limite: 0,
        limiteBloqueado: locked
      } as CorpXSaldoResponse;
    }

    return {
      erro: true,
      globalBalance: 0,
      saldo: 0,
      saldoDisponivel: 0,
      saldoBloqueado: 0,
      limite: 0,
      limiteBloqueado: 0
    } as CorpXSaldoResponse;
    
  } catch (error: any) {
    // AbortError não deve virar erro “hard” no UI
    if (error?.name === 'AbortError') {
      return null;
    }
    console.error('[CORPX-SALDO] Erro ao consultar saldo:', error.message);
    
    
    // ✅ Retornar estrutura de erro em vez de null
    return {
      erro: true,
      globalBalance: 0,
      saldo: 0,
      saldoDisponivel: 0,
      saldoBloqueado: 0,
      limite: 0,
      limiteBloqueado: 0
    } as CorpXSaldoResponse;
  }
}

/**
 * Consultar Extrato
 * Endpoint: POST /api/corpx/account/extrato
 */
export async function consultarExtratoCorpX(params: CorpXExtratoParams): Promise<CorpXExtratoResponse | null> {
  try {
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    // ✅ CORRIGIDO: Incluir filtros de data conforme especificação do backend
    const requestBody = {
      tax_document: params.cnpj,
      itensporpagina:  500, // Conforme especificação: limite de 500 por página
      page: params.page || 1,
      // ✅ ADICIONADO: Parâmetros de data conforme backend espera
      ...(params.dataInicio && { dataini: params.dataInicio }),
      ...(params.dataFim && { datafim: params.dataFim })
    };
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.consultarExtrato}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      let errorDetails;
      try {
        const errorText = await response.text();
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }
      } catch (readError) {
        errorDetails = { message: 'Erro ao ler resposta do servidor' };
      }
      
      throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }

    const responseData = await response.json();
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as CorpXBackendResponse<any>;
    
    
    if (backendResponse.error === false && backendResponse.data) {
      // ✅ Melhor tratamento: verificar se data é array ou objeto com array dentro
      let rawTransactions = [];
      
      if (Array.isArray(backendResponse.data)) {
        rawTransactions = backendResponse.data;
      } else if (backendResponse.data.extrato && Array.isArray(backendResponse.data.extrato)) {
        rawTransactions = backendResponse.data.extrato;
      } else if (backendResponse.data.transactions && Array.isArray(backendResponse.data.transactions)) {
        rawTransactions = backendResponse.data.transactions;
      } else if (backendResponse.data.items && Array.isArray(backendResponse.data.items)) {
        rawTransactions = backendResponse.data.items;
      } else {
        rawTransactions = [];
      }
      
      // ✅ CORREÇÃO: Adaptar dados CorpX para a interface esperada
      const transactions = rawTransactions.map((item: any, index: number) => {
        // Pular item "Saldo Atual"
        if (item.data === "Saldo Atual" || item.descricao === "Saldo Atual") {
          return null;
        }

        // ✅ MAPEAMENTO CORRETO para estrutura CorpX
        const valorString = item.valor || '0';
        const valor = parseFloat(valorString.toString());
        const dataHora = item.data && item.hora ? `${item.data} ${item.hora}` : item.data;
        
        const transaction = {
          id: item.nrMovimento || item.idEndToEnd || index.toString(),
          date: dataHora || new Date().toISOString().split('T')[0],
          description: item.descricao || 'Transação',
          amount: Math.abs(valor),
          type: (item.tipo === 'C') ? 'credit' as const : 'debit' as const,
          balance: 0, // CorpX não retorna saldo por transação
          // 🔧 PRESERVAR DADOS ORIGINAIS PARA ANTI-DUPLICAÇÃO
          idEndToEnd: item.idEndToEnd, // End-to-End obrigatório para CorpX
          nrMovimento: item.nrMovimento, // ID do movimento
          originalItem: item // Preservar dados originais completos
        };
        
        return transaction;
      }).filter(t => t !== null); // Remover items nulos (Saldo Atual)
      
      const result = {
        erro: false,
        page: 1, // CorpX não usa paginação por agora
        totalPages: 1, // Backend não retorna totalPages
        transactions
      } as CorpXExtratoResponse;
      
      
      return result;
    } else {
      // ✅ Verificar se ainda assim há dados para retornar
      if (responseData && (Array.isArray(responseData) || responseData.length > 0)) {
        const directData = Array.isArray(responseData) ? responseData : [responseData];
        
        const transactions = directData.map((item: any, index: number) => ({
          id: item.id || index.toString(),
          date: item.date || item.data || new Date().toISOString().split('T')[0],
          description: item.description || item.descricao || 'Transação',
          amount: parseFloat(item.amount || item.valor || '0'),
          type: (item.type === 'credit' || item.tipo === 'C') ? 'credit' as const : 'debit' as const,
          balance: parseFloat(item.balance || item.saldo || '0')
        }));
      
      return {
        erro: false,
          page: 1,
          totalPages: 1,
        transactions
      } as CorpXExtratoResponse;
      }
      
      return {
        erro: true,
        page: 1,
        totalPages: 1,
        transactions: []
      } as CorpXExtratoResponse;
    }
    
  } catch (error: any) {
    console.error('[CORPX-EXTRATO] Erro ao consultar extrato:', error.message);
    
    // ✅ Retornar estrutura de erro em vez de null para melhor tratamento no frontend
    return {
      erro: true,
      page: 1,
      totalPages: 1,
      transactions: []
    } as CorpXExtratoResponse;
  }
}

/**
 * Listar transações usando a nova API consolidada
 * Endpoint: GET /api/corpx/transactions
 */
export async function listarTransacoesCorpX(
  params: CorpXTransactionsParams = {},
  options?: { signal?: AbortSignal }
): Promise<CorpXTransactionsResponse> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const corpxBaseUrl =
      (API_CONFIG?.BASE_URL && API_CONFIG.BASE_URL.includes('api-bank-v2.gruponexus.com.br'))
        ? API_CONFIG.BASE_URL
        : 'https://api-bank-v2.gruponexus.com.br';

    const baseUrlTrimmed = corpxBaseUrl.endsWith('/') ? corpxBaseUrl.slice(0, -1) : corpxBaseUrl;
    const url = new URL(`${baseUrlTrimmed}${CORPX_CONFIG.endpoints.listarTransacoes}`);
    const query = url.searchParams;

    if (params.accountId !== undefined && params.accountId !== null) {
      query.append('accountId', String(params.accountId));
    }
    if (params.transactionType) {
      query.append('transactionType', params.transactionType);
    }
    if (params.startDate) {
      query.append('startDate', params.startDate);
    }
    if (params.endDate) {
      query.append('endDate', params.endDate);
    }
    
    // ✅ Prioridade: exactAmount ignora minAmount e maxAmount
    // ✅ Aceita valores negativos conforme especificação (GUIA-FRONTEND-TRANSACOES.md)
    if (typeof params.exactAmount === 'number' && params.exactAmount !== 0) {
      query.append('exactAmount', params.exactAmount.toString());
    } else {
      // Só adicionar minAmount e maxAmount se exactAmount não foi informado
      // ✅ Aceita valores negativos em minAmount e maxAmount
      if (typeof params.minAmount === 'number') {
        query.append('minAmount', params.minAmount.toString());
      }
      if (typeof params.maxAmount === 'number') {
        query.append('maxAmount', params.maxAmount.toString());
      }
    }
    
    // ✅ Prioridade: endToEnd ignora search
    if (params.endToEnd && params.endToEnd.trim() !== '') {
      query.append('endToEnd', params.endToEnd.trim());
    } else if (params.search && params.search.trim() !== '') {
      query.append('search', params.search.trim());
    }
    if (params.pixStatus) {
      query.append('pixStatus', params.pixStatus);
    }
    if (params.pixType) {
      query.append('pixType', params.pixType);
    }
    if (params.source) {
      query.append('source', params.source);
    }
    if (params.payerDocument) {
      query.append('payerDocument', params.payerDocument);
    }
    if (params.beneficiaryDocument) {
      query.append('beneficiaryDocument', params.beneficiaryDocument);
    }
    if (typeof params.limit === 'number') {
      const safeLimit = Math.min(Math.max(params.limit, 1), 2000);
      query.append('limit', safeLimit.toString());
    }
    if (typeof params.offset === 'number') {
      query.append('offset', Math.max(params.offset, 0).toString());
    }
    if (params.order) {
      query.append('order', params.order);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    return responseData as CorpXTransactionsResponse;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.error('[CORPX-TRANSACTIONS] Erro ao listar transações:', error.message || error);
    throw error;
  }
}

export async function sincronizarExtratoCorpX(params: CorpXSyncRequest): Promise<CorpXSyncResponse> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const corpxBaseUrl =
      (API_CONFIG?.BASE_URL && API_CONFIG.BASE_URL.includes('api-bank-v2.gruponexus.com.br'))
        ? API_CONFIG.BASE_URL
        : 'https://api-bank-v2.gruponexus.com.br';

    const baseUrlTrimmed = corpxBaseUrl.endsWith('/') ? corpxBaseUrl.slice(0, -1) : corpxBaseUrl;
    const url = `${baseUrlTrimmed}${CORPX_CONFIG.endpoints.sincronizarExtrato}`;

    const payload = {
      taxDocument: params.taxDocument,
      startDate: params.startDate,
      endDate: params.endDate,
      dryRun: params.dryRun ?? false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let parsed: any;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        parsed = { success: response.ok, raw: text };
      }
    } else {
      parsed = { success: response.ok };
    }

    if (!response.ok) {
      const message = parsed?.message || `HTTP error! status: ${response.status}`;
      throw new Error(message);
    }

    return parsed as CorpXSyncResponse;
  } catch (error: any) {
    console.error('[CORPX-SYNC] Erro ao sincronizar extrato:', error?.message || error);
    throw error;
  }
}

// ==================== INTERFACE PARA CONSULTA DE TRANSAÇÃO ====================

export interface ConsultarTransacaoRequest {
  tax_document: string;
  endtoend: string;
}

export interface ConsultarTransacaoResponse {
  error: boolean;
  message: string;
  data?: {
    ok: boolean;
    data: {
      cursor: string | null;
      requests?: Array<{
        amount: number;
        cashAmount: number;
        cashierBankCode: string;
        cashierType: string;
        created: string;
        description: string;
        endToEndId: string;
        externalId: string;
        fee: number;
        flow: 'in' | 'out';
        id: string;
        initiatorTaxId: string;
        method: string;
        priority: string;
        receiverAccountNumber: string;
        receiverAccountType: string;
        receiverBankCode: string;
        receiverBranchCode: string;
        receiverKeyId: string;
        receiverName: string;
        receiverTaxId: string;
        reconciliationId: string;
        senderAccountNumber: string;
        senderAccountType: string;
        senderBankCode: string;
        senderBranchCode: string;
        senderName: string;
        senderTaxId: string;
        status: string;
        tags: string[];
        updated: string;
      }>;
      reversals?: Array<{
        amount: number;
        created: string;
        description: string;
        endToEndId: string;
        externalId: string;
        fee: number;
        flow: 'in' | 'out';
        id: string;
        reason: string;
        returnId: string;
        status: string;
        tags: string[];
        updated: string;
      }>;
    };
    erro_code: string | null;
    erro_message: string | null;
  };
}

export interface VerificacaoTransacaoResult {
  sucesso: boolean;
  status?: string;
  mensagem: string;
  transacao?: ConsultarTransacaoResponse['data']['data']['requests'][0] | ConsultarTransacaoResponse['data']['data']['reversals'][0];
  permiteOperacao: boolean;
  rawResponse?: ConsultarTransacaoResponse; // ✅ Adicionar resposta bruta para debug
}

/** Mapeia resposta qtran para formato da UI */
function mapearTransacaoQtranParaUI(data: any, endtoend: string) {
  const isQtran = data.senderName != null || data.senderTaxId != null;
  const amountCentavos = isQtran
    ? (typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0') || 0)
    : Math.round((typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0') || 0) * 100);
  const feeAmount = data.fee?.amount != null
    ? (data.fee.amount > 1 ? data.fee.amount : Math.round(data.fee.amount * 100))
    : (data.fee ?? 0);
  return {
    id: data.id || data.transactionId || data.idEndToEnd,
    endToEndId: data.endToEndId || data.endToEnd || data.idEndToEnd || endtoend,
    status: data.status,
    direction: data.direction,
    flow: (data.flow || ((data.direction || '').toLowerCase() === 'in' ? 'in' : 'out')) as 'in' | 'out',
    amount: amountCentavos,
    type: data.type,
    operation: data.operation,
    method: data.method,
    fee: typeof feeAmount === 'number' ? feeAmount : 0,
    senderName: data.senderName ?? data.payer?.name,
    receiverName: data.receiverName ?? data.payee?.name,
    senderTaxId: data.senderTaxId ?? data.payer?.document,
    receiverTaxId: data.receiverTaxId ?? data.payee?.document,
    senderBankCode: data.senderBankCode ?? data.payer?.bankCode,
    senderBranchCode: data.senderBranchCode ?? data.payer?.branch,
    senderAccountNumber: data.senderAccountNumber ?? data.payer?.account,
    senderAccountType: data.senderAccountType ?? data.payer?.accountType ?? '-',
    receiverBankCode: data.receiverBankCode ?? data.payee?.bankCode,
    receiverBranchCode: data.receiverBranchCode ?? data.payee?.branch,
    receiverAccountNumber: data.receiverAccountNumber ?? data.payee?.account,
    receiverAccountType: data.receiverAccountType ?? data.payee?.accountType ?? '-',
    created: data.created ?? data.createdAt,
    updated: data.updated ?? data.updatedAt,
    createdAt: data.createdAt ?? data.created,
    updatedAt: data.updatedAt ?? data.updated,
    description: data.description ?? data.operation ?? data.errorReason,
    reconciliationId: data.reconciliationId,
    errorReason: data.errorReason,
    _v2: data
  };
}

/**
 * Consultar Transação por EndToEnd
 * POST /api/corpx/account/qtran — body: { tax_document, endtoend }
 */
export async function consultarTransacaoPorEndToEnd(
  taxDocument: string,
  endtoend: string
): Promise<VerificacaoTransacaoResult> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      return {
        sucesso: false,
        mensagem: 'Token de autenticação não encontrado. Faça login novamente.',
        permiteOperacao: false
      };
    }

    const taxDocumentLimpo = (taxDocument || '').replace(/\D/g, '');
    if (!taxDocumentLimpo || taxDocumentLimpo.length < 11) {
      return {
        sucesso: false,
        mensagem: 'Documento (CNPJ/CPF) inválido',
        permiteOperacao: false
      };
    }

    if (!endtoend || endtoend.length < 10) {
      return {
        sucesso: false,
        mensagem: 'EndToEnd inválido ou muito curto',
        permiteOperacao: false
      };
    }

    const endtoendTrim = endtoend.trim();

    // POST /api/corpx/account/qtran — consulta por EndToEnd
    const baseUrl = API_CONFIG.BASE_URL;
    const url = `${baseUrl}${CORPX_CONFIG.endpoints.consultarTransacao}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        tax_document: taxDocumentLimpo,
        endtoend: endtoendTrim,
      }),
    });

    const raw = await response.json();

    if (!response.ok || raw?.error) {
      return {
        sucesso: false,
        mensagem: raw?.message || `Erro ao consultar transação: HTTP ${response.status}`,
        permiteOperacao: false,
        rawResponse: raw
      };
    }

    // qtran pode retornar { data: { data: { requests: [...] } } } ou { data: {...} } direto
    let data = raw?.data ?? raw;
    if (data?.data?.requests?.length) {
      data = data.data.requests[0];
    } else if (data?.data?.reversals?.length) {
      data = data.data.reversals[0];
    } else if (typeof data?.data === 'object' && !Array.isArray(data.data)) {
      data = data.data;
    }
    const hasValidTx = data && (data.id || data.transactionId || data.idEndToEnd || data.endToEndId);
    if (!hasValidTx) {
      return {
        sucesso: false,
        mensagem: raw?.message || 'Transação não encontrada na API. O endToEnd pode estar incorreto ou a transação não foi processada.',
        permiteOperacao: false,
        rawResponse: raw
      };
    }

    const status = (data.status || data.Status || '').toUpperCase();
    const permiteOperacao = status === 'SUCCESS';
    const transacao = mapearTransacaoQtranParaUI(data, endtoendTrim);

    if (permiteOperacao) {
      return {
        sucesso: true,
        status: data.status,
        mensagem: `Transação verificada com sucesso! Status: ${data.status}`,
        transacao,
        permiteOperacao: true,
        rawResponse: raw
      };
    } else {
      return {
        sucesso: true,
        status: data.status,
        mensagem: `Transação encontrada, porém com status "${data.status}". Operações de crédito/compensação não são permitidas.`,
        transacao,
        permiteOperacao: false,
        rawResponse: raw
      };
    }

  } catch (error: any) {
    console.error('[CORPX-QTRAN] Erro ao consultar transação:', error);
    return {
      sucesso: false,
      mensagem: `Erro ao consultar transação: ${error.message || 'Erro de conexão'}`,
      permiteOperacao: false
    };
  }
}

/**
 * Criar Conta
 * Endpoint: POST /api/corpx/account/criar
 */
export async function criarContaCorpX(dados: CorpXCreateAccountRequest): Promise<CorpXCreateAccountResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    // Backend espera nome_completo e tax_document
    const requestBody = {
      nome_completo: dados.name,
      tax_document: dados.tax_document
    };
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.criarConta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as CorpXBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message,
        account_id: backendResponse.data?.id || null
      } as CorpXCreateAccountResponse;
    } else {
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreateAccountResponse;
    }
    
  } catch (error: any) {
    console.error('[CORPX-CONTA] Erro ao criar conta:', error.message);
    return null;
  }
}

/**
 * 🔑 CHAVES PIX
 */

/**
 * Listar Chaves PIX (CorpX v2)
 * Endpoint: GET /api/corpx-v2/pix/keys
 * Header: X-Corpx-Account-Context: {alias}
 */
export async function listarChavesPixCorpX(alias: string): Promise<CorpXPixKeysResponse | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}${CORPX_CONFIG.endpoints.listarChavesPix}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': alias,
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    const raw = responseData?.data ?? responseData;
    const arr = Array.isArray(raw) ? raw : (raw?.keys ?? raw?.chaves ?? []);

    const chaves = (Array.isArray(arr) ? arr : []).map((item: any, index: number) => ({
      id: item.keypix || item.id || item.key || item.chave || index.toString(),
      key: item.keypix || item.key || item.chave || '',
      type: item.keyType || item.tipo || item.type || 'RANDOM',
      status: item.status || 'ACTIVE',
      created_at: item.created_at || item.criado || item.dataCriacao || new Date().toISOString()
    }));

    return {
      erro: responseData?.error === true ? true : false,
      chaves
    } as CorpXPixKeysResponse;
  } catch (error: any) {
    console.error('[CORPX-PIX-CHAVES] Erro ao listar chaves:', error.message);
    return null;
  }
}

/** Mapeia tipo v1 (1-5) para keyType v2 */
const TIPO_TO_KEYTYPE: Record<string, string> = {
  '1': 'cpf', '2': 'cnpj', '3': 'phone', '4': 'email', '5': 'random'
};

/**
 * Criar Chave PIX (CorpX v2)
 * Endpoint: POST /api/corpx-v2/pix/keys
 * Header: X-Corpx-Account-Context: {alias}
 * Body: { keyType, key? }
 * Nota: OTP (v1) não existe na v2 - fluxo pode ter mudado
 */
export async function criarChavePixCorpX(alias: string, dados: CorpXCreatePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const tipoStr = String(dados.tipo ?? '5');
    const keyType = TIPO_TO_KEYTYPE[tipoStr] || 'random';
    const body: { keyType: string; key?: string } = { keyType };
    if (dados.key && tipoStr !== '5') {
      body.key = dados.key.trim();
    }

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}${CORPX_CONFIG.endpoints.criarChavePix}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': alias,
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();
    const raw = responseData?.data ?? responseData;

    if (!response.ok) {
      return {
        erro: true,
        message: responseData?.message || `Erro HTTP ${response.status}`,
        details: responseData?.details || responseData?.message
      } as CorpXCreatePixKeyResponse;
    }

    return {
      erro: responseData?.error === true,
      message: responseData?.message || 'Chave PIX criada com sucesso',
      data: raw
    } as CorpXCreatePixKeyResponse;
  } catch (error: any) {
    console.error('[CORPX-PIX-CRIAR] Erro ao criar chave:', error);
    return {
      erro: true,
      message: 'Erro ao criar chave PIX',
      details: error.message || 'Erro de conexão. Tente novamente.'
    } as CorpXCreatePixKeyResponse;
  }
}

/**
 * ✅ NOVO: Enviar OTP para validação de chave PIX
 * Endpoint: PUT /api/corpx/pix/chave/otp
 * 
 * Necessário para tipos 3 (Celular) e 4 (Email) antes de criar a chave
 */
export async function enviarOtpPixCorpX(dados: CorpXEnviarOtpPixRequest): Promise<CorpXEnviarOtpPixResponse | null> {
  try {
    console.log('[CORPX-PIX-OTP] Enviando OTP...', { 
      tax_document: dados.tax_document, 
      key: dados.key ? '***' : undefined
    });
    
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.enviarOtpPix}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(dados)
    });

    const responseData = await response.json();
    console.log('[CORPX-PIX-OTP] Resposta recebida:', responseData);
    
    if (!response.ok) {
      const errorResponse = responseData as {
        error: boolean;
        message: string;
        details?: string;
      };
      
      return {
        erro: true,
        message: errorResponse.message || `Erro HTTP ${response.status}`,
        details: errorResponse.details || errorResponse.message
      } as CorpXEnviarOtpPixResponse;
    }
    
    const successResponse = responseData as {
      error: false;
      message: string;
      data?: any;
    };
    
    if (successResponse.error === false) {
      return {
        erro: false,
        message: successResponse.message || 'OTP enviado com sucesso',
        data: successResponse.data
      } as CorpXEnviarOtpPixResponse;
    } else {
      return {
        erro: true,
        message: successResponse.message || 'Erro desconhecido',
        details: successResponse.message
      } as CorpXEnviarOtpPixResponse;
    }
    
  } catch (error: any) {
    console.error('[CORPX-PIX-OTP] Erro ao enviar OTP:', error);
    
    return {
      erro: true,
      message: 'Erro ao enviar OTP',
      details: error.message || 'Erro de conexão. Tente novamente.'
    } as CorpXEnviarOtpPixResponse;
  }
}

/**
 * Cancelar Chave PIX
 * Endpoint: DELETE /api/corpx/pix/chave
 * 
 * Nota: Como api.delete não suporta body, usamos uma requisição customizada
 * mas ainda aproveitando o sistema de autenticação do projeto
 */
export async function cancelarChavePixCorpX(dados: CorpXDeletePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
  try {
    //console.log('[CORPX-PIX-CANCELAR] Cancelando chave PIX...', dados);
    
    // ✅ Usar TOKEN_STORAGE diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.cancelarChavePix}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    //console.log('[CORPX-PIX-CANCELAR] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as CorpXBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    } else {
      console.error('[CORPX-PIX-CANCELAR] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    }
    
  } catch (error: any) {
    console.error('[CORPX-PIX-CANCELAR] Erro ao cancelar chave:', error);
    return null;
  }
}

/**
 * 💸 TRANSFERÊNCIAS PIX
 */

/**
 * Criar Transferência PIX
 * Endpoint: POST /api/corpx/pix/transferencia
 */
export async function criarTransferenciaPixCorpX(dados: CorpXPixTransferRequest): Promise<CorpXPixTransferResponse | null> {
  try {
    //console.log('[CORPX-PIX-TRANSFER] Criando transferência PIX...', dados);
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.criarTransferenciaPix}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    //console.log('[CORPX-PIX-TRANSFER] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as CorpXBackendResponse<any>;
    
    if (backendResponse.error === false && backendResponse.data) {
      const data = backendResponse.data;
      return {
        erro: false,
        type: data.type || 'PIX',
        key: dados.key,
        branch: data.branch || data.agencia || '',
        number: data.number || data.conta || '',
        account_type: data.account_type || 'PAYMENT',
        tax_document: data.tax_document || data.cpf_cnpj || '',
        nome: data.nome || data.recebedorNome || '',
        ispb: data.ispb || '',
        compe: data.compe || '',
        banco: data.banco || data.bancoNome || '',
        endtoend: data.endtoend || data.endToEnd || data.id || '',
        Valor: dados.valor.toString()
      } as CorpXPixTransferResponse;
    } else {
      console.error('[CORPX-PIX-TRANSFER] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        type: '',
        key: dados.key,
        branch: '',
        number: '',
        account_type: '',
        tax_document: '',
        nome: '',
        ispb: '',
        compe: '',
        banco: '',
        endtoend: '',
        Valor: dados.valor.toString()
      } as CorpXPixTransferResponse;
    }
    
  } catch (error: any) {
    console.error('[CORPX-PIX-TRANSFER] Erro ao criar transferência:', error.response?.data);
    return null;
  }
}

/**
 * Confirmar Transferência PIX
 * Endpoint: GET /api/corpx/pix/transferencia/confirmar?endtoend=X&tax_document=Y
 */
export async function confirmarTransferenciaPixCorpX(dados: CorpXPixConfirmRequest): Promise<CorpXPixConfirmResponse | null> {
  try {
    //console.log('[CORPX-PIX-CONFIRM] Confirmando transferência PIX...', dados);
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const url = `${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.confirmarTransferenciaPix}?endtoend=${dados.endtoend}&tax_document=${dados.tax_document}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    //console.log('[CORPX-PIX-CONFIRM] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as CorpXBackendResponse<any>;
    
    if (backendResponse.error === false && backendResponse.data) {
      // Adaptar dados do backend para interface esperada
      const data = backendResponse.data;
      return {
        message: backendResponse.message,
        endtoend: dados.endtoend,
        erro: false,
        id: data.id || data.transactionId || '',
        idEndToEnd: data.idEndToEnd || data.endtoend || dados.endtoend,
        transactionDate: data.transactionDate || new Date().toISOString(),
        transactionCode: data.transactionCode || '',
        status: data.status || 'created',
        amount: parseFloat(data.amount || data.valor || '0'),
        "Tipo de transação": "Transferência Pix",
        "Data": data.transactionDate || new Date().toISOString(),
        "Valor": `R$ ${parseFloat(data.amount || data.valor || '0').toFixed(2).replace('.', ',')}`,
        "Código da transação": data.idEndToEnd || dados.endtoend,
        "De": data.pagadorNome || "Conta CorpX",
        "CPF/CNPJ": data.recebedorDocument || "***",
        "Para": data.recebedorNome || "Beneficiário",
        "Descrição": data.descricao || ""
      } as CorpXPixConfirmResponse;
    } else {
      console.error('[CORPX-PIX-CONFIRM] Erro na resposta:', backendResponse.message);
      return null;
    }
    
  } catch (error: any) {
    console.error('[CORPX-PIX-CONFIRM] Erro ao confirmar transferência:', error.response?.data);
    return null;
  }
}

/**
 * 📱 QR CODE PIX
 */

/**
 * Gerar QR Code PIX
 * Endpoint: POST /api/corpx/pix/qrcode
 */
export async function gerarQRCodePixCorpX(dados: CorpXQRCodeRequest): Promise<CorpXQRCodeResponse | null> {
  try {
    //console.log('[CORPX-PIX-QR] Gerando QR Code PIX...', dados);
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${CORPX_CONFIG.endpoints.gerarQRCodePix}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    //console.log('[CORPX-PIX-QR] Resposta recebida:', responseData);
    
    return responseData as CorpXQRCodeResponse;
    
  } catch (error: any) {
    console.error('[CORPX-PIX-QR] Erro ao gerar QR Code:', error.response?.data);
    return null;
  }
}

/** Infere keyType v2 a partir da chave PIX */
function inferKeyTypeFromKey(key: string): string {
  const k = (key || '').trim();
  if (!k) return 'random';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return 'email';
  if (/^(\+?55)?\d{10,11}$/.test(k.replace(/\D/g, ''))) return 'phone';
  if (/^\d{11}$/.test(k.replace(/\D/g, ''))) return 'cpf';
  if (/^\d{14}$/.test(k.replace(/\D/g, ''))) return 'cnpj';
  if (k.length === 36 && k.includes('-')) return 'random';
  return 'random';
}

/** Limpa formatação de documento (CPF/CNPJ) */
function limparDocumentoCorpX(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

/**
 * Transferência interna entre contas CorpX (CorpX v2)
 * Endpoint: POST /api/corpx-v2/transfers/internal/simple
 * Ref: docs/MIGRACAO-FRONTEND-CORPX-V2.md
 * Origem: automática (conta selecionada). Destino: operador informa documento.
 */
export async function transferenciaInternaCorpX(
  originDocument: string,
  destinationDocument: string,
  value: number,
  message?: string
): Promise<{ transferId?: string; status?: string; value?: number; createdAt?: string; identifier?: string } | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const origin = limparDocumentoCorpX(originDocument);
    const destination = limparDocumentoCorpX(destinationDocument);

    if (!origin || origin.length < 11) {
      throw new Error('Documento de origem inválido');
    }
    if (!destination || destination.length < 11) {
      throw new Error('Documento de destino inválido');
    }
    if (origin === destination) {
      throw new Error('Origem e destino não podem ser iguais');
    }
    if (value <= 0) {
      throw new Error('Valor deve ser maior que zero');
    }

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const body = {
      originDocument: origin,
      destinationDocument: destination,
      value,
      message: message || undefined,
      identifier: `int-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    };

    const response = await fetch(`${baseUrl}/api/corpx-v2/transfers/internal/simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.message || data?.error || `Erro HTTP ${response.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (error: any) {
    console.error('[CORPX-TRANSF-INTERNA] Erro:', error);
    throw error;
  }
}

/**
 * Executar transferência PIX completa (CorpX v2)
 * POST /api/corpx-v2/pix/out
 * Header: X-Corpx-Account-Context: {alias}
 */
export async function executarTransferenciaCompletaCorpX(alias: string, dados: any): Promise<any | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const valor = typeof dados.valor === 'number' ? dados.valor : parseFloat(String(dados.valor));
    const keyType = inferKeyTypeFromKey(dados.key);
    const identifier = `PIX-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const body = {
      amount: valor,
      currency: 'BRL',
      keyType,
      key: (dados.key || '').trim(),
      description: dados.description || dados.nome || undefined,
      identifier,
    };

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}/api/corpx-v2/pix/out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': alias,
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData?.message || `Erro HTTP ${response.status}`);
    }

    return responseData?.data ?? responseData;
  } catch (error: any) {
    console.error('[CORPX-PIX-COMPLETA] Erro:', error?.message || error);
    return null;
  }
}

/**
 * BigPIX — PIX > R$ 15k (CorpX v2)
 * POST /api/corpx-v2/pix/out/bigpix
 * Header: X-Corpx-Account-Context: {alias}
 * Body: mesmo de pix/out — backend cuida da lógica
 */
export async function executarBigPixCorpX(alias: string, dados: { key: string; valor: number; tipo?: number; nome?: string; description?: string }): Promise<any | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const valor = typeof dados.valor === 'number' ? dados.valor : parseFloat(String(dados.valor));
    const keyType = inferKeyTypeFromKey(dados.key);
    const identifier = `BIGPIX-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const body = {
      amount: valor,
      currency: 'BRL',
      keyType,
      key: (dados.key || '').trim(),
      description: dados.description || dados.nome || undefined,
      identifier,
    };

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}/api/corpx-v2/pix/out/bigpix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': alias,
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok || responseData?.error) {
      throw new Error(responseData?.message || `Erro HTTP ${response.status}`);
    }

    return responseData?.data ?? responseData;
  } catch (error: any) {
    console.error('[CORPX-BIGPIX] Erro:', error?.message || error);
    return null;
  }
}

/**
 * Executar transferência PIX completa programada
 * POST /api/corpx/pix/transferencia-completa-programada
 */
export async function executarTransferenciaCompletaProgramadaCorpX(dados: any): Promise<any | null> {
  try {
    console.log('[CORPX-PIX-PROGRAMADA] Executando transferência PIX programada...', dados);
    
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/corpx/pix/transferencia-completa-programada`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('[CORPX-PIX-PROGRAMADA] Resposta recebida:', responseData);
    
    return responseData;
    
  } catch (error: any) {
    console.error('[CORPX-PIX-PROGRAMADA] Erro ao executar transferência programada:', error.response?.data);
    return null;
  }
}

/**
 * 🎯 FLUXO COMPLETO - Enviar PIX
 */
export async function enviarPixCompletoCorpX(
  dadosTransferencia: CorpXPixTransferRequest
): Promise<{ criacao: CorpXPixTransferResponse; confirmacao: CorpXPixConfirmResponse } | null> {
  try {
    //console.log('[CORPX-PIX-COMPLETO] Iniciando fluxo completo PIX...', dadosTransferencia);
    
    // 1. Criar transferência
    const criacao = await criarTransferenciaPixCorpX(dadosTransferencia);
    
    if (!criacao || criacao.erro) {
      throw new Error('Erro ao criar transferência');
    }

    // 2. Confirmar transferência
    const confirmacao = await confirmarTransferenciaPixCorpX({
      endtoend: criacao.endtoend,
      tax_document: dadosTransferencia.tax_document
    });

    if (!confirmacao || confirmacao.erro) {
      throw new Error('Erro ao confirmar transferência');
    }

    //console.log('[CORPX-PIX-COMPLETO] Fluxo completo executado com sucesso');

    return {
      criacao,
      confirmacao
    };
    
  } catch (error: any) {
    console.error('[CORPX-PIX-COMPLETO] Erro no fluxo completo:', error);
    return null;
  }
}

/**
 * 📝 HELPERS UTILITÁRIOS
 */

/**
 * Formatar valor para display
 */
export function formatarValorCorpX(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Validar CNPJ (apenas números)
 */
export function validarCNPJCorpX(cnpj: string): boolean {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  return cnpjLimpo.length === 14;
}

/**
 * Formatar chave PIX baseado no tipo
 */
export function formatarChavePixCorpX(chave: string, tipo: number): string {
  switch (tipo) {
    case 2: // Telefone
      return chave.startsWith('+55') ? chave : `+55${chave}`;
    case 3: // Email
      return chave.toLowerCase();
    case 1: // CPF/CNPJ
      return chave.replace(/\D/g, '');
    default:
      return chave;
  }
}

/**
 * Tratamento de erros padronizado
 */
export function tratarErroCorpX(error: any): string {
  if (error.response) {
    switch (error.response.status) {
      case 400:
        return 'Dados inválidos. Verifique os campos.';
      case 401:
        return 'Chave PIX não encontrada.';
      case 402:
        return 'Conta não aprovada ou saldo insuficiente.';
      case 422:
        return 'Erro de validação dos dados.';
      case 500:
        return 'Erro interno. Tente novamente.';
      default:
        return error.response.data?.message || 'Erro na operação. Tente novamente.';
    }
  }
  return 'Erro de conexão. Verifique sua internet.';
}

// ==================== EXPORT PRINCIPAL ====================

/**
 * Serviço principal CORPX Banking
 * Baseado no guia oficial de integração frontend
 * ✅ Implementação completa conforme API
 */
export const CorpXService = {
  // 💰 CONTA / SALDO
  consultarSaldo: consultarSaldoCorpX,
  consultarExtrato: consultarExtratoCorpX,
  listarTransacoes: listarTransacoesCorpX,
  sincronizarExtrato: sincronizarExtratoCorpX,
  criarConta: criarContaCorpX,
  
  // 🔍 VERIFICAÇÃO DE TRANSAÇÃO
  consultarTransacaoPorEndToEnd: consultarTransacaoPorEndToEnd,
  
  // 🔑 CHAVES PIX
  listarChavesPix: listarChavesPixCorpX,
  criarChavePix: criarChavePixCorpX,
  enviarOtpPix: enviarOtpPixCorpX, // ✅ NOVO: Enviar OTP para validação
  cancelarChavePix: cancelarChavePixCorpX,
  
  // 💸 TRANSFERÊNCIAS PIX
  criarTransferenciaPix: criarTransferenciaPixCorpX,
  confirmarTransferenciaPix: confirmarTransferenciaPixCorpX,
  enviarPixCompleto: enviarPixCompletoCorpX,
  
  // 📱 QR CODE PIX
  gerarQRCodePix: gerarQRCodePixCorpX,
  
  // 📝 HELPERS
  formatarValor: formatarValorCorpX,
  validarCNPJ: validarCNPJCorpX,
  formatarChavePix: formatarChavePixCorpX,
  tratarErro: tratarErroCorpX,
} as const;

// Exports compatíveis com versão anterior
export const getCorpXSaldo = consultarSaldoCorpX;
export const getCorpXExtrato = consultarExtratoCorpX;

export default CorpXService;
