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

const NTX_BASE = `${API_CONFIG.BASE_URL}/api/ntxpay`;

// ===================== Tipos =====================

export interface NtxBalance {
  grossBalance: number | null;
  blockedBalance: number | null;
  netBalance: number | null;
}

export interface NtxTransactionDB {
  transactionId: string;
  endToEndId: string;
  externalId: string;
  type: 'FUNDING' | 'WITHDRAWAL' | 'UNKNOWN';
  status: string; // cru do provider (badge normaliza os comuns)
  amount: string; // em reais (string p/ exibição)
  counterpartName: string;
  counterpartDocument: string;
  description: string;
  createdAt: string;
  eventRaw: string;
  _original: Record<string, unknown>;
}

export interface NtxStatementFilters {
  page?: number;
  size?: number;
  status?: string;
  type?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
  externalId?: string;
  endToEndId?: string;
}

export interface NtxStatementResult {
  transactions: NtxTransactionDB[];
  currentPage: number;
  totalPages: number;
  raw: any;
}

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
  return {
    transactions: list.map(mapNtxToTransactionDB),
    currentPage: toNum(d?.page ?? d?.currentPage ?? d?.number) ?? filters.page ?? 1,
    totalPages: toNum(d?.totalPages ?? d?.total_pages ?? d?.pageCount) ?? 1,
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
  return {
    transactionId: str(t?.transactionId ?? t?.id),
    endToEndId: str(t?.endToEndId ?? t?.e2eId),
    externalId: str(t?.externalId),
    type: direction(t, eventRaw),
    status: str(t?.status),
    amount: reais(t?.originalAmount ?? t?.finalAmount ?? t?.value ?? t?.amount),
    counterpartName: str(counterpart?.name ?? t?.counterpartName ?? t?.payerName),
    counterpartDocument: str(counterpart?.document ?? t?.counterpartDocument),
    description: str(t?.description ?? t?.errorMessage),
    createdAt: str(t?.processingDate ?? t?.createdAt ?? t?.date),
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
  if (['CONFIRMED', 'PAID', 'COMPLETE', 'SETTLED', 'PIX RECEBIDO', 'PAGO'].some((x) => s.includes(x))) return 'default';
  if (['PENDING', 'PROCESSING', 'PENDENTE'].some((x) => s.includes(x))) return 'secondary';
  if (['ERROR', 'FAILED', 'REJECTED', 'FALHA', 'RECUSAD', 'ERRO'].some((x) => s.includes(x))) return 'destructive';
  return 'outline';
}

export const NtxRealtimeService = {
  getNtxBalance,
  getNtxStatement,
  mapNtxToTransactionDB,
  formatCurrencyBRL,
  formatDateBR,
  statusBadgeVariant,
} as const;

export default NtxRealtimeService;
