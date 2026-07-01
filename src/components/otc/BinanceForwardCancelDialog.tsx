/**
 * Dialog de confirmação para cancelar item da fila de repasse Binance.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BinanceForwardQueueItem } from '@/types/binance';

interface BinanceForwardCancelDialogProps {
  target: BinanceForwardQueueItem | null;
  reason: string;
  onReasonChange: (value: string) => void;
  cancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const BinanceForwardCancelDialog: React.FC<BinanceForwardCancelDialogProps> = ({
  target,
  reason,
  onReasonChange,
  cancelling,
  onConfirm,
  onClose,
}) => (
  <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Cancelar repasse</DialogTitle>
        <DialogDescription>
          Libera a reserva OTC do cliente. O item não será reprocessado automaticamente.
        </DialogDescription>
      </DialogHeader>
      {target && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Withdraw: </span>
            <span className="font-mono text-xs">{target.withdraw_id_binance}</span>
          </p>
          <div className="space-y-1">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ex.: cliente desistiu"
            />
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={cancelling}>
          Voltar
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={cancelling}>
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Confirmar cancelamento
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default BinanceForwardCancelDialog;
