/**
 * 🪙 Binance Types
 * Tipos TypeScript para integração com API Binance
 */

// ==================== REQUEST TYPES ====================

export interface BinanceQuoteRequest {
  amount: number;
  fromCurrency?: 'BRL' | 'USDT';
  side?: 'BUY' | 'SELL';
  symbol?: string;
}

export interface BinanceQuoteData {
  side: 'BUY' | 'SELL';
  inputAmount: number;
  inputCurrency: 'BRL' | 'USDT';
  outputAmount: number;
  outputCurrency: 'BRL' | 'USDT';
  averagePrice: number;
  totalQuantity: number;
  totalCost: number;
  ordersUsed: number;
  orderBookDepth: number;
  timestamp: string;
}

export interface BinanceExecuteTradeRequest {
  quantity: number;
  price?: number; // Opcional - se omitido, executa como MARKET
  symbol?: string; // Default: 'USDTBRL'
  side: 'BUY' | 'SELL'; // Obrigatório
  fromCurrency: 'BRL' | 'USDT'; // Obrigatório
}

export interface BinanceWithdrawalRequest {
  coin: string;
  amount: string;
  address: string;
  network?: string;
  addressTag?: string;
}

// ==================== RESPONSE TYPES ====================

export interface BinanceBackendResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface BinanceNetworkInfo {
  network: string;
  coin: string;
  name: string;
  withdrawEnable: boolean;
  depositEnable: boolean;
  withdrawFee: string;
  withdrawMin: string;
  withdrawMax: string;
}

export interface BinanceBalance {
  coin: string;
  free: string;
  locked: string;
  freeze: string;
  withdrawing: string;
  ipoing: string;
  ipoable: string;
  storage: string;
  isLegalMoney: boolean;
  trading: boolean;
  networkList?: BinanceNetworkInfo[];
}

export interface BinanceSpotBalancesData {
  balances: BinanceBalance[];
  total: number;
  timestamp: string;
}

export interface BinanceSpotBalancesResponse extends BinanceBackendResponse<BinanceSpotBalancesData> {}

export interface BinanceQuoteResponse extends BinanceBackendResponse<BinanceQuoteData> {}

export interface BinanceTradeData {
  orderId: number;
  status: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  price: string;
  timestamp: string;
}

export interface BinanceTradeResponse extends BinanceBackendResponse<BinanceTradeData> {}

export interface BinanceOrderStatusData {
  orderId: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  price: string;
  timestamp: string;
}

export interface BinanceOrderStatusResponse extends BinanceBackendResponse<BinanceOrderStatusData> {}

export interface BinanceTradeHistoryItem {
  id: number;
  symbol: string;
  price: string;
  qty?: string; // Campo usado pela API da Binance
  quantity?: string; // Campo alternativo
  commission: string;
  isBuyer: boolean;
  time?: string; // Campo usado pela API da Binance
  timestamp?: string; // Campo alternativo
}

export interface BinanceTradeHistoryData {
  trades: BinanceTradeHistoryItem[];
  total: number;
  symbol: string;
  timestamp: string;
}

export interface BinanceTradeHistoryResponse extends BinanceBackendResponse<BinanceTradeHistoryData> {}

export interface BinanceWithdrawalData {
  withdrawId: string;
  coin: string;
  amount: string;
  address: string;
  status: string;
  timestamp: string;
}

export interface BinanceWithdrawalResponse extends BinanceBackendResponse<BinanceWithdrawalData> {}

export interface BinanceWithdrawalHistoryItem {
  id: string;
  coin: string;
  amount: string;
  address: string;
  status: number;
  timestamp: string;
}

export interface BinanceWithdrawalHistoryData {
  withdrawals: BinanceWithdrawalHistoryItem[];
  total: number;
  timestamp: string;
}

export interface BinanceWithdrawalHistoryResponse extends BinanceBackendResponse<BinanceWithdrawalHistoryData> {}

export interface BinanceWithdrawalAddressItem {
  coin: string;
  address: string;
  network: string;
}

export interface BinanceWithdrawalAddressesData {
  addresses: BinanceWithdrawalAddressItem[];
  total: number;
  timestamp: string;
}

export interface BinanceWithdrawalAddressesResponse extends BinanceBackendResponse<BinanceWithdrawalAddressesData> {}

export interface BinanceDepositAddressItem {
  coin: string;
  address: string;
  network: string;
}

export interface BinanceDepositAddressesData {
  addresses: BinanceDepositAddressItem[];
  timestamp: string;
}

export interface BinanceDepositAddressesResponse extends BinanceBackendResponse<BinanceDepositAddressesData> {}

export interface BinanceDepositHistoryItem {
  id: string;
  coin: string;
  amount: string;
  status: number;
  timestamp: string;
}

export interface BinanceDepositHistoryData {
  deposits: BinanceDepositHistoryItem[];
  total: number;
  timestamp: string;
}

export interface BinanceDepositHistoryResponse extends BinanceBackendResponse<BinanceDepositHistoryData> {}

// ==================== UI TYPES ====================

export interface BinanceTransaction {
  id: string;
  type: 'Compra' | 'Venda';
  currency: string;
  quote: number;
  quantity: number;
  total: number;
  date: string;
  timestamp?: string | number; // Timestamp original para ordenação
  status: 'Executada' | 'Pendente' | 'Cancelada';
  note?: string;
  orderId?: number;
}

export interface BinanceBalance {
  availableBalance: string;
  availableBalanceUSDT: string;
  credit: string;
  creditUSDT: string;
}

