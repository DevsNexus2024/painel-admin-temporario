import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSyncDashboard, useUpdateAlert } from '@/hooks/useSync';
import { toastSuccess, toastError } from '@/utils/toast';
import type { SyncDashboardResponse, SyncAlert, ProviderHealth } from '@/types/sync';

interface SyncOverviewProps {
  onNavigate: (subtab: string, filters?: Record<string, string>) => void;
}

// ── Helpers ──────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'OK': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'WARNING': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'CRITICAL': return 'bg-red-500/15 text-red-600 border-red-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'text-red-500';
    case 'WARNING': return 'text-yellow-500';
    case 'INFO': return 'text-blue-500';
    default: return 'text-zinc-400';
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function syncStatusBadge(status: string | null): string {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'PARTIAL': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'FAILED': return 'bg-red-500/15 text-red-600 border-red-500/30';
    case 'RUNNING': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

// ── Sub-components ───────────────────────────────────────

function StatusBanner({ data }: { data: SyncDashboardResponse }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Status Geral:</span>
          <Badge variant="outline" className={statusColor(data.health.status)}>
            {data.health.status}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          Alertas abertos: <span className="font-bold text-foreground">{data.health.totalOpenAlerts}</span>
        </span>
      </CardContent>
    </Card>
  );
}

function ProviderCard({
  code,
  health,
  onClick,
}: {
  code: string;
  health: ProviderHealth;
  onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-foreground/20 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase">{code}</CardTitle>
          <Badge variant="outline" className={statusColor(health.status)}>
            {health.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ultimo sync:</span>
          <span className="font-mono text-xs">{formatDateTime(health.lastSync)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant="outline" className={`text-xs ${syncStatusBadge(health.lastSyncStatus)}`}>
            {health.lastSyncStatus || '—'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Contas:</span>
          <span>{health.accountsSynced}/{health.accountsActive} sync</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Alertas:</span>
          <span>
            <span className="text-red-500">{health.openAlerts.critical}C</span>{' '}
            <span className="text-yellow-500">{health.openAlerts.warning}W</span>{' '}
            <span className="text-blue-500">{health.openAlerts.info}I</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reconcil:</span>
          <span>{health.lastReconciliation ? health.lastReconciliation.status : '—'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OpenAlertsPreview({
  alerts,
  onViewAll,
}: {
  alerts: SyncAlert[];
  onViewAll: () => void;
}) {
  const updateAlert = useUpdateAlert();
  const preview = alerts.slice(0, 5);

  const handleAcknowledge = (id: string) => {
    updateAlert.mutate(
      { id, data: { acknowledged: true } },
      {
        onSuccess: () => toastSuccess('Alerta acknowledged'),
        onError: (err) => toastError('Erro', err.message),
      },
    );
  };

  const handleResolve = (id: string) => {
    updateAlert.mutate(
      { id, data: { resolved: true } },
      {
        onSuccess: () => toastSuccess('Alerta resolvido'),
        onError: (err) => toastError('Erro', err.message),
      },
    );
  };

  if (preview.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground text-center">
          Nenhum alerta aberto
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Alertas Abertos</CardTitle>
          <Button variant="link" size="sm" className="text-xs" onClick={onViewAll}>
            Ver todos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {preview.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-2 p-2 rounded-md border text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={severityColor(alert.severity)}>
                {alert.severity === 'CRITICAL' ? <XCircle className="h-4 w-4" /> :
                 alert.severity === 'WARNING' ? <AlertTriangle className="h-4 w-4" /> :
                 <Clock className="h-4 w-4" />}
              </span>
              <Badge variant="outline" className="text-[10px] shrink-0">{alert.providerCode}</Badge>
              <span className="truncate text-muted-foreground">{alert.message}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              {!alert.acknowledged && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={updateAlert.isPending}
                >
                  Ack
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleResolve(alert.id)}
                disabled={updateAlert.isPending}
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SyncHistoryChart({ syncs }: { syncs: SyncDashboardResponse['recentSyncs']['items'] }) {
  const chartData = useMemo(() => {
    const byDay: Record<string, { date: string; COMPLETED: number; PARTIAL: number; FAILED: number }> = {};
    for (const s of syncs) {
      const day = new Date(s.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!byDay[day]) byDay[day] = { date: day, COMPLETED: 0, PARTIAL: 0, FAILED: 0 };
      const status = s.status as 'COMPLETED' | 'PARTIAL' | 'FAILED';
      if (status in byDay[day]) {
        byDay[day][status]++;
      }
    }
    return Object.values(byDay).reverse();
  }, [syncs]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground text-center">
          Sem dados de sync recentes
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Syncs Recentes (ultimos 7 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="COMPLETED" fill="#22c55e" stackId="a" />
            <Bar dataKey="PARTIAL" fill="#eab308" stackId="a" />
            <Bar dataKey="FAILED" fill="#ef4444" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────

export default function SyncOverview({ onNavigate }: SyncOverviewProps) {
  const dashboard = useSyncDashboard(7);

  if (dashboard.isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando dashboard...</div>;
  }

  if (dashboard.isError) {
    return <div className="text-center py-8 text-red-500">Erro: {dashboard.error?.message}</div>;
  }

  const data = dashboard.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <StatusBanner data={data} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(data.health.providers).map(([code, health]) => (
          <ProviderCard
            key={code}
            code={code}
            health={health}
            onClick={() => onNavigate('logs', { provider: code })}
          />
        ))}
      </div>

      <OpenAlertsPreview
        alerts={data.openAlerts.items}
        onViewAll={() => onNavigate('alerts')}
      />

      <SyncHistoryChart syncs={data.recentSyncs.items} />
    </div>
  );
}
