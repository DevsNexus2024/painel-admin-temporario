/**
 * 🚀 HOOK DE EXTRATO COM PAGINAÇÃO REAL - SOLUÇÃO DEFINITIVA
 * 
 * ✅ PAGINAÇÃO SERVER-SIDE: 200 registros por vez
 * ✅ FILTROS NO BACKEND: Data aplicada no servidor
 * ✅ CACHE INTELIGENTE: Cache por página/filtros
 * ✅ LOAD MORE: Carregamento incremental
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { unifiedBankingService } from '@/services/banking';
import { toast } from 'sonner';
import { API_CONFIG } from '@/config/api';

// Tipos principais
interface ExtratoFiltrosPaginados {
  de?: string; // Data inicial YYYY-MM-DD
  ate?: string; // Data final YYYY-MM-DD
  provider?: 'bmp' | 'bmp-531' | 'bitso';
}

interface MovimentoExtratoPaginado {
  id: string;
  dateTime: string;
  value: number;
  type: 'DÉBITO' | 'CRÉDITO';
  document: string;
  client?: string;
  identified: boolean;
  code: string;
  descCliente?: string;
  descricaoOperacao?: string;
  bitsoData?: any;
  _original?: any; // 🔧 DADOS ORIGINAIS PARA ANTI-DUPLICAÇÃO
}

interface PaginaExtrato {
  items: MovimentoExtratoPaginado[];
  hasMore: boolean;
  nextCursor: string | null;
  provider: string;
  totalEstimado?: number;
}

interface UseExtratoSeguroPaginadoOptions {
  filtros?: ExtratoFiltrosPaginados;
  enabled?: boolean;
  pageSize?: number;
}

/**
 * Função para fazer chamada real à API com paginação
 */
const buscarExtratoComPaginacao = async ({ 
  provider, 
  filtros, 
  cursor, 
  pageSize = 1000 
}: {
  provider: 'bmp' | 'bmp-531' | 'bitso';
  filtros: ExtratoFiltrosPaginados;
  cursor?: string | null;
  pageSize: number;
}): Promise<PaginaExtrato> => {
  


  let url: string;
  let params = new URLSearchParams();
  
  // Configurar parâmetros específicos por provider
  if (provider === 'bmp' || provider === 'bmp-531') {
    // BMP e BMP-531 usam cursor + date filters (parâmetros específicos do BMP!)
    if (filtros.de) params.append('data_inicio', filtros.de);
    if (filtros.ate) params.append('data_fim', filtros.ate);
    if (cursor) params.append('cursor', cursor);
    
    // 🎯 CRÍTICO: ORDENAÇÃO DO MAIS RECENTE PARA O MAIS ANTIGO
    params.append('order', 'desc');
    params.append('sort_by', 'data_movimento');
    
    // 📄 PAGINAÇÃO: Definir limite de registros
    params.append('limit', pageSize.toString());
    
    // Definir URLs
    if (provider === 'bmp') {
      url = `/internal/account/extrato`;
    } else {
      url = `/bmp-531/account/extrato`;
      // Adicionar parâmetros específicos BMP-531
      params.append('agencia', import.meta.env.VITE_BMP_AGENCIA_TTF || '');
      params.append('agencia_digito', import.meta.env.VITE_BMP_AGENCIA_DIGITO_TTF || '');
      params.append('conta', import.meta.env.VITE_BMP_CONTA_TTF || '');
      params.append('conta_digito', import.meta.env.VITE_BMP_CONTA_DIGITO_TTF || '');
      params.append('conta_pgto', import.meta.env.VITE_BMP_CONTA_PGTO_TTF || '');
      params.append('tipo_conta', String(import.meta.env.VITE_BMP_TIPO_CONTA_TTF || 1));
      params.append('modelo_conta', String(import.meta.env.VITE_BMP_MODELO_CONTA_TTF || 1));
      params.append('numero_banco', import.meta.env.VITE_BMP_531_BANCO || '');
    }
    
  } else if (provider === 'bitso') {
    // Bitso usa limit + marker + date filters
    params.append('limit', Math.min(pageSize, 1000).toString()); // ✅ Garantir que não ultrapasse 1000
    if (filtros.de) params.append('start_date', filtros.de);
    if (filtros.ate) params.append('end_date', filtros.ate);
    // ✅ Suporte aos novos markers otimizados ou fallback para cursor
    if (cursor) {
      // Se cursor é um objeto com markers específicos (novo formato)
      if (typeof cursor === 'object' && cursor !== null) {
        const cursorsObj = cursor as any;
        if (cursorsObj.payInsMarker) params.append('payInsMarker', cursorsObj.payInsMarker);
        if (cursorsObj.payOutsMarker) params.append('payOutsMarker', cursorsObj.payOutsMarker);
      } else {
        // Fallback para formato antigo
        params.append('marker', cursor as string);
      }
    }
    
    // 🎯 CRÍTICO: ORDENAÇÃO DO MAIS RECENTE PARA O MAIS ANTIGO
    params.append('order', 'desc');
    params.append('sort', 'timestamp');
    
    url = `/api/bitso/pix/extrato/conta`;
  } else {
    throw new Error(`Provider inválido: ${provider}`);
  }

  // Fazer requisição com URL base correta
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  

  
  // Usar configuração de API do projeto
  const absoluteUrl = `${API_CONFIG.BASE_URL}${fullUrl}`;
  

  
  const response = await fetch(absoluteUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Headers de autenticação conforme necessário
      ...(localStorage.getItem('auth_token') && {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`
      })
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`${provider.toUpperCase()} API Error: ${errorData.message || response.statusText}`);
  }

  const data = await response.json();
  
  // Processar resposta por provider
  let items: MovimentoExtratoPaginado[] = [];
  let hasMore = false;
  let nextCursor: string | null = null;
  
  if (provider === 'bitso') {
    // Resposta Bitso
    if (data.sucesso && data.data?.transacoes) {
      let transacoesBitso = data.data.transacoes;
      
      // 🔍 FILTRO LOCAL: Se API não filtrou, fazer no frontend temporariamente
      if (filtros.de || filtros.ate) {
        const dataInicio = filtros.de ? new Date(filtros.de + 'T00:00:00') : null;
        const dataFim = filtros.ate ? new Date(filtros.ate + 'T23:59:59') : null;
        
        transacoesBitso = transacoesBitso.filter((transacao: any) => {
          if (!transacao.data) return true;
          
          const dataTransacao = new Date(transacao.data);
          
          if (dataInicio && dataTransacao < dataInicio) return false;
          if (dataFim && dataTransacao > dataFim) return false;
          
          return true;
        });
      }
      
      items = transacoesBitso.map(formatarMovimentoBitso);
      hasMore = data.hasMore || data.data?.hasMore || false; // ✅ Priorizar campo raiz conforme backend
      // ✅ Usar novos nextMarkers se disponíveis, senão fallback para marker antigo
      nextCursor = data.nextMarkers || data.data?.nextMarkers || data.data?.marker || null;
    } else {
      throw new Error('Formato de resposta Bitso inválido');
    }
  } else {
    // Resposta BMP/BMP-531
    if (data.items && Array.isArray(data.items)) {
      items = data.items.map(item => formatarMovimentoDoBackend(item, provider));
      hasMore = data.hasMore || false;
      nextCursor = data.cursor ? String(data.cursor) : null;
    } else {
      throw new Error(`Formato de resposta ${provider.toUpperCase()} inválido`);
    }
  }

  // Ordenar por data (mais recente primeiro)
  items.sort((a, b) => {
    const dataA = new Date(a.dateTime);
    const dataB = new Date(b.dateTime);
    return dataB.getTime() - dataA.getTime();
  });



  return {
    items,
    hasMore,
    nextCursor,
    provider,
    totalEstimado: data.totalEstimado
  };
};

/**
 * Formatar movimento do backend BMP/BMP-531
 */
const formatarMovimentoDoBackend = (item: any, provider: string): MovimentoExtratoPaginado => {
  // Lógica de formatação (simplificada do extrato.ts original)
  let clienteFormatado = '';
  if (item.nome) {
    clienteFormatado = item.nome;
  } else if (item.complemento && item.complemento.includes(' - ')) {
    const partes = item.complemento.split(' - ');
    clienteFormatado = partes.slice(1).join(' - ');
  } else if (item.nomeCliente) {
    clienteFormatado = item.nomeCliente;
  } else {
    clienteFormatado = 'Cliente não identificado';
  }

  let documentoFormatado = '';
  if (item.documentoFederal) {
    documentoFormatado = item.documentoFederal;
  } else if (item.complemento && item.complemento.includes('***')) {
    const partes = item.complemento.split(' - ');
    if (partes[0]) {
      documentoFormatado = partes[0];
    }
  } else if (item.documento) {
    documentoFormatado = item.documento;
  } else {
    documentoFormatado = '—';
  }

  const valor = parseFloat(item.vlrMovimento || item.valor || item.value || 0);
  
  // Determinar tipo - 🚨 CORRIGIDO: usar tipoMovimento para BMP-531
  let tipo: 'DÉBITO' | 'CRÉDITO';
  if (provider === 'bmp-531') {
    // BMP-531 usa tipoMovimento: C = Crédito, D = Débito
    tipo = item.tipoMovimento === 'C' ? 'CRÉDITO' : 'DÉBITO';
  } else {
    // BMP regular usa tipoLancamento ou valor
    tipo = item.tipoLancamento === 'C' ? 'CRÉDITO' : 'DÉBITO';
  }

  return {
    id: item.codigo || item.codigoTransacao || item.id || Math.random().toString(36),
    dateTime: item.dtMovimento || item.dataHora || item.dateTime || new Date().toISOString(),
    value: Math.abs(valor),
    type: tipo,
    document: documentoFormatado,
    client: clienteFormatado,
    identified: true,
    code: item.identificadorOperacao || item.codigoTransacao || item.codigo || Math.random().toString(36).substr(2, 9).toUpperCase(),
    descCliente: item.descCliente || undefined,
    descricaoOperacao: item.descricaoOperacao || undefined,
    _original: item // 🔧 PRESERVAR DADOS ORIGINAIS PARA ANTI-DUPLICAÇÃO
  };
};

/**
 * Formatar movimento Bitso
 */
const formatarMovimentoBitso = (item: any): MovimentoExtratoPaginado => {
  const clientePrincipal = item.tipo === 'CRÉDITO' 
    ? (item.pagador?.nome || 'Cliente não identificado')
    : (item.destinatario?.nome || 'Cliente não identificado');

  return {
    id: item.id || Math.random().toString(36),
    dateTime: item.data || new Date().toISOString(),
    value: Math.abs(parseFloat(item.valor || 0)),
    type: item.tipo === 'CRÉDITO' ? 'CRÉDITO' : 'DÉBITO',
    document: clientePrincipal,
    client: item.tipo === 'CRÉDITO' 
      ? (item.pagador?.documento || '—') 
      : (item.destinatario?.documento || '—'),
    identified: true,
    code: item.endToEndId || item.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
    bitsoData: {
      pagador: item.pagador,
      destinatario: item.destinatario,
      metadados: item.metadados,
      origem: item.origem || 'pay-in',
      provider: 'bitso'
    },
    _original: item // 🔧 PRESERVAR DADOS ORIGINAIS PARA ANTI-DUPLICAÇÃO
  };
};

/**
 * Hook principal com paginação infinita
 */
export const useExtratoSeguroPaginado = (options: UseExtratoSeguroPaginadoOptions = {}) => {
  const { filtros = {}, enabled = true, pageSize = 1000 } = options;
  
  // Estado para loading de páginas adicionais
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Obter provider atual
  const obterProviderAtivo = (): 'bmp' | 'bmp-531' | 'bitso' => {
    try {
      const activeAccount = unifiedBankingService.getActiveAccount();
      if (activeAccount?.provider) {
        return activeAccount.provider as 'bmp' | 'bmp-531' | 'bitso';
      }
      return 'bmp'; // Fallback
    } catch (error) {
      return 'bmp'; // Fallback
    }
  };

  const provider = filtros.provider || obterProviderAtivo();

  const queryKey = ['extrato-paginado', provider, filtros, pageSize];

  // Query infinita
  const queryResult = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = null }) => 
      buscarExtratoComPaginacao({
        provider,
        filtros,
        cursor: pageParam as string | null,
        pageSize
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: PaginaExtrato) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled,
    staleTime: 30000, // Cache por 30 segundos
    gcTime: 60000, // Manter cache por 1 minuto
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000
  });

  // Função para carregar mais registros
  const loadMore = useCallback(async () => {
    if (queryResult.hasNextPage && !queryResult.isFetchingNextPage) {
      setIsLoadingMore(true);
      try {
        await queryResult.fetchNextPage();
      } catch (error) {
        toast.error('Erro ao carregar mais registros');
        console.error('[ExtratoSeguroPaginado] Erro ao carregar mais:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [queryResult]);

  // Combinar todas as páginas em um array único
  const allItems = queryResult.data?.pages.flatMap((page: PaginaExtrato) => page.items) || [];

  return {
    // Dados principais
    data: allItems,
    provider,
    
    // Estados de loading
    isLoading: queryResult.isLoading,
    isLoadingMore: isLoadingMore || queryResult.isFetchingNextPage,
    
    // Controle de paginação
    hasNextPage: queryResult.hasNextPage,
    loadMore,
    
    // Estados de erro
    error: queryResult.error,
    isError: queryResult.isError,
    
    // Controles
    refetch: queryResult.refetch,
    
    // Metadados
    totalPages: queryResult.data?.pages.length || 0,
    totalItems: allItems.length,
    
    // Estatísticas
    stats: {
      totalCarregado: allItems.length,
      paginasCarregadas: queryResult.data?.pages.length || 0,
      temMais: queryResult.hasNextPage,
      ultimaAtualizacao: new Date().toLocaleTimeString()
    }
  };
};
