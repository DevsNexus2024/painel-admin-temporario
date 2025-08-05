import { useState, useCallback } from 'react';

// Base URL específica para o relatório de depósitos
const RELATORIO_BASE_URL = 'https://vps80270.cloudpublic.com.br:8081';

export interface DepositReportFilters {
  whitelabel?: 'EMX' | 'TCR' | 'TODOS';
  data_inicio: string; // YYYY-MM-DD
  data_fim: string; // YYYY-MM-DD
  ordenacao?: 'maior_deposito' | 'menor_deposito';
  incluir_detalhes?: 'true' | 'false';
}

export interface DepositUser {
  id_usuario: number;
  nome: string;
  documento: string;
  email: string;
  id_brasil_bitcoin: string;
  whitelabel: string;
  total_depositado: number;
  quantidade_depositos: number;
  primeiro_deposito: string;
  ultimo_deposito: string;
  detalhes_depositos?: Array<{
    id: number;
    valor: number;
    data: string;
    status: string;
  }>;
}

export interface WhitelabelStats {
  usuarios: number;
  total_depositos: number;
  quantidade_depositos: number;
}

export interface DepositReportResponse {
  mensagem: string;
  response: {
    resumo: {
      periodo: {
        inicio: string;
        fim: string;
      };
      whitelabel_filtro: string;
      total_usuarios: number;
      total_depositos: number;
      total_quantidade_depositos: number;
      por_whitelabel: {
        EMX?: WhitelabelStats;
        TCR?: WhitelabelStats;
      };
    };
    usuarios: DepositUser[];
    metadados: {
      data_geracao: string;
      ordenacao_aplicada: string;
      detalhes_incluidos: boolean;
      total_registros_brutos: number;
    };
  };
}

export const useDepositReport = () => {
  const [data, setData] = useState<DepositReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (filters: DepositReportFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      // Construir query parameters
      const params = new URLSearchParams();
      
      if (filters.whitelabel && filters.whitelabel !== 'TODOS') {
        params.append('whitelabel', filters.whitelabel);
      }
      
      params.append('data_inicio', filters.data_inicio);
      params.append('data_fim', filters.data_fim);
      
      if (filters.ordenacao) {
        params.append('ordenacao', filters.ordenacao);
      }
      
      if (filters.incluir_detalhes) {
        params.append('incluir_detalhes', filters.incluir_detalhes);
      }

      const url = `${RELATORIO_BASE_URL}/relatorio/depositos-whitelabel?${params.toString()}`;
      
      console.log('🔍 Buscando relatório de depósitos:', {
        url,
        filters
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      const result: DepositReportResponse = await response.json();
      
      console.log('🔍 RESPOSTA COMPLETA DA API:', JSON.stringify(result, null, 2));
      
      console.log('📊 DADOS ESTRUTURADOS:');
      console.log('- Resumo:', result.response?.resumo);
      console.log('- Total usuários:', result.response?.usuarios?.length);
      console.log('- Primeiro usuário:', result.response?.usuarios?.[0]);
      console.log('- Metadados:', result.response?.metadados);
      
      // Verificar campos específicos do primeiro usuário
      if (result.response?.usuarios?.[0]) {
        const firstUser = result.response.usuarios[0];
        console.log('👤 PRIMEIRO USUÁRIO - CAMPOS INDIVIDUAIS:');
        console.log('- ID:', firstUser.id_usuario);
        console.log('- Nome:', firstUser.nome);
        console.log('- Documento:', firstUser.documento);
        console.log('- Email:', firstUser.email);
        console.log('- ID Brasil Bitcoin:', firstUser.id_brasil_bitcoin);
        console.log('- Whitelabel:', firstUser.whitelabel);
        console.log('- Total depositado:', firstUser.total_depositado);
        console.log('- Quantidade depósitos:', firstUser.quantidade_depositos);
        console.log('- Primeiro depósito:', firstUser.primeiro_deposito);
        console.log('- Último depósito:', firstUser.ultimo_deposito);
      }

      setData(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar relatório';
      console.error('❌ Erro ao buscar relatório:', error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    fetchReport,
    clearData
  };
};