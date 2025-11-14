import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { TOKEN_STORAGE } from "@/config/api";

const REVY_REALTIME_URL = "https://api-bank-v2.gruponexus.com.br/realtime";

export interface RevyTransactionPayload {
  type: "REVY_TRANSACTION";
  timestamp: string;
  data: {
    id: string;
    endToEnd: string;
    movementId: string;
    transactionType: "CREDIT" | "DEBIT";
    amount: string;
    amountCentavos: number;
    transactionDatetime: string;
    movementType: string;
    cashInOrOut: "CASH IN" | "CASH OUT";
    description: string | null;
    payerName: string | null;
    payerDocument: string | null;
    beneficiaryName: string | null;
    beneficiaryDocument: string | null;
    tenantId: string;
    operationalAccountId: string;
    liquidityPoolAccountId: string;
    journalId: string;
    created: boolean;
    source: "WEBHOOK";
  };
}

interface UseRevyRealtimeOptions {
  tenantId?: number;
  onTransaction?: (payload: RevyTransactionPayload) => void;
  debug?: boolean;
}

export function useRevyRealtime(options: UseRevyRealtimeOptions = {}) {
  const { tenantId, onTransaction, debug = false } = options;
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastEvent, setLastEvent] = useState<RevyTransactionPayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const handlerRef = useRef<typeof onTransaction>();
  handlerRef.current = onTransaction;

  useEffect(() => {
    const token = TOKEN_STORAGE.get();
    if (!token) {
      return;
    }

    const socketInstance = io(REVY_REALTIME_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setSocketId(socketInstance.id);
      setLastError(null);
      socketInstance.emit("join_room", "platform");
      if (tenantId) {
        socketInstance.emit("join_room", `tenant:${tenantId}`);
      }
      if (debug) {
        // eslint-disable-next-line no-console
        console.info("[REVY-WS] Connected", socketInstance.id);
      }
    });

    socketInstance.on("disconnect", (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[REVY-WS] Disconnected", reason);
      }
    });

    socketInstance.on("reconnect_attempt", () => {
      setIsReconnecting(true);
      setIsConnected(false);
    });

    socketInstance.on("reconnect", () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    socketInstance.on("connect_error", (error) => {
      setIsConnected(false);
      setIsReconnecting(true);
      setLastError(error.message);
      if (debug) {
        // eslint-disable-next-line no-console
        console.error("[REVY-WS] Connection error", error);
      }
    });

    socketInstance.on("error", (error) => {
      setLastError(typeof error === "string" ? error : error?.message || "Erro desconhecido");
    });

    socketInstance.on("revy:transaction", (payload: RevyTransactionPayload) => {
      if (tenantId && payload?.data?.tenantId !== tenantId.toString()) {
        return;
      }
      setLastEvent(payload);
      handlerRef.current?.(payload);
      if (debug) {
        // eslint-disable-next-line no-console
        console.info("[REVY-WS] Transaction", payload);
      }
    });

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsReconnecting(false);
      setSocketId(null);
    };
  }, [tenantId, debug]);

  return {
    socketId,
    isConnected,
    isReconnecting,
    lastEvent,
    lastError,
  };
}


