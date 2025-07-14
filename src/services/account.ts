import { API_CONFIG, buildApiUrl, getApiHeaders } from "@/config/api";

// Tipos para o serviço de conta
export interface SaldoResponse {
  saldoDisponivel: number;
  saldoBloqueado: number;
  saldoAgendado: number;
  atualizadoEm: string;
}

/**
 * Consulta o saldo da conta
 * @returns Promise com dados do saldo
 */
export const consultarSaldo = async (): Promise<SaldoResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.ACCOUNT.SALDO);
    
    console.log("=== CONSULTANDO SALDO ===");
    console.log("URL:", url);
    console.log("Headers:", getApiHeaders());
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resposta de erro:", errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      throw new Error(errorData.message || errorData.mensagem || `Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log("Resposta bruta:", responseText);
    
    const result: SaldoResponse = JSON.parse(responseText);
    console.log("Dados do saldo parseados:", result);
    console.log("========================");

    return result;
  } catch (error) {
    console.error("=== ERRO AO CONSULTAR SALDO ===");
    console.error("Erro:", error);
    console.error("===============================");
    
    let mensagemErro = 'Erro desconhecido ao consultar saldo';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    throw new Error(mensagemErro);
  }
};

/**
 * Formatar valor monetário para exibição
 * @param valor Valor numérico
 * @returns String formatada em Real brasileiro
 */
export const formatarValorMonetario = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}; 