import { useQuery } from '@tanstack/react-query';
import {
  fetchHealth,
  fetchReadiness,
  fetchMetrics,
  fetchLogErrors,
  fetchLogOutput,
  fetchLogStats,
  fetchLogTail,
  fetchAuditLogs,
  fetchAuditIntegrity,
} from '@/services/system';
import type { LogErrorsParams, LogOutputParams, AuditFilters } from '@/types/system';

export function useHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: fetchHealth,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: ['system', 'readiness'],
    queryFn: fetchReadiness,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: fetchMetrics,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLogErrors(params: LogErrorsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['system', 'logs', 'errors', params],
    queryFn: () => fetchLogErrors(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useLogOutput(params: LogOutputParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['system', 'logs', 'output', params],
    queryFn: () => fetchLogOutput(params),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useLogStats(enabled = true) {
  return useQuery({
    queryKey: ['system', 'logs', 'stats'],
    queryFn: fetchLogStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useLogTail(type: 'error' | 'output' = 'output', lines = 50, enabled = true) {
  return useQuery({
    queryKey: ['system', 'logs', 'tail', type, lines],
    queryFn: () => fetchLogTail(type, lines),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useAuditLogs(filters: AuditFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['system', 'audit', 'logs', filters],
    queryFn: () => fetchAuditLogs(filters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useAuditIntegrity(tenantId?: string) {
  return useQuery({
    queryKey: ['system', 'audit', 'integrity', tenantId ?? 'all'],
    queryFn: () => fetchAuditIntegrity(tenantId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
