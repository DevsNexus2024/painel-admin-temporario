import { useState } from 'react';
import { MoreHorizontal, Undo2, Lock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { PixRefundButton } from '@/components/otc/PixRefundButton';
import type { PixRefundProvider } from '@/services/otcPixRefund';
import { bloqueioCautelarService } from '@/services/bloqueioCautelar';

interface RowPixActionsProps {
  provider: PixRefundProvider;
  endToEndId?: string | null;
  amount?: number | string | null;
  clientName?: string | null;
  /** Bloqueio cautelar só faz sentido em conta TCR (TCR-APP). */
  allowBlock?: boolean;
  onDone?: () => void;
}

/**
 * Menu de ações por linha (M4) — "⋯" → Devolver PIX (+ Bloquear saldo cautelar nos extratos TCR).
 * Compacto, sem cramar a coluna de ações. Abre os modais controlados.
 */
export function RowPixActions({ provider, endToEndId, amount, clientName, allowBlock = false, onDone }: RowPixActionsProps) {
  const e2e = (endToEndId || '').trim();
  const [refundOpen, setRefundOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [blocking, setBlocking] = useState(false);

  if (!e2e) return null;

  const handleBlock = async () => {
    if (blocking) return;
    setBlocking(true);
    try {
      await bloqueioCautelarService.bloquear({ endToEndId: e2e, motivo: motivo || undefined });
      toast.success('Bloqueio cautelar aplicado');
      setBlockOpen(false);
      setMotivo('');
      onDone?.();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao aplicar o bloqueio cautelar');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Ações"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            className="text-rose-700 dark:text-rose-300 cursor-pointer"
            onSelect={(e) => { e.preventDefault(); setRefundOpen(true); }}
          >
            <Undo2 className="h-4 w-4 mr-2" /> Devolver PIX
          </DropdownMenuItem>
          {allowBlock && (
            <DropdownMenuItem
              className="text-amber-700 dark:text-amber-300 cursor-pointer"
              onSelect={(e) => { e.preventDefault(); setBlockOpen(true); }}
            >
              <Lock className="h-4 w-4 mr-2" /> Bloquear saldo (cautelar)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal de devolução (controlado, sem botão-gatilho) */}
      <PixRefundButton
        hideTrigger
        open={refundOpen}
        onOpenChange={setRefundOpen}
        provider={provider}
        endToEndId={e2e}
        amount={amount}
        clientName={clientName}
        onDone={onDone}
      />

      {/* Modal de bloqueio cautelar */}
      <Dialog open={blockOpen} onOpenChange={(o) => { if (!blocking) { setBlockOpen(o); if (!o) setMotivo(''); } }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Bloquear saldo (cautelar)</DialogTitle>
            <DialogDescription>
              Segura (hold reversível) o valor deste PIX na conta TCR do usuário. Não devolve — só bloqueia.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Reversível pelo desbloqueio. Exige saldo suficiente — recusa se insuficiente.
            </AlertDescription>
          </Alert>

          <div className="space-y-1 text-sm">
            {clientName && <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{clientName}</span></div>}
            {amount != null && amount !== '' && (
              <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-medium">{String(amount)}</span></div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">E2E</span>
              <span className="font-mono text-xs break-all text-right">{e2e}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bloqueio-motivo">Motivo (opcional)</Label>
            <Input id="bloqueio-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: suspeita de fraude" autoComplete="off" />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBlockOpen(false); setMotivo(''); }} disabled={blocking}>Cancelar</Button>
            <Button onClick={handleBlock} disabled={blocking} className="bg-amber-600 hover:bg-amber-700 text-white">
              {blocking ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Bloqueando…</> : 'Confirmar bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RowPixActions;
