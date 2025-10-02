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
    //console.log('[TCR-SALDO] 🔍 Status do token:', tokenStatus);
    
    if (!tokenStatus.isValid) {
      console.error('[TCR-SALDO] ❌ Token inválido ou expirado!', tokenStatus);
      throw new Error('Token de autenticação inválido ou expirado. Faça login novamente.');
    }
    
    // ✅ Aviso se token expira em menos de 5 minutos
    if (tokenStatus.timeToExpiry < 300) {
      console.warn('[TCR-SALDO] ⚠️ Token expira em breve:', {
        timeToExpiry: tokenStatus.timeToExpiry,
        minutes: Math.floor(tokenStatus.timeToExpiry / 60)
      });
    }
    
    // ✅ Obter token JWT diretamente como no bmp531.ts
    const { TOKEN_STORAGE, API_CONFIG } = await import('@/config/api');
    const userToken = TOKEN_STORAGE.get();
    
    
    if (!userToken) {
      console.error('[TCR-SALDO] ❌ Token de autenticação não encontrado!');
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
      console.error('[TCR-SALDO] ❌ HTTP Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url: requestUrl
      });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    //console.log('[TCR-SALDO] ✅ Resposta completa recebida:', responseData);
    
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
      console.error('[TCR-SALDO] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        saldo: 0,
        saldoDisponivel: 0,
        limite: 0,
        limiteBloqueado: 0
      } as CorpXSaldoResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-SALDO] 💥 Erro detalhado ao consultar saldo:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      httpStatus: error.response?.status,
      httpData: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    // ✅ Se erro 401, verificar se token expirou
    if (error.message.includes('401')) {
      console.warn('[TCR-SALDO] 🔐 Erro 401 detectado - possível token expirado');
      
      // Tentar obter informações do token
      try {
        const { TOKEN_STORAGE } = await import('@/config/api');
        const currentToken = TOKEN_STORAGE.get();
        
        if (currentToken) {
          // Decodificar payload do JWT (sem verificação de assinatura, só para debug)
          const payload = JSON.parse(atob(currentToken.split('.')[1]));
          const now = Math.floor(Date.now() / 1000);
          
          console.warn('[TCR-SALDO] 🔍 Token analysis:', {
            hasToken: !!currentToken,
            tokenExp: payload.exp,
            currentTime: now,
            isExpired: payload.exp < now,
            timeToExpiry: payload.exp - now,
            userId: payload.sub || payload.id || 'unknown'
          });
        }
      } catch (tokenError) {
        console.error('[TCR-SALDO] ❌ Erro ao analisar token:', tokenError);
      }
    }
    
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
    //console.log('[TCR-EXTRATO] Consultando extrato TCR...', params);
    
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
    
    //console.log('[TCR-EXTRATO] 🧪 TESTE: Paginação real TCR - página', params.page || 1);
    
    //console.log('[TCR-EXTRATO] Request body enviado:', requestBody);
    //console.log('[TCR-EXTRATO] URL da requisição:', `${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.consultarExtrato}`);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${TCR_CONFIG.endpoints.consultarExtrato}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(requestBody)
    });

    //console.log('[TCR-EXTRATO] Status da resposta HTTP:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorDetails;
      try {
        const errorText = await response.text();
        console.error('[TCR-EXTRATO] ❌ Erro HTTP RAW:', errorText);
        
        // Tentar fazer parse do JSON do erro
        try {
          errorDetails = JSON.parse(errorText);
          console.error('[TCR-EXTRATO] ❌ Erro HTTP JSON:', errorDetails);
        } catch {
          errorDetails = { message: errorText };
        }
      } catch (readError) {
        console.error('[TCR-EXTRATO] ❌ Erro ao ler resposta:', readError);
        errorDetails = { message: 'Erro ao ler resposta do servidor' };
      }
      
      // Log específico para erro 400
      if (response.status === 400) {
        console.error('[TCR-EXTRATO] 🚨 ERRO 400 DETALHADO:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          requestBody: requestBody,
          errorResponse: errorDetails
        });
      }
      
      throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }

    const responseData = await response.json();
    //console.log('[TCR-EXTRATO] Resposta completa recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    
    if (backendResponse.error === false && backendResponse.data) {
      // ✅ Melhor tratamento: verificar se data é array ou objeto com array dentro
      let rawTransactions = [];
      
      if (Array.isArray(backendResponse.data)) {
        rawTransactions = backendResponse.data;
      } else if (backendResponse.data.extrato && Array.isArray(backendResponse.data.extrato)) {
        // ✅ CORREÇÃO: TCR retorna dados em data.extrato
        //console.log('[TCR-EXTRATO] ✅ Encontrou data.extrato com', backendResponse.data.extrato.length, 'transações');
        rawTransactions = backendResponse.data.extrato;
      } else if (backendResponse.data.transactions && Array.isArray(backendResponse.data.transactions)) {
        rawTransactions = backendResponse.data.transactions;
      } else if (backendResponse.data.items && Array.isArray(backendResponse.data.items)) {
        rawTransactions = backendResponse.data.items;
      } else {
        //console.log('[TCR-EXTRATO] ❌ Dados não estão em formato de array:', backendResponse.data);
        //console.log('[TCR-EXTRATO] 🔍 Estrutura encontrada:', Object.keys(backendResponse.data));
        rawTransactions = [];
      }
      
      //console.log('[TCR-EXTRATO] Transações encontradas:', rawTransactions.length);
      
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
      console.error('[TCR-EXTRATO] Erro na resposta:', backendResponse.message || 'Resposta sem dados');
      
      // ✅ Verificar se ainda assim há dados para retornar
      if (responseData && (Array.isArray(responseData) || responseData.length > 0)) {
        //console.log('[TCR-EXTRATO] Tentando processar dados diretos da resposta...');
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
    console.error('[TCR-EXTRATO] Erro ao consultar extrato:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });
    
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
    //console.log('[TCR-CONTA] Criando conta TCR...', dados);
    
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
    //console.log('[TCR-CONTA] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message,
        account_id: backendResponse.data?.id || null
      } as CorpXCreateAccountResponse;
    } else {
      console.error('[TCR-CONTA] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreateAccountResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-CONTA] Erro ao criar conta:', error.response?.data);
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
    //console.log('[TCR-PIX-CHAVES] Listando chaves PIX...', cnpj);
    
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
    //console.log('[TCR-PIX-CHAVES] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: [...] }
    const backendResponse = responseData as TCRBackendResponse<any[]>;
    
    if (backendResponse.error === false && backendResponse.data) {
      //console.log('[TCR-PIX-CHAVES] 📊 Dados brutos da API:', backendResponse.data);
      
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
      console.error('[TCR-PIX-CHAVES] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        chaves: []
      } as CorpXPixKeysResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CHAVES] Erro ao listar chaves:', error.response?.data);
    return null;
  }
}

/**
 * Criar Chave PIX
 * Endpoint: POST /api/corpx/pix/chave
 */
export async function criarChavePixTCR(dados: CorpXCreatePixKeyRequest): Promise<CorpXCreatePixKeyResponse | null> {
  try {
    //console.log('[TCR-PIX-CRIAR] Criando chave PIX...', dados);
    
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
    //console.log('[TCR-PIX-CRIAR] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    } else {
      console.error('[TCR-PIX-CRIAR] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CRIAR] Erro ao criar chave:', error.response?.data);
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
    //console.log('[TCR-PIX-CANCELAR] Cancelando chave PIX...', dados);
    
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
    //console.log('[TCR-PIX-CANCELAR] Resposta recebida:', responseData);
    
    // Backend retorna: { error: false, message: "...", data: {...} }
    const backendResponse = responseData as TCRBackendResponse<any>;
    
    if (backendResponse.error === false) {
      return {
        erro: false,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    } else {
      console.error('[TCR-PIX-CANCELAR] Erro na resposta:', backendResponse.message);
      return {
        erro: true,
        message: backendResponse.message
      } as CorpXCreatePixKeyResponse;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CANCELAR] Erro ao cancelar chave:', error);
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
    //console.log('[TCR-PIX-TRANSFER] Criando transferência PIX...', dados);
    
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
    //console.log('[TCR-PIX-TRANSFER] Resposta recebida:', responseData);
    
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
      console.error('[TCR-PIX-TRANSFER] Erro na resposta:', backendResponse.message);
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
    console.error('[TCR-PIX-TRANSFER] Erro ao criar transferência:', error.response?.data);
    return null;
  }
}

/**
 * Confirmar Transferência PIX
 * Endpoint: GET /api/corpx/pix/transferencia/confirmar?endtoend=X&tax_document=Y
 */
export async function confirmarTransferenciaPixTCR(dados: CorpXPixConfirmRequest): Promise<CorpXPixConfirmResponse | null> {
  try {
    //console.log('[TCR-PIX-CONFIRM] Confirmando transferência PIX...', dados);
    
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
    //console.log('[TCR-PIX-CONFIRM] Resposta recebida:', responseData);
    
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
      console.error('[TCR-PIX-CONFIRM] Erro na resposta:', backendResponse.message);
      return null;
    }
    
  } catch (error: any) {
    console.error('[TCR-PIX-CONFIRM] Erro ao confirmar transferência:', error.response?.data);
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
    //console.log('[TCR-PIX-QR] Gerando QR Code PIX...', dados);
    
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
    //console.log('[TCR-PIX-QR] Resposta recebida:', responseData);
    
    return responseData as CorpXQRCodeResponse;
    
  } catch (error: any) {
    console.error('[TCR-PIX-QR] Erro ao gerar QR Code:', error.response?.data);
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
    //console.log('[TCR-PIX-COMPLETO] Iniciando fluxo completo PIX...', dadosTransferencia);
    
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

    //console.log('[TCR-PIX-COMPLETO] Fluxo completo executado com sucesso');

    return {
      criacao,
      confirmacao
    };
    
  } catch (error: any) {
    console.error('[TCR-PIX-COMPLETO] Erro no fluxo completo:', error);
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
