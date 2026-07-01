/**
 * Helpers para saque Binance em 2 etapas (extração de withdrawId e status de repasse).
 */
import type { BinanceForwardQueueItem, BinanceForwardStatus } from '@/types/binance';

export const FORWARD_STATUS_LABEL: Record<string, string> = {
  aguardando_escrow: 'Aguardando escrow',
  escrow_recebido: 'Escrow recebido',
  repasse_enviado: 'Repasse enviado',
  concluido: 'Concluído',
  falhou: 'Falhou (retry auto)',
  cancelado: 'Cancelado',
};

export const HOLD_LABEL: Record<string, string> = {
  ACTIVE: 'Reservado',
  CAPTURED: 'Debitado',
  RELEASED: 'Liberado',
};

export function canCancelForwardQueueItem(item: BinanceForwardQueueItem): boolean {
  return item.forward_status !== 'concluido' && item.forward_status !== 'cancelado';
}

/**
 * Extrai o withdrawId do texto de uma operação OTC.
 * O backend grava a descrição no padrão "SAQUE - ID: {withdrawId}".
 */
export function extractWithdrawIdFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/SAQUE\s*-\s*ID:\s*([A-Za-z0-9]+)/i);
  return match?.[1] ?? null;
}

/** Estados terminais: repasse encerrado, sem novas atualizações. */
export function isTerminalForwardStatus(status: BinanceForwardStatus): boolean {
  return status === 'concluido' || status === 'cancelado';
}

/** Estados que ainda fazem sentido acompanhar (polling ativo). */
export function isTrackableForwardStatus(status: BinanceForwardStatus): boolean {
  return !isTerminalForwardStatus(status);
}
