import { useState } from "react";

interface UseBelmontXRealtimeOptions {
  tenantId?: number;
  onTransaction?: (payload: any) => void;
  debug?: boolean;
}

/**
 * Hook para WebSocket BelmontX
 * Nota: API BelmontX não possui WebSocket no momento
 * Este hook retorna valores padrão para manter compatibilidade
 */
export function useBelmontXRealtime(options: UseBelmontXRealtimeOptions = {}) {
  // API BelmontX não possui WebSocket, retornando valores padrão
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
