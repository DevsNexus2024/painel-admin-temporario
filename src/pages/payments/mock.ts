export interface PendingTransaction {
  id: string;
  dateTime: string;
  value: number;
  type: 'CHAVE' | 'QR';
  status: 'PENDENTE' | 'REJEITADO';
  pendingTime: string;
}

export interface ExtractTransaction {
  id: string;
  dateTime: string;
  value: number;
  type: 'DÉBITO' | 'CRÉDITO';
  description: string;
  client: string | null;
  identified: boolean;
  code: string;
}

export const mockPendingTransactions: PendingTransaction[] = [
  {
    id: '1',
    dateTime: '22/05/2025 09:40',
    value: 150.00,
    type: 'CHAVE',
    status: 'PENDENTE',
    pendingTime: '2h 30min'
  },
  {
    id: '2',
    dateTime: '22/05/2025 08:30',
    value: 89.90,
    type: 'QR',
    status: 'REJEITADO',
    pendingTime: '3h 40min'
  },
  {
    id: '3',
    dateTime: '21/05/2025 16:15',
    value: 250.00,
    type: 'CHAVE',
    status: 'PENDENTE',
    pendingTime: '18h 55min'
  },
  {
    id: '4',
    dateTime: '21/05/2025 14:22',
    value: 45.50,
    type: 'QR',
    status: 'PENDENTE',
    pendingTime: '21h 8min'
  },
  {
    id: '5',
    dateTime: '20/05/2025 11:05',
    value: 320.75,
    type: 'CHAVE',
    status: 'REJEITADO',
    pendingTime: '1d 2h'
  }
];

const generateExtractTransaction = (index: number): ExtractTransaction => {
  const types: ('DÉBITO' | 'CRÉDITO')[] = ['DÉBITO', 'CRÉDITO'];
  const descriptions = [
    'Transferência Pix',
    'Pagamento QR Code',
    'Recebimento',
    'Devolução',
    'Taxa de manutenção',
    'Depósito em conta'
  ];
  const clients = [
    'João Silva',
    'Maria Santos',
    'Pedro Oliveira',
    'Ana Costa',
    null,
    'Lucas Ferreira'
  ];

  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 30));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));

  const type = types[Math.floor(Math.random() * types.length)];
  const value = Math.random() * 1000 + 10;

  return {
    id: `extract_${index}`,
    dateTime: date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    value: type === 'DÉBITO' ? -value : value,
    type,
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    client: clients[Math.floor(Math.random() * clients.length)],
    identified: Math.random() > 0.3,
    code: `PIX${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  };
};

export const generateMockExtractTransactions = (count: number): ExtractTransaction[] => {
  return Array.from({ length: count }, (_, index) => generateExtractTransaction(index));
};

export const initialMockExtractTransactions = generateMockExtractTransactions(25); 