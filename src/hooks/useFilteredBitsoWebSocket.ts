import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface BitsoTransaction {
  id: number;
  type: 'funding' | 'withdrawal';
  transactionId: string;
  endToEndId: string;
  reconciliationId: string | null;
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

interface BitsoDepositProcessed {
  transaction_id: string;
  end_to_end_id: string;
  reconciliation_id: string | null;
  tenant_id: string;
  tenant_slug: string;
  account_id: string;
  account_type: string;
  user_id: string | null;
  amount: string;
  fee: string;
  gross_amount: string;
  currency: string;
  journal_id: string;
  status: 'processed';
  processed_at: string;
}

interface BitsoWithdrawalCompleted {
  transaction_id: string;
  end_to_end_id: string;
  tenant_id: string;
  tenant_slug: string;
  account_id: string | null;
  amount: number;
  fee: number | null;
  currency: string;
  journal_id: string;
  status: 'completed';
  payee: {
    name?: string;
    tax_id?: string;
  };
  completed_at: string;
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

export interface UseFilteredBitsoWebSocketOptions {
  context: 'api' | 'otc' | 'tcr';
  tenantId?: number;
  accountId?: number;
}

// Constantes
const OTC_TENANT_ID = 3;
const OTC_ACCOUNT_ID = 27;
const TCR_TENANT_ID = 2;

export function useFilteredBitsoWebSocket(options: UseFilteredBitsoWebSocketOptions) {
  const { context, tenantId, accountId } = options;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [newTransaction, setNewTransaction] = useState<BitsoTransaction | null>(null);
  const [transactionTimestamp, setTransactionTimestamp] = useState<number>(0);
  const [newBalance, setNewBalance] = useState<BitsoBalance[] | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [showMoneyEffect, setShowMoneyEffect] = useState(false);
  const [transactionQueue, setTransactionQueue] = useState<{amount: string; type: 'funding' | 'withdrawal'}[]>([]);

  // Função para verificar se um evento deve ser processado
  const shouldProcessEvent = useCallback((eventData: any): boolean => {
    if (context === 'api') {
      // API mostra tudo
      return true;
    }

    if (context === 'otc') {
      // OTC: filtrar por tenantId=3 e accountId=27
      const eventTenantId = eventData.tenant_id || eventData.tenantId;
      const eventAccountId = eventData.account_id || eventData.accountId;
      
      return eventTenantId === OTC_TENANT_ID.toString() && 
             eventAccountId === OTC_ACCOUNT_ID.toString();
    }

    if (context === 'tcr') {
      // TCR: filtrar por tenantId=2
      const eventTenantId = eventData.tenant_id || eventData.tenantId;
      const targetTenantId = tenantId || TCR_TENANT_ID;
      
      return eventTenantId === targetTenantId.toString();
    }

    return false;
  }, [context, tenantId]);

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
      
      // Se não for contexto 'api', também entrar na sala do tenant para receber eventos filtrados
      if (context === 'otc') {
        socketInstance.emit('join_room', `tenant:${OTC_TENANT_ID}`);
      } else if (context === 'tcr') {
        const targetTenantId = tenantId || TCR_TENANT_ID;
        socketInstance.emit('join_room', `tenant:${targetTenantId}`);
      }
    });

    socketInstance.on('joined_room', () => {
      // Sala confirmada
    });

    socketInstance.on('reconnect_attempt', () => {
      setIsReconnecting(true);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      toast.success('Conexão restaurada!', {
        description: 'WebSocket reconectado com sucesso',
        duration: 3000,
      });
    });

    socketInstance.on('connect_error', () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      
      if (reason === 'io server disconnect') {
        setTimeout(() => socketInstance.connect(), 1000);
      }
    });

    // Evento: Nova Transação Bitso (bitso:transaction)
    // Este evento não tem tenant_id, então para OTC/TCR precisamos filtrar depois
    // Mas como agora usamos bitso:deposit:processed, este evento só é usado para contexto 'api'
    socketInstance.on('bitso:transaction', (data: WebSocketData<BitsoTransaction>) => {
      // Para contexto 'api', mostrar tudo
      if (context === 'api') {
        setNewTransaction(data.data);
        setTransactionTimestamp(Date.now());
        
        setTransactionQueue(prev => {
          const newQueue = [...prev, { amount: data.data.amount, type: data.data.type }];
          return newQueue;
        });
        
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
      }
    });

    // Evento: Depósito Processado (bitso:deposit:processed)
    // Este evento já vem filtrado por tenant (rooms), mas verificamos accountId também
    socketInstance.on('bitso:deposit:processed', (event: WebSocketData<BitsoDepositProcessed>) => {
      if (!shouldProcessEvent(event.data)) {
        return;
      }

      // Converter para formato BitsoTransaction
      const transaction: BitsoTransaction = {
        id: parseInt(event.data.journal_id),
        type: 'funding',
        transactionId: event.data.transaction_id,
        endToEndId: event.data.end_to_end_id,
        reconciliationId: event.data.reconciliation_id || '',
        status: 'complete',
        amount: event.data.amount,
        currency: event.data.currency,
        isReversal: false,
        payerName: undefined,
        createdAt: event.data.processed_at,
        receivedAt: event.data.processed_at,
        updatedAt: event.data.processed_at,
      };

      setNewTransaction(transaction);
      setTransactionTimestamp(Date.now());

      setTransactionQueue(prev => {
        const newQueue = [...prev, { amount: transaction.amount, type: 'funding' as const }];
        return newQueue;
      });

      setShowMoneyEffect(true);
      setTimeout(() => {
        setShowMoneyEffect(false);
        setTransactionQueue(prev => prev.slice(1));
      }, 3500);

      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      } catch {}
    });

    // Evento: Saque Confirmado (bitso:withdrawal:completed)
    socketInstance.on('bitso:withdrawal:completed', (event: WebSocketData<BitsoWithdrawalCompleted>) => {
      if (!shouldProcessEvent(event.data)) {
        return;
      }

      const transaction: BitsoTransaction = {
        id: parseInt(event.data.journal_id),
        type: 'withdrawal',
        transactionId: event.data.transaction_id,
        endToEndId: event.data.end_to_end_id,
        reconciliationId: null,
        status: 'complete',
        amount: String(event.data.amount),
        currency: event.data.currency,
        isReversal: false,
        payeeName: event.data.payee.name,
        createdAt: event.data.completed_at,
        receivedAt: event.data.completed_at,
        updatedAt: event.data.completed_at,
      };

      setNewTransaction(transaction);
      setTransactionTimestamp(Date.now());

      // Sistema de notificação para saques também
      setTransactionQueue(prev => {
        const newQueue = [...prev, { amount: String(event.data.amount), type: 'withdrawal' as const }];
        return newQueue;
      });

      setShowMoneyEffect(true);
      setTimeout(() => {
        setShowMoneyEffect(false);
        setTransactionQueue(prev => prev.slice(1));
      }, 3500);

      // Som de notificação para saques também
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

    socketInstance.on('pong', (data: { timestamp: string }) => {
      setLastPing(data.timestamp);
    });

    setSocket(socketInstance);

    const pingInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000);

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
  }, [context, tenantId, accountId, shouldProcessEvent]);

  const emit = useCallback((event: string, data?: any) => {
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    isReconnecting,
    newTransaction,
    transactionTimestamp,
    transactionQueue,
    newBalance,
    lastPing,
    showMoneyEffect,
    emit,
  };
}

