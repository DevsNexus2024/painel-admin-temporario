import { useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useReconcile, useReconciliationResults } from '@/hooks/useSync';
import { toastSuccess, toastError } from '@/utils/toast';
import type {
  ReconcileResponse,
  ReconciliationResult,
  Divergence,
  ReconciliationResultStored,
  ReconciliationResultsParams,
} from '@/types/sync';

function reconStatusBadge(status: string): string {
  switch (status) {
    case 'MATCHED': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'DIVERGENT': return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'FAILED': return 'bg-red-500/15 text-red-600 border-red-500/30';
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function formatBRL(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function DivergenceList({ divergences }: { divergences: Divergence[] }) {
  if (divergences.length === 0) return <span className="text-muted-foreground">Nenhuma divergencia</span>;

  return (
    <div className="space-y-1">
      {divergences.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${
            d.type === 'MISSING_IN_DB' ? 'text-red-500' :
            d.type === 'MISSING_IN_STATEMENT' ? 'text-orange-500' :
            'text-yellow-500'
          }`}>
            {d.type}
          </Badge>
          <span className="font-mono truncate max-w-[200px]">{d.reconciliationKey}</span>
          {d.statementAmount !== undefined && (
            <span className="text-muted-foreground">Extrato: {formatBRL(d.statementAmount)}</span>
          )}
          {d.databaseAmount !== undefined && (
            <span className="text-muted-foreground">DB: {formatBRL(d.databaseAmount)}</span>
          )}
          {d.description && <span className="text-muted-foreground">{d.description}</span>}
          {d.autoFixed && <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600">auto-fixed</Badge>}
        </div>
      ))}
    </div>
  );
}

// ── Reconcile Form + Result ──────────────────────────────

function ReconcileForm() {
  const [providerCode, setProviderCode] = useState('');
  const [date, setDate] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [autoFix, setAutoFix] = useState(false);
  const [result, setResult] = useState<ReconcileResponse | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const reconcile = useReconcile();

  const handleExecute = () => {
    if (!providerCode) {
      toastError('Selecione um provider');
      return;
    }
    if (!date) {
      toastError('Selecione uma data');
      return;
    }

    setResult(null);
    reconcile.mutate(
      {
        providerCode,
        date,
        accountIdentifier: accountIdentifier || undefined,
        autoFix,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          toastSuccess('Reconciliacao concluida', `${data.matched} matched, ${data.divergent} divergent`);
        },
        onError: (err) => toastError('Erro na reconciliacao', err.message),
      },
    );
  };

  const executeButton = (
    <Button
      disabled={reconcile.isPending || !providerCode || !date}
      {...(!autoFix ? { onClick: handleExecute } : {})}
    >
      {reconcile.isPending ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Executando...
        </>
      ) : (
        'Executar Reconciliacao'
      )}
    </Button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Executar Reconciliacao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Provider *</label>
              <Select value={providerCode} onValueChange={setProviderCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corpx">CorpX</SelectItem>
                  <SelectItem value="brasilcash">BrasilCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data *</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Conta (opcional)</label>
              <Input
                placeholder="CNPJ ou identificador"
                value={accountIdentifier}
                onChange={(e) => setAccountIdentifier(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFix}
                  onChange={(e) => setAutoFix(e.target.checked)}
                  className="rounded border-muted-foreground"
                />
                Auto-fix
              </label>
            </div>
          </div>

          {autoFix && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Auto-fix ira re-sincronizar transacoes faltantes. Use com cuidado em producao.
            </div>
          )}

          {autoFix ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                {executeButton}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar auto-fix?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza? Isso ira re-sincronizar transacoes faltantes automaticamente.
                    Esta acao nao pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleExecute}>
                    Confirmar e Executar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            executeButton
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                {result.matched} MATCHED
              </Badge>
              <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">
                {result.divergent} DIVERGENT
              </Badge>
              <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">
                {result.failed} FAILED
              </Badge>
            </div>

            {result.results.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Conta</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Extrato</TableHead>
                      <TableHead className="text-right">Banco</TableHead>
                      <TableHead className="text-right">Faltando</TableHead>
                      <TableHead className="text-right">Div.</TableHead>
                      <TableHead className="text-right">Fix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((r: ReconciliationResult, idx: number) => {
                      const isExpanded = expandedIdx === idx;
                      return (
                        <Fragment key={`${r.accountIdentifier}-${idx}`}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          >
                            <TableCell className="p-2">
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs">{r.accountName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${reconStatusBadge(r.status)}`}>
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.statementCount}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.databaseCount}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.missingInDb}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.amountMismatches}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.autoFixed}</TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0">
                                <div className="bg-muted/30 p-4">
                                  <DivergenceList divergences={r.divergences} />
                                  {r.error && (
                                    <p className="mt-2 text-xs text-red-500">Erro: {r.error}</p>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Reconciliation History ───────────────────────────────

function ReconciliationHistory() {
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<ReconciliationResultsParams>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const results = useReconciliationResults(appliedFilters);

  const handleSearch = () => {
    setAppliedFilters({
      provider: provider && provider !== 'all' ? provider : undefined,
      status: status && status !== 'all' ? status : undefined,
      from: from || undefined,
      to: to || undefined,
    });
  };

  const items = results.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Historico de Reconciliacoes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                <SelectItem value="MATCHED">Matched</SelectItem>
                <SelectItem value="DIVERGENT">Divergent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
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
            onClick={() => results.refetch()}
            disabled={results.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${results.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {results.isError ? (
          <p className="text-sm text-red-500 text-center py-4">Erro: {results.error?.message}</p>
        ) : results.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Data</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Faltando</TableHead>
                  <TableHead className="text-right">Fix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r: ReconciliationResultStored) => {
                  const isExpanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        <TableCell className="p-2">
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(r.reconciliationDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{r.providerCode}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.accountName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${reconStatusBadge(r.status)}`}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{r.missingInDb + r.missingInStatement}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{r.autoFixed}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0">
                            <div className="bg-muted/30 p-4 space-y-2 text-xs font-mono">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <div><span className="text-muted-foreground">Extrato:</span> {r.statementCount}</div>
                                <div><span className="text-muted-foreground">Banco:</span> {r.databaseCount}</div>
                                <div><span className="text-muted-foreground">Faltando DB:</span> {r.missingInDb}</div>
                                <div><span className="text-muted-foreground">Faltando Extrato:</span> {r.missingInStatement}</div>
                                <div><span className="text-muted-foreground">Divergencias:</span> {r.amountMismatches}</div>
                                <div><span className="text-muted-foreground">Auto-fixed:</span> {r.autoFixed}</div>
                              </div>
                              <DivergenceList divergences={r.divergences || []} />
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
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────

export default function ReconciliationTab() {
  return (
    <div className="space-y-6">
      <ReconcileForm />
      <ReconciliationHistory />
    </div>
  );
}
