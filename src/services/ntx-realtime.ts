/**
 * NTX Pay ↔ TCR — serviço de leitura (saldo + extrato) do painel.
 *
 * Espelha o padrão do brasilcash-realtime, com duas diferenças de propósito:
 *  - base URL vem de API_CONFIG (não hardcoded);
 *  - valores em REAIS (a NTX NÃO é centavos — não dividir por 100).
 *
 * O extrato da NTX usa vocabulário TRADUZIDO (ex.: "Pix Recebido"/"Estorno") e a
 * shape exata dos itens só é confirmada numa bateria real (ver checkpoint da
 * M-ntxpay). Por isso o mapper é DEFENSIVO: extrai o que reconhece com fallbacks
 * e preserva `_original` pro detalhe. Ajustar os nomes de campo quando o extrato
 * real for coletado.
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

export interface NtxTransactionDB {
  id: string; // = transactionId (chave de linha/compensação no painel)
  transactionId: string;
  endToEndId: string;
  externalId: string;
  type: 'FUNDING' | 'WITHDRAWAL' | 'UNKNOWN';
  status: string; // cru do provider — a NTX devolve TRADUZIDO ("Confirmado"/"Pendente")
  amount: string; // originalAmount em reais (o webhook credita o BRUTO — compensação usa o mesmo)
  feeAmount: string;
  finalAmount: string;
  counterpartName: string;
  counterpartDocument: string; // MASCARADO no statement (completo só em /transaction/:id)
  counterpartBankName: string;
  counterpartBranch: string;
  counterpartAccount: string;
  counterpartIspb: string;
  description: string;
  createdAt: string;
  processedAt: string;
  isRefund: boolean;
  eventRaw: string;
  _original: Record<string, unknown>;
}

export interface NtxStatementFilters {
  page?: number;
  size?: number; // máx 100 na NTX
  status?: string; // enum CRU: PENDING | CONFIRMED | ERROR
  type?: string; // enum CRU: PAYMENT | WITHDRAW | REFUND_IN | REFUND_OUT
  startDate?: string; // ISO — janela máx 31 dias na NTX
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

/** Limites/enums da API NTX (filtros aceitam só o enum CRU; a resposta volta traduzida). */
export const NTX_MAX_PAGE_SIZE = 100;
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

/** GET /api/ntxpay/balance → { grossBalance, blockedBalance, netBalance } (reais). */
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

/** GET /api/ntxpay/statement — extrato paginado (janela máx 31 dias na NTX). */
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

  const res = await fetch(`${NTX_BASE}/statement?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Falha ao consultar extrato NTX (HTTP ${res.status})`);
  }
  const d = await res.json();
  const list = extractList(d);
  // Envelope real (confirmado nos docs do W3Build): { data: [...], metadata: { page, size, total, totalPages, hasNext } }
  const meta = d?.metadata ?? d ?? {};
  return {
    transactions: list.map(mapNtxToTransactionDB),
    currentPage: toNum(meta?.page ?? meta?.currentPage ?? meta?.number) ?? filters.page ?? 1,
    totalPages: toNum(meta?.totalPages ?? meta?.total_pages ?? meta?.pageCount) ?? 1,
    total: toNum(meta?.total) ?? list.length,
    hasNext: Boolean(meta?.hasNext),
    raw: d,
  };
}

/** Extrai a lista de transações de qualquer envelope comum da NTX (defensivo). */
function extractList(d: any): Record<string, unknown>[] {
  const candidate =
    d?.content ?? d?.data ?? d?.transactions ?? d?.items ?? d?.results ?? (Array.isArray(d) ? d : null);
  return Array.isArray(candidate) ? candidate : [];
}

/** Mapeia um item cru do extrato NTX pro shape do painel (defensivo). */
export function mapNtxToTransactionDB(t: any): NtxTransactionDB {
  const eventRaw = str(t?.event ?? t?.operationType ?? t?.type ?? t?.movementType);
  const counterpart = t?.counterpart ?? {};
  const bank = counterpart?.bank ?? {};
  const transactionId = str(t?.transactionId ?? t?.id);
  return {
    id: transactionId,
    transactionId,
    endToEndId: str(t?.endToEndId ?? t?.e2eId),
    externalId: str(t?.externalId),
    type: direction(t, eventRaw),
    status: str(t?.status),
    amount: reais(t?.originalAmount ?? t?.finalAmount ?? t?.value ?? t?.amount),
    feeAmount: reais(t?.feeAmount),
    finalAmount: reais(t?.finalAmount ?? t?.originalAmount ?? t?.value ?? t?.amount),
    counterpartName: str(counterpart?.name ?? t?.counterpartName ?? t?.payerName),
    counterpartDocument: str(counterpart?.document ?? t?.counterpartDocument),
    counterpartBankName: str(bank?.bankName ?? t?.counterpartAccountBankName),
    counterpartBranch: str(bank?.accountBranch ?? t?.counterpartAccountBranch),
    counterpartAccount: str(bank?.accountNumber ?? t?.counterpartAccountNumber),
    counterpartIspb: str(bank?.bankISPB ?? t?.counterpartAccountIspb),
    description: str(t?.description ?? t?.errorMessage),
    createdAt: str(t?.createdAt ?? t?.processingDate ?? t?.date),
    processedAt: str(t?.processedAt ?? t?.processingDate),
    isRefund: /refund|estorno/i.test(eventRaw),
    eventRaw,
    _original: t ?? {},
  };
}

function direction(t: any, eventRaw: string): 'FUNDING' | 'WITHDRAWAL' | 'UNKNOWN' {
  const mv = String(t?.movementType ?? '').toUpperCase();
  if (mv === 'CREDIT') return 'FUNDING';
  if (mv === 'DEBIT') return 'WITHDRAWAL';
  const e = eventRaw.toLowerCase();
  if (e.includes('cashin') || e.includes('recebid') || e.includes('recebimento')) return 'FUNDING';
  if (e.includes('cashout') || e.includes('envio') || e.includes('pagamento') || e.includes('estorno')) return 'WITHDRAWAL';
  return 'UNKNOWN';
}

// ===================== Helpers de exibição =====================

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Valor em reais → string com 2 casas (NTX já é reais; sem /100). */
function reais(v: unknown): string {
  const n = toNum(v);
  return n === null ? '0.00' : n.toFixed(2);
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

export function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toUpperCase();
  if (['CONFIRMED', 'PAID', 'COMPLETE', 'SETTLED', 'PIX RECEBIDO', 'PAGO', 'CONFIRMADO'].some((x) => s.includes(x))) return 'default';
  if (['PENDING', 'PROCESSING', 'PENDENTE'].some((x) => s.includes(x))) return 'secondary';
  if (['ERROR', 'FAILED', 'REJECTED', 'FALHA', 'RECUSAD', 'ERRO'].some((x) => s.includes(x))) return 'destructive';
  return 'outline';
}

/** Badge no formato {variant, label} usado pelas tabelas do painel (label já vem em PT da NTX). */
export function getStatusBadge(status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  return { variant: statusBadgeVariant(status), label: status || '—' };
}

export function getTransactionTypeLabel(type: NtxTransactionDB['type']): string {
  if (type === 'FUNDING') return 'Recebimento';
  if (type === 'WITHDRAWAL') return 'Envio';
  return 'Desconhecido';
}

export const NtxRealtimeService = {
  getNtxBalance,
  getNtxStatement,
  mapNtxToTransactionDB,
  formatCurrencyBRL,
  formatDateBR,
  statusBadgeVariant,
  getStatusBadge,
  getTransactionTypeLabel,
} as const;

export default NtxRealtimeService;
