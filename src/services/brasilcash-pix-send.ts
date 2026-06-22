/**
 * 💸 BrasilCash PIX Send Service
 * Serviço para enviar PIX via BrasilCash
 */
import { fetchWithTotp } from '@/services/totpBridge';

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export interface BrasilCashPixSendRequest {
  amount: number; // Valor em reais (será convertido para centavos)
  key_type: 'document' | 'phone' | 'email' | 'randomKey';
  key: string;
  external_id?: string; // ID externo opcional para rastreamento
  /** UUID da conta BrasilCash de origem. Enviado como X-Account-Id — exigido pelo guard de pix-out quando a permissão é por conta (BRASILCASH_ACCOUNT) e seleciona a sub-conta no provedor. */
  accountId?: string;
  /** Alias OTC da conta. Enviado como x-otc-id — seleciona as credenciais corretas no backend. */
  otcId?: string;
}

export interface BrasilCashPixSendResponse {
  success: boolean;
  message?: string;
  transaction_id?: string;
  end_to_end_id?: string;
  endToEndId?: string;
  pix_id?: string;
  amount?: number;
  tax_amount?: number;
  status?: string;
  created_at?: string;
  external_id?: string;
  receiver?: {
    ispb?: string;
    bank_name?: string;
    branch?: string;
    account_number?: string;
    account_type?: string;
    document?: string;
    document_type?: string;
    name?: string;
    trade_name?: string;
  };
  error?: string | {
    code?: string;
    message?: string;
    traceId?: string;
  };
}

// ===================================
// API FUNCTIONS
// ===================================

/**
 * Obter token de autenticação (mesmo padrão dos outros serviços)
 */
function getAuthToken(): string | null {
  return sessionStorage.getItem('jwt_token') || 
         localStorage.getItem('jwt_token') ||
         sessionStorage.getItem('auth_token') || 
         localStorage.getItem('auth_token');
}

/**
 * Converter tipo de chave PIX para formato da API BrasilCash
 * API aceita: document, phone, email, randomKey
 */
function normalizeKeyType(keyType: string): 'document' | 'phone' | 'email' | 'randomKey' {
  const normalized = keyType.toLowerCase();
  
  switch (normalized) {
    case 'cpf':
    case 'cnpj':
    case 'document':
      return 'document';
    case 'phone':
    case 'telefone':
      return 'phone';
    case 'email':
      return 'email';
    case 'evp':
    case 'aleatoria':
    case 'randomkey':
      return 'randomKey';
    default:
      return 'randomKey'; // Padrão seguro
  }
}

/**
 * Enviar PIX via BrasilCash
 * POST /api/brasilcash/pix/cashout/payments
 * Realiza um PIX Cashout completo em uma única operação (initiate + confirm)
 */
export async function sendPixBrasilCash(data: BrasilCashPixSendRequest): Promise<BrasilCashPixSendResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    // Converter valor de reais para centavos
    // Exemplo: 289649.00 reais → 28964900 centavos (multiplicar por 100)
    // A API espera o valor em centavos (integer)
    const amountInCents = Math.round(data.amount * 100);
    
    // Validar que o valor convertido é válido
    if (isNaN(amountInCents) || amountInCents <= 0) {
      throw new Error('Valor inválido. O valor deve ser maior que zero.');
    }
    
    // Log para debug (pode ser removido em produção)
    console.log(`[BrasilCash PIX] Convertendo valor: R$ ${data.amount} → ${amountInCents} centavos`);

    // Normalizar tipo de chave
    const normalizedKeyType = normalizeKeyType(data.key_type);

    // Preparar body da requisição
    const requestBody: {
      amount: number;
      key_type: string;
      key: string;
      external_id?: string;
    } = {
      amount: amountInCents,
      key_type: normalizedKeyType,
      key: data.key.trim(),
    };

    // Adicionar external_id se fornecido
    if (data.external_id && data.external_id.trim()) {
      requestBody.external_id = data.external_id.trim();
    }

    // Preparar headers. X-Account-Id / x-otc-id identificam a conta de origem:
    // sem eles o guard de pix-out não enxerga permissões por conta (BRASILCASH_ACCOUNT)
    // e bloqueia com 403. O backend também usa otcId para escolher as credenciais.
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    };
    if (data.accountId) {
      headers['X-Account-Id'] = data.accountId;
    }
    if (data.otcId) {
      headers['x-otc-id'] = data.otcId;
    }

    const response = await fetchWithTotp(`${API_BASE_URL}/api/brasilcash/pix/cashout/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Se status HTTP é sucesso (2xx), retornar dados com success: true
    if (response.ok) {
      return {
        success: true,
        pix_id: responseData.pix_id || responseData.pixId,
        end_to_end_id: responseData.endToEndId || responseData.end_to_end_id,
        endToEndId: responseData.endToEndId || responseData.end_to_end_id,
        transaction_id: responseData.pix_id || responseData.pixId,
        amount: responseData.amount,
        tax_amount: responseData.tax_amount || responseData.taxAmount,
        status: responseData.status,
        created_at: responseData.created_at || responseData.createdAt,
        external_id: responseData.external_id || responseData.externalId,
        receiver: responseData.receiver,
        message: 'PIX enviado com sucesso!',
      };
    }

    // Se status HTTP é erro (4xx, 5xx), extrair mensagem de erro
    if (responseData.error) {
      const errorMessage = responseData.error.message || responseData.error.code || 'Erro desconhecido';
      return {
        success: false,
        error: {
          code: responseData.error.code,
          message: errorMessage,
          traceId: responseData.error.traceId,
        },
        message: errorMessage,
      };
    }
    
    // Formato alternativo: { message: "..." }
    const errorMessage = responseData.message || `HTTP error! status: ${response.status}`;
    return {
      success: false,
      error: errorMessage,
      message: errorMessage,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao enviar PIX',
      message: error.message || 'Erro desconhecido ao enviar PIX',
    };
  }
}

