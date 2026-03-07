export interface DashboardStats {
  generatedAt: string;
  period: {
    today: string;
    last30Days: {
      from: string;
      to: string;
    };
  };
  providers: {
    [key: string]: ProviderStats;
  };
  combined: {
    today: PeriodStats;
    last30Days: PeriodStats;
  };
  cashClosure: {
    lastClosureDate: string;
    totalBalanceBRL: number;
    pixSentLast30Days: number;
    pixReceivedLast30Days: number;
    totalDebitLast30Days: number;
    totalCreditLast30Days: number;
  };
  webhookEvents: {
    corpxToday: number;
    brasilcashToday: number;
  };
  recentActivity: TransactionEvent[];
}

export interface ProviderStats {
  status: 'active' | 'legacy' | 'inactive';
  today: PeriodStats;
  last30Days: PeriodStats;
}

export interface PeriodStats {
  sentCount: number;
  sentVolumeBRL: number;
  receivedCount: number;
  receivedVolumeBRL: number;
  failedCount: number;
  totalOperations: number;
}

export interface TransactionEvent {
  id: string;
  provider: 'BRASILCASH' | 'CORPX_V2' | 'CORPX' | string;
  operationType: 'SEND' | 'RECV';
  operationStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'TIMEOUT' | 'SECURITY_BLOCKED';
  pixValue: number;
  pixKeyType?: string;
  authMode?: string;
  processingTimeMs?: number;
  createdAt: string;
}

export interface DailyEvolution {
  date: string;
  pixReceived: number;
  pixSent: number;
}
