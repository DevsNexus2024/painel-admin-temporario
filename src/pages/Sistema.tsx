import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, FileWarning, FileText, Shield, RefreshCw, Search, ArrowLeftRight } from 'lucide-react';
import { usePermissions } from '@/hooks/useAuth';
import SyncDashboardTab from '@/components/system/sync/SyncDashboardTab';
import { useHealth, useReadiness, useMetrics, useLogErrors, useLogOutput, useLogStats, useLogTail } from '@/hooks/useSystem';
import { parsePrometheusMetrics } from '@/components/system/MetricsParser';
import HealthStatusCard from '@/components/system/HealthStatusCard';
import MetricCard, { getThresholdLevel } from '@/components/system/MetricCard';
import ErrorsPerHourChart from '@/components/system/ErrorsPerHourChart';
import TopErrorsList from '@/components/system/TopErrorsList';
import ContextBreakdown from '@/components/system/ContextBreakdown';
import LogsTable from '@/components/system/LogsTable';
import AuditTable from '@/components/system/AuditTable';
import LogTail from '@/components/system/LogTail';

const MAX_HISTORY = 30;

function pushHistory(arr: number[], val: number): number[] {
  const next = [...arr, val];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

interface MetricHistory {
  requests: number[];
  errorRate: number[];
  p50: number[];
  p95: number[];
  p99: number[];
  memory: number[];
}

const EMPTY_HISTORY: MetricHistory = { requests: [], errorRate: [], p50: [], p95: [], p99: [], memory: [] };

export default function Sistema() {
  const [activeTab, setActiveTab] = useState('health');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [history, setHistory] = useState<MetricHistory>(EMPTY_HISTORY);

  // Tab 2: Error logs state
  const [errorSearch, setErrorSearch] = useState('');
  const [errorFrom, setErrorFrom] = useState('');
  const [errorTo, setErrorTo] = useState('');

  // Tab 3: Output logs state
  const [outputSearch, setOutputSearch] = useState('');
  const [outputLevel, setOutputLevel] = useState<string>('');

  // Health & Metrics queries
  const health = useHealth();
  const readiness = useReadiness();
  const metrics = useMetrics();

  // Logs queries (enabled only when tab is active)
  // errorFrom/errorTo are stored as YYYY-MM-DD for the date input; convert to ISO for API
  const logErrors = useLogErrors(
    {
      lines: 200,
      search: errorSearch || undefined,
      from: errorFrom ? new Date(errorFrom).toISOString() : undefined,
      to: errorTo ? new Date(errorTo + 'T23:59:59.999Z').toISOString() : undefined,
    },
    activeTab === 'errors',
  );
  const logStats = useLogStats(activeTab === 'errors');
  const logOutput = useLogOutput(
    { lines: 200, search: outputSearch || undefined, level: (outputLevel && outputLevel !== 'all' ? outputLevel : undefined) as 'LOG' | 'WARN' | 'DEBUG' | undefined },
    activeTab === 'output',
  );
  const logTail = useLogTail('output', 50, activeTab === 'output');

  const parsed = useMemo(
    () => (metrics.data ? parsePrometheusMetrics(metrics.data) : null),
    [metrics.data],
  );

  // Acumular historico quando metricas atualizarem (dataUpdatedAt muda a cada fetch)
  useEffect(() => {
    if (!parsed) return;
    setHistory(prev => ({
      requests: pushHistory(prev.requests, parsed.httpRequestsTotal),
      errorRate: pushHistory(prev.errorRate, parsed.errorRate),
      p50: pushHistory(prev.p50, parsed.latencyP50Ms),
      p95: pushHistory(prev.p95, parsed.latencyP95Ms),
      p99: pushHistory(prev.p99, parsed.latencyP99Ms),
      memory: pushHistory(prev.memory, parsed.memoryRssMb),
    }));
  }, [metrics.dataUpdatedAt]);

  const handleRefresh = useCallback(() => {
    health.refetch();
    readiness.refetch();
    metrics.refetch();
    setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
  }, [health, readiness, metrics]);

  const { hasRole } = usePermissions();
  const isSuperAdmin = hasRole('super_admin');

  const isRefreshing = health.isFetching || readiness.isFetching || metrics.isFetching;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sistema</h1>
        <p className="text-muted-foreground">
          Monitoramento, logs e auditoria da plataforma
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'max-w-2xl grid-cols-5' : 'max-w-lg grid-cols-4'}`}>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-1.5">
            <FileWarning className="w-4 h-4" />
            Erros
          </TabsTrigger>
          <TabsTrigger value="output" className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Output
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="sync" className="flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4" />
              Sync
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== TAB 1: Health & Metricas ===== */}
        <TabsContent value="health" className="space-y-6 mt-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Ultima atualizacao: {lastUpdate}
              </span>
            )}
          </div>

          {/* Health Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HealthStatusCard
              title="API"
              type="api"
              status={health.isLoading ? 'loading' : health.isError ? 'fail' : health.data?.status === 'ok' ? 'ok' : 'fail'}
            />
            <HealthStatusCard
              title="Database"
              type="database"
              status={readiness.isLoading ? 'loading' : readiness.isError ? 'fail' : readiness.data?.status === 'ready' ? 'ok' : 'fail'}
              details={readiness.data?.checks}
            />
          </div>

          {/* Metric Cards */}
          {parsed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Requests"
                value={parsed.httpRequestsTotal}
                history={history.requests}
                thresholdLevel="green"
              />
              <MetricCard
                label="Error Rate"
                value={parsed.errorRate}
                unit="%"
                history={history.errorRate}
                thresholdLevel={getThresholdLevel(parsed.errorRate, { green: 1, yellow: 5 })}
              />
              <MetricCard
                label="Latencia P50"
                value={parsed.latencyP50Ms}
                unit="ms"
                history={history.p50}
                thresholdLevel={getThresholdLevel(parsed.latencyP50Ms, { green: 100, yellow: 500 })}
              />
              <MetricCard
                label="Latencia P95"
                value={parsed.latencyP95Ms}
                unit="ms"
                history={history.p95}
                thresholdLevel={getThresholdLevel(parsed.latencyP95Ms, { green: 500, yellow: 1000 })}
              />
              <MetricCard
                label="Latencia P99"
                value={parsed.latencyP99Ms}
                unit="ms"
                history={history.p99}
                thresholdLevel={getThresholdLevel(parsed.latencyP99Ms, { green: 1000, yellow: 3000 })}
              />
              <MetricCard
                label="Memoria RSS"
                value={parsed.memoryRssMb}
                unit="MB"
                history={history.memory}
                thresholdLevel={getThresholdLevel(parsed.memoryRssMb, { green: 256, yellow: 512 })}
              />
            </div>
          )}

          {metrics.isLoading && !parsed && (
            <div className="text-center py-8 text-muted-foreground">
              Carregando metricas...
            </div>
          )}

          {metrics.isError && (
            <div className="text-center py-8 text-red-500">
              Erro ao carregar metricas: {metrics.error?.message}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB 2: Logs de Erro ===== */}
        <TabsContent value="errors" className="space-y-6 mt-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar logs..."
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={errorFrom}
              onChange={(e) => setErrorFrom(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              value={errorTo}
              onChange={(e) => setErrorTo(e.target.value)}
              className="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logErrors.refetch()}
              disabled={logErrors.isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${logErrors.isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Stats cards */}
          {logStats.data?.success && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase">Total de Erros</p>
                  <p className="text-2xl font-bold text-foreground">{logStats.data.errors.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase">Tamanho Error Log</p>
                  <p className="text-2xl font-bold text-foreground">{logStats.data.files.error_log_size}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase">Error Rate</p>
                  <p className="text-2xl font-bold text-foreground">
                    {parsed ? `~${parsed.errorRate}%` : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts row */}
          {logStats.data?.success && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ErrorsPerHourChart perHour={logStats.data.errors.per_hour} />
              <TopErrorsList errors={logStats.data.errors.most_common} />
              <ContextBreakdown byContext={logStats.data.errors.by_context} />
            </div>
          )}

          {/* Logs table */}
          <LogsTable logs={logErrors.data?.logs || []} isLoading={logErrors.isLoading} />
        </TabsContent>

        {/* ===== TAB 3: Logs de Output ===== */}
        <TabsContent value="output" className="space-y-6 mt-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={outputSearch}
                onChange={(e) => setOutputSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={outputLevel} onValueChange={setOutputLevel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="LOG">Info</SelectItem>
                <SelectItem value="WARN">Warn</SelectItem>
                <SelectItem value="DEBUG">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logOutput.refetch()}
              disabled={logOutput.isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${logOutput.isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Logs table */}
          <LogsTable logs={logOutput.data?.logs || []} isLoading={logOutput.isLoading} />

          {/* Tail section */}
          <LogTail
            lines={logTail.data?.content || []}
            isLoading={logTail.isFetching}
            onRefresh={() => logTail.refetch()}
          />
        </TabsContent>

        {/* ===== TAB 4: Auditoria ===== */}
        <TabsContent value="audit" className="mt-6">
          <AuditTable />
        </TabsContent>

        {/* ===== TAB 5: Sync (super_admin only) ===== */}
        {isSuperAdmin && (
          <TabsContent value="sync" className="mt-6">
            <SyncDashboardTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
