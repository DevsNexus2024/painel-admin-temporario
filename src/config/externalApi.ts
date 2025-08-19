// ===============================================
// 🔐 CONFIGURAÇÃO DA API EXTERNA - BaaS TCR
// ===============================================

/**
 * Configurações da API Externa para atualização de depósitos
 */
export const EXTERNAL_API_CONFIG = {
  // 🌐 URL base da API externa
  BASE_URL: import.meta.env.X_DIAGNOSTICO_API_URL,
  
  // 📍 Endpoints disponíveis
  ENDPOINTS: {
    ATUALIZAR_DEPOSITO: '/api/externos/depositos/atualizar',
    STATUS_API: '/api/externos/status'
  },
  
  // 🔑 API Key (configurada no DigitalOcean App Platform)
  API_KEY: import.meta.env.X_EXTERNAL_API_KEY,
  
  // ⚙️ Configurações gerais
  TIMEOUT: 30000, // 30 segundos
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

/**
 * Headers padrão para requisições da API externa
 */
export const getExternalApiHeaders = (additionalHeaders?: Record<string, string>) => ({
  'Content-Type': 'application/json',
  'x-external-api-key': EXTERNAL_API_CONFIG.API_KEY,
  ...additionalHeaders
});

/**
 * Constrói a URL completa para um endpoint
 */
export const buildExternalApiUrl = (endpoint: string): string => {
  return `${EXTERNAL_API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Interface para resposta da API externa
 */
export interface ExternalApiResponse<T = any> {
  sucesso: boolean;
  mensagem: string;
  response?: T;
  erro?: string;
}

/**
 * Interface para dados de atualização de depósito
 */
export interface AtualizarDepositoRequest {
  id_deposito: number;
  id_usuario: number;
  status_deposito: string;
  step: string;
}

/**
 * Função utilitária para fazer requisições à API externa
 */
export const callExternalApi = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ExternalApiResponse<T>> => {
  const url = buildExternalApiUrl(endpoint);
  const headers = getExternalApiHeaders(options.headers as Record<string, string>);
  
  const config: RequestInit = {
    ...options,
    headers,
    signal: AbortSignal.timeout(EXTERNAL_API_CONFIG.TIMEOUT)
  };

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    if (!response.ok) {
      // Tratamento específico por código de erro
      const errorMessage = (() => {
        switch (response.status) {
          case 401:
            return '❌ API Key inválida ou não fornecida';
          case 400:
            return `❌ Dados inválidos: ${result.erro || result.mensagem}`;
          case 404:
            return `❌ Recurso não encontrado: ${result.mensagem}`;
          case 500:
            return `❌ Erro interno do servidor: ${result.erro || result.mensagem}`;
          default:
            return `❌ Erro HTTP ${response.status}: ${result.mensagem || response.statusText}`;
        }
      })();
      
      throw new Error(errorMessage);
    }

    return result;
  } catch (error) {
    // Log seguro - erro na API externa (dados não expostos)
    throw error;
  }
};

/**
 * Testa se a API externa está funcionando
 */
export const testarApiExterna = async (): Promise<boolean> => {
  try {
    const response = await callExternalApi(EXTERNAL_API_CONFIG.ENDPOINTS.STATUS_API);
    
    if (response.sucesso) {

      return true;
    } else {

      return false;
    }
  } catch (error) {
    // Log seguro - erro ao testar API externa (dados não expostos)
    return false;
  }
};

