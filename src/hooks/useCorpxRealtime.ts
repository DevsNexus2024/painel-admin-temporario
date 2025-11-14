import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TOKEN_STORAGE } from '@/config/api';

const REALTIME_URL = 'https://api-bank-v2.gruponexus.com.br/realtime';
const TRANSPORTS: ('websocket' | 'polling')[] = ['websocket', 'polling'];

export interface CorpXTransactionPayload {
  type: 'CORPX_TRANSACTION';
  timestamp: string;
  data: {
    id: string;
    endToEnd: string;
    transactionType: 'C' | 'D';
    amount: string;
    transactionDatetime: string;
    pixType: 'PIX_IN' | 'PIX_OUT';
    pixStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
    description: string;
    taxDocument: string;
    tenantId: string | null;
    corpxAccountId: string | null;
    created: boolean;
    source: 'WEBHOOK';
  };
}

interface UseCorpxRealtimeOptions {
  enabled?: boolean;
  onTransaction?: (payload: CorpXTransactionPayload) => void;
  filterTransaction?: (transaction: CorpXTransactionPayload['data']) => boolean;
  debug?: boolean;
}

export function useCorpxRealtime(options: UseCorpxRealtimeOptions = {}) {
  const { enabled = true, onTransaction, filterTransaction, debug = false } = options;
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastEvent, setLastEvent] = useState<CorpXTransactionPayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [latestTransaction, setLatestTransaction] = useState<CorpXTransactionPayload['data'] | null>(null);
  const [showMoneyEffect, setShowMoneyEffect] = useState(false);
  const [transactionQueue, setTransactionQueue] = useState<Array<{ amount: string; type: 'funding' | 'withdrawal' }>>([]);
  const socketRef = useRef<Socket | null>(null);
  const handlerRef = useRef<typeof onTransaction>();
  const filterRef = useRef<typeof filterTransaction>();
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideEffectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  handlerRef.current = onTransaction;
  filterRef.current = filterTransaction;

  function cleanupSocket() {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (hideEffectTimeoutRef.current) {
      clearTimeout(hideEffectTimeoutRef.current);
      hideEffectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsReconnecting(false);
    setSocketId(null);
  }

  useEffect(() => {
    if (!enabled) {
      cleanupSocket();
      return;
    }

    if (socketRef.current) {
      return;
    }

    const token = TOKEN_STORAGE.get();
    const socketInstance = io(REALTIME_URL, {
      auth: token ? { token } : undefined,
      transports: TRANSPORTS,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setSocketId(socketInstance.id);
      setLastError(null);
      socketInstance.emit('join_room', 'platform');
      if (debug) {
        // eslint-disable-next-line no-console
        console.info('[CORPX-WS] Connected', socketInstance.id);
      }
    });

    socketInstance.on('connected', (payload: any) => {
      if (debug) {
        // eslint-disable-next-line no-console
        console.info('[CORPX-WS] Server confirmation', payload);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn('[CORPX-WS] Disconnected', reason);
      }
    });

    socketInstance.on('reconnect_attempt', () => {
      setIsReconnecting(true);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
    });

    socketInstance.on('connect_error', (error) => {
      setLastError(error.message);
      setIsConnected(false);
      setIsReconnecting(true);
      if (debug) {
        // eslint-disable-next-line no-console
        console.error('[CORPX-WS] Connection error', error);
      }
    });

    socketInstance.on('error', (error) => {
      setLastError(typeof error === 'string' ? error : error?.message || 'Erro desconhecido');
    });

    socketInstance.on('corpx:transaction', (payload: CorpXTransactionPayload) => {
      const shouldProcess = filterRef.current ? filterRef.current(payload.data) : true;
      if (!shouldProcess) {
        return;
      }

      setLastEvent(payload);
      setLatestTransaction(payload.data);

      const queueEntry = {
        amount: payload.data.amount,
        type: payload.data.transactionType === 'C' ? 'funding' : 'withdrawal',
      } as const;

      setTransactionQueue((prev) => [...prev, queueEntry]);
      setShowMoneyEffect(true);

      if (hideEffectTimeoutRef.current) {
        clearTimeout(hideEffectTimeoutRef.current);
      }

      hideEffectTimeoutRef.current = setTimeout(() => {
        setShowMoneyEffect(false);
        setTransactionQueue((prev) => prev.slice(1));
      }, 3500);

      handlerRef.current?.(payload);
      if (debug) {
        // eslint-disable-next-line no-console
        console.info('[CORPX-WS] corpx:transaction', payload);
      }
    });

    socketInstance.on('pong', (data) => {
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug('[CORPX-WS] pong', data);
      }
    });

    pingIntervalRef.current = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000);

    return () => {
      cleanupSocket();
    };
  }, [enabled, debug]);

  const reconnect = () => {
    cleanupSocket();
    if (enabled) {
      setTimeout(() => {
        socketRef.current = null;
      }, 50);
    }
  };

  return {
    socketId,
    isConnected,
    isReconnecting,
    lastEvent,
    lastTransaction: lastEvent?.data ?? null,
    latestTransaction,
    showMoneyEffect,
    transactionQueue,
    lastError,
    reconnect,
  };
}


