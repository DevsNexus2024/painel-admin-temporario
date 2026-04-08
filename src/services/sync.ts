// Service layer para Sync Dashboard — BaaS v2 API
// Segue o mesmo padrão de src/services/system.ts

import { API_CONFIG, TOKEN_STORAGE, USER_STORAGE } from '@/config/api';
import type {
  SyncHealthResponse,
  SyncDashboardResponse,
  SyncLog,
  SyncLogsParams,
  SyncAlert,
  SyncAlertsParams,
  ReconcileRequest,
  ReconcileResponse,
  ReconciliationResultStored,
  ReconciliationResultsParams,
} from '@/types/sync';

const V2_BASE = API_CONFIG.CORPX_V2_BASE_URL;

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

async function v2Fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${V2_BASE}${path}`, {
    method: 'GET',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN_STORAGE.get() || ''}`,
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(API_CONFIG.TIMEOUT || 60000),
  });

  if (res.status === 401) {
    TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ── Queries ──────────────────────────────────────────────

export async function fetchSyncHealth(): Promise<SyncHealthResponse> {
  return v2Fetch<SyncHealthResponse>('/api/sync/health');
}

export async function fetchSyncDashboard(days: number = 7): Promise<SyncDashboardResponse> {
  const qs = buildQuery({ days });
  return v2Fetch<SyncDashboardResponse>(`/api/sync/dashboard${qs}`);
}

export async function fetchSyncLogs(params: SyncLogsParams = {}): Promise<SyncLog[]> {
  const qs = buildQuery({
    provider: params.provider,
    status: params.status,
    from: params.from,
    to: params.to,
    limit: params.limit,
  });
  return v2Fetch<SyncLog[]>(`/api/sync/logs${qs}`);
}

export async function fetchSyncAlerts(params: SyncAlertsParams = {}): Promise<SyncAlert[]> {
  const qs = buildQuery({
    severity: params.severity,
    resolved: params.resolved,
    provider: params.provider,
  });
  return v2Fetch<SyncAlert[]>(`/api/sync/alerts${qs}`);
}

export async function fetchReconciliationResults(
  params: ReconciliationResultsParams = {},
): Promise<ReconciliationResultStored[]> {
  const qs = buildQuery({
    provider: params.provider,
    status: params.status,
    from: params.from,
    to: params.to,
  });
  return v2Fetch<ReconciliationResultStored[]>(`/api/sync/reconcile/results${qs}`);
}

// ── Mutations ────────────────────────────────────────────

export async function updateSyncAlert(
  id: string,
  data: { acknowledged?: boolean; resolved?: boolean },
): Promise<SyncAlert> {
  const safeId = encodeURIComponent(id);
  // Runtime allowlist — only send known fields
  const body: Record<string, boolean> = {};
  if (data.acknowledged !== undefined) body.acknowledged = data.acknowledged;
  if (data.resolved !== undefined) body.resolved = data.resolved;
  return v2Fetch<SyncAlert>(`/api/sync/alerts/${safeId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function executeReconciliation(data: ReconcileRequest): Promise<ReconcileResponse> {
  // Runtime allowlist — only send known fields
  const body: Record<string, unknown> = { providerCode: data.providerCode, date: data.date };
  if (data.accountIdentifier) body.accountIdentifier = data.accountIdentifier;
  if (data.autoFix !== undefined) body.autoFix = data.autoFix;
  return v2Fetch<ReconcileResponse>('/api/sync/reconcile', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
