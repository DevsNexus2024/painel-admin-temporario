import { API_CONFIG, TOKEN_STORAGE } from "@/config/api";

const REVY_PROVIDER = "REVY";
const REVY_API_BASE = "https://api-bank-v2.gruponexus.com.br";

export type RevyJournalType = "DEPOSIT" | "WITHDRAWAL";

export interface FetchRevyTransactionsParams {
  tenantId: number;
  accountId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  journalType?: RevyJournalType;
  search?: string;
  includePostings?: boolean;
}

export interface LedgerPosting {
  id: string;
  accountId: string;
  side: "PAY_IN" | "PAY_OUT";
  amount: string;
  currency: string;
  account: {
    id: string;
    accountType: string;
    accountPurpose?: string;
    balance?: string;
    currency: string;
  };
}

export interface LedgerTransaction {
  id: string;
  type: RevyJournalType;
  description: string | null;
  endToEndId: string | null;
  externalId: string | null;
  provider: string;
  providerTxId: string | null;
  functionalCurrency: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  postings?: LedgerPosting[];
}

export interface LedgerTransactionsResponse {
  success: boolean;
  data: LedgerTransaction[];
  total: number;
  limit: number;
  offset: number;
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
    currentPage?: number;
    totalPages?: number;
  };
}

export interface AccountBalanceResponse {
  success: boolean;
  accountId: string;
  tenantId: string;
  accountType: string;
  currency: string;
  balance: string;
  creditLimit?: string;
  accountPurpose?: string;
}

interface FetchRevyBalanceParams {
  tenantId: number;
  accountId: number;
}

export interface RevyPixPaymentRequest {
  key: string;
  amount: number;
  pin: string;
}

export interface RevyPixPaymentResponse {
  transaction: {
    id: string;
    endToEnd?: string;
    amount: number;
    status: string;
    createdAt: string;
  };
}

const buildQueryString = (params: FetchRevyTransactionsParams): string => {
  const query = new URLSearchParams();

  query.append("tenantId", params.tenantId.toString());
  query.append("provider", REVY_PROVIDER);
  query.append("limit", (params.limit ?? 100).toString());
  query.append("offset", (params.offset ?? 0).toString());

  if (typeof params.includePostings === "boolean") {
    query.append("includePostings", params.includePostings ? "true" : "false");
  } else {
    query.append("includePostings", "true");
  }

  if (params.accountId) {
    query.append("accountId", params.accountId.toString());
  }
  if (params.startDate) {
    query.append("startDate", params.startDate);
  }
  if (params.endDate) {
    query.append("endDate", params.endDate);
  }
  if (params.journalType) {
    query.append("journalType", params.journalType);
  }
  if (params.search) {
    query.append("search", params.search);
  }

  return query.toString();
};

export async function fetchRevyTransactions(
  params: FetchRevyTransactionsParams
): Promise<LedgerTransactionsResponse> {
  const token = TOKEN_STORAGE.get();
  if (!token) {
    throw new Error("Token de autenticação não encontrado. Faça login novamente.");
  }

  const queryString = buildQueryString(params);
  const baseUrl = REVY_API_BASE;
  const endpoint = `${baseUrl}/ledger/transactions?${queryString}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorPayload.message || "Erro ao consultar extrato da Revy");
  }

  const json = await response.json();
  const pagination = json.pagination || {};
  return {
    ...json,
    pagination,
    total: json.total ?? pagination.total ?? (Array.isArray(json.data) ? json.data.length : 0),
    limit: json.limit ?? pagination.limit ?? params.limit ?? 100,
    offset: json.offset ?? pagination.offset ?? params.offset ?? 0,
  };
}

export async function fetchRevyAccountBalance(
  params: FetchRevyBalanceParams
): Promise<AccountBalanceResponse> {
  const token = TOKEN_STORAGE.get();
  if (!token) {
    throw new Error("Token de autenticação não encontrado. Faça login novamente.");
  }

  const endpoint = `${REVY_API_BASE}/ledger/accounts/${params.accountId}/balance?tenantId=${params.tenantId}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorPayload.message || "Erro ao consultar saldo da Revy");
  }

  return response.json();
}

export async function sendRevyPixPayment(
  accountId: string,
  payload: RevyPixPaymentRequest
): Promise<RevyPixPaymentResponse> {
  const token = TOKEN_STORAGE.get();
  if (!token) {
    throw new Error("Token de autenticação não encontrado. Faça login novamente.");
  }

  const endpoint = `https://api-v2.tcr.finance/revy/accounts/${accountId}/pix/payment/simple`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(errorPayload.message || "Erro ao enviar PIX Revy");
  }

  return response.json();
}


