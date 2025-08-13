// src/services/pix.secure.ts
import { apiClient } from './api.client';
import { logger } from '@/utils/logger';
import { handleApiError } from '@/utils/error.handler';

// Interfaces para operações PIX
export interface PixTransferData {
  chave: string;
  valor: number;
  descricao?: string;
}

export interface PixCopiaColaData {
  emv: string;
  valor?: number;
  descricao?: string;
}

export interface PixKeyData {
  tipoChave: 'email' | 'telefone' | 'cpf' | 'cnpj' | 'aleatoria';
  chave?: string;
  codigoMfa?: string;
  codigoAutenticacao?: string;
}

export interface PixQRCodeData {
  chave?: string;
  valor?: number;
  descricao?: string;
  tipo?: 'estatico' | 'dinamico';
}

export interface PixResponse<T = any> {
  sucesso: boolean;
  mensagem?: string;
  data?: T;
  codigoTransacao?: string;
  etapa?: string;
}

/**
 * Serviço PIX Seguro implementando as especificações da documentação JWT
 */
class PixSecureService {
  
  /**
   * Validar dados de transferência PIX
   */
  private validatePixTransfer(data: PixTransferData): void {
    if (!data.chave) {
      throw { codigo: 'PIX_001', mensagem: 'Chave PIX é obrigatória' };
    }

    if (!data.valor || isNaN(data.valor) || data.valor <= 0) {
      throw { codigo: 'PIX_002', mensagem: 'Valor deve ser um número positivo' };
    }

    if (data.valor > 100000) {
      throw { codigo: 'PIX_003', mensagem: 'Valor excede o limite máximo de R$ 100.000' };
    }

    // Validar formato da chave PIX
    if (!this.isValidPixKey(data.chave)) {
      throw { codigo: 'PIX_004', mensagem: 'Formato da chave PIX inválido' };
    }
  }

  /**
   * Validar formato da chave PIX
   */
  private isValidPixKey(chave: string): boolean {
    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(chave)) return true;

    // Telefone (formato +5511999999999)
    const phoneRegex = /^\+55\d{10,11}$/;
    if (phoneRegex.test(chave)) return true;

    // CPF (11 dígitos)
    const cpfRegex = /^\d{11}$/;
    if (cpfRegex.test(chave)) return true;

    // CNPJ (14 dígitos)
    const cnpjRegex = /^\d{14}$/;
    if (cnpjRegex.test(chave)) return true;

    // Chave aleatória (36 caracteres com hífens)
    const randomKeyRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (randomKeyRegex.test(chave)) return true;

    return false;
  }

  /**
   * Enviar PIX
   */
  async enviarPix(data: PixTransferData): Promise<PixResponse> {
    try {
      // Validações no frontend (duplicando as do backend por UX)
      this.validatePixTransfer(data);

      logger.info('[PIX] Iniciando transferência', {
        chaveDestino: this.maskPixKey(data.chave),
        valor: '***' // Não logar valor por segurança
      });

      const response = await apiClient.post<PixResponse>('/internal/pix/enviar', {
        chave: data.chave,
        valor: parseFloat(data.valor.toString()),
        descricao: data.descricao || ''
      });

      if (response.sucesso) {
        logger.info('[PIX] Transferência enviada com sucesso', {
          codigoTransacao: response.codigoTransacao
        });
      }

      return response;

    } catch (error) {
      logger.error('[PIX] Erro ao enviar PIX:', error);
      throw error;
    }
  }

  /**
   * Pagar PIX Copia e Cola
   */
  async pagarCopiaCola(data: PixCopiaColaData): Promise<PixResponse> {
    try {
      if (!data.emv) {
        throw { codigo: 'PIX_001', mensagem: 'Código PIX (EMV) é obrigatório' };
      }

      // Validar valor se fornecido
      if (data.valor && (isNaN(data.valor) || data.valor <= 0)) {
        throw { codigo: 'PIX_002', mensagem: 'Valor deve ser um número positivo' };
      }

      if (data.valor && data.valor > 100000) {
        throw { codigo: 'PIX_003', mensagem: 'Valor excede o limite máximo de R$ 100.000' };
      }

      logger.info('[PIX] Processando pagamento copia e cola');

      const payload: any = {
        emv: data.emv,
        descricao: data.descricao || ''
      };

      if (data.valor) {
        payload.valor = parseFloat(data.valor.toString());
      }

      const response = await apiClient.post<PixResponse>('/internal/pix/pagar-copia-cola', payload);

      if (response.sucesso) {
        logger.info('[PIX] Pagamento processado com sucesso');
      }

      return response;

    } catch (error) {
      logger.error('[PIX] Erro ao processar pagamento:', error);
      throw error;
    }
  }

  /**
   * Consultar status de transação
   */
  async consultarStatus(codigoTransacao: string): Promise<PixResponse> {
    try {
      if (!codigoTransacao) {
        throw { codigo: 'PIX_001', mensagem: 'Código da transação é obrigatório' };
      }

      logger.debug('[PIX] Consultando status da transação', { codigoTransacao });

      return await apiClient.get<PixResponse>(`/internal/pix/status/${codigoTransacao}`);
      
    } catch (error) {
      logger.error('[PIX] Erro ao consultar status:', error);
      throw error;
    }
  }

  /**
   * Listar chaves PIX
   */
  async listarChaves(): Promise<PixResponse> {
    try {
      logger.debug('[PIX] Listando chaves PIX');
      
      return await apiClient.get<PixResponse>('/internal/pix/chaves/listar');
      
    } catch (error) {
      logger.error('[PIX] Erro ao listar chaves:', error);
      throw error;
    }
  }

  /**
   * Criar chave PIX
   */
  async criarChave(data: PixKeyData): Promise<PixResponse> {
    try {
      if (!data.tipoChave) {
        throw { codigo: 'PIX_001', mensagem: 'Tipo de chave é obrigatório' };
      }

      const payload: any = { tipoChave: data.tipoChave };

      // Validar chave para tipos específicos
      if (data.tipoChave !== 'aleatoria') {
        if (!data.chave) {
          throw { codigo: 'PIX_001', mensagem: 'Chave é obrigatória para este tipo' };
        }
        
        if (!this.isValidPixKey(data.chave)) {
          throw { codigo: 'PIX_004', mensagem: 'Formato da chave PIX inválido' };
        }
        
        payload.chave = data.chave;
      }

      if (data.codigoMfa) {
        payload.codigoMfa = data.codigoMfa;
      }

      if (data.codigoAutenticacao) {
        payload.codigoAutenticacao = data.codigoAutenticacao;
      }

      logger.info('[PIX] Criando chave PIX', { 
        tipoChave: data.tipoChave,
        chave: data.chave ? this.maskPixKey(data.chave) : 'aleatoria'
      });

      return await apiClient.post<PixResponse>('/internal/pix/chaves/criar', payload);
      
    } catch (error) {
      logger.error('[PIX] Erro ao criar chave:', error);
      throw error;
    }
  }

  /**
   * Gerar QR Code PIX
   */
  async gerarQRCode(data: PixQRCodeData): Promise<PixResponse> {
    try {
      const payload: any = { 
        tipo: data.tipo || 'estatico' 
      };

      if (data.chave) {
        if (!this.isValidPixKey(data.chave)) {
          throw { codigo: 'PIX_004', mensagem: 'Formato da chave PIX inválido' };
        }
        payload.chave = data.chave;
      }
      
      if (data.valor) {
        if (isNaN(data.valor) || data.valor <= 0) {
          throw { codigo: 'PIX_002', mensagem: 'Valor deve ser um número positivo' };
        }
        payload.valor = parseFloat(data.valor.toString());
      }
      
      if (data.descricao) {
        payload.descricao = data.descricao;
      }

      logger.info('[PIX] Gerando QR Code', { 
        tipo: payload.tipo,
        temChave: !!data.chave,
        temValor: !!data.valor
      });

      return await apiClient.post<PixResponse>('/internal/pix/qrcode/dicascripto', payload);
      
    } catch (error) {
      logger.error('[PIX] Erro ao gerar QR Code:', error);
      throw error;
    }
  }

  /**
   * Consultar chave PIX
   */
  async consultarChave(chave: string): Promise<PixResponse> {
    try {
      if (!chave) {
        throw { codigo: 'PIX_001', mensagem: 'Chave PIX é obrigatória' };
      }

      if (!this.isValidPixKey(chave)) {
        throw { codigo: 'PIX_004', mensagem: 'Formato da chave PIX inválido' };
      }

      logger.info('[PIX] Consultando chave PIX', { 
        chave: this.maskPixKey(chave) 
      });

      return await apiClient.get<PixResponse>('/internal/pix/consultar-chave', { chave });
      
    } catch (error) {
      logger.error('[PIX] Erro ao consultar chave:', error);
      throw error;
    }
  }

  /**
   * Mascarar chave PIX para logs
   */
  private maskPixKey(chave: string): string {
    if (!chave) return '';
    
    // Email: j***@gmail.com
    if (chave.includes('@')) {
      const [user, domain] = chave.split('@');
      return `${user.charAt(0)}***@${domain}`;
    }
    
    // Telefone: +5511***9999
    if (chave.startsWith('+55')) {
      return `${chave.substring(0, 6)}***${chave.substring(chave.length - 4)}`;
    }
    
    // CPF/CNPJ: 123***789
    if (/^\d+$/.test(chave)) {
      return `${chave.substring(0, 3)}***${chave.substring(chave.length - 3)}`;
    }
    
    // Chave aleatória: abc12***89ef
    return `${chave.substring(0, 5)}***${chave.substring(chave.length - 4)}`;
  }
}

// Instância única do serviço
export const pixSecureService = new PixSecureService();
export default pixSecureService;
