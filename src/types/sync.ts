// Types para o Sync Dashboard (/sistema > Sync)
// Interfaces matching backend sync-engine response shapes

// ============================================================
// HEALTH
// ============================================================

export interface ProviderHealth {
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  lastSync: string | null;
  lastSyncStatus: string | null;
  accountsActive: number;
  accountsSynced: number;
  openAlerts: {
    critical: number;
    warning: number;
    info: number;
  };
  lastReconciliation: {
    date: string;
    status: string;
  } | null;
  error?: string;
}

export interface SyncHealthResponse {
  status: 'OK' | 'WARNING' | 'CRITICAL';
  providers: Record<string, ProviderHealth>;
  totalOpenAlerts: number;
}

// ============================================================
// SYNC LOGS
// ============================================================

export interface SyncLog {
  id: string;
  batchId: string;
  providerCode: string;
  syncType: string;
  accountIdentifier: string;
  accountName: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  transactionsFound: number;
  transactionsNew: number;
  transactionsUpdated: number;
  transactionsSkipped: number;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface SyncLogsParams {
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// ============================================================
// ALERTS
// ============================================================

export type AlertType =
  | 'GAP'
  | 'MISSING_ACCOUNT'
  | 'PARTIAL_SYNC'
  | 'FAILED_SYNC'
  | 'SLOW_SYNC'
  | 'ZERO_TX'
  | 'RECONCILIATION_DIVERGENT';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SyncAlert {
  id: string;
  providerCode: string;
  accountIdentifier: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown> | null;
  acknowledged: boolean;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SyncAlertsParams {
  severity?: string;
  resolved?: string;
  provider?: string;
}

// ============================================================
// RECONCILIATION
// ============================================================

export type DivergenceType = 'MISSING_IN_DB' | 'MISSING_IN_STATEMENT' | 'AMOUNT_MISMATCH';

export interface Divergence {
  type: DivergenceType;
  reconciliationKey: string;
  statementAmount?: number;
  databaseAmount?: number;
  description?: string;
  autoFixed: boolean;
}

export interface ReconciliationResult {
  providerCode: string;
  accountIdentifier: string;
  accountName: string;
  date: string;
  status: 'MATCHED' | 'DIVERGENT' | 'FAILED';
  statementCount: number;
  databaseCount: number;
  missingInDb: number;
  missingInStatement: number;
  amountMismatches: number;
  autoFixed: number;
  divergences: Divergence[];
  error?: string;
}

export interface ReconciliationResultStored {
  id: string;
  batchId: string;
  providerCode: string;
  accountIdentifier: string;
  accountName: string;
  reconciliationDate: string;
  status: 'MATCHED' | 'DIVERGENT' | 'FAILED';
  statementCount: number;
  databaseCount: number;
  missingInDb: number;
  missingInStatement: number;
  amountMismatches: number;
  divergences: Divergence[];
  autoFixed: number;
  createdAt: string;
}

export interface ReconciliationResultsParams {
  provider?: string;
  status?: string;
  from?: string;
  to?: string;
}

// ============================================================
// DASHBOARD
// ============================================================

export interface SyncDashboardResponse {
  health: SyncHealthResponse;
  recentSyncs: {
    total: number;
    items: SyncLog[];
  };
  openAlerts: {
    total: number;
    items: SyncAlert[];
  };
  recentReconciliations: {
    total: number;
    items: ReconciliationResultStored[];
  };
}

// ============================================================
// RECONCILE REQUEST / RESPONSE
// ============================================================

export interface ReconcileRequest {
  providerCode: string;
  accountIdentifier?: string;
  date: string;
  autoFix?: boolean;
}

export interface ReconcileResponse {
  success: boolean;
  total: number;
  matched: number;
  divergent: number;
  failed: number;
  results: ReconciliationResult[];
}
