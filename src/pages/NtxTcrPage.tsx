import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getNtxBalance,
  getNtxStatement,
  formatCurrencyBRL,
  formatDateBR,
  statusBadgeVariant,
  type NtxBalance,
  type NtxTransactionDB,
} from '@/services/ntx-realtime';

/**
 * Painel NTX Pay ↔ TCR — saldo + extrato (somente leitura).
 *
 * Read-only por escolha: ações PIX iniciadas pelo painel (que movem dinheiro e
 * exigem fetchWithTotp) ficam pra uma passada dedicada. Todo dado do provider é
 * renderizado como filho JSX (auto-escapado) — NÃO usar document.write/
 * dangerouslySetInnerHTML com campo de terceiro (nome do pagador é atacável).
 */
export default function NtxTcrPage() {
  const [balance, setBalance] = useState<NtxBalance | null>(null);
  const [transactions, setTransactions] = useState<NtxTransactionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Saldo e extrato em paralelo; um erro num não derruba o outro na UI.
      const [bal, stmt] = await Promise.allSettled([getNtxBalance(), getNtxStatement({ size: 50 })]);
      if (bal.status === 'fulfilled') setBalance(bal.value);
      if (stmt.status === 'fulfilled') setTransactions(stmt.value.transactions);
      const firstErr =
        bal.status === 'rejected' ? bal.reason : stmt.status === 'rejected' ? stmt.reason : null;
      if (firstErr) setError(firstErr?.message || 'Falha ao carregar dados da NTX.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar dados da NTX.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">NTX Pay &lt;&gt; TCR</h1>
          <p className="text-sm text-muted-foreground">Saldo e extrato da conta NTX da TCR (somente leitura).</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Saldo (valores em reais) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard title="Saldo líquido" value={balance?.netBalance} icon={<Wallet className="h-4 w-4" />} highlight />
        <BalanceCard title="Saldo bruto" value={balance?.grossBalance} icon={<ArrowDownCircle className="h-4 w-4" />} />
        <BalanceCard title="Bloqueado" value={balance?.blockedBalance} icon={<ArrowUpCircle className="h-4 w-4" />} />
      </div>

      {/* Extrato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contraparte</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>E2E / TxId</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma transação no período.
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map((t, i) => (
                  <TableRow key={t.transactionId || t.endToEndId || i}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateBR(t.createdAt)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {t.type === 'FUNDING' ? '📥 Entrada' : t.type === 'WITHDRAWAL' ? '📤 Saída' : t.eventRaw || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm" title={t.counterpartName}>
                      {t.counterpartName || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrencyBRL(t.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(t.status)}>{t.status || '—'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs" title={t.endToEndId || t.transactionId}>
                      {t.endToEndId || t.transactionId || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceCard({
  title,
  value,
  icon,
  highlight,
}: {
  title: string;
  value: number | null | undefined;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/40' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${highlight ? 'text-primary' : ''}`}>
          {value === null || value === undefined ? '—' : formatCurrencyBRL(value)}
        </div>
      </CardContent>
    </Card>
  );
}
