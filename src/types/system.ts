// Types para o dashboard de observabilidade (/sistema)

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: Record<string, 'ok' | 'fail'>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  raw: string;
}

export interface LogsResponse {
  success: boolean;
  total: number;
  lines: number;
  logs: LogEntry[];
}

export interface LogStats {
  success: boolean;
  period: string;
  errors: {
    total: number;
    by_context: Record<string, number>;
    most_common: Array<{ message: string; count: number }>;
    per_hour: Record<string, number>;
  };
  files: {
    error_log_size: string;
    output_log_size: string;
  };
}

export interface LogTailResponse {
  success: boolean;
  type: 'error' | 'output';
  lines: number;
  content: string[];
}

export interface AuditEntry {
  id: number;
  tenantId: string;
  ts: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  traceId: string;
  recordDigest: string;
  prevHash: string;
  hash: string;
}

export interface AuditResponse {
  data: AuditEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditIntegrity {
  tenantId: string;
  logsChecked: number;
  isValid: boolean;
  errors: Array<{ logId: string; error: string }>;
}

export interface ParsedMetrics {
  httpRequestsTotal: number;
  httpErrorsTotal: number;
  errorRate: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  memoryRssMb: number;
  cpuSecondsTotal: number;
}

export interface LogErrorsParams {
  lines?: number;
  search?: string;
  from?: string;
  to?: string;
}

export interface LogOutputParams {
  lines?: number;
  search?: string;
  level?: 'LOG' | 'WARN' | 'DEBUG';
  from?: string;
  to?: string;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
}
