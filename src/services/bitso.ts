// services/bitso.ts - Serviço Bitso Banking
// Espelho do CorpX TCR usando APIs Bitso
import { BitsoApiClient } from './banking/BitsoApiClient';
import type {
  BitsoBalance,
  BitsoTransaction,
  BitsoFilters,
  BitsoPixData,
  BitsoResponse
} from './banking/BitsoApiClient';

// Cliente singleton
const bitsoClient = new BitsoApiClient();

/**
 * 💰 SALDO
 */
export async function consultarSaldoBitso(): Promise<BitsoBalance | null> {
  try {
    const response = await bitsoClient.getBalance();
    
    if (response.sucesso && response.dados) {
      return response.dados;
    }
    
    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * 📊 EXTRATO
 */
export async function consultarExtratoBitso(filters?: BitsoFilters): Promise<{
  erro: boolean;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    balance: number;
    _original: any;
  }>;
  page: number;
  totalPages: number;
} | null> {
  try {
    const response = await bitsoClient.getTransactions(filters);
    
    if (response.sucesso && response.dados) {
      const transactions = response.dados.map((item: BitsoTransaction) => ({
        id: item.id,
        date: item.data_criacao,
        description: item.tipo === 'pay_in' ? 'PIX Recebido' : 'PIX Enviado',
        amount: parseFloat(item.valor),
        type: item.tipo === 'pay_in' ? 'credit' as const : 'debit' as const,
        balance: 0,
        _original: item
      }));

      return {
        erro: false,
        transactions,
        page: 1,
        totalPages: 1
      };
    }
    
    return {
      erro: true,
      transactions: [],
      page: 1,
      totalPages: 1
    };
  } catch (error: any) {
    return {
      erro: true,
      transactions: [],
      page: 1,
      totalPages: 1
    };
  }
}

/**
 * 🔑 CHAVES PIX
 */
export async function listarChavesPixBitso(): Promise<{
  erro: boolean;
  chaves: Array<{
    id: string;
    key: string;
    type: string;
    status: string;
    created_at: string;
  }>;
} | null> {
  try {
    // Bitso não tem gerenciamento de chaves PIX da mesma forma
    // Retornar array vazio por enquanto
    return {
      erro: false,
      chaves: []
    };
  } catch (error: any) {
    return {
      erro: true,
      chaves: []
    };
  }
}

/**
 * 💸 TRANSFERÊNCIA PIX
 */
export async function enviarPixBitso(dados: BitsoPixData): Promise<BitsoResponse<any> | null> {
  try {
    const response = await bitsoClient.sendPix(dados);
    return response;
  } catch (error: any) {
    return null;
  }
}

/**
 * 📱 GERAR QR CODE PIX
 */
export async function gerarQRCodePixBitso(valor: string): Promise<{
  erro: boolean;
  qrCode?: string;
  pixKey?: string;
  message?: string;
} | null> {
  try {
    const response = await bitsoClient.generatePixQRCode(valor);
    
    if (response.sucesso && response.dados) {
      return {
        erro: false,
        qrCode: response.dados.qr_code,
        pixKey: response.dados.pix_key,
        message: 'QR Code gerado com sucesso'
      };
    }
    
    return {
      erro: true,
      message: response.mensagem || 'Erro ao gerar QR Code'
    };
  } catch (error: any) {
    return {
      erro: true,
      message: error.message
    };
  }
}

/**
 * 📝 HELPERS UTILITÁRIOS
 */
export function formatarValorBitso(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function tratarErroBitso(error: any): string {
  if (error.response) {
    switch (error.response.status) {
      case 400:
        return 'Dados inválidos. Verifique os campos.';
      case 401:
        return 'Não autorizado. Verifique suas credenciais.';
      case 402:
        return 'Saldo insuficiente.';
      case 422:
        return 'Erro de validação dos dados.';
      case 500:
        return 'Erro interno. Tente novamente.';
      default:
        return error.response.data?.message || 'Erro na operação. Tente novamente.';
    }
  }
  return 'Erro de conexão. Verifique sua internet.';
}

// Export principal
export const BitsoService = {
  consultarSaldo: consultarSaldoBitso,
  consultarExtrato: consultarExtratoBitso,
  listarChavesPix: listarChavesPixBitso,
  enviarPix: enviarPixBitso,
  gerarQRCodePix: gerarQRCodePixBitso,
  formatarValor: formatarValorBitso,
  tratarErro: tratarErroBitso,
} as const;

export default BitsoService;



