import { API_CONFIG, buildApiUrl, getApiHeaders } from "@/config/api";

// Tipos para o serviço de extrato
export interface ExtratoFiltros {
  de?: string; // Data inicial no formato YYYY-MM-DD
  ate?: string; // Data final no formato YYYY-MM-DD
  cursor?: number; // Offset para paginação
}

export interface MovimentoExtrato {
  id: string;
  dateTime: string;
  value: number;
  type: 'DÉBITO' | 'CRÉDITO';
  document: string;
  client?: string;
  identified: boolean;
  code: string;
}

export interface ExtratoResponse {
  items: MovimentoExtrato[];
  hasMore: boolean;
  cursor: number | null;
}

export interface ExtratoApiResponse {
  items: any[];
  hasMore: boolean;
  cursor: number | null;
}

/**
 * Consulta extrato de transações com filtros e paginação
 * @param filtros Filtros de data e cursor para paginação
 * @returns Promise com resultado da consulta
 */
export const consultarExtrato = async (filtros: ExtratoFiltros = {}): Promise<ExtratoResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.ACCOUNT.EXTRATO);
    
    // Construir query string
    const queryParams = new URLSearchParams();
    if (filtros.de) queryParams.append('de', filtros.de);
    if (filtros.ate) queryParams.append('ate', filtros.ate);
    if (filtros.cursor !== undefined) queryParams.append('cursor', filtros.cursor.toString());
    
    const urlWithParams = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
    
    console.log("Consultando extrato:", urlWithParams);
    console.log("Filtros:", filtros);
    
    const response = await fetch(urlWithParams, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.mensagem || `Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ExtratoApiResponse = await response.json();
    console.log("Resposta da API:", result);

    // Transformar dados do backend para o formato do frontend
    const movimentosFormatados: MovimentoExtrato[] = result.items.map(item => 
      formatarMovimentoDoBackend(item)
    );

    // Ordenar por data no frontend também (garantia adicional)
    movimentosFormatados.sort((a, b) => {
      const dataA = new Date(a.dateTime);
      const dataB = new Date(b.dateTime);
      return dataB.getTime() - dataA.getTime(); // Mais recente primeiro
    });
    
    console.log("Movimentos ordenados no frontend:", movimentosFormatados.slice(0, 3).map(m => ({
      data: m.dateTime,
      valor: m.value,
      tipo: m.type
    })));

    return {
      items: movimentosFormatados,
      hasMore: result.hasMore,
      cursor: result.cursor
    };
  } catch (error) {
    console.error("Erro ao consultar extrato:", error);
    throw error;
  }
};

/**
 * Função para desmascarar documento federal se necessário
 * ATENÇÃO: O mascaramento vem da API do banco por questões de segurança
 * @param documento Documento possivelmente mascarado
 * @returns Documento processado
 */
const processarDocumento = (documento: string): string => {
  if (!documento) return '—';
  
  // Se for um documento mascarado (padrão ***NNNNNN**)
  // TODO: Implementar desmascaramento se houver autorização/chave específica
  if (documento.includes('***')) {
    // Por enquanto, retorna como está (mascarado)
    return documento;
  }
  
  return documento;
};

/**
 * Formatar movimento do backend para o formato esperado pelo frontend
 * @param item Item do backend
 * @returns Movimento formatado
 */
const formatarMovimentoDoBackend = (item: any): MovimentoExtrato => {
  // Mapear campos do backend para o frontend
  return {
    id: item.codigoTransacao || item.id || Math.random().toString(36),
    dateTime: item.dataHora || item.dtMovimento || item.dateTime || new Date().toLocaleString('pt-BR'),
    value: Math.abs(parseFloat(item.valor || item.value || item.vlrMovimento || 0)),
    type: item.tipo || item.type || (parseFloat(item.valor || item.vlrMovimento || 0) >= 0 ? 'CRÉDITO' : 'DÉBITO'),
    document: processarDocumento(item.documentoFederal || item.documento),
    client: item.nomeCliente || item.cliente || item.nome || undefined,
    identified: item.identificado === 'sim' || item.identified === true || item.identified === 'true',
    code: item.codigoTransacao || item.codigo || item.code || Math.random().toString(36).substr(2, 9).toUpperCase()
  };
};

/**
 * Validar intervalo de datas
 * @param dataInicial Data inicial no formato YYYY-MM-DD
 * @param dataFinal Data final no formato YYYY-MM-DD
 * @returns boolean indicando se o intervalo é válido
 */
export const validarIntervaloData = (dataInicial?: string, dataFinal?: string): boolean => {
  if (!dataInicial || !dataFinal) return true; // Sem filtro é válido
  
  const inicio = new Date(dataInicial);
  const fim = new Date(dataFinal);
  
  // Verificar se as datas são válidas
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return false;
  
  // Data inicial não pode ser maior que a final
  if (inicio > fim) return false;
  
  // Intervalo máximo de 31 dias
  const diffTime = Math.abs(fim.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 31;
};

/**
 * Formatar data para o formato esperado pela API (YYYY-MM-DD)
 * @param date Objeto Date
 * @returns String no formato YYYY-MM-DD
 */
export const formatarDataParaAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
}; 