import { API_CONFIG, getApiHeaders } from '@/config/api';
import { DashboardStats, DailyEvolution } from '@/types/dashboard';

const DASHBOARD_API_BASE_URL = API_CONFIG.CORPX_V2_BASE_URL || 'https://api-bank-v2.gruponexus.com.br';

// Simular dados para desenvolvimento
const MOCK_STATS: DashboardStats = {
  generatedAt: new Date().toISOString(),
  period: {
    today: new Date().toISOString().split('T')[0],
    last30Days: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    }
  },
  providers: {
    BRASILCASH: {
      status: 'active',
      today: { sentCount: 12, sentVolumeBRL: 85000, receivedCount: 45, receivedVolumeBRL: 320000, failedCount: 1, totalOperations: 58 },
      last30Days: { sentCount: 280, sentVolumeBRL: 2100000, receivedCount: 950, receivedVolumeBRL: 7400000, failedCount: 18, totalOperations: 1248 }
    },
    CORPX_V2: {
      status: 'active',
      today: { sentCount: 20, sentVolumeBRL: 115000, receivedCount: 68, receivedVolumeBRL: 570000, failedCount: 1, totalOperations: 89 },
      last30Days: { sentCount: 410, sentVolumeBRL: 3200000, receivedCount: 1200, receivedVolumeBRL: 9800000, failedCount: 22, totalOperations: 1632 }
    },
    CORPX: {
      status: 'legacy',
      today: { sentCount: 0, sentVolumeBRL: 0, receivedCount: 5, receivedVolumeBRL: 0, failedCount: 1, totalOperations: 6 },
      last30Days: { sentCount: 0, sentVolumeBRL: 0, receivedCount: 0, receivedVolumeBRL: 0, failedCount: 0, totalOperations: 0 }
    }
  },
  combined: {
    today: { sentCount: 32, sentVolumeBRL: 200000, receivedCount: 118, receivedVolumeBRL: 890000, failedCount: 3, totalOperations: 153 },
    last30Days: { sentCount: 690, sentVolumeBRL: 5300000, receivedCount: 2150, receivedVolumeBRL: 17200000, failedCount: 40, totalOperations: 2880 }
  },
  cashClosure: {
    lastClosureDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalBalanceBRL: 1250000,
    pixSentLast30Days: 4200000,
    pixReceivedLast30Days: 15800000,
    totalDebitLast30Days: 5100000,
    totalCreditLast30Days: 16200000
  },
  webhookEvents: {
    corpxToday: 320,
    brasilcashToday: 480
  },
  recentActivity: [
    {
      id: '1001',
      provider: 'BRASILCASH',
      operationType: 'SEND',
      operationStatus: 'SUCCESS',
      pixValue: 5000,
      pixKeyType: 'CPF',
      authMode: 'FRONTEND_JWT',
      processingTimeMs: 412,
      createdAt: new Date().toISOString()
    },
    {
      id: '1002',
      provider: 'CORPX_V2',
      operationType: 'RECV',
      operationStatus: 'SUCCESS',
      pixValue: 12500,
      pixKeyType: 'EVP',
      processingTimeMs: 218,
      createdAt: new Date(Date.now() - 5000).toISOString()
    },
    {
      id: '1003',
      provider: 'BRASILCASH',
      operationType: 'SEND',
      operationStatus: 'FAILED',
      pixValue: 800,
      pixKeyType: 'EMAIL',
      processingTimeMs: 0,
      createdAt: new Date(Date.now() - 15000).toISOString()
    }
  ]
};

const MOCK_EVOLUTION: DailyEvolution[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().split('T')[0],
    pixReceived: Math.floor(Math.random() * 800000) + 200000,
    pixSent: Math.floor(Math.random() * 300000) + 50000
  };
});

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    try {
      const url = `${DASHBOARD_API_BASE_URL}/api/dashboard/stats`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getApiHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Dashboard stats indisponível, usando dados mockados:', error);
      return MOCK_STATS;
    }
  },

  getDailyEvolution: async (startDate: string, endDate: string): Promise<DailyEvolution[]> => {
    try {
      const url = `${DASHBOARD_API_BASE_URL}/api/cash-closure/daily-evolution?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getApiHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const raw = Array.isArray(json) ? json : (json?.data ?? []);
      // API retorna: { date, closingBalance, credits, debits, variation }
      // Mapear para: { date, pixReceived, pixSent }
      return raw.map((item: { date: string; credits?: number; debits?: number }) => ({
        date: item.date,
        pixReceived: item.credits ?? 0,
        pixSent: Math.abs(item.debits ?? 0), // debits vem negativo
      }));
    } catch (error) {
      console.warn('Daily evolution indisponível, usando dados mockados:', error);
      return MOCK_EVOLUTION;
    }
  }
};
