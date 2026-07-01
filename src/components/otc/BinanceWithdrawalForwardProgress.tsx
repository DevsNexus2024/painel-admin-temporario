/**
 * Stepper de progresso do saque Binance em 2 etapas (escrow → cliente).
 * Apenas UI — débito/reserva OTC é gerenciado pelo backend.
 */
import React from 'react';
import { Check, Circle, Loader2, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BinanceForwardStatus, OTCHoldStatus } from '@/types/binance';

const STEPS: Array<{
  key: BinanceForwardStatus | 'solicitado';
  label: string;
  statuses: BinanceForwardStatus[];
}> = [
  { key: 'solicitado', label: 'Saque solicitado', statuses: [] },
  {
    key: 'aguardando_escrow',
    label: 'Aguardando escrow',
    statuses: ['aguardando_escrow'],
  },
  {
    key: 'escrow_recebido',
    label: 'Repasse ao cliente',
    statuses: ['escrow_recebido', 'repasse_enviado', 'falhou'],
  },
  { key: 'concluido', label: 'Concluído', statuses: ['concluido'] },
];

function stepIndex(forwardStatus: BinanceForwardStatus | null | undefined): number {
  if (!forwardStatus || forwardStatus === 'aguardando_escrow') return 1;
  if (
    forwardStatus === 'escrow_recebido' ||
    forwardStatus === 'repasse_enviado' ||
    forwardStatus === 'falhou'
  ) {
    return 2;
  }
  if (forwardStatus === 'concluido') return 3;
  if (forwardStatus === 'cancelado') return -2;
  return 1;
}

function holdStatusLabel(hold: OTCHoldStatus | null | undefined): string | null {
  if (!hold) return null;
  switch (hold) {
    case 'ACTIVE':
      return 'Saldo reservado — aguardando repasse';
    case 'CAPTURED':
      return 'Débito lançado no extrato do cliente';
    case 'RELEASED':
      return 'Reserva liberada — sem débito';
    default:
      return null;
  }
}

interface BinanceWithdrawalForwardProgressProps {
  forwardStatus: BinanceForwardStatus | null;
  otcHoldStatus?: OTCHoldStatus | null;
  lastError?: string | null;
  txidRecebimento?: string | null;
  txidReenvioCliente?: string | null;
  className?: string;
}

export const BinanceWithdrawalForwardProgress: React.FC<
  BinanceWithdrawalForwardProgressProps
> = ({
  forwardStatus,
  otcHoldStatus,
  lastError,
  txidRecebimento,
  txidReenvioCliente,
  className,
}) => {
  const current = stepIndex(forwardStatus);
  const cancelled = forwardStatus === 'cancelado';
  const retrying = forwardStatus === 'falhou';
  const holdLabel = holdStatusLabel(otcHoldStatus);

  return (
    <div className={cn('space-y-4', className)}>
      {cancelled && (
        <div className="flex items-start gap-2 rounded-lg border border-muted-foreground/30 bg-muted/40 p-3 text-sm">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Saque cancelado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A reserva OTC foi liberada. Nenhum débito foi lançado.
            </p>
          </div>
        </div>
      )}

      {retrying && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Erro temporário — retry automático</p>
            {lastError && <p className="mt-1 text-xs">{lastError}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              O saldo permanece reservado enquanto o backend tenta novamente.
            </p>
          </div>
        </div>
      )}

      {holdLabel && !cancelled && (
        <p className="text-xs text-muted-foreground rounded-md bg-muted/30 px-3 py-2">
          {holdLabel}
        </p>
      )}

      {!cancelled && (
        <ol className="space-y-3">
          {STEPS.map((step, index) => {
            const done = !retrying && current > index;
            const active = (retrying && index === 2) || (!retrying && current === index);
            const pending = !retrying && current < index;

            return (
              <li key={step.key} className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    done && 'border-green-600 bg-green-600 text-white',
                    active && !retrying && 'border-orange-500 text-orange-600',
                    active && retrying && 'border-amber-500 text-amber-600',
                    pending && 'border-muted-foreground/30 text-muted-foreground/40',
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      active && !retrying && 'text-orange-600',
                      active && retrying && 'text-amber-600',
                      done && 'text-green-700 dark:text-green-400',
                      pending && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                  {active && forwardStatus === 'aguardando_escrow' && (
                    <p className="text-xs text-muted-foreground">
                      Aguardando cripto na wallet oficial TCR
                    </p>
                  )}
                  {active &&
                    (forwardStatus === 'escrow_recebido' ||
                      forwardStatus === 'repasse_enviado') && (
                      <p className="text-xs text-muted-foreground">
                        {forwardStatus === 'repasse_enviado'
                          ? 'Repasse enviado — aguardando confirmação on-chain'
                          : 'Cripto recebida — iniciando repasse ao cliente'}
                      </p>
                    )}
                  {active && retrying && (
                    <p className="text-xs text-muted-foreground">
                      Aguardando nova tentativa de repasse…
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {(txidRecebimento || txidReenvioCliente) && (
        <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
          {txidRecebimento && (
            <div>
              <span className="text-muted-foreground">Tx recebimento escrow: </span>
              <span className="break-all font-mono">{txidRecebimento}</span>
            </div>
          )}
          {txidReenvioCliente && (
            <div>
              <span className="text-muted-foreground">Tx repasse cliente: </span>
              <span className="break-all font-mono">{txidReenvioCliente}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BinanceWithdrawalForwardProgress;
