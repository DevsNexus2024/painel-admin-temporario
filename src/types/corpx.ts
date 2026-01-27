// types/corpx.ts - Types específicos para CorpX Banking API
// Baseado no guia de integração oficial

export interface CorpXSaldoResponse {
  erro: boolean;
  globalBalance: number;
  saldo: number;
  saldoDisponivel: number;
  saldoBloqueado: number;
  limite: number;
  limiteBloqueado: number;
}

export interface CorpXExtratoTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  balance: number;
}

export interface CorpXExtratoResponse {
  erro: boolean;
  page: number;
  totalPages: number;
  transactions: CorpXExtratoTransaction[];
}

export interface CorpXExtratoParams {
  cnpj: string;
  page?: number;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  itensporpagina?: number; // Limite de itens por página (máx 500)
}

export interface CorpXTransactionItem {
  id: number | string;
  corpx_account_id?: number;
  transactionDatetime?: string;
  transactionDatetimeUtc?: string;
  transactionDate?: string;
  amount?: string;
  transactionType?: 'C' | 'D';
  description?: string;
  pixStatus?: string;
  pixType?: string;
  source?: string;
  payerName?: string;
  payerDocument?: string;
  beneficiaryName?: string;
  beneficiaryDocument?: string;
  endToEndId?: string;
  nrMovimento?: string;
  taxDocument?: string;
  corpxAccount?: {
    id?: number;
    taxDocument?: string;
    fullName?: string;
    accountNumber?: string;
    status?: string;
  } | null;
  [key: string]: any;
}

export interface CorpXTransactionsPagination {
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
  hasMore?: boolean;
  current_page?: number;
  total_pages?: number;
}

export interface CorpXTransactionsSummary {
  total_credits?: string;
  total_debits?: string;
  net_total?: string;
  [key: string]: any;
}

export interface CorpXTransactionsResponse {
  success: boolean;
  data: CorpXTransactionItem[];
  pagination?: CorpXTransactionsPagination;
  summary?: CorpXTransactionsSummary | null;
  filters_applied?: Record<string, any>;
}

export interface CorpXTransactionsParams {
  accountId?: string | number; // ID numérico da API ou string para compatibilidade
  transactionType?: 'C' | 'D';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  exactAmount?: number; // Valor exato (ignora minAmount e maxAmount quando informado)
  endToEnd?: string; // Busca por endToEnd específico (ignora search quando informado)
  search?: string;
  pixStatus?: string;
  pixType?: string;
  source?: string;
  payerDocument?: string;
  beneficiaryDocument?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface CorpXSyncRequest {
  taxDocument: string;
  startDate: string;
  endDate: string;
  dryRun?: boolean;
}

export interface CorpXSyncResponse {
  success: boolean;
  message?: string;
  totalSynced?: number;
  startedAt?: string;
  finishedAt?: string;
  [key: string]: any;
}

export interface CorpXPixKey {
  id: string;
  key: string;
  type: 'CNPJ' | 'PHONE' | 'EMAIL' | 'RANDOM';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface CorpXPixKeysResponse {
  erro: boolean;
  chaves: CorpXPixKey[];
}

export interface CorpXCreatePixKeyRequest {
  tax_document: string; // CPF/CNPJ do titular (apenas números)
  tipo: string; // "1"=CPF, "2"=CNPJ, "3"=Celular, "4"=Email, "5"=Aleatória
  key?: string; // Opcional para todos os tipos
  otp?: string; // Opcional - Código OTP para validação
  otp_code?: string; // Opcional - Código OTP alternativo (compatibilidade)
}

// ✅ NOVO: Interface para enviar OTP
export interface CorpXEnviarOtpPixRequest {
  tax_document: string; // CPF/CNPJ do titular (apenas números)
  key: string; // Chave para a qual enviar OTP (celular ou email)
}

export interface CorpXEnviarOtpPixResponse {
  erro: boolean;
  message: string;
  details?: string;
  data?: any;
}

export interface CorpXCreatePixKeyResponse {
  erro: boolean;
  message: string;
  details?: string; // ✅ NOVO: Detalhes do erro (se houver)
  data?: { // ✅ NOVO: Dados da chave criada
    key?: string;
    tipo?: string;
    tax_document?: string;
  };
  apiResponse?: any; // ✅ NOVO: Resposta completa da API (para debug)
}

export interface CorpXDeletePixKeyRequest {
  tax_document: string;
  key: string;
}

export interface CorpXPixTransferRequest {
  tax_document: string;
  key: string;
  tipo: number;
  valor: number;
  nome?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
}

export interface CorpXPixTransferResponse {
  erro: boolean;
  type: string;
  key: string;
  branch: string;
  number: string;
  account_type: string;
  tax_document: string;
  nome: string;
  ispb: string;
  compe: string;
  banco: string;
  endtoend: string;
  Valor: string;
}

export interface CorpXPixConfirmRequest {
  endtoend: string;
  tax_document: string;
}

export interface CorpXPixConfirmResponse {
  message: string;
  endtoend: string;
  erro: boolean;
  id: string;
  idEndToEnd: string;
  transactionDate: string;
  transactionCode: string;
  status: string;
  amount: number;
  "Tipo de transação": string;
  "Data": string;
  "Valor": string;
  "Código da transação": string;
  "De": string;
  "CPF/CNPJ": string;
  "Para": string;
  "Descrição": string;
}

export interface CorpXQRCodeRequest {
  tax_document: string;
  valor: number; // 0 para QR aberto
  descricao: string;
}

export interface CorpXQRCodeResponse {
  erro: boolean;
  brcode: string;
  heximg: string; // Base64 da imagem PNG
}

export interface CorpXCreateAccountRequest {
  tax_document: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
  };
}

export interface CorpXCreateAccountResponse {
  erro: boolean;
  message: string;
  account_id?: string;
}

// Error types
export interface CorpXErrorResponse {
  erro: true;
  message: string;
  code?: number;
}

// Utility types
export type CorpXPixKeyType = 1 | 2 | 3 | 4; // CPF/CNPJ, Phone, Email, Random
export type CorpXTransactionType = 'credit' | 'debit';
