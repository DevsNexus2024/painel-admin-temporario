import {
  CashClosureListParams,
  CashClosureListResponse,
  CashClosureSummary,
  DailyEvolutionResponse,
  CashClosureDetail,
  CashClosureAccountsResponse,
} from '@/types/cash-closure';
import { getApiHeaders } from '@/config/api';

// BASE URL conforme documentação
const CASH_CLOSURE_API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';
const CASH_CLOSURE_ENDPOINT = '/api/cash-closure';

/**
 * Serviço para gerenciar Cash Closure
 */
export class CashClosureService {
  /**
   * Lista fechamentos de caixa
   */
  async listClosures(params: CashClosureListParams = {}): Promise<CashClosureListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params.endDate) {
      searchParams.append('endDate', params.endDate);
    }
    if (params.taxDocument) {
      searchParams.append('taxDocument', params.taxDocument);
    }
    if (params.accountType) {
      searchParams.append('accountType', params.accountType);
    }
    if (params.page) {
      searchParams.append('page', String(params.page));
    }
    if (params.limit) {
      searchParams.append('limit', String(params.limit));
    }

    const queryString = searchParams.toString();
    const url = `${CASH_CLOSURE_API_BASE_URL}${CASH_CLOSURE_ENDPOINT}${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Obtém resumo do período
   */
  async getSummary(params: { startDate?: string; endDate?: string; taxDocument?: string } = {}): Promise<CashClosureSummary> {
    const searchParams = new URLSearchParams();
    
    if (params.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params.endDate) {
      searchParams.append('endDate', params.endDate);
    }
    if (params.taxDocument) {
      searchParams.append('taxDocument', params.taxDocument);
    }

    const queryString = searchParams.toString();
    const url = `${CASH_CLOSURE_API_BASE_URL}${CASH_CLOSURE_ENDPOINT}/summary${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Obtém detalhes de um fechamento específico
   */
  async getClosureById(id: string): Promise<CashClosureDetail> {
    const url = `${CASH_CLOSURE_API_BASE_URL}${CASH_CLOSURE_ENDPOINT}/${id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Obtém dados para gráfico de evolução diária
   */
  async getDailyEvolution(params: {
    startDate?: string;
    endDate?: string;
    taxDocument?: string;
  } = {}): Promise<DailyEvolutionResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params.endDate) {
      searchParams.append('endDate', params.endDate);
    }
    if (params.taxDocument) {
      searchParams.append('taxDocument', params.taxDocument);
    }

    const queryString = searchParams.toString();
    const url = `${CASH_CLOSURE_API_BASE_URL}${CASH_CLOSURE_ENDPOINT}/daily-evolution${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Lista contas disponíveis
   */
  async getAccounts(): Promise<CashClosureAccountsResponse> {
    const url = `${CASH_CLOSURE_API_BASE_URL}${CASH_CLOSURE_ENDPOINT}/accounts`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
}

// Instância singleton do serviço
export const cashClosureService = new CashClosureService();
