/**
 * Stepper de progresso do saque Binance em 2 etapas (escrow → cliente).
 */
import React from 'react';
import { Check, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BinanceForwardStatus } from '@/types/binance';

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
    statuses: ['escrow_recebido', 'repasse_enviado'],
  },
  { key: 'concluido', label: 'Concluído', statuses: ['concluido'] },
];

function stepIndex(forwardStatus: BinanceForwardStatus | null | undefined): number {
  if (!forwardStatus || forwardStatus === 'aguardando_escrow') return 1;
  if (forwardStatus === 'escrow_recebido' || forwardStatus === 'repasse_enviado') return 2;
  if (forwardStatus === 'concluido') return 3;
  if (forwardStatus === 'falhou') return -1;
  return 1;
}

interface BinanceWithdrawalForwardProgressProps {
  forwardStatus: BinanceForwardStatus | null;
  lastError?: string | null;
  txidRecebimento?: string | null;
  txidReenvioCliente?: string | null;
  className?: string;
}

export const BinanceWithdrawalForwardProgress: React.FC<
  BinanceWithdrawalForwardProgressProps
> = ({ forwardStatus, lastError, txidRecebimento, txidReenvioCliente, className }) => {
  const current = stepIndex(forwardStatus);
  const failed = forwardStatus === 'falhou';

  return (
    <div className={cn('space-y-4', className)}>
      {failed && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Repasse falhou</p>
            {lastError && <p className="mt-1 text-xs">{lastError}</p>}
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {STEPS.map((step, index) => {
          const done = !failed && current > index;
          const active = !failed && current === index;
          const pending = !failed && current < index;

          return (
            <li key={step.key} className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                  done && 'border-green-600 bg-green-600 text-white',
                  active && 'border-orange-500 text-orange-600',
                  pending && 'border-muted-foreground/30 text-muted-foreground/40',
                  failed && index === 0 && 'border-green-600 bg-green-600 text-white',
                  failed && index > 0 && 'border-muted-foreground/30 text-muted-foreground/40',
                )}
              >
                {done || (failed && index === 0) ? (
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
                    active && 'text-orange-600',
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
              </div>
            </li>
          );
        })}
      </ol>

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
