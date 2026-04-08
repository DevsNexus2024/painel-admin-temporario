import { API_CONFIG, TOKEN_STORAGE, USER_STORAGE } from '@/config/api';
import {
  OtcReportFilters,
  BankingReportFilters,
  TarifaReportFilters,
  TcrTransactionsResponse,
  TcrBalanceResponse,
  CorpxTransactionsResponse,
  BrasilCashTransactionsResponse,
  CashClosureResponse,
  DepositsStatsResponse,
  TcrAccountsResponse,
} from '@/types/reports';
import { OTCApiResponse, OTCStatement, OTCConversionsResponse } from '@/types/otc';

const OTC_BASE_URL = '/api/otc';
const W3_BASE_URL = API_CONFIG.CORPX_V2_BASE_URL;

/**
 * Converte data YYYY-MM-DD para ISO com início ou fim do dia em BRT.
 * Início: 00:00:00 BRT = 03:00:00 UTC (BRT = UTC-3)
 * Fim: 23:59:59 BRT = 02:59:59 UTC do dia seguinte
 */
function normalizeDateParam(dateStr: string, isEndDate: boolean): string {
  if (!dateStr || dateStr.includes('T')) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isEndDate) {
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59));
    return nextDay.toISOString();
  } else {
    return new Date(Date.UTC(year, month - 1, day, 3, 0, 0)).toISOString();
  }
}

// Helper: fetch autenticado com tratamento de 401 e timeout (mesmo padrão do api.ts)
async function authFetch<T>(
  url: string,
  options: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<T> {
  // Combina signal do caller (cancelamento) com timeout por request
  const timeoutMs = API_CONFIG.TIMEOUT || 60000;
  const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (options.signal) signals.push(options.signal);
  const combinedSignal = AbortSignal.any(signals);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN_STORAGE.get() || ''}`,
      ...options.headers,
    },
    signal: combinedSignal,
  });

  // Tratamento de 401 — mesmo comportamento do api.ts
  if (response.status === 401) {
    TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
    throw new Error('Sessão expirada. Redirecionando para login...');
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.message) errorMessage = errorData.message;
    } catch (_) { /* ignore parse error */ }
    throw new Error(errorMessage);
  }

  return response.json();
}

class ReportService {

  // ===== OTC (BaaS-TCR) =====

  async fetchOtcStatement(
    clientId: number,
    filters: OtcReportFilters,
    page: number = 1,
    limit: number = 200,
    signal?: AbortSignal,
  ): Promise<OTCApiResponse<OTCStatement>> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (filters.dateFrom) params.append('dateFrom', normalizeDateParam(filters.dateFrom, false));
    if (filters.dateTo) params.append('dateTo', normalizeDateParam(filters.dateTo, true));
    if (filters.operationType && filters.operationType !== 'conversion') {
      params.append('operationType', filters.operationType);
    }
    params.append('hideReversals', String(filters.hideReversals !== false));

    return authFetch<OTCApiResponse<OTCStatement>>(
      `${API_CONFIG.BASE_URL}${OTC_BASE_URL}/clients/${clientId}/statement?${params}`,
      { signal },
    );
  }

  async fetchOtcConversions(
    clientId: number,
    filters: OtcReportFilters,
    page: number = 1,
    limit: number = 50,
    signal?: AbortSignal,
  ): Promise<OTCConversionsResponse> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (filters.dateFrom) params.append('dateFrom', normalizeDateParam(filters.dateFrom, false));
    if (filters.dateTo) params.append('dateTo', normalizeDateParam(filters.dateTo, true));

    return authFetch<OTCConversionsResponse>(
      `${API_CONFIG.BASE_URL}${OTC_BASE_URL}/clients/${clientId}/conversions?${params}`,
      { signal },
    );
  }

  // ===== DEPÓSITOS STATS (BaaS-TCR) =====

  async fetchDepositsStats(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DepositsStatsResponse> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    return authFetch<DepositsStatsResponse>(
      `${API_CONFIG.BASE_URL}${OTC_BASE_URL}/deposits/stats?${params}`,
    );
  }

  // ===== CONTAS (BaaS-W3Build via tcr-baas) =====

  async fetchAccounts(provider?: string): Promise<TcrAccountsResponse> {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    params.append('status', 'active');

    return authFetch<TcrAccountsResponse>(
      `${W3_BASE_URL}/api/tcr-baas/account/list?${params}`,
    );
  }

  // ===== BANCÁRIO (BaaS-W3Build via tcr-baas) =====

  async fetchBankingTransactions(
    filters: BankingReportFilters,
    page: number = 1,
    pageSize: number = 100,
    signal?: AbortSignal,
  ): Promise<TcrTransactionsResponse> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));
    if (filters.dateFrom) params.append('startDate', filters.dateFrom);
    if (filters.dateTo) params.append('endDate', filters.dateTo);
    // Backend exige CORPX/BRASILCASH em maiúsculo
    if (filters.provider && filters.provider !== 'all') params.append('provider', filters.provider.toUpperCase());
    if (filters.accountId) params.append('accountId', filters.accountId);
    if (filters.type) params.append('type', filters.type);
    if (filters.search) {
      params.append('document', filters.search);
      params.append('name', filters.search);
    }

    return authFetch<TcrTransactionsResponse>(
      `${W3_BASE_URL}/api/tcr-baas/account/transactions?${params}`,
      { signal },
    );
  }

  async fetchBankingBalance(
    provider?: string,
    accountId?: string,
  ): Promise<TcrBalanceResponse> {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (accountId) params.append('accountId', accountId);

    return authFetch<TcrBalanceResponse>(`${W3_BASE_URL}/api/tcr-baas/account/balance?${params}`);
  }

  async fetchCashClosure(
    filters: BankingReportFilters,
  ): Promise<CashClosureResponse> {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('startDate', filters.dateFrom);
    if (filters.dateTo) params.append('endDate', filters.dateTo);
    if (filters.accountId) params.append('accountId', filters.accountId);

    return authFetch<CashClosureResponse>(`${W3_BASE_URL}/api/cash-closure?${params}`);
  }

  // ===== TARIFAS (BaaS-W3Build — endpoints diretos dos providers) =====

  async fetchCorpxTariffs(
    filters: TarifaReportFilters,
    offset: number = 0,
    limit: number = 2000,
    signal?: AbortSignal,
  ): Promise<CorpxTransactionsResponse> {
    const params = new URLSearchParams();
    // Tarifas CorpX: beneficiaryName = 'TARIFA' (match exato) + transactionType = 'D'
    params.append('beneficiaryName', 'TARIFA');
    params.append('transactionType', 'D');
    params.append('offset', String(offset));
    params.append('limit', String(limit));
    if (filters.dateFrom) params.append('startDate', filters.dateFrom);
    if (filters.dateTo) params.append('endDate', filters.dateTo);
    if (filters.accountId) params.append('accountId', filters.accountId);

    return authFetch<CorpxTransactionsResponse>(
      `${W3_BASE_URL}/api/corpx/transactions?${params}`,
      { signal },
    );
  }

  async fetchBrasilcashTariffs(
    filters: TarifaReportFilters,
    offset: number = 0,
    limit: number = 2000,
    signal?: AbortSignal,
  ): Promise<BrasilCashTransactionsResponse> {
    const params = new URLSearchParams();
    params.append('type', 'tarifa');
    params.append('offset', String(offset));
    params.append('limit', String(limit));
    if (filters.dateFrom) params.append('startDate', filters.dateFrom);
    if (filters.dateTo) params.append('endDate', filters.dateTo);

    const headers: Record<string, string> = {};
    if (filters.otcId) headers['x-otc-id'] = filters.otcId;

    return authFetch<BrasilCashTransactionsResponse>(
      `${W3_BASE_URL}/api/brasilcash/transactions?${params}`,
      { signal, headers },
    );
  }
}

export const reportService = new ReportService();
