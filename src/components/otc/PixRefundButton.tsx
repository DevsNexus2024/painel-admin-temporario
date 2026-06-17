import React, { useRef, useState } from 'react';
import { Undo2, AlertTriangle, Loader2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  otcPixRefundService,
  type PixRefundProvider,
} from '@/services/otcPixRefund';

interface PixRefundButtonProps {
  provider: PixRefundProvider;
  endToEndId?: string | null;
  amount?: number | string | null;
  clientName?: string | null;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'destructive' | 'outline' | 'ghost';
  /** Renderiza só o ícone (para uso compacto em linha de tabela) */
  iconOnly?: boolean;
  onDone?: () => void;
}

/**
 * Botão autossuficiente de DEVOLUÇÃO de PIX (M4). Abre um modal de confirmação que exige
 * PIN (operador) + TOTP (aprovador/dono). O valor e a conta são resolvidos server-side pelo
 * endToEndId — aqui só enviamos provider + e2e + pin + totp. Idempotente no backend.
 */
export function PixRefundButton({
  provider,
  endToEndId,
  amount,
  clientName,
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
  onDone,
}: PixRefundButtonProps) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);

  const e2e = (endToEndId || '').trim();
  const disabled = !e2e;

  const reset = () => {
    setPin('');
    setTotp('');
    setLoading(false);
    submitLockRef.current = false;
  };

  const handleConfirm = async () => {
    if (submitLockRef.current) return; // anti duplo-clique
    if (!/^\d{6}$/.test(pin)) {
      toast.error('PIN deve ter 6 dígitos');
      return;
    }
    if (!/^\d{6}$/.test(totp)) {
      toast.error('Código TOTP deve ter 6 dígitos');
      return;
    }
    submitLockRef.current = true;
    setLoading(true);
    try {
      const resp = await otcPixRefundService.criarDevolucao({ provider, endToEndId: e2e, pin, totp });
      const status = resp?.data?.status;
      const warning = resp?.data?.debit?.warning;
      if (status === 'DONE' || status === 'ALREADY_REFUNDED') {
        toast.success(status === 'ALREADY_REFUNDED' ? 'Devolução já havia sido feita (idempotente)' : 'Devolução executada');
        if (warning) toast.warning(warning);
      } else if (status === 'IN_PROGRESS') {
        toast.info('Devolução já está em andamento para este PIX');
      } else {
        toast.warning(resp?.message || `Devolução retornou status: ${status}`);
      }
      setOpen(false);
      reset();
      onDone?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Falha ao processar a devolução';
      toast.error(msg);
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        title={disabled ? 'Sem endToEndId — não é possível devolver' : 'Devolver este PIX'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Undo2 className="h-4 w-4" />
        {!iconOnly && <span className="ml-1">Devolver</span>}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (loading) return; // não fechar durante o envio
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5" /> Devolver PIX
            </DialogTitle>
            <DialogDescription>
              Estorna o PIX ao pagador original e debita o cliente. Ação sensível e idempotente.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Conferir antes de confirmar. O valor e a conta são resolvidos pelo endToEndId no servidor.
            </AlertDescription>
          </Alert>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium">{provider}</span></div>
            {clientName && <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{clientName}</span></div>}
            {amount != null && amount !== '' && (
              <div className="flex justify-between"><span className="text-muted-foreground">Valor (ref.)</span><span className="font-medium">{String(amount)}</span></div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">E2E</span>
              <span className="font-mono text-xs break-all text-right">{e2e}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pix-refund-pin">PIN do operador</Label>
              <Input
                id="pix-refund-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pix-refund-totp">Código do aprovador (TOTP)</Label>
              <Input
                id="pix-refund-totp"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="000000"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <p className="text-xs text-muted-foreground">Peça o código de 6 dígitos ao aprovador (gerado no app autenticador dele).</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={loading || pin.length !== 6 || totp.length !== 6}>
              {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Devolvendo…</> : 'Confirmar devolução'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PixRefundButton;
