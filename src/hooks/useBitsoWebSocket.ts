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
    console.log('🔌 Iniciando conexão WebSocket com Bitso (modo público)...');
    console.log('🌐 URL: https://api-bank-v2.gruponexus.com.br/realtime');

    // Criar conexão Socket.IO com reconexão automática robusta
    const socketInstance = io('https://api-bank-v2.gruponexus.com.br/realtime', {
      transports: ['websocket', 'polling'], // Permitir fallback para polling
      reconnection: true,
      reconnectionAttempts: Infinity, // ✅ Tentar reconectar infinitamente
      reconnectionDelay: 1000, // Começar com 1s
      reconnectionDelayMax: 10000, // ✅ Máximo 10s (exponential backoff)
      timeout: 20000,
    });

    // Evento: Conectado
    socketInstance.on('connect', () => {
      console.log('✅ WebSocket conectado!', socketInstance.id);
      setIsConnected(true);
      setIsReconnecting(false); // ✅ Limpar estado de reconectando
      
      // Entrar na sala 'platform' para receber notificações
      socketInstance.emit('join_room', 'platform');
      console.log('📡 Solicitando entrada na sala: platform');
    });

    // Evento: Confirmação de entrada na sala
    socketInstance.on('joined_room', (room: string) => {
      console.log('✅ Entrou na sala:', room);
    });

    // Evento: Tentando reconectar
    socketInstance.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 Tentativa de reconexão #${attemptNumber}...`);
      setIsReconnecting(true);
      setIsConnected(false);
    });

    // Evento: Reconectado com sucesso
    socketInstance.on('reconnect', (attemptNumber: number) => {
      console.log(`✅ Reconectado após ${attemptNumber} tentativas!`);
      setIsConnected(true);
      setIsReconnecting(false);
      toast.success('Conexão restaurada!', {
        description: 'WebSocket reconectado com sucesso',
        duration: 3000,
      });
    });

    // Evento: Erro de conexão
    socketInstance.on('connect_error', (error: any) => {
      console.error('❌ Erro de conexão WebSocket:', error);
      console.error('   Tipo:', error.type);
      console.error('   Mensagem:', error.message);
      console.error('   Transport:', socketInstance.io.engine?.transport?.name || 'N/A');
      setIsConnected(false);
      setIsReconnecting(true);
    });

    // Evento: Desconectado
    socketInstance.on('disconnect', (reason) => {
      console.log('👋 WebSocket desconectado:', reason);
      setIsConnected(false);
      setIsReconnecting(true);
      
      if (reason === 'io server disconnect') {
        // Servidor desconectou, tentar reconectar manualmente
        console.log('🔄 Servidor forçou desconexão, reconectando...');
        setTimeout(() => socketInstance.connect(), 1000);
      }
    });

    // Evento: Nova Transação Bitso
    socketInstance.on('bitso:transaction', (data: WebSocketData<BitsoTransaction>) => {
      console.log('📨 Nova transação Bitso recebida:', data);
      console.log('💰 Tipo:', data.data.type, '| Valor:', data.data.amount, '| ID:', data.data.id);
      
      // Atualizar transação com timestamp único para forçar re-render
      setNewTransaction(data.data);
      setTransactionTimestamp(Date.now()); // ✅ Força useEffect a disparar sempre
      
      // 🎉 Sistema de notificação inteligente para alto volume
      setTransactionQueue(prev => {
        const newQueue = [...prev, { amount: data.data.amount, type: data.data.type }];
        
        // Se já tem uma notificação ativa, só adiciona na fila
        // A fila será processada quando a notificação atual acabar
        return newQueue;
      });
      
      // Processar fila de notificações (throttle)
      setShowMoneyEffect(true);
      setTimeout(() => {
        setShowMoneyEffect(false);
        setTransactionQueue(prev => prev.slice(1)); // Remove primeira da fila
      }, 3500);
      
      // Som de notificação (suave para não ficar repetitivo)
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.2; // ✅ Volume reduzido para alto volume
        audio.play().catch(err => console.log('🔇 Som não disponível:', err));
      } catch (err) {
        console.log('🔇 Áudio não disponível');
      }
    });

    // Evento: Atualização de Saldo Bitso
    socketInstance.on('bitso:balance', (data: WebSocketData<{ balances: BitsoBalance[] }>) => {
      console.log('💰 Saldo Bitso atualizado:', data);
      setNewBalance(data.data.balances);
    });

    // Evento: Pong (Keep-Alive)
    socketInstance.on('pong', (data: { timestamp: string }) => {
      console.log('🏓 Pong recebido:', data.timestamp);
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
      console.log('🔌 Desconectando WebSocket...');
      clearInterval(pingInterval);
      socketInstance.disconnect();
    };
  }, []);

  // Função para emitir eventos customizados (se necessário)
  const emit = useCallback((event: string, data?: any) => {
    if (socket && socket.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket não conectado');
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

