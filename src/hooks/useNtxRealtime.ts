import { useState } from "react";

interface UseNtxRealtimeOptions {
  tenantId?: number;
  onTransaction?: (payload: any) => void;
  debug?: boolean;
}

/**
 * Hook para WebSocket NTX Pay
 * Nota: o socket do painel é Bitso-namespaced e a NTX não emite nele.
 * Este hook retorna valores padrão para manter compatibilidade (igual BelmontX).
 */
export function useNtxRealtime(options: UseNtxRealtimeOptions = {}) {
  const [isConnected] = useState(false);
  const [isReconnecting] = useState(false);
  const [socketId] = useState<string | null>(null);
  const [lastEvent] = useState<any | null>(null);
  const [lastError] = useState<string | null>(null);

  return {
    socketId,
    isConnected,
    isReconnecting,
    lastEvent,
    lastError,
  };
}
