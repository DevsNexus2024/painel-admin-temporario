/**
 * Modal de acompanhamento de repasse Binance (2 etapas).
 * Somente leitura — o repasse é executado pelo backend; aqui apenas exibimos o stepper.
 * Usado tanto logo após criar o saque quanto ao reabrir a partir do extrato/fila.
 */
import React from 'react';
import { Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BinanceWithdrawalForwardProgress } from '@/components/otc/BinanceWithdrawalForwardProgress';
import { isTerminalForwardStatus } from '@/utils/binanceWithdrawal';
import type { BinanceForwardStatusData } from '@/types/binance';

interface BinanceForwardTrackingModalProps {
  isOpen: boolean;
  withdrawId?: string | null;
  forwardStatus?: BinanceForwardStatusData | null;
  isPollingForward?: boolean;
  /** Fecha o modal mantendo o polling ativo em segundo plano. */
  onContinueInBackground: () => void;
  /** Encerra a sessão de acompanhamento (aborta polling e limpa estado). */
  onDismiss: () => void;
}

export const BinanceForwardTrackingModal: React.FC<BinanceForwardTrackingModalProps> = ({
  isOpen,
  withdrawId,
  forwardStatus,
  isPollingForward = false,
  onContinueInBackground,
  onDismiss,
}) => {
  const status = forwardStatus?.forward_status ?? 'aguardando_escrow';
  const terminal = isTerminalForwardStatus(status);

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    // Fechar pelo X/overlay: se terminou, encerra a sessão; senão mantém em background.
    if (terminal) {
      onDismiss();
    } else {
      onContinueInBackground();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-4 h-4 text-orange-500" />
            Acompanhando repasse
          </DialogTitle>
          <DialogDescription className="text-sm">
            Fluxo em 2 etapas: Binance → wallet TCR → wallet do cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {withdrawId && (
            <p className="text-xs text-muted-foreground">
              ID Binance: <span className="font-mono">{withdrawId}</span>
            </p>
          )}
          <BinanceWithdrawalForwardProgress
            forwardStatus={status}
            otcHoldStatus={forwardStatus?.otc_hold_status}
            lastError={forwardStatus?.last_error}
            txidRecebimento={forwardStatus?.txid_recebimento}
            txidReenvioCliente={forwardStatus?.txid_reenvio_cliente}
          />
          {isPollingForward && !terminal && (
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              Atualizando status a cada ~7 segundos…
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {terminal ? (
            <Button variant="outline" onClick={onDismiss}>
              Fechar
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={onContinueInBackground}
              className="border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
            >
              Continuar em segundo plano
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BinanceForwardTrackingModal;
