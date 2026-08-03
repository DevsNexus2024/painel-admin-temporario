/**
 * NTX Pay ↔ TCR — serviço de leitura do painel.
 *
 * Extrato: lê o NOSSO banco (`ntx_transactions`, alimentada por webhook + sync)
 * via `GET /api/ntxpay/transactions` — padrão BrasilCash/CorpX. Sem os caps da
 * API live (100/página, janela 31 dias); doc da contraparte vem COMPLETO quando
 * já enriquecido. Dados novos dependem do sync (cron 30/30min + D-1) — o botão
 * Sincronizar da tela chama `POST /api/ntxpay/sync` (janela máx 31d, 3/min, 409
 * se já houver um sync em execução).
 *
 * Saldo: continua LIVE (`GET /api/ntxpay/balance`) — em REAIS, sem /100.
 *
 * Datas: a API devolve `processingDate` (tempo do PROVIDER) e `createdAt`
 * (INSERT no nosso banco). O mapper expõe processingDate como `createdAt` da
 * UI — tabela/CSV/compensação continuam mostrando o tempo real da transação.
 */
import { API_CONFIG } from '@/config/api';

// As rotas /api/ntxpay vivem no backend V2 (api-bank-v2) — API_CONFIG.BASE_URL aponta
// pro V1 e NÃO tem o módulo ntxpay. CORPX_V2_BASE_URL é a base v2 env-driven do painel
// (default prod api-bank-v2); X_NTX_API_URL/X_BAAS_V2_API_URL permitem override local.
const NTX_API_BASE =
  (import.meta.env.X_NTX_API_URL as string) ||
  (import.meta.env.X_BAAS_V2_API_URL as string) ||
  API_CONFIG.CORPX_V2_BASE_URL;

const NTX_BASE = `${NTX_API_BASE.endsWith('/') ? NTX_API_BASE.slice(0, -1) : NTX_API_BASE}/api/ntxpay`;

// ===================== Tipos =====================

export interface NtxBalance {
  grossBalance: number | null;
  blockedBalance: number | null;
  netBalance: number | null;
}

/** Item da resposta de `GET /api/ntxpay/transactions` (egress whitelist do backend). */
export type NtxDbTransactionItem = {
  id: string;
  ntxTransactionId: string;
  externalId: string | null;
  endToEndId: string | null;
  parentTransactionId: string | null;
  eventType: string; // canônico: CashIn | CashOut | CashInReversal | CashOutReversal
  movementType: string | null; // CREDIT | DEBIT
  status: string; // canônico: PENDING | CONFIRMED | ERROR (cru se o sync persistiu desconhecido)
  originalAmount: number; // REAIS
  feeAmount: number;
  finalAmount: number;
  pixKey: string | null;
  counterpartName: string | null;
  counterpartDocument: string | null; // COMPLETO quando counterpartDocumentMasked=false
  counterpartDocumentMasked: boolean;
  counterpartBankIspb: string | null;
  counterpartBankCode: string | null;
  counterpartBankName: string | null;
  counterpartAccountBranch: string | null;
  counterpartAccountNumber: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  processingDate: string | null; // tempo do PROVIDER (ISO)
  source: string; // WEBHOOK | SYNC
  createdAt: string; // INSERT no nosso banco (ISO)
};

export interface NtxTransactionDB {
  id: string; // = ntxTransactionId (chave de linha/compensação no painel)
  transactionId: string;
  endToEndId: string;
  externalId: string;
  type: 'FUNDING' | 'WITHDRAWAL' | 'UNKNOWN';
  status: string; // enum canônico do banco (label PT via getNtxStatusLabel)
  amount: string; // originalAmount em reais (o webhook credita o BRUTO — compensação usa o mesmo)
  feeAmount: string;
  finalAmount: string;
  counterpartName: string;
  counterpartDocument: string; // completo quando enriquecido (counterpartDocumentMasked=false)
  counterpartBankName: string;
  counterpartBranch: string;
  counterpartAccount: string;
  counterpartIspb: string;
  description: string;
  createdAt: string; // = processingDate (tempo do provider; fallback INSERT)
  processedAt: string;
  isRefund: boolean;
  eventRaw: string; // eventType canônico (label PT via getNtxEventLabel)
  _original: Record<string, unknown>;
}

export interface NtxStatementFilters {
  page?: number;
  size?: number; // leitura DB: até 2000
  status?: string; // enum CRU: PENDING | CONFIRMED | ERROR
  type?: string; // enum CRU: PAYMENT | WITHDRAW | REFUND_IN | REFUND_OUT
  startDate?: string; // ISO — filtra processingDate; leitura SEM janela máxima
  endDate?: string; // ISO
  externalId?: string;
  endToEndId?: string;
}

export interface NtxStatementResult {
  transactions: NtxTransactionDB[];
  currentPage: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
  raw: any;
}

/** Resultado do `POST /api/ntxpay/sync` (NtxSyncResult do W3Build). */
export interface NtxSyncResult {
  window: { startDate: string; endDate: string };
  pagesFetched: number;
  itemsSeen: number;
  created: number;
  updated: number;
  skipped: number;
  webhookLost: number;
  enriched: number;
  balanceUpdated: boolean;
  webhookLostSamples: unknown[];
  anomalies: unknown[];
}

/** Página default da tela (o Select oferece 20/50/100). */
export const NTX_DEFAULT_PAGE_SIZE = 100;
/** Máximo aceito pela LEITURA DB (`size` do GET /transactions) — usado pelo export CSV. */
export const NTX_MAX_PAGE_SIZE = 2000;
/** Janela máxima do SYNC (POST /sync recusa >31d). A LEITURA não tem janela. */
export const NTX_MAX_WINDOW_DAYS = 31;
export const NTX_STATUS_FILTERS = ['PENDING', 'CONFIRMED', 'ERROR'] as const;
export const NTX_TYPE_FILTERS = ['PAYMENT', 'WITHDRAW', 'REFUND_IN', 'REFUND_OUT'] as const;

// ===================== Auth =====================

function getAuthToken(): string | null {
  return (
    localStorage.getItem('auth_token') ||
    localStorage.getItem('jwt_token') ||
    sessionStorage.getItem('auth_token') ||
    sessionStorage.getItem('jwt_token')
  );
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ===================== API =====================

/** GET /api/ntxpay/balance → { grossBalance, blockedBalance, netBalance } (reais, LIVE). */
export async function getNtxBalance(): Promise<NtxBalance> {
  const res = await fetch(`${NTX_BASE}/balance`, { method: 'GET', headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Falha ao consultar saldo NTX (HTTP ${res.status})`);
  }
  const d = await res.json();
  return {
    grossBalance: toNum(d?.grossBalance),
    blockedBalance: toNum(d?.blockedBalance),
    netBalance: toNum(d?.netBalance),
  };
}

/** GET /api/ntxpay/transactions — extrato paginado do NOSSO banco (sem janela máxima). */
export async function getNtxStatement(filters: NtxStatementFilters = {}): Promise<NtxStatementResult> {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.append('page', String(filters.page));
  if (filters.size !== undefined) params.append('size', String(filters.size));
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.externalId) params.append('externalId', filters.externalId);
  if (filters.endToEndId) params.append('endToEndId', filters.endToEndId);

  const res = await fetch(`${NTX_BASE}/transactions?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Rota /api/ntxpay/transactions indisponível — o deploy do W3Build (extrato DB) ainda não foi feito neste backend.',
      );
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Falha ao consultar extrato NTX (HTTP ${res.status})`);
  }
  const d = await res.json();
  const list: NtxDbTransactionItem[] = Array.isArray(d?.data) ? d.data : [];
  return {
    transactions: list.map(mapDbRowToTransactionDB),
    currentPage: toNum(d?.pagination?.current_page) ?? filters.page ?? 1,
    totalPages: toNum(d?.pagination?.total_pages) ?? 1,
    total: toNum(d?.pagination?.total) ?? list.length,
    hasNext: Boolean(d?.pagination?.has_more),
    raw: d,
  };
}

/**
 * POST /api/ntxpay/sync — puxa a janela na API da NTX e grava no banco.
 * Backend: lock distribuído (409 se ocupado), throttle 3/min (429), janela máx 31 dias (400).
 */
export async function syncNtxStatement(startDate: string, endDate: string): Promise<NtxSyncResult> {
  const res = await fetch(`${NTX_BASE}/sync`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (res.status === 409) {
    throw new Error('Já existe uma sincronização em andamento — aguarde ela terminar e tente de novo.');
  }
  if (res.status === 429) {
    throw new Error('Muitas sincronizações seguidas (máx 3 por minuto) — aguarde um instante.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Falha ao sincronizar extrato NTX (HTTP ${res.status})`);
  }
  return res.json();
}

/** Mapeia um item da leitura DB pro shape do painel (determinístico — sem fallback defensivo). */
export function mapDbRowToTransactionDB(r: NtxDbTransactionItem): NtxTransactionDB {
  const isRefund = r.eventType === 'CashInReversal' || r.eventType === 'CashOutReversal';
  const type: NtxTransactionDB['type'] =
    r.movementType === 'CREDIT'
      ? 'FUNDING'
      : r.movementType === 'DEBIT'
        ? 'WITHDRAWAL'
        : r.eventType === 'CashIn' || r.eventType === 'CashOutReversal'
          ? 'FUNDING'
          : r.eventType === 'CashOut' || r.eventType === 'CashInReversal'
            ? 'WITHDRAWAL'
            : 'UNKNOWN';
  return {
    id: r.ntxTransactionId,
    transactionId: r.ntxTransactionId,
    endToEndId: r.endToEndId ?? '',
    externalId: r.externalId ?? '',
    type,
    status: r.status,
    amount: r.originalAmount.toFixed(2),
    feeAmount: r.feeAmount.toFixed(2),
    finalAmount: r.finalAmount.toFixed(2),
    counterpartName: r.counterpartName ?? '',
    counterpartDocument: r.counterpartDocument ?? '',
    counterpartBankName: r.counterpartBankName ?? '',
    counterpartBranch: r.counterpartAccountBranch ?? '',
    counterpartAccount: r.counterpartAccountNumber ?? '',
    counterpartIspb: r.counterpartBankIspb ?? '',
    description: r.errorMessage ?? '',
    createdAt: r.processingDate ?? r.createdAt,
    processedAt: r.processingDate ?? '',
    isRefund,
    eventRaw: r.eventType,
    _original: r,
  };
}

// ===================== Helpers de exibição =====================

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatCurrencyBRL(value: string | number | null): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n as number) ? (n as number) : 0);
}

export function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso.slice(0, -1) : iso;
  const d = new Date(s);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Label PT do status canônico do banco (desconhecido sai cru — visível, não some). */
export function getNtxStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmado',
    ERROR: 'Erro',
  };
  return map[status.toUpperCase()] ?? status ?? '—';
}

/** Label PT do eventType canônico do banco. */
export function getNtxEventLabel(eventType: string): string {
  const map: Record<string, string> = {
    CashIn: 'Pix Recebido',
    CashOut: 'Pix Enviado',
    CashInReversal: 'Estorno de Recebimento',
    CashOutReversal: 'Estorno de Envio',
  };
  return map[eventType] ?? eventType ?? '—';
}

export function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toUpperCase();
  if (['CONFIRMED', 'PAID', 'COMPLETE', 'SETTLED', 'PIX RECEBIDO', 'PAGO', 'CONFIRMADO'].some((x) => s.includes(x))) return 'default';
  if (['PENDING', 'PROCESSING', 'PENDENTE'].some((x) => s.includes(x))) return 'secondary';
  if (['ERROR', 'FAILED', 'REJECTED', 'FALHA', 'RECUSAD', 'ERRO'].some((x) => s.includes(x))) return 'destructive';
  return 'outline';
}

/** Badge no formato {variant, label} usado pelas tabelas do painel (label traduzido pra PT). */
export function getStatusBadge(status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  return { variant: statusBadgeVariant(status), label: getNtxStatusLabel(status) };
}

export function getTransactionTypeLabel(type: NtxTransactionDB['type']): string {
  if (type === 'FUNDING') return 'Recebimento';
  if (type === 'WITHDRAWAL') return 'Envio';
  return 'Desconhecido';
}

export const NtxRealtimeService = {
  getNtxBalance,
  getNtxStatement,
  syncNtxStatement,
  mapDbRowToTransactionDB,
  formatCurrencyBRL,
  formatDateBR,
  getNtxStatusLabel,
  getNtxEventLabel,
  statusBadgeVariant,
  getStatusBadge,
  getTransactionTypeLabel,
} as const;

export default NtxRealtimeService;
