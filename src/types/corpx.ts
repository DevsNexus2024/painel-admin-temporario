// types/corpx.ts - Types específicos para CorpX Banking API
// Baseado no guia de integração oficial

export interface CorpXSaldoResponse {
  erro: boolean;
  saldo: number;
  saldoDisponivel: number;
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
  tax_document: string;
  tipo: 1 | 2 | 3 | 4 | 5; // 1=CPF, 2=CNPJ, 3=Celular, 4=Email, 5=Aleatória
  key?: string; // Opcional - só para tipos 3 e 4
}

export interface CorpXCreatePixKeyResponse {
  erro: boolean;
  message: string;
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
