import { useState, useCallback } from 'react';

// Base URL específica para o relatório de depósitos
const RELATORIO_BASE_URL = import.meta.env.X_DIAGNOSTICO_API_URL;

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
      
      
      
      // Dados carregados com sucesso

      setData(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar relatório';

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