import { 
  OTCClient, 
  OTCBalance, 
  OTCStatement, 
  OTCStats, 
  OTCOperation,
  CreateOTCClientRequest,
  CreateOTCOperationRequest,
  OTCClientsResponse,
  OTCClientsParams,
  OTCStatementParams,
  OTCOperationsParams,
  OTCApiResponse
} from '@/types/otc';
import { api } from '@/config/api';

const OTC_BASE_URL = '/api/otc';

// Classe para gerenciar serviços OTC
export class OTCService {
  
  /**
   * Lista todos os clientes OTC
   */
  async getClients(params: OTCClientsParams = {}): Promise<OTCClientsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.is_active !== undefined) {
      searchParams.append('is_active', String(params.is_active));
    }
    if (params.search) {
      searchParams.append('search', params.search);
    }
    if (params.page) {
      searchParams.append('page', String(params.page));
    }
    if (params.limit) {
      searchParams.append('limit', String(params.limit));
    }

    const response = await api.get<OTCClientsResponse>(
      `${OTC_BASE_URL}/clients${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    );
    
    return response.data;
  }

  /**
   * Cria um novo cliente OTC
   */
  async createClient(clientData: CreateOTCClientRequest): Promise<OTCApiResponse<OTCClient>> {
    const response = await api.post<OTCApiResponse<OTCClient>>(
      `${OTC_BASE_URL}/clients`,
      clientData
    );
    
    return response.data;
  }

  /**
   * Obtém dados de um cliente específico
   */
  async getClient(id: number): Promise<OTCApiResponse<OTCClient>> {
    const response = await api.get<OTCApiResponse<OTCClient>>(
      `${OTC_BASE_URL}/clients/${id}`
    );
    
    return response.data;
  }

  /**
   * Obtém saldo do cliente
   */
  async getClientBalance(id: number): Promise<OTCApiResponse<OTCBalance>> {
    const response = await api.get<OTCApiResponse<OTCBalance>>(
      `${OTC_BASE_URL}/clients/${id}/balance`
    );
    
    return response.data;
  }

  /**
   * Obtém extrato do cliente
   */
  async getClientStatement(id: number, params: OTCStatementParams = {}): Promise<OTCApiResponse<OTCStatement>> {
    const searchParams = new URLSearchParams();
    
    if (params.page) {
      searchParams.append('page', String(params.page));
    }
    if (params.limit) {
      searchParams.append('limit', String(params.limit));
    }
    if (params.dateFrom) {
      searchParams.append('dateFrom', params.dateFrom);
    }
    if (params.dateTo) {
      searchParams.append('dateTo', params.dateTo);
    }

    const response = await api.get<OTCApiResponse<OTCStatement>>(
      `${OTC_BASE_URL}/clients/${id}/statement${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    );
    
    return response.data;
  }

  /**
   * Cria uma operação manual
   */
  async createOperation(operationData: CreateOTCOperationRequest): Promise<OTCApiResponse<any>> {
    const response = await api.post<OTCApiResponse<any>>(
      `${OTC_BASE_URL}/operations`,
      operationData
    );
    
    return response.data;
  }

  /**
   * Lista operações manuais
   */
  async getOperations(params: OTCOperationsParams = {}): Promise<OTCApiResponse<OTCOperation[]>> {
    const searchParams = new URLSearchParams();
    
    if (params.otc_client_id) {
      searchParams.append('otc_client_id', String(params.otc_client_id));
    }
    if (params.page) {
      searchParams.append('page', String(params.page));
    }
    if (params.limit) {
      searchParams.append('limit', String(params.limit));
    }

    const response = await api.get<OTCApiResponse<OTCOperation[]>>(
      `${OTC_BASE_URL}/operations${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    );
    
    return response.data;
  }

  /**
   * Obtém estatísticas do sistema OTC
   */
  async getStats(): Promise<OTCApiResponse<OTCStats>> {
    const response = await api.get<OTCApiResponse<OTCStats>>(
      `${OTC_BASE_URL}/stats`
    );
    
    return response.data;
  }

  /**
   * Atualiza cliente OTC
   */
  async updateClient(id: number, clientData: Partial<CreateOTCClientRequest>): Promise<OTCApiResponse<OTCClient>> {
    const response = await api.put<OTCApiResponse<OTCClient>>(
      `${OTC_BASE_URL}/clients/${id}`,
      clientData
    );
    
    return response.data;
  }

  /**
   * Desativa/ativa cliente OTC
   */
  async toggleClientStatus(id: number, isActive: boolean): Promise<OTCApiResponse<OTCClient>> {
    const response = await api.patch<OTCApiResponse<OTCClient>>(
      `${OTC_BASE_URL}/clients/${id}/status`,
      { is_active: isActive }
    );
    
    return response.data;
  }

  /**
   * Valida CPF/CNPJ
   */
  validateDocument(document: string): boolean {
    // Remove caracteres especiais
    const cleanDocument = document.replace(/[^\d]/g, '');
    
    if (cleanDocument.length === 11) {
      // Validação simples de CPF
      return this.isValidCPF(cleanDocument);
    } else if (cleanDocument.length === 14) {
      // Validação simples de CNPJ
      return this.isValidCNPJ(cleanDocument);
    }
    
    return false;
  }

  /**
   * Valida CPF
   */
  private isValidCPF(cpf: string): boolean {
    // Implementação básica de validação de CPF
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
      return false;
    }
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    
    if ((remainder === 10) || (remainder === 11)) {
      remainder = 0;
    }
    
    if (remainder !== parseInt(cpf.substring(9, 10))) {
      return false;
    }
    
    sum = 0;
    
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    
    if ((remainder === 10) || (remainder === 11)) {
      remainder = 0;
    }
    
    return remainder === parseInt(cpf.substring(10, 11));
  }

  /**
   * Valida CNPJ
   */
  private isValidCNPJ(cnpj: string): boolean {
    // Implementação básica de validação de CNPJ
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
      return false;
    }
    
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    
    if (resultado !== parseInt(digitos.charAt(0))) {
      return false;
    }
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) {
        pos = 9;
      }
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    
    return resultado === parseInt(digitos.charAt(1));
  }

  /**
   * Formata documento (CPF/CNPJ)
   */
  formatDocument(document: string): string {
    const cleanDocument = document.replace(/[^\d]/g, '');
    
    if (cleanDocument.length === 11) {
      // Formato CPF: 999.999.999-99
      return cleanDocument.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleanDocument.length === 14) {
      // Formato CNPJ: 99.999.999/9999-99
      return cleanDocument.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    return document;
  }

  /**
   * Valida chave PIX
   */
  validatePixKey(pixKey: string, type: string): boolean {
    switch (type) {
      case 'cpf':
        return this.isValidCPF(pixKey.replace(/[^\d]/g, ''));
      case 'cnpj':
        return this.isValidCNPJ(pixKey.replace(/[^\d]/g, ''));
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey);
      case 'phone':
        return /^\+?5511\d{8,9}$/.test(pixKey.replace(/[^\d+]/g, ''));
      case 'random':
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(pixKey);
      default:
        return false;
    }
  }

  /**
   * Formata valor monetário
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Formata data
   */
  formatDate(date: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
}

// Instância singleton do serviço
export const otcService = new OTCService(); 