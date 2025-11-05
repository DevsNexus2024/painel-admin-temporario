import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface BitsoTransaction {
  id: number;
  type: 'funding' | 'withdrawal';
  transactionId: string;
  endToEndId: string;
  reconciliationId: string;
  status: 'complete' | 'pending' | 'failed';
  amount: string;
  currency: string;
  isReversal: boolean;
  payerName?: string;
  payeeName?: string;
  payerTaxId?: string;
  payerBankName?: string;
  createdAt: string;
  receivedAt?: string;
  updatedAt?: string;
}

interface BitsoBalance {
  currency: string;
  available: string;
  total: string;
  locked: string;
}

interface WebSocketData<T> {
  timestamp: string;
  data: T;
}

export function useBitsoWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [newTransaction, setNewTransaction] = useState<BitsoTransaction | null>(null);
  const [transactionTimestamp, setTransactionTimestamp] = useState<number>(0); // Para forçar re-render
  const [newBalance, setNewBalance] = useState<BitsoBalance[] | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [showMoneyEffect, setShowMoneyEffect] = useState(false);
  const [transactionQueue, setTransactionQueue] = useState<{amount: string; type: 'funding' | 'withdrawal'}[]>([]);

  useEffect(() => {
    const socketInstance = io('https://api-bank-v2.gruponexus.com.br/realtime', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    // Evento: Conectado
    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      
      // Entrar na sala 'platform' para receber notificações
      socketInstance.emit('join_room', 'platform');
    });

    // Evento: Confirmação de entrada na sala
    socketInstance.on('joined_room', () => {
      // Sala confirmada
    });

    // Evento: Tentando reconectar
    socketInstance.on('reconnect_attempt', () => {
      setIsReconnecting(true);
      setIsConnected(false);
    });

    // Evento: Reconectado com sucesso
    socketInstance.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      toast.success('Conexão restaurada!', {
        description: 'WebSocket reconectado com sucesso',
        duration: 3000,
      });
    });

    // Evento: Erro de conexão
    socketInstance.on('connect_error', () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    // Evento: Desconectado
    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      
      if (reason === 'io server disconnect') {
        setTimeout(() => socketInstance.connect(), 1000);
      }
    });

    // Evento: Nova Transação Bitso
    socketInstance.on('bitso:transaction', (data: WebSocketData<BitsoTransaction>) => {
      // Atualizar transação com timestamp único para forçar re-render
      setNewTransaction(data.data);
      setTransactionTimestamp(Date.now());
      
      // Sistema de notificação inteligente para alto volume
      setTransactionQueue(prev => {
        const newQueue = [...prev, { amount: data.data.amount, type: data.data.type }];
        return newQueue;
      });
      
      // Processar fila de notificações (throttle)
      setShowMoneyEffect(true);
      setTimeout(() => {
        setShowMoneyEffect(false);
        setTransactionQueue(prev => prev.slice(1));
      }, 3500);
      
      // Som de notificação (suave para não ficar repetitivo)
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      } catch {}
    });

    // Evento: Atualização de Saldo Bitso
    socketInstance.on('bitso:balance', (data: WebSocketData<{ balances: BitsoBalance[] }>) => {
      setNewBalance(data.data.balances);
    });

    // Evento: Pong (Keep-Alive)
    socketInstance.on('pong', (data: { timestamp: string }) => {
      setLastPing(data.timestamp);
    });

    setSocket(socketInstance);

    // Manter conexão viva com ping a cada 30 segundos
    const pingInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000);

    // Cleanup ao desmontar
    return () => {
      clearInterval(pingInterval);
      socketInstance.removeAllListeners();
      if (socketInstance.connected) {
        socketInstance.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, []);

  // Função para emitir eventos customizados (se necessário)
  const emit = useCallback((event: string, data?: any) => {
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    isReconnecting, // ✅ Para mostrar estado de reconectando
    newTransaction,
    transactionTimestamp, // ✅ Exportar para componentes usarem como dependência
    transactionQueue, // ✅ Fila de transações pendentes
    newBalance,
    lastPing,
    showMoneyEffect,
    emit,
  };
}

