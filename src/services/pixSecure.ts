// services/pixSecure.ts

import { pixApiClient } from '@/utils/pixApiClient';
import { AuthHelper } from '@/utils/authHelper';
import { PixErrorHandler, handlePixError, errorRequiresReauth } from '@/utils/pixErrorHandler';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

/**
 * 🔐 Serviço PIX Seguro com Autenticação Híbrida
 * 
 * Substitui o serviço PIX antigo implementando as novas 
 * especificações de segurança com API Key + JWT Token
 */

// Interfaces para o novo serviço
export interface SecurePixTransferRequest {
  chave: string;
  valor: number;
  descricao?: string;
  keyType?: string;
}

export interface SecurePixQRCodeRequest {
  emv: string;
  valor?: number;
  descricao?: string;
}

export interface SecurePixCreateKeyRequest {
  tipoChave: 'email' | 'telefone' | 'cpf' | 'cnpj' | 'aleatoria';
  chave?: string;
  codigoMfa?: string;
  codigoAutenticacao?: string;
}

export interface SecurePixQRCodeResponse {
  qrCode: string;
  txId?: string;
  emv?: string;
  sucesso: boolean;
  mensagem?: string;
}

export interface SecurePixTransferResponse {
  sucesso: boolean;
  codigoTransacao?: string;
  status?: string;
  mensagem: string;
  provider?: string;
}

export interface SecurePixKeyResponse {
  sucesso: boolean;
  etapa: string;
  mensagem: string;
  codigoAutenticacao?: string;
  chave?: string;
  tipoChave?: string;
  mfaEnviado?: boolean;
  proximoPasso?: string;
}

export interface SecurePixKeysListResponse {
  sucesso: boolean;
  mensagem: string;
  total: number;
  chaves: any[];
  estatisticas?: any;
  contaConsultada?: any;
}

/**
 * 🔐 Classe principal do serviço PIX seguro
 */
export class SecurePixService {
  
  /**
   * ✅ Enviar PIX com autenticação híbrida
   * @param data - Dados da transferência PIX
   * @returns Promise com resultado da transferência
   */
  async enviarPix(data: SecurePixTransferRequest): Promise<SecurePixTransferResponse> {
    try {
      // 🔒 STEP 1: Verificar autenticação obrigatória
      await AuthHelper.requireAuthentication('PIX Transfer');
      
      // 🔒 STEP 2: Validar dados de entrada
      this.validatePixTransferData(data);
      
      // 🔒 STEP 3: Log da operação (sem dados sensíveis)
      logger.info('[SECURE-PIX] Iniciando transferência PIX', {
        temChave: !!data.chave,
        valor: '***', // Não logar valor por segurança
        temDescricao: !!data.descricao,
        keyType: data.keyType
      });
      
      // 🔒 STEP 4: Fazer requisição via cliente seguro
      const response = await pixApiClient.makePixRequest('/pix/enviar', 'POST', {
        chave: data.chave,
        valor: parseFloat(data.valor.toString()),
        descricao: data.descricao || '',
        keyType: data.keyType
      });
      
      // 🔒 STEP 5: Processar resposta
      if (response.sucesso) {
        logger.info('[SECURE-PIX] PIX enviado com sucesso', {
          codigoTransacao: response.codigoTransacao,
          provider: response.provider
        });
        
        toast.success('PIX enviado com sucesso!');
        
        return {
          sucesso: true,
          codigoTransacao: response.codigoTransacao,
          status: response.status || 'PROCESSADO',
          mensagem: response.mensagem || 'PIX enviado com sucesso',
          provider: response.provider
        };
      } else {
        throw new Error(response.mensagem || 'Falha no envio do PIX');
      }
      
    } catch (error) {
      return this.handlePixError(error, 'envio PIX');
    }
  }
  
  /**
   * ✅ Pagar PIX via QR Code/Copia e Cola
   * @param data - Dados do pagamento via QR
   * @returns Promise com resultado do pagamento
   */
  async pagarComQRCode(data: SecurePixQRCodeRequest): Promise<SecurePixTransferResponse> {
    try {
      // 🔒 STEP 1: Verificar autenticação
      await AuthHelper.requireAuthentication('PIX QR Payment');
      
      // 🔒 STEP 2: Validar dados
      this.validateQRCodeData(data);
      
      // 🔒 STEP 3: Log da operação
      logger.info('[SECURE-PIX] Processando pagamento QR Code PIX');
      
      // 🔒 STEP 4: Fazer requisição
      const response = await pixApiClient.makePixRequest('/pix/pagar-copia-cola', 'POST', {
        emv: data.emv,
        valor: data.valor ? parseFloat(data.valor.toString()) : undefined,
        descricao: data.descricao || ''
      });
      
      // 🔒 STEP 5: Processar resposta
      if (response.sucesso) {
        logger.info('[SECURE-PIX] Pagamento QR Code processado com sucesso');
        toast.success('Pagamento processado com sucesso!');
        
        return {
          sucesso: true,
          codigoTransacao: response.codigoTransacao,
          status: response.status || 'PROCESSADO',
          mensagem: response.mensagem || 'Pagamento realizado com sucesso'
        };
      } else {
        throw new Error(response.mensagem || 'Falha no pagamento via QR Code');
      }
      
    } catch (error) {
      return this.handlePixError(error, 'pagamento QR Code');
    }
  }
  
  /**
   * ✅ Listar chaves PIX da conta
   * @returns Promise com lista de chaves PIX
   */
  async listarChavesPix(): Promise<SecurePixKeysListResponse> {
    try {
      // 🔒 STEP 1: Verificar autenticação
      await AuthHelper.requireAuthentication('PIX Keys List');
      
      // 🔒 STEP 2: Log da operação
      logger.info('[SECURE-PIX] Listando chaves PIX');
      
      // 🔒 STEP 3: Fazer requisição
      const response = await pixApiClient.makePixRequest('/pix/chaves/listar', 'GET');
      
      // 🔒 STEP 4: Processar resposta
      if (response.sucesso) {
        logger.info('[SECURE-PIX] Chaves PIX listadas com sucesso', {
          total: response.total || 0
        });
        
        return {
          sucesso: true,
          mensagem: response.mensagem || 'Chaves listadas com sucesso',
          total: response.total || 0,
          chaves: response.chaves || [],
          estatisticas: response.estatisticas,
          contaConsultada: response.contaConsultada
        };
      } else {
        throw new Error(response.mensagem || 'Falha ao listar chaves PIX');
      }
      
    } catch (error) {
      logger.error('[SECURE-PIX] Erro ao listar chaves PIX:', error);
      const errorMessage = handlePixError(error);
      
      return {
        sucesso: false,
        mensagem: errorMessage,
        total: 0,
        chaves: []
      };
    }
  }
  
  /**
   * ✅ Criar nova chave PIX
   * @param data - Dados para criação da chave
   * @returns Promise com resultado da criação
   */
  async criarChavePix(data: SecurePixCreateKeyRequest): Promise<SecurePixKeyResponse> {
    try {
      // 🔒 STEP 1: Verificar autenticação
      await AuthHelper.requireAuthentication('PIX Key Creation');
      
      // 🔒 STEP 2: Validar dados
      this.validateCreateKeyData(data);
      
      // 🔒 STEP 3: Log da operação
      logger.info('[SECURE-PIX] Criando chave PIX', {
        tipoChave: data.tipoChave,
        temChave: !!data.chave,
        temMfa: !!data.codigoMfa
      });
      
      // 🔒 STEP 4: Fazer requisição
      const response = await pixApiClient.makePixRequest('/pix/chaves/criar', 'POST', data);
      
      // 🔒 STEP 5: Processar resposta
      if (response.sucesso) {
        logger.info('[SECURE-PIX] Chave PIX criada/processada', {
          etapa: response.etapa,
          mfaEnviado: response.mfaEnviado
        });
        
        if (response.etapa === 'CONCLUIDO') {
          toast.success('Chave PIX criada com sucesso!');
        } else if (response.mfaEnviado) {
          toast.info('Código de verificação enviado!');
        }
        
        return {
          sucesso: true,
          etapa: response.etapa || 'PROCESSANDO',
          mensagem: response.mensagem || 'Chave PIX processada',
          codigoAutenticacao: response.codigoAutenticacao,
          chave: response.chave,
          tipoChave: response.tipoChave,
          mfaEnviado: response.mfaEnviado,
          proximoPasso: response.proximoPasso
        };
      } else {
        throw new Error(response.mensagem || 'Falha ao criar chave PIX');
      }
      
    } catch (error) {
      logger.error('[SECURE-PIX] Erro ao criar chave PIX:', error);
      const errorMessage = handlePixError(error);
      
      return {
        sucesso: false,
        etapa: 'ERRO',
        mensagem: errorMessage
      };
    }
  }
  
  /**
   * ✅ Gerar QR Code PIX estático
   * @param valor - Valor do QR Code (opcional)
   * @param descricao - Descrição do pagamento
   * @returns Promise com QR Code gerado
   */
  async gerarQRCodeEstatico(valor?: number, descricao?: string): Promise<SecurePixQRCodeResponse> {
    try {
      // 🔒 STEP 1: Verificar autenticação
      await AuthHelper.requireAuthentication('PIX QR Code Generation');
      
      // 🔒 STEP 2: Log da operação
      logger.info('[SECURE-PIX] Gerando QR Code estático', {
        temValor: !!valor,
        temDescricao: !!descricao
      });
      
      // 🔒 STEP 3: Preparar dados
      const requestData: any = {
        tipo: 'estatico'
      };
      
      if (valor && valor > 0) {
        requestData.valor = parseFloat(valor.toString());
      }
      
      if (descricao) {
        requestData.descricao = descricao;
      }
      
      // 🔒 STEP 4: Fazer requisição
      const response = await pixApiClient.makePixRequest('/pix/qrcode/estatico', 'POST', requestData);
      
      // 🔒 STEP 5: Processar resposta
      if (response.sucesso) {
        logger.info('[SECURE-PIX] QR Code gerado com sucesso');
        toast.success('QR Code gerado com sucesso!');
        
        return {
          sucesso: true,
          qrCode: response.qrCode || response.emv || response.codigo,
          txId: response.txId,
          emv: response.emv,
          mensagem: response.mensagem || 'QR Code gerado com sucesso'
        };
      } else {
        throw new Error(response.mensagem || 'Falha ao gerar QR Code');
      }
      
    } catch (error) {
      logger.error('[SECURE-PIX] Erro ao gerar QR Code:', error);
      const errorMessage = handlePixError(error);
      
      return {
        sucesso: false,
        qrCode: '',
        mensagem: errorMessage
      };
    }
  }
  
  /**
   * 🔒 Validar dados de transferência PIX
   */
  private validatePixTransferData(data: SecurePixTransferRequest): void {
    if (!data.chave) {
      throw new Error('Chave PIX é obrigatória');
    }
    
    if (!data.valor || isNaN(data.valor) || data.valor <= 0) {
      throw new Error('Valor deve ser um número positivo');
    }
    
    if (data.valor > 100000) {
      throw new Error('Valor excede o limite máximo de R$ 100.000');
    }
  }
  
  /**
   * 🔒 Validar dados de QR Code
   */
  private validateQRCodeData(data: SecurePixQRCodeRequest): void {
    if (!data.emv) {
      throw new Error('Código PIX (EMV) é obrigatório');
    }
    
    if (data.valor && (isNaN(data.valor) || data.valor <= 0)) {
      throw new Error('Valor deve ser um número positivo');
    }
    
    if (data.valor && data.valor > 100000) {
      throw new Error('Valor excede o limite máximo de R$ 100.000');
    }
  }
  
  /**
   * 🔒 Validar dados de criação de chave
   */
  private validateCreateKeyData(data: SecurePixCreateKeyRequest): void {
    if (!data.tipoChave) {
      throw new Error('Tipo de chave é obrigatório');
    }
    
    const tiposValidos = ['email', 'telefone', 'cpf', 'cnpj', 'aleatoria'];
    if (!tiposValidos.includes(data.tipoChave)) {
      throw new Error('Tipo de chave inválido');
    }
    
    // Para chaves não aleatórias, a chave é obrigatória
    if (data.tipoChave !== 'aleatoria' && !data.chave) {
      throw new Error('Chave é obrigatória para este tipo');
    }
  }
  
  /**
   * 🚨 Tratar erros de forma unificada
   */
  private handlePixError(error: any, operationType: string): SecurePixTransferResponse {
    logger.error(`[SECURE-PIX] Erro na operação ${operationType}:`, error);
    
    // Processar erro com handler específico
    const processedError = PixErrorHandler.processError(error);
    const errorMessage = PixErrorHandler.getUserFriendlyMessage(processedError);
    
    // Verificar se requer reautenticação
    if (errorRequiresReauth(processedError)) {
      toast.error('Sua sessão expirou. Fazendo logout...');
      // Forçar logout após um pequeno delay
      setTimeout(() => {
        AuthHelper.forceLogoutIfInvalid();
      }, 2000);
    } else {
      toast.error(errorMessage);
    }
    
    return {
      sucesso: false,
      mensagem: errorMessage,
      status: 'ERRO'
    };
  }
}

// ✅ Instância única do serviço
export const securePixService = new SecurePixService();

// 🎯 Funções de conveniência para compatibilidade
export const enviarPixSeguro = (data: SecurePixTransferRequest): Promise<SecurePixTransferResponse> => {
  return securePixService.enviarPix(data);
};

export const pagarQRCodeSeguro = (data: SecurePixQRCodeRequest): Promise<SecurePixTransferResponse> => {
  return securePixService.pagarComQRCode(data);
};

export const listarChavesPixSeguro = (): Promise<SecurePixKeysListResponse> => {
  return securePixService.listarChavesPix();
};

export const criarChavePixSegura = (data: SecurePixCreateKeyRequest): Promise<SecurePixKeyResponse> => {
  return securePixService.criarChavePix(data);
};

export const gerarQRCodePixSeguro = (valor?: number, descricao?: string): Promise<SecurePixQRCodeResponse> => {
  return securePixService.gerarQRCodeEstatico(valor, descricao);
};

export default securePixService;
