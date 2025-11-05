/**
 * 💸 Bitso PIX Send Service
 * Serviço para enviar PIX via Bitso com ledger
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// ===================================
// TYPES
// ===================================

export interface BitsoPixSendRequest {
  tenant_id: 2 | 3; // 2 = TCR, 3 = OTC
  pix_key: string;
  pix_key_type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  amount: number;
}

export interface BitsoPixSendResponse {
  success: boolean;
  message?: string;
  journal_id?: string;
  end_to_end_id?: string;
  wid?: string;
  status?: string;
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
 * Enviar PIX via Bitso com ledger
 * POST /bitso/pix/send-with-ledger
 */
export async function sendPixWithLedger(data: BitsoPixSendRequest): Promise<BitsoPixSendResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}/bitso/pix/send-with-ledger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: data.tenant_id,
        pix_key: data.pix_key,
        pix_key_type: data.pix_key_type,
        amount: data.amount,
      }),
    });

    const responseData = await response.json();

    // Se status HTTP é sucesso (2xx), retornar dados com success: true
    if (response.ok) {
      return {
        success: true,
        ...responseData,
      };
    }

    // Se status HTTP é erro (4xx, 5xx), extrair mensagem de erro
    // Formato de erro da API: { error: { code, message, traceId } }
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
    throw new Error(error.message || 'Erro ao enviar PIX');
  }
}

