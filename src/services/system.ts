import { API_CONFIG, TOKEN_STORAGE, USER_STORAGE } from '@/config/api';
import type {
  HealthResponse,
  ReadinessResponse,
  LogsResponse,
  LogStats,
  LogTailResponse,
  AuditResponse,
  AuditIntegrity,
  LogErrorsParams,
  LogOutputParams,
  AuditFilters,
} from '@/types/system';

// BaaS v2 (W3Build) — mesma base URL usada em reports.ts e auth.ts
const V2_BASE = API_CONFIG.CORPX_V2_BASE_URL;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

// Fetch autenticado para BaaS v2 (mesmo padrão do reports.ts)
async function v2Fetch<T>(path: string, opts: { accept?: string } = {}): Promise<T> {
  const res = await fetch(`${V2_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN_STORAGE.get() || ''}`,
      ...(opts.accept ? { Accept: opts.accept } : {}),
    },
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT || 60000),
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

async function v2FetchText(path: string): Promise<string> {
  const res = await fetch(`${V2_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN_STORAGE.get() || ''}`,
      Accept: 'text/plain',
    },
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT || 60000),
  });

  if (res.status === 401) {
    TOKEN_STORAGE.remove();
    USER_STORAGE.remove();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    throw new Error(`Metrics fetch failed: ${res.status}`);
  }

  return res.text();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return v2Fetch<HealthResponse>('/_health');
}

export async function fetchReadiness(): Promise<ReadinessResponse> {
  return v2Fetch<ReadinessResponse>('/_ready');
}

export async function fetchMetrics(): Promise<string> {
  return v2FetchText('/metrics');
}

export async function fetchLogErrors(params: LogErrorsParams = {}): Promise<LogsResponse> {
  const qs = buildQuery({
    lines: params.lines,
    search: params.search,
    from: params.from,
    to: params.to,
  });
  return v2Fetch<LogsResponse>(`/logs/errors${qs}`);
}

export async function fetchLogOutput(params: LogOutputParams = {}): Promise<LogsResponse> {
  const qs = buildQuery({
    lines: params.lines,
    search: params.search,
    level: params.level,
    from: params.from,
    to: params.to,
  });
  return v2Fetch<LogsResponse>(`/logs/output${qs}`);
}

export async function fetchLogStats(): Promise<LogStats> {
  return v2Fetch<LogStats>('/logs/stats');
}

export async function fetchLogTail(
  type: 'error' | 'output' = 'output',
  lines: number = 50,
): Promise<LogTailResponse> {
  const qs = buildQuery({ type, lines });
  return v2Fetch<LogTailResponse>(`/logs/tail${qs}`);
}

export async function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditResponse> {
  const qs = buildQuery({
    page: filters.page,
    limit: filters.limit,
    tenantId: filters.tenantId,
    actorId: filters.actorId,
    action: filters.action,
    resourceType: filters.resourceType,
    resourceId: filters.resourceId,
  });
  return v2Fetch<AuditResponse>(`/audit${qs}`);
}

export async function fetchAuditIntegrity(tenantId?: string): Promise<AuditIntegrity> {
  const qs = tenantId ? buildQuery({ tenantId }) : '';
  return v2Fetch<AuditIntegrity>(`/audit/verify${qs}`);
}
