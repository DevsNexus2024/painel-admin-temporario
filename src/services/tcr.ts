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
  CorpXErrorResponse
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
    // 💰 CONTA / SALDO (rotas corretas do backend)
    consultarSaldo: '/api/corpx/account/saldo',
    consultarExtrato: '/api/corpx/account/extrato',
    criarConta: '/api/corpx/account/criar',
    
    // 🔑 CHAVES PIX (rotas corretas do backend)
    listarChavesPix: '/api/corpx/pix/chaves',
    criarChavePix: '/api/corpx/pix/chave',
    cancelarChavePix: '/api/corpx/pix/chave',
    
    // 💸 TRANSFERÊNCIAS PIX (rotas corretas do backend)
    criarTransferenciaPix: '/api/corpx/pix/transferencia',
    confirmarTransferenciaPix: '/api/corpx/pix/transferencia/confirmar',
    
    // 📱 QR CODE PIX (TODO: verificar se existe no backend)
    gerarQRCodePix: '/api/corpx/pix/qrcode',
    
    // 🔄 PIX PROGRAMADO COM QR
    pixProgramadoComQR: '/api/corpx/pix/programado-qr',
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
 * Consultar Saldo
 * Endpoint: GET /api/corpx/account/saldo?tax_document=CNPJ
 */
export async function consultarSaldoTCR(cnpj: string): Promise<CorpXSaldoResponse | null> {
  try {
    
    // ✅ Verificar status do token ANTES da requisição
    const tokenStatus = await checkTokenStatus();
    
    if (!tokenStatus.isValid) {
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const requestUrl = `${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.consultarSaldo}?tax_document=${cnpj}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${userToken}`
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
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    if (backendResponse.error === false && backendResponse.data) {
      // Adaptar dados do backend para a interface esperada
      return {
        erro: false,
        saldo: backendResponse.data.globalBalance || backendResponse.data.saldo || 0,
        saldoDisponivel: backendResponse.data.globalBalance || backendResponse.data.saldo || 0,
        limite: 0, // Campo padrão
        limiteBloqueado: 0 // Campo padrão
      } as CorpXSaldoResponse;
    } else {
      return {
        erro: true,
        saldo: 0,
        saldoDisponivel: 0,
        limite: 0,
        limiteBloqueado: 0
      } as CorpXSaldoResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-SALDO] Erro ao consultar saldo:', error.message);
    
    // ✅ Retornar estrutura de erro em vez de null
    return {
      erro: true,
      saldo: 0,
      saldoDisponivel: 0,
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
 * Listar Chaves PIX
 * Endpoint: GET /api/corpx/pix/chaves?tax_document=CNPJ
 */
export async function listarChavesPixTCR(cnpj: string): Promise<CorpXPixKeysResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.listarChavesPix}?tax_document=${cnpj}`, {
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
    
    // Backend retorna: { error: false, message: "...", data: [...] }
    const backendResponse = responseData as TCRBackendResponse<any[]>;
    
    if (backendResponse.error === false && backendResponse.data) {
      
      const chaves = backendResponse.data.map((item: any, index: number) => {
        
        // ✅ CORREÇÃO: API retorna 'keypix', não 'chave'
        const chaveMapeada = {
          id: item.keypix || item.id || item.chave || index.toString(),
          key: item.keypix || item.chave || item.key || '',
          type: item.tipo || item.type || 'RANDOM',
          status: item.status || 'ACTIVE',
          created_at: item.criado || item.created_at || item.dataCriacao || new Date().toISOString()
        };
        
        return chaveMapeada;
      });
      
      return {
        erro: false,
        chaves
      } as CorpXPixKeysResponse;
    } else {
      return {
        erro: true,
        chaves: []
      } as CorpXPixKeysResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CHAVES] Erro ao listar chaves:', error.message);
    return null;
  }
}

/**
 * Criar Chave PIX
 * Endpoint: POST /api/corpx/pix/chave
 */
export async function criarChavePixTCR(dados: CorpXCreatePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
  try {
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    if (!userToken) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.criarChavePix}`, {
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

/**
 * 🎯 FLUXO COMPLETO - Enviar PIX
 */
export async function enviarPixCompletoTCR(
  dadosTransferencia: CorpXPixTransferRequest
): Promise<{ criacao: CorpXPixTransferResponse; confirmacao: CorpXPixConfirmResponse } | null> {
  try {
    // 1. Criar transferência
    const criacao = await criarTransferenciaPixTCR(dadosTransferencia);
    
    if (!criacao || criacao.erro) {
      throw new Error('Erro ao criar transferência');
    }

    // 2. Confirmar transferência
    const confirmacao = await confirmarTransferenciaPixTCR({
      endtoend: criacao.endtoend,
      tax_document: dadosTransferencia.tax_document
    });

    if (!confirmacao || confirmacao.erro) {
      throw new Error('Erro ao confirmar transferência');
    }

    return {
      criacao,
      confirmacao
    };
    
  } catch (error: any) {
    console.error('[TCR-PIX-COMPLETO] Erro no fluxo completo:', error.message);
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
  criarConta: criarContaTCR,
  
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
