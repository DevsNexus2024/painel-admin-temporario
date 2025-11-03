import { TOKEN_STORAGE } from "@/config/api";
import { toast } from "sonner";

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';
const API_BASE = '/ledger';

/**
 * Tratamento centralizado de erros da API
 */
const handleApiError = (error: any, defaultMessage: string) => {
  if (error.status === 401) {
    toast.error("Sessão expirada. Redirecionando para login...");
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
    return;
  }
  
  if (error.status === 403) {
    toast.error("Você não tem permissão para acessar esta área.");
    return;
  }
  
  if (error.status === 404) {
    toast.error("Recurso não encontrado.");
    return;
  }
  
  toast.error(error.message || defaultMessage);
};

/**
 * Serviço de API para o módulo de Contas e Organizações
 * Baseado no FRONTEND-GUIDE.md
 */
export const ledgerApi = {
  /**
   * Listar tenants (organizações)
   */
  async listTenants(filters?: {
    page?: number;
    limit?: number;
    name?: string;
    slug?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.name) params.append('name', filters.name);
    if (filters?.slug) params.append('slug', filters.slug);
    if (filters?.status) params.append('status', filters.status);

    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_BASE}/tenants?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao listar tenants' }));
        throw { status: response.status, message: error.message || 'Erro ao listar tenants' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao listar organizações');
      throw error;
    }
  },

  /**
   * Listar accounts (contas)
   */
  async listAccounts(filters?: {
    page?: number;
    limit?: number;
    tenantId?: number;
    userId?: number;
    accountType?: string;
    currency?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.tenantId) params.append('tenantId', filters.tenantId.toString());
    if (filters?.userId) params.append('userId', filters.userId.toString());
    if (filters?.accountType) params.append('accountType', filters.accountType);
    if (filters?.currency) params.append('currency', filters.currency);

    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_BASE}/accounts?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao listar accounts' }));
        throw { status: response.status, message: error.message || 'Erro ao listar contas' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao listar contas');
      throw error;
    }
  },

  /**
   * Listar transações do ledger
   * OBRIGATÓRIO: tenantId na query
   */
  async listTransactions(tenantId: number, filters?: {
    provider?: string;
    journalType?: string;
    accountId?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
    includePostings?: boolean;
  }) {
    const params = new URLSearchParams();
    params.append('tenantId', tenantId.toString());
    if (filters?.provider) params.append('provider', filters.provider);
    if (filters?.journalType) params.append('journalType', filters.journalType);
    if (filters?.accountId) params.append('accountId', filters.accountId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.includePostings !== undefined) {
      params.append('includePostings', filters.includePostings.toString());
    }

    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_BASE}/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao listar transações' }));
        throw { status: response.status, message: error.message || 'Erro ao listar transações' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao listar transações');
      throw error;
    }
  },

  /**
   * Detalhes de uma transação específica
   */
  async getTransactionDetails(transactionId: number, tenantId: number) {
    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_BASE}/transactions/${transactionId}?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao buscar detalhes' }));
        throw { status: response.status, message: error.message || 'Erro ao buscar detalhes da transação' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao buscar detalhes da transação');
      throw error;
    }
  },

  /**
   * Consultar saldo de uma conta
   */
  async getAccountBalance(accountId: number, tenantId: number) {
    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_BASE}/accounts/${accountId}/balance?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao buscar saldo' }));
        throw { status: response.status, message: error.message || 'Erro ao buscar saldo' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao buscar saldo');
      throw error;
    }
  },

  /**
   * Resumo agregado de saldos
   */
  async getBalanceSummary(tenantId: number, filters?: {
    accountId?: number;
    currency?: string;
    provider?: string;
    journalType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    params.append('tenantId', tenantId.toString());
    if (filters?.accountId) params.append('accountId', filters.accountId.toString());
    if (filters?.currency) params.append('currency', filters.currency);
    if (filters?.provider) params.append('provider', filters.provider);
    if (filters?.journalType) params.append('journalType', filters.journalType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_BASE}/balance-summary?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao buscar resumo' }));
        throw { status: response.status, message: error.message || 'Erro ao buscar resumo de saldo' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao buscar resumo de saldo');
      throw error;
    }
  },

  /**
   * Gerar extrato formatado
   */
  async getStatement(tenantId: number, filters: {
    startDate: string;
    endDate: string;
    accountId?: number;
    provider?: string;
    journalType?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    params.append('tenantId', tenantId.toString());
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);
    if (filters.accountId) params.append('accountId', filters.accountId.toString());
    if (filters.provider) params.append('provider', filters.provider);
    if (filters.journalType) params.append('journalType', filters.journalType);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const token = TOKEN_STORAGE.get();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_BASE}/statement?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao gerar extrato' }));
        throw { status: response.status, message: error.message || 'Erro ao gerar extrato' };
      }

      return response.json();
    } catch (error: any) {
      handleApiError(error, 'Erro ao gerar extrato');
      throw error;
    }
  },
};

