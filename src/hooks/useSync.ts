// React Query hooks para Sync Dashboard
// Segue o mesmo padrão de src/hooks/useSystem.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSyncHealth,
  fetchSyncDashboard,
  fetchSyncLogs,
  fetchSyncAlerts,
  fetchReconciliationResults,
  updateSyncAlert,
  executeReconciliation,
} from '@/services/sync';
import type {
  SyncLogsParams,
  SyncAlertsParams,
  ReconciliationResultsParams,
  ReconcileRequest,
} from '@/types/sync';

export function useSyncHealth(enabled = true) {
  return useQuery({
    queryKey: ['sync', 'health'],
    queryFn: fetchSyncHealth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useSyncDashboard(days: number = 7, enabled = true) {
  return useQuery({
    queryKey: ['sync', 'dashboard', days],
    queryFn: () => fetchSyncDashboard(days),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useSyncLogs(params: SyncLogsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['sync', 'logs', params],
    queryFn: () => fetchSyncLogs(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useSyncAlerts(params: SyncAlertsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['sync', 'alerts', params],
    queryFn: () => fetchSyncAlerts(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useReconciliationResults(params: ReconciliationResultsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['sync', 'reconciliation-results', params],
    queryFn: () => fetchReconciliationResults(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { acknowledged?: boolean; resolved?: boolean } }) =>
      updateSyncAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });
}

export function useReconcile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReconcileRequest) => executeReconciliation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });
}
