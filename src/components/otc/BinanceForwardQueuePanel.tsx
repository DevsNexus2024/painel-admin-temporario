/**
 * Fila de repasse Binance (admin) — acompanhamento e cancelamento.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  cancelarForwardQueueBinance,
  listarForwardQueueBinance,
} from '@/services/binance';
import type { BinanceForwardQueueItem } from '@/types/binance';

const FORWARD_STATUS_LABEL: Record<string, string> = {
  aguardando_escrow: 'Aguardando escrow',
  escrow_recebido: 'Escrow recebido',
  repasse_enviado: 'Repasse enviado',
  concluido: 'Concluído',
  falhou: 'Falhou (retry auto)',
  cancelado: 'Cancelado',
};

const HOLD_LABEL: Record<string, string> = {
  ACTIVE: 'Reservado',
  CAPTURED: 'Debitado',
  RELEASED: 'Liberado',
};

function canCancel(item: BinanceForwardQueueItem): boolean {
  return item.forward_status !== 'concluido' && item.forward_status !== 'cancelado';
}

interface BinanceForwardQueuePanelProps {
  otcClientId?: number;
  clientNameById?: (id: number) => string | undefined;
  onCancelled?: () => void;
}

export const BinanceForwardQueuePanel: React.FC<BinanceForwardQueuePanelProps> = ({
  otcClientId,
  clientNameById,
  onCancelled,
}) => {
  const [items, setItems] = useState<BinanceForwardQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BinanceForwardQueueItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarForwardQueueBinance({
        otc_client_id: otcClientId,
        limit: 50,
      });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [otcClientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelarForwardQueueBinance(
        cancelTarget.id,
        cancelReason.trim() || undefined,
      );
      toast.success('Saque cancelado. Reserva OTC liberada.');
      setCancelTarget(null);
      setCancelReason('');
      await load();
      onCancelled?.();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao cancelar item da fila');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="border-t bg-muted/20 px-6 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Fila de repasse (admin)</h3>
          <p className="text-xs text-muted-foreground">
            Saques em 2 etapas pendentes ou com erro. Cancelar libera a reserva OTC.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-8"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Atualizar</span>
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhum item na fila
          {otcClientId ? ' para este cliente' : ''}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="text-xs">ID fila</TableHead>
                <TableHead className="text-xs">Withdraw</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
                <TableHead className="text-xs">Repasse</TableHead>
                <TableHead className="text-xs">Reserva</TableHead>
                <TableHead className="text-xs">Erro</TableHead>
                <TableHead className="text-xs w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="h-10">
                  <TableCell className="text-xs font-mono">{item.id}</TableCell>
                  <TableCell className="text-xs font-mono max-w-[100px] truncate" title={item.withdraw_id_binance}>
                    {item.withdraw_id_binance}
                  </TableCell>
                  <TableCell className="text-xs">
                    {clientNameById?.(item.otc_client_id) ?? `#${item.otc_client_id}`}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.amount ? `${item.amount} ${item.coin ?? 'USDT'}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {FORWARD_STATUS_LABEL[item.forward_status] ?? item.forward_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.otc_hold_status
                      ? HOLD_LABEL[item.otc_hold_status] ?? item.otc_hold_status
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={item.last_error ?? ''}>
                    {item.last_error || '—'}
                  </TableCell>
                  <TableCell>
                    {canCancel(item) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setCancelTarget(item)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar repasse</DialogTitle>
            <DialogDescription>
              Libera a reserva OTC do cliente. O item não será reprocessado automaticamente.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Withdraw: </span>
                <span className="font-mono text-xs">{cancelTarget.withdraw_id_binance}</span>
              </p>
              <div className="space-y-1">
                <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
                <Input
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex.: cliente desistiu"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmCancel()} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BinanceForwardQueuePanel;
