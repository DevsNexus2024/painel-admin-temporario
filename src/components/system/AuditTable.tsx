import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRight, ChevronLeft, Shield, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuditLogs, useAuditIntegrity } from '@/hooks/useSystem';
import type { AuditEntry, AuditFilters } from '@/types/system';

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function AuditTable() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 50 });
  const [actorInput, setActorInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [resourceInput, setResourceInput] = useState('');

  const audit = useAuditLogs(filters);
  const integrity = useAuditIntegrity();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const handleApplyFilters = () => {
    setFilters(prev => ({
      ...prev,
      page: 1,
      actorId: actorInput || undefined,
      action: actionInput || undefined,
      resourceType: resourceInput || undefined,
    }));
  };

  const pagination = audit.data?.pagination;
  const entries = audit.data?.data || [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Actor</label>
          <Input
            placeholder="user:5"
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Action</label>
          <Input
            placeholder="CREATE_PIX"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Resource</label>
          <Input
            placeholder="pix_transaction"
            value={resourceInput}
            onChange={(e) => setResourceInput(e.target.value)}
            className="w-44"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleApplyFilters}>
          Filtrar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => audit.refetch()}
          disabled={audit.isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${audit.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Integrity banner */}
      {integrity.isError && (
        <Card className="border border-red-500/30">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-500">Erro ao verificar integridade da chain</p>
          </CardContent>
        </Card>
      )}
      {integrity.data && (
        <Card className={`border ${integrity.data.isValid ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <CardContent className="flex items-center gap-3 p-4">
            {integrity.data.isValid ? (
              <Shield className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-500" />
            )}
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                Hash Chain:
                <Badge
                  variant="outline"
                  className={integrity.data.isValid
                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    : 'bg-red-500/15 text-red-600 border-red-500/30'
                  }
                >
                  {integrity.data.isValid ? 'Integro' : 'Violacao detectada'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {integrity.data.logsChecked ?? '?'} registros verificados
              </p>
            </div>
            {integrity.data.errors && integrity.data.errors.length > 0 && (
              <div className="ml-auto text-xs text-red-500">
                {integrity.data.errors.map((err) => (
                  <div key={err.logId}>Log {err.logId}: {err.error}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {audit.isError ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar audit logs</p>
      ) : audit.isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando audit logs...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-[130px]">Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>ResourceId</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: AuditEntry) => {
                const rowKey = String(entry.id);
                const isExpanded = expandedKey === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                    >
                      <TableCell className="p-2">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatTs(entry.ts)}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.actorId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.resourceType}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.resourceId}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <div className="bg-muted/30 p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-mono">
                            <div><span className="text-muted-foreground">RequestId:</span> {entry.requestId}</div>
                            <div><span className="text-muted-foreground">TraceId:</span> {entry.traceId}</div>
                            <div><span className="text-muted-foreground">RecordDigest:</span> {entry.recordDigest}</div>
                            <div><span className="text-muted-foreground">PrevHash:</span> {entry.prevHash}</div>
                            <div className="col-span-2"><span className="text-muted-foreground">Hash:</span> {entry.hash}</div>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
          >
            Proximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
