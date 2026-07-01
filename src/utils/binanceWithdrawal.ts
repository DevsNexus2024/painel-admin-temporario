/**
 * Helpers para saque Binance em 2 etapas (extração de withdrawId e status de repasse).
 */
import type { BinanceForwardStatus } from '@/types/binance';

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
