/**
 * 🔄 Bitso Sync Service
 * Serviço para sincronizar extrato da Bitso
 */

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

/**
 * Obter token de autenticação
 */
function getAuthToken(): string | null {
  return sessionStorage.getItem('jwt_token') || 
         localStorage.getItem('jwt_token') ||
         sessionStorage.getItem('auth_token') || 
         localStorage.getItem('auth_token');
}

/**
 * Obter data atual no formato YYYY-MM-DD
 */
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Sincronizar extrato da Bitso para a data atual
 * POST /bitso/sync/{date}
 */
export async function syncBitsoExtract(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token de autenticação não encontrado. Faça login novamente.');
    }

    const date = getTodayDate();
    const response = await fetch(`${API_BASE_URL}/bitso/sync/${date}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const responseData = await response.json();

    // Se a resposta tem status de erro HTTP
    if (!response.ok) {
      // Formato: { error: { code, message, traceId } }
      if (responseData.error) {
        const errorMsg = responseData.error.message || responseData.error.code || 'Erro desconhecido';
        return {
          success: false,
          error: errorMsg,
        };
      }
      
      // Formato alternativo
      const errorMsg = responseData.message || `HTTP error! status: ${response.status}`;
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Sucesso
    return {
      success: true,
      message: responseData.message || 'Extrato sincronizado com sucesso!',
      ...responseData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao sincronizar extrato',
    };
  }
}

