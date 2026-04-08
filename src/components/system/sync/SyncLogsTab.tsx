import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useSyncLogs } from '@/hooks/useSync';
import type { SyncLog, SyncLogsParams } from '@/types/sync';

interface SyncLogsTabProps {
  initialFilters?: { provider?: string };
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'PARTIAL': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'FAILED': return 'bg-red-500/15 text-red-600 border-red-500/30';
    case 'RUNNING': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

export default function SyncLogsTab({ initialFilters }: SyncLogsTabProps) {
  const [provider, setProvider] = useState(initialFilters?.provider || '');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<SyncLogsParams>({
    provider: initialFilters?.provider || undefined,
    limit: 100,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = useSyncLogs(appliedFilters);

  const handleSearch = () => {
    setAppliedFilters({
      provider: provider && provider !== 'all' ? provider : undefined,
      status: status && status !== 'all' ? status : undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 100,
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ate</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          Buscar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logs.refetch()}
          disabled={logs.isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${logs.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      {logs.isError ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar logs: {logs.error?.message}</p>
      ) : logs.isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando sync logs...</p>
      ) : !logs.data || logs.data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum sync log encontrado</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Txns</TableHead>
                <TableHead className="text-right">Novas</TableHead>
                <TableHead className="text-right">Duracao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.data.map((log: SyncLog) => {
                const isExpanded = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell className="p-2">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(log.dateFrom)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.providerCode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{log.accountName}</TableCell>
                      <TableCell className="text-xs">{log.syncType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusBadgeClass(log.status)}`}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{log.transactionsFound}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{log.transactionsNew}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatDuration(log.durationSeconds)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0">
                          <div className="bg-muted/30 p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-mono">
                            <div><span className="text-muted-foreground">BatchId:</span> {log.batchId}</div>
                            <div><span className="text-muted-foreground">SyncType:</span> {log.syncType}</div>
                            <div><span className="text-muted-foreground">Conta:</span> {log.accountIdentifier}</div>
                            <div><span className="text-muted-foreground">Periodo:</span> {formatDate(log.dateFrom)} - {formatDate(log.dateTo)}</div>
                            <div><span className="text-muted-foreground">Novas:</span> {log.transactionsNew}</div>
                            <div><span className="text-muted-foreground">Atualizadas:</span> {log.transactionsUpdated}</div>
                            <div><span className="text-muted-foreground">Ignoradas:</span> {log.transactionsSkipped}</div>
                            <div><span className="text-muted-foreground">Inicio:</span> {new Date(log.startedAt).toLocaleString('pt-BR')}</div>
                            {log.errorMessage && (
                              <div className="col-span-2 text-red-500">
                                <span className="text-muted-foreground">Erro:</span> {log.errorMessage}
                              </div>
                            )}
                            {log.details && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Detalhes:</span>
                                <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all">
                                  {JSON.stringify(log.details, null, 2)}
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
