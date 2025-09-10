// hooks/useCorpX.ts - Hook principal para operações CorpX Banking
// Baseado no guia oficial de integração frontend

import { useState, useCallback } from 'react';
import { CorpXService } from '@/services/corpx';
import type {
  CorpXSaldoResponse,
  CorpXExtratoResponse,
  CorpXExtratoParams,
  CorpXPixKeysResponse,
  CorpXCreatePixKeyRequest,
  CorpXDeletePixKeyRequest,
  CorpXPixTransferRequest,
  CorpXQRCodeRequest,
  CorpXCreateAccountRequest
} from '@/types/corpx';

interface UseCorpXState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useCorpX() {
  const [state, setState] = useState<UseCorpXState>({
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  // Helper para gerenciar estado
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, lastUpdated: new Date() }));
  }, []);

  const setSuccess = useCallback(() => {
    setState(prev => ({ ...prev, error: null, lastUpdated: new Date() }));
  }, []);

  // 💰 CONTA / SALDO
  const consultarSaldo = useCallback(async (cnpj: string): Promise<CorpXSaldoResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Consultando saldo...', cnpj);
      
      const response = await CorpXService.consultarSaldo(cnpj);
      
      if (response?.erro) {
        setError('Erro ao consultar saldo CORPX');
        return null;
      }

      setSuccess();
      //console.log('[useCorpX] Saldo consultado com sucesso:', response);
      return response;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao consultar saldo:', error);
      setError(CorpXService.tratarErro(error));
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  const consultarExtrato = useCallback(async (params: CorpXExtratoParams): Promise<CorpXExtratoResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Consultando extrato...', params);
      
      const response = await CorpXService.consultarExtrato(params);
      
      if (response?.erro) {
        setError('Erro ao consultar extrato CORPX');
        return null;
      }

      setSuccess();
      //console.log('[useCorpX] Extrato consultado com sucesso:', response);
      return response;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao consultar extrato:', error);
      setError(CorpXService.tratarErro(error));
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  const criarConta = useCallback(async (dados: CorpXCreateAccountRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Criando conta...', dados);
      
      const response = await CorpXService.criarConta(dados);
      
      if (response?.erro) {
        setError(response.message || 'Erro ao criar conta CORPX');
        return false;
      }

      setSuccess();
      //console.log('[useCorpX] Conta criada com sucesso:', response);
      return true;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao criar conta:', error);
      setError(CorpXService.tratarErro(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  // 🔑 CHAVES PIX
  const listarChavesPix = useCallback(async (cnpj: string): Promise<CorpXPixKeysResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Listando chaves PIX...', cnpj);
      
      const response = await CorpXService.listarChavesPix(cnpj);
      
      if (response?.erro) {
        setError('Erro ao listar chaves PIX CORPX');
        return null;
      }

      setSuccess();
      //console.log('[useCorpX] Chaves PIX listadas com sucesso:', response);
      return response;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao listar chaves PIX:', error);
      setError(CorpXService.tratarErro(error));
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  const criarChavePix = useCallback(async (dados: CorpXCreatePixKeyRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Criando chave PIX...', dados);
      
      const response = await CorpXService.criarChavePix(dados);
      
      if (response?.erro) {
        setError(response.message || 'Erro ao criar chave PIX CORPX');
        return false;
      }

      setSuccess();
      //console.log('[useCorpX] Chave PIX criada com sucesso:', response);
      return true;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao criar chave PIX:', error);
      setError(CorpXService.tratarErro(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  const cancelarChavePix = useCallback(async (dados: CorpXDeletePixKeyRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Cancelando chave PIX...', dados);
      
      const response = await CorpXService.cancelarChavePix(dados);
      
      if (response?.erro) {
        setError(response.message || 'Erro ao cancelar chave PIX CORPX');
        return false;
      }

      setSuccess();
      //console.log('[useCorpX] Chave PIX cancelada com sucesso:', response);
      return true;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao cancelar chave PIX:', error);
      setError(CorpXService.tratarErro(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  // 💸 TRANSFERÊNCIAS PIX
  const enviarPixCompleto = useCallback(async (dados: CorpXPixTransferRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Enviando PIX completo...', dados);
      
      const response = await CorpXService.enviarPixCompleto(dados);
      
      if (!response) {
        setError('Erro ao enviar PIX CORPX');
        return false;
      }

      setSuccess();
      //console.log('[useCorpX] PIX enviado com sucesso:', response);
      return true;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao enviar PIX:', error);
      setError(CorpXService.tratarErro(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  // 📱 QR CODE PIX
  const gerarQRCodePix = useCallback(async (dados: CorpXQRCodeRequest): Promise<{ codigoPix: string; imagemBase64: string } | null> => {
    setLoading(true);
    setError(null);

    try {
      //console.log('[useCorpX] Gerando QR Code PIX...', dados);
      
      const response = await CorpXService.gerarQRCodePix(dados);
      
      if (response?.erro) {
        setError('Erro ao gerar QR Code PIX CORPX');
        return null;
      }

      setSuccess();
      
      const resultado = {
        codigoPix: response?.brcode || '',
        imagemBase64: response?.heximg ? `data:image/png;base64,${response.heximg}` : ''
      };
      
      //console.log('[useCorpX] QR Code gerado com sucesso');
      return resultado;
      
    } catch (error: any) {
      //console.error('[useCorpX] Erro ao gerar QR Code:', error);
      setError(CorpXService.tratarErro(error));
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSuccess]);

  // 🧹 HELPERS
  const limparError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    // Estado
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // 💰 CONTA / SALDO
    consultarSaldo,
    consultarExtrato,
    criarConta,
    
    // 🔑 CHAVES PIX
    listarChavesPix,
    criarChavePix,
    cancelarChavePix,
    
    // 💸 PIX
    enviarPixCompleto,
    
    // 📱 QR CODE
    gerarQRCodePix,
    
    // 🧹 HELPERS
    limparError
  };
}
