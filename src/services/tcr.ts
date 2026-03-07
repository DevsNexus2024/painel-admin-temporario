// services/tcr.ts - Serviço TCR Banking (baseado no CorpX)
// Baseado no guia oficial de integração frontend
import { api } from '@/config/api';
import type {
  CorpXSaldoResponse,
  CorpXExtratoResponse,
  CorpXExtratoParams,
  CorpXPixKeysResponse,
  CorpXCreatePixKeyRequest,
  CorpXCreatePixKeyResponse,
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
} from '@/types/corpx'; // Reutilizando os types do CorpX

// Estrutura de resposta padrão do backend TCR (mesmo formato do CorpX)
interface TCRBackendResponse<T = any> {
  error: boolean;
  message: string;
  data?: T;
  details?: string;
}

const TCR_CONFIG = {
  endpoints: {
    // 💰 CONTA / SALDO (CorpX v2)
    consultarSaldo: '/api/corpx-v2/balance',
    consultarExtrato: '/api/corpx/account/extrato',
    criarConta: '/api/corpx/account/criar',
    
    // 🔍 CONSULTA DE TRANSAÇÃO POR ENDTOEND (qtran com document + e2e - igual botão Verificar do extrato TCR)
    consultarTransacao: '/api/corpx/account/qtran',
    
    // 🔑 CHAVES PIX (CorpX v2)
    listarChavesPix: '/api/corpx-v2/pix/keys',
    criarChavePix: '/api/corpx-v2/pix/keys',
    cancelarChavePix: '/api/corpx-v2/pix/keys',
    
    // 💸 TRANSFERÊNCIAS PIX (CorpX v2 - 1 etapa)
    pixOut: '/api/corpx-v2/pix/out',
    bigPix: '/api/corpx-v2/pix/out/bigpix',
    // v1 (legado - manter para referência)
    criarTransferenciaPix: '/api/corpx/pix/transferencia',
    confirmarTransferenciaPix: '/api/corpx/pix/transferencia/confirmar',
    
    // 📱 QR CODE PIX (TODO: verificar se existe no backend)
    gerarQRCodePix: '/api/corpx/pix/qrcode',
    
    // 🔄 PIX PROGRAMADO COM QR
    pixProgramadoComQR: '/api/corpx/pix/programado-qr',
    
    // 📊 NOVA API DE TRANSAÇÕES
    listarTransacoes: '/api/corpx/transactions',
    
    // 🔄 SINCRONIZAR EXTRATO
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
export async function consultarSaldoTCR(alias: string): Promise<CorpXSaldoResponse | null> {
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
    const requestUrl = `${baseUrl}${TCR_CONFIG.endpoints.consultarSaldo}?includeLocks=true`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'X-Corpx-Account-Context': alias,
    };

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: requestHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    // CorpX v2 response: { available, locked, total, currency, locks }
    // Ou backend wrapper: { error: false, data: { available, locked, total, ... } }
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
    console.error('[TCR-SALDO] Erro ao consultar saldo:', error.message);
    
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
export async function consultarExtratoTCR(params: CorpXExtratoParams): Promise<CorpXExtratoResponse | null> {
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
      page: params.page || 1,
      // ✅ REMOVIDO: itensporpagina agora vai na query string
      // ✅ REMOVIDO: Parâmetros de data agora vão na query string
    };
    
    // ✅ CORREÇÃO CRÍTICA: itensporpagina deve ir na query string, não no body
    const queryParams = new URLSearchParams();
    queryParams.append('itensporpagina', '500');
    if (params.dataInicio) queryParams.append('dataini', params.dataInicio);
    if (params.dataFim) queryParams.append('datafim', params.dataFim);
    
    const urlWithParams = `${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.consultarExtrato}?${queryParams.toString()}`;
    
    const response = await fetch(urlWithParams, {
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
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    
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
      
      // ✅ CORREÇÃO: Adaptar dados TCR para a interface esperada
      const transactions = rawTransactions.map((item: any, index: number) => {
        // Pular item "Saldo Atual"
        if (item.data === "Saldo Atual" || item.descricao === "Saldo Atual") {
          return null;
        }

        // ✅ MAPEAMENTO CORRETO para estrutura TCR
        const valorString = item.valor || '0';
        const valor = parseFloat(valorString.toString());
        const dataHora = item.data && item.hora ? `${item.data} ${item.hora}` : item.data;
        
        const transaction = {
          id: item.nrMovimento || item.idEndToEnd || index.toString(),
          date: dataHora || new Date().toISOString().split('T')[0],
          description: item.descricao || 'Transação',
          amount: Math.abs(valor),
          type: (item.tipo === 'C') ? 'credit' as const : 'debit' as const,
          balance: 0, // TCR não retorna saldo por transação
          // ✅ PRESERVAR dados originais completos para funcionalidades como verificação de endtoend
          _original: {
            ...item,
            endToEndId: item.idEndToEnd, // Mapear idEndToEnd para endToEndId também
            e2eId: item.idEndToEnd, // Alias para diferentes formatos
            // Dados do pagador para referência
            payerDocument: item.payer?.document,
            payerName: item.payer?.fullName,
            // Dados do beneficiário para referência  
            beneficiaryDocument: item.beneficiary?.document,
            beneficiaryPixKey: item.beneficiary?.pixKey,
            // Outros dados úteis
            nrMovimento: item.nrMovimento,
            valor: item.valor,
            tipo: item.tipo,
            data: item.data,
            hora: item.hora
          }
        };
        
        return transaction;
      }).filter(t => t !== null); // Remover items nulos (Saldo Atual)
      
      const result = {
        erro: false,
        page: 1, // TCR não usa paginação por agora
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
    console.error('[TCR-EXTRATO] Erro ao consultar extrato:', error.message);
    
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
export async function listarTransacoesTCR(params: CorpXTransactionsParams = {}): Promise<CorpXTransactionsResponse> {
  try {
    const { TOKEN_STORAGE } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    // ✅ URL base fixa para API CorpX
    const tcrBaseUrl = 'https://api-bank-v2.gruponexus.com.br';
    const baseUrlTrimmed = tcrBaseUrl.endsWith('/') ? tcrBaseUrl.slice(0, -1) : tcrBaseUrl;
    const url = new URL(`${baseUrlTrimmed}${TCR_CONFIG.endpoints.listarTransacoes}`);
    const query = url.searchParams;

    // ✅ AccountId fixo para TCR: 51771
    query.append('accountId', '51771');

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
    if (typeof params.exactAmount === 'number' && params.exactAmount > 0) {
      query.append('exactAmount', params.exactAmount.toString());
    } else {
      // Só adicionar minAmount e maxAmount se exactAmount não foi informado
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
    } else {
      // Default limit de 500 se não especificado
      query.append('limit', '500');
    }
    if (typeof params.offset === 'number') {
      query.append('offset', Math.max(params.offset, 0).toString());
    } else {
      // Default offset de 0 se não especificado
      query.append('offset', '0');
    }
    if (params.order) {
      query.append('order', params.order);
    } else {
      // Default order desc se não especificado
      query.append('order', 'desc');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    return responseData as CorpXTransactionsResponse;
  } catch (error: any) {
    console.error('[TCR-TRANSACTIONS] Erro ao listar transações:', error.message || error);
    throw error;
  }
}

/**
 * Sincronizar extrato TCR
 * Endpoint: POST /api/corpx/sync
 */
export async function sincronizarExtratoTCR(params: CorpXSyncRequest): Promise<CorpXSyncResponse> {
  try {
    const { TOKEN_STORAGE } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();

    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    // ✅ URL base fixa para API CorpX
    const tcrBaseUrl = 'https://api-bank-v2.gruponexus.com.br';
    const baseUrlTrimmed = tcrBaseUrl.endsWith('/') ? tcrBaseUrl.slice(0, -1) : tcrBaseUrl;
    const url = `${baseUrlTrimmed}${TCR_CONFIG.endpoints.sincronizarExtrato}`;

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
    console.error('[TCR-SYNC] Erro ao sincronizar extrato:', error?.message || error);
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
      requests: Array<{
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
    };
    erro_code: string | null;
    erro_message: string | null;
  };
}

/** Transação normalizada para UI (v1 qtran ou v2 GET /pix/transactions) */
export interface TransacaoVerificadaUI {
  id?: string;
  endToEndId?: string;
  status?: string;
  direction?: string;
  flow?: 'in' | 'out';
  amount?: number;
  type?: string;
  operation?: string;
  method?: string;
  fee?: number;
  senderName?: string;
  receiverName?: string;
  senderTaxId?: string;
  receiverTaxId?: string;
  senderBankCode?: string;
  senderBranchCode?: string;
  senderAccountNumber?: string;
  senderAccountType?: string;
  receiverBankCode?: string;
  receiverBranchCode?: string;
  receiverAccountNumber?: string;
  receiverAccountType?: string;
  created?: string;
  updated?: string;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  reconciliationId?: string;
  [key: string]: any;
}

export interface VerificacaoTransacaoResult {
  sucesso: boolean;
  status?: string;
  mensagem: string;
  transacao?: TransacaoVerificadaUI;
  permiteOperacao: boolean;
}

/**
 * Consultar Transação por EndToEnd (qtran com document + e2e)
 * Endpoint: POST /api/corpx/account/qtran
 * Body: { tax_document, endtoend }
 * Igual ao botão Verificar do extrato TCR.
 */
export async function consultarTransacaoPorEndToEndTCR(
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

    // qtran usa BASE_URL (baas-v1), igual extrato TCR
    const baseUrl = API_CONFIG.BASE_URL;
    const url = `${baseUrl}${TCR_CONFIG.endpoints.consultarTransacao}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        tax_document: taxDocumentLimpo,
        endtoend: endtoend.trim(),
      }),
    });

    const raw = await response.json();

    if (!response.ok) {
      return {
        sucesso: false,
        mensagem: raw?.message || `Erro ao consultar transação: HTTP ${response.status}`,
        permiteOperacao: false
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
        permiteOperacao: false
      };
    }

    const status = (data.status || data.Status || '').toUpperCase();
    const permiteOperacao = status === 'SUCCESS';

    // Mapear qtran/v2 → formato esperado pela UI (amount em centavos, sender/receiver)
    const amountBRL = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || data.valor || '0') || 0;
    const feeAmount = data.fee?.amount != null
      ? (data.fee.amount > 1 ? data.fee.amount : Math.round(data.fee.amount * 100))
      : 0;
    const transacao = {
      id: data.id || data.transactionId || data.idEndToEnd,
      endToEndId: data.endToEndId || data.endToEnd || data.idEndToEnd || endtoend,
      status: data.status,
      direction: data.direction,
      flow: ((data.direction || '').toLowerCase() === 'in' ? 'in' : 'out') as 'in' | 'out',
      amount: Math.round(amountBRL * 100),
      type: data.type,
      operation: data.operation,
      method: data.method,
      fee: feeAmount,
      senderName: data.payer?.name,
      receiverName: data.payee?.name,
      senderTaxId: data.payer?.document,
      receiverTaxId: data.payee?.document,
      senderBankCode: data.payer?.bankCode,
      senderBranchCode: data.payer?.branch,
      senderAccountNumber: data.payer?.account,
      senderAccountType: data.payer?.accountType || '-',
      receiverBankCode: data.payee?.bankCode,
      receiverBranchCode: data.payee?.branch,
      receiverAccountNumber: data.payee?.account,
      receiverAccountType: data.payee?.accountType || '-',
      created: data.createdAt,
      updated: data.updatedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      description: data.operation || data.errorReason,
      errorReason: data.errorReason,
      _v2: data
    };

    if (permiteOperacao) {
      return {
        sucesso: true,
        status: data.status,
        mensagem: `Transação verificada com sucesso! Status: ${data.status}`,
        transacao,
        permiteOperacao: true
      };
    } else {
      return {
        sucesso: true,
        status: data.status,
        mensagem: `Transação encontrada, porém com status "${data.status}". Operações de crédito/compensação não são permitidas.`,
        transacao,
        permiteOperacao: false
      };
    }

  } catch (error: any) {
    console.error('[TCR-QTRAN] Erro ao consultar transação:', error);
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
export async function criarContaTCR(dados: CorpXCreateAccountRequest): Promise<CorpXCreateAccountResponse | null> {
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
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.criarConta}`, {
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
    const backendResponse = responseData as TCRBackendResponse<any>;
    
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
    console.error('[TCR-CONTA] Erro ao criar conta:', error.message);
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
export async function listarChavesPixTCR(alias: string): Promise<CorpXPixKeysResponse | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}${TCR_CONFIG.endpoints.listarChavesPix}`, {
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
    console.error('[TCR-PIX-CHAVES] Erro ao listar chaves:', error.message);
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
 */
export async function criarChavePixTCR(alias: string, dados: CorpXCreatePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
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
    const response = await fetch(`${baseUrl}${TCR_CONFIG.endpoints.criarChavePix}`, {
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
        message: responseData?.message || `Erro HTTP ${response.status}`
      } as CorpXCreatePixKeyResponse;
    }

    return {
      erro: responseData?.error === true,
      message: responseData?.message || 'Chave PIX criada com sucesso',
      data: raw
    } as CorpXCreatePixKeyResponse;
  } catch (error: any) {
    console.error('[TCR-PIX-CRIAR] Erro ao criar chave:', error.message);
    return null;
  }
}

/**
 * Cancelar Chave PIX
 * Endpoint: DELETE /api/corpx/pix/chave
 * 
 * Nota: Como api.delete não suporta body, usamos uma requisição customizada
 * mas ainda aproveitando o sistema de autenticação do projeto
 */
export async function cancelarChavePixTCR(dados: CorpXDeletePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
  try {
    // ✅ Usar TOKEN_STORAGE diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.cancelarChavePix}`, {
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
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    } else {
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CANCELAR] Erro ao cancelar chave:', error.message);
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
export async function criarTransferenciaPixTCR(dados: CorpXPixTransferRequest): Promise<CorpXPixTransferResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.criarTransferenciaPix}`, {
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
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
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
    console.error('[TCR-PIX-TRANSFER] Erro ao criar transferência:', error.message);
    return null;
  }
}

/**
 * Confirmar Transferência PIX
 * Endpoint: GET /api/corpx/pix/transferencia/confirmar?endtoend=X&tax_document=Y
 */
export async function confirmarTransferenciaPixTCR(dados: CorpXPixConfirmRequest): Promise<CorpXPixConfirmResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const url = `${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.confirmarTransferenciaPix}?endtoend=${dados.endtoend}&tax_document=${dados.tax_document}`;
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
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
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
        "De": data.pagadorNome || "Conta TCR",
        "CPF/CNPJ": data.recebedorDocument || "***",
        "Para": data.recebedorNome || "Beneficiário",
        "Descrição": data.descricao || ""
      } as CorpXPixConfirmResponse;
    } else {
      return null;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CONFIRM] Erro ao confirmar transferência:', error.message);
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
export async function gerarQRCodePixTCR(dados: CorpXQRCodeRequest): Promise<CorpXQRCodeResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.gerarQRCodePix}`, {
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
    
    return responseData as CorpXQRCodeResponse;
    
  } catch (error: any) {
    console.error('[TCR-PIX-QR] Erro ao gerar QR Code:', error.message);
    return null;
  }
}

/** Infere keyType v2 a partir da chave PIX */
function inferKeyType(key: string): string {
  const k = (key || '').trim();
  if (!k) return 'random';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return 'email';
  if (/^(\+?55)?\d{10,11}$/.test(k.replace(/\D/g, ''))) return 'phone';
  if (/^\d{11}$/.test(k.replace(/\D/g, ''))) return 'cpf';
  if (/^\d{14}$/.test(k.replace(/\D/g, ''))) return 'cnpj';
  if (k.length === 36 && k.includes('-')) return 'random';
  return 'random';
}

/**
 * Enviar PIX (CorpX v2) - 1 etapa
 * Endpoint: POST /api/corpx-v2/pix/out
 * Header: X-Corpx-Account-Context: {alias}
 */
export async function enviarPixCompletoTCR(
  dadosTransferencia: CorpXPixTransferRequest
): Promise<{ criacao: CorpXPixTransferResponse; confirmacao: CorpXPixConfirmResponse } | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const { TCR_CORPX_ALIAS } = await import('@/contexts/CorpXContext');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const valor = typeof dadosTransferencia.valor === 'number' ? dadosTransferencia.valor : parseFloat(String(dadosTransferencia.valor));
    const keyType = inferKeyType(dadosTransferencia.key);
    const identifier = `PIX-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const body = {
      amount: valor,
      currency: 'BRL',
      keyType,
      key: dadosTransferencia.key.trim(),
      description: dadosTransferencia.description || dadosTransferencia.nome || undefined,
      identifier,
    };

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}${TCR_CONFIG.endpoints.pixOut}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': TCR_CORPX_ALIAS,
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();
    const raw = responseData?.data ?? responseData;

    if (!response.ok) {
      throw new Error(responseData?.message || `Erro HTTP ${response.status}`);
    }

    const endToEnd = raw?.endToEndId ?? raw?.endtoend ?? raw?.id ?? identifier;
    return {
      criacao: {
        erro: false,
        endtoend: endToEnd,
        key: dadosTransferencia.key,
        Valor: String(valor),
      } as CorpXPixTransferResponse,
      confirmacao: {
        erro: false,
        idEndToEnd: endToEnd,
        message: 'PIX enviado com sucesso',
        amount: valor,
      } as CorpXPixConfirmResponse,
    };
  } catch (error: any) {
    console.error('[TCR-PIX-COMPLETO] Erro:', error.message);
    return null;
  }
}

/**
 * BigPIX — PIX > R$ 15k (CorpX v2)
 * POST /api/corpx-v2/pix/out/bigpix
 * Header: X-Corpx-Account-Context: TCR
 */
export async function enviarBigPixTCR(dados: { key: string; valor: number; tipo?: number; nome?: string; description?: string }): Promise<{ criacao: CorpXPixTransferResponse; confirmacao: CorpXPixConfirmResponse } | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const { TCR_CORPX_ALIAS } = await import('@/contexts/CorpXContext');
    const userToken = TOKEN_STORAGE.get();
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const valor = typeof dados.valor === 'number' ? dados.valor : parseFloat(String(dados.valor));
    const keyType = inferKeyType(dados.key);
    const identifier = `BIGPIX-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const body = {
      amount: valor,
      currency: 'BRL',
      keyType,
      key: dados.key.trim(),
      description: dados.description || dados.nome || undefined,
      identifier,
    };

    const baseUrl = API_CONFIG.CORPX_V2_BASE_URL || API_CONFIG.BASE_URL;
    const response = await fetch(`${baseUrl}${TCR_CONFIG.endpoints.bigPix}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'X-Corpx-Account-Context': TCR_CORPX_ALIAS,
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();
    const raw = responseData?.data ?? responseData;

    if (!response.ok) {
      throw new Error(responseData?.message || `Erro HTTP ${response.status}`);
    }

    const endToEnd = raw?.endToEndId ?? raw?.endtoend ?? raw?.id ?? identifier;
    return {
      criacao: {
        erro: false,
        endtoend: endToEnd,
        key: dados.key,
        Valor: String(valor),
      } as CorpXPixTransferResponse,
      confirmacao: {
        erro: false,
        idEndToEnd: endToEnd,
        message: 'BigPIX enviado com sucesso',
        amount: valor,
      } as CorpXPixConfirmResponse,
    };
  } catch (error: any) {
    console.error('[TCR-BIGPIX] Erro:', error.message);
    return null;
  }
}

/**
 * 📝 HELPERS UTILITÁRIOS
 */

/**
 * Formatar valor para display
 */
export function formatarValorTCR(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Validar CNPJ (apenas números)
 */
export function validarCNPJTCR(cnpj: string): boolean {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  return cnpjLimpo.length === 14;
}

/**
 * Formatar chave PIX baseado no tipo
 */
export function formatarChavePixTCR(chave: string, tipo: number): string {
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
export function tratarErroTCR(error: any): string {
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

/**
 * PIX Programado com QR Codes
 * POST /api/corpx/pix/programado-qr
 */
export async function executarPixProgramadoComQRTCR(dados: {
  tax_document: string;
  custom_id?: string;
  montante: number;
  valor: number;
  intervalo?: number;
}): Promise<any | null> {
  try {
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.pixProgramadoComQR}`, {
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
    return responseData;
    
  } catch (error: any) {
    return null;
  }
}

// ==================== EXPORT PRINCIPAL ====================

/**
 * Serviço principal TCR Banking
 * Baseado no guia oficial de integração frontend (clone do CorpX)
 * ✅ Implementação completa conforme API
 */
export const TCRService = {
  // 💰 CONTA / SALDO
  consultarSaldo: consultarSaldoTCR,
  consultarExtrato: consultarExtratoTCR,
  listarTransacoes: listarTransacoesTCR,
  sincronizarExtrato: sincronizarExtratoTCR,
  criarConta: criarContaTCR,
  
  // 🔍 VERIFICAÇÃO DE TRANSAÇÃO
  consultarTransacaoPorEndToEnd: consultarTransacaoPorEndToEndTCR,
  
  // 🔑 CHAVES PIX
  listarChavesPix: listarChavesPixTCR,
  criarChavePix: criarChavePixTCR,
  cancelarChavePix: cancelarChavePixTCR,
  
  // 💸 TRANSFERÊNCIAS PIX
  criarTransferenciaPix: criarTransferenciaPixTCR,
  confirmarTransferenciaPix: confirmarTransferenciaPixTCR,
  enviarPixCompleto: enviarPixCompletoTCR,
  
  // 📱 QR CODE PIX
  gerarQRCodePix: gerarQRCodePixTCR,
  
  // 🔄 PIX PROGRAMADO COM QR
  executarPixProgramadoComQR: executarPixProgramadoComQRTCR,
  
  // 📝 HELPERS
  formatarValor: formatarValorTCR,
  validarCNPJ: validarCNPJTCR,
  formatarChavePix: formatarChavePixTCR,
  tratarErro: tratarErroTCR,
} as const;

// Exports compatíveis com versão anterior
export const getTCRSaldo = consultarSaldoTCR;
export const getTCRExtrato = consultarExtratoTCR;

export default TCRService;
