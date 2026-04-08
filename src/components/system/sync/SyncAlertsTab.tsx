import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ChevronRight, RefreshCw, XCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useSyncAlerts, useUpdateAlert } from '@/hooks/useSync';
import { toastSuccess, toastError } from '@/utils/toast';
import type { SyncAlert, SyncAlertsParams } from '@/types/sync';

function severityIcon(severity: string) {
  switch (severity) {
    case 'CRITICAL': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'INFO': return <Info className="h-4 w-4 text-blue-500" />;
    default: return null;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function SyncAlertsTab() {
  const [severity, setSeverity] = useState('');
  const [provider, setProvider] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SyncAlertsParams>({ resolved: 'false' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const alerts = useSyncAlerts(appliedFilters);
  const updateAlert = useUpdateAlert();

  const handleApplyFilters = () => {
    setAppliedFilters({
      severity: severity && severity !== 'all' ? severity : undefined,
      provider: provider && provider !== 'all' ? provider : undefined,
      resolved: showResolved ? undefined : 'false',
    });
  };

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

  const items = alerts.data || [];

  const counts = { critical: 0, warning: 0, info: 0, resolved: 0 };
  for (const a of items) {
    if (a.resolved) { counts.resolved++; continue; }
    if (a.severity === 'CRITICAL') counts.critical++;
    else if (a.severity === 'WARNING') counts.warning++;
    else if (a.severity === 'INFO') counts.info++;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Severidade</label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provider</label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="corpx">CorpX</SelectItem>
              <SelectItem value="brasilcash">BrasilCash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-muted-foreground"
          />
          Mostrar resolvidos
        </label>
        <Button variant="outline" size="sm" onClick={handleApplyFilters}>
          Filtrar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => alerts.refetch()}
          disabled={alerts.isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${alerts.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Counters */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">
          Critical: {counts.critical}
        </Badge>
        <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">
          Warning: {counts.warning}
        </Badge>
        <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30">
          Info: {counts.info}
        </Badge>
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
          Resolvidos: {counts.resolved}
        </Badge>
      </div>

      {/* Table */}
      {alerts.isError ? (
        <p className="text-sm text-red-500 text-center py-8">Erro: {alerts.error?.message}</p>
      ) : alerts.isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando alertas...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta encontrado</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-10">Sev.</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-16">Quando</TableHead>
                <TableHead className="w-24">Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((alert: SyncAlert) => {
                const isExpanded = expandedId === alert.id;
                return (
                  <Fragment key={alert.id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${alert.resolved ? 'opacity-50' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                    >
                      <TableCell className="p-2">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </TableCell>
                      <TableCell>{severityIcon(alert.severity)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{alert.providerCode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{alert.alertType}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{alert.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(alert.createdAt)}</TableCell>
                      <TableCell>
                        {!alert.resolved && (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  disabled={updateAlert.isPending}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Resolver alerta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja marcar este alerta como resolvido?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleResolve(alert.id)}>
                                    Resolver
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-muted/30 p-4 text-xs font-mono space-y-2">
                            <div><span className="text-muted-foreground">ID:</span> {alert.id}</div>
                            <div><span className="text-muted-foreground">Conta:</span> {alert.accountIdentifier || '—'}</div>
                            <div><span className="text-muted-foreground">Criado:</span> {new Date(alert.createdAt).toLocaleString('pt-BR')}</div>
                            {alert.resolvedAt && (
                              <div><span className="text-muted-foreground">Resolvido:</span> {new Date(alert.resolvedAt).toLocaleString('pt-BR')}</div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Acknowledged:</span>{' '}
                              {alert.acknowledged ? 'Sim' : 'Nao'}
                            </div>
                            {alert.details && (
                              <div>
                                <span className="text-muted-foreground">Detalhes:</span>
                                <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all">
                                  {JSON.stringify(alert.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
