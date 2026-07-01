/**
 * Hook para fila de repasse Binance (admin) — fetch, map por withdrawId e cancelamento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  cancelarForwardQueueBinance,
  listarForwardQueueBinance,
} from '@/services/binance';
import type { BinanceForwardQueueItem } from '@/types/binance';

interface UseBinanceForwardQueueOptions {
  otcClientId?: number;
  /** Quando false, não faz fetch (ex.: operador não-admin ou aba inativa). */
  enabled?: boolean;
  onCancelled?: () => void;
}

export function useBinanceForwardQueue({
  otcClientId,
  enabled = true,
  onCancelled,
}: UseBinanceForwardQueueOptions = {}) {
  const [items, setItems] = useState<BinanceForwardQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BinanceForwardQueueItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  const load = useCallback(async () => {
    if (!enabled) return;
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
  }, [enabled, otcClientId]);

  // Fetch inicial e quando enabled/cliente mudam — deps estáveis (sem callbacks).
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const data = await listarForwardQueueBinance({
          otc_client_id: otcClientId,
          limit: 50,
        });
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, otcClientId]);

  const queueByWithdrawId = useMemo(() => {
    const map = new Map<string, BinanceForwardQueueItem>();
    for (const item of items) {
      map.set(item.withdraw_id_binance, item);
    }
    return map;
  }, [items]);

  const confirmCancel = useCallback(async () => {
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
      onCancelledRef.current?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao cancelar item da fila';
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, load]);

  const openCancelDialog = useCallback((item: BinanceForwardQueueItem) => {
    setCancelTarget(item);
    setCancelReason('');
  }, []);

  const closeCancelDialog = useCallback(() => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason('');
  }, [cancelling]);

  return {
    items,
    loading,
    queueByWithdrawId,
    load,
    cancelTarget,
    cancelReason,
    setCancelReason,
    cancelling,
    confirmCancel,
    openCancelDialog,
    closeCancelDialog,
  };
}
