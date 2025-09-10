/**
 * Hook para Extrato com Paginação Tradicional
 * 📄 Páginas numeradas (1, 2, 3...)
 * 🎯 200 registros por página
 * ✅ Navegação anterior/próxima
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { API_CONFIG } from '@/config/api';
import { MovimentoExtrato } from '@/services/extrato';

// Tipos
interface ExtratoFiltrosPaginados {
  de?: string; // Data inicial YYYY-MM-DD
  ate?: string; // Data final YYYY-MM-DD
  provider?: 'bmp' | 'bmp-531' | 'bitso';
}

interface PaginaExtrato {
  items: MovimentoExtrato[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pageSize: number;
}

interface UseExtratoPaginadoOptions {
  filtros: ExtratoFiltrosPaginados;
  enabled?: boolean;
  pageSize?: number;
  initialPage?: number;
}

/**
 * Função para buscar uma página específica
 */
const buscarPagina = async ({ 
  provider, 
  filtros, 
  page,
  pageSize = 1000,
  paginationState,
  setPaginationState
}: {
  provider: 'bmp' | 'bmp-531' | 'bitso';
  filtros: ExtratoFiltrosPaginados;
  page: number;
  pageSize: number;
  paginationState?: {
    page: number;
    nextMarkers?: {
      payInsMarker?: string;
      payOutsMarker?: string;
    };
    markers: Record<number, any>;
  };
  setPaginationState?: Dispatch<SetStateAction<{
    page: number;
    nextMarkers?: {
      payInsMarker?: string;
      payOutsMarker?: string;
    };
    markers: Record<number, any>;
  }>>;
}): Promise<PaginaExtrato> => {
  
  let url: string;
  let params = new URLSearchParams();
  
  // 🚀 Configurar parâmetros específicos por provider
  if (provider === 'bmp' || provider === 'bmp-531') {
    
    if (provider === 'bmp') {
      // 🚀 BMP 274 usa NOVA API pura igual à BMP 531
      url = `/api/account/statement`;
      
      // ✅ Parâmetros corretos BMP 274 TCR
      params.append('Conta.Agencia', import.meta.env.VITE_BMP_AGENCIA_BMP_274_TCR || '0001');
      params.append('Conta.AgenciaDigito', import.meta.env.VITE_BMP_AGENCIA_DIGITO_BMP_274_TCR || '');
      params.append('Conta.Conta', import.meta.env.VITE_BMP_CONTA_BMP_274_TCR || '902486');
      params.append('Conta.ContaDigito', import.meta.env.VITE_BMP_CONTA_DIGITO_BMP_274_TCR || '0');
      params.append('Conta.ContaPgto', import.meta.env.VITE_BMP_CONTA_PGTO_BMP_274_TCR || '09024860');
      params.append('Conta.TipoConta', String(import.meta.env.VITE_BMP_TIPO_CONTA_BMP_274_TCR || '3'));
      params.append('Conta.ModeloConta', String(import.meta.env.VITE_BMP_MODELO_CONTA_BMP_274_TCR || '1'));
      params.append('NumeroBanco', import.meta.env.VITE_BMP_BANCO_BMP_274_TCR || '274');
      
      // ✅ Parâmetros de data para filtro específico (corrigir timezone)
      if (filtros.de && filtros.ate) {
        // ✅ AMBAS AS DATAS: Usar estratégia específica igual à BMP 531
        const [anoInicial, mesInicial, diaInicial] = filtros.de.split('-');
        const [anoFinal, mesFinal, diaFinal] = filtros.ate.split('-');
        
        // Se mesmo mês, enviar dias específicos
        if (anoInicial === anoFinal && mesInicial === mesFinal) {
          params.append('Mes', mesInicial);
          params.append('Ano', anoInicial);
          params.append('DiaInicial', diaInicial);
          params.append('DiaFinal', diaFinal);
        } else {
          // Meses diferentes: usar estratégia de mês inteiro do inicial
          params.append('Mes', mesInicial);
          params.append('Ano', anoInicial);
        }
      } else if (filtros.de) {
        // ✅ SÓ DATA INICIAL: Usar mês inteiro
        const [ano, mes] = filtros.de.split('-');
        params.append('Mes', mes);
        params.append('Ano', ano);
      } else if (filtros.ate) {
        // ✅ SÓ DATA FINAL: Usar mês inteiro
        const [ano, mes] = filtros.ate.split('-');
        params.append('Mes', mes);
        params.append('Ano', ano);
      }
      
      // Se não tem filtros específicos, buscar mês atual
      if (!filtros.de && !filtros.ate) {
        const hoje = new Date();
        params.append('Mes', (hoje.getMonth() + 1).toString().padStart(2, '0'));
        params.append('Ano', hoje.getFullYear().toString());
      }

      
    } else {
      // 🚀 BMP-531 usa NOVA API com paginação real
      if (filtros.de) params.append('de', filtros.de);
      if (filtros.ate) params.append('ate', filtros.ate);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
      
      // ✅ CORREÇÃO FINAL: Usar rota completa que realmente funciona
      url = `/api/bmp-531/account/statement`;
      
      // ✅ Parâmetros corretos TTF BMP-531
      params.append('Conta.Agencia', import.meta.env.VITE_BMP_AGENCIA_TTF || '0001');
      params.append('Conta.AgenciaDigito', import.meta.env.VITE_BMP_AGENCIA_DIGITO_TTF || '8');
      params.append('Conta.Conta', import.meta.env.VITE_BMP_CONTA_TTF || '159');  // ✅ CORRETO: 159
      params.append('Conta.ContaDigito', import.meta.env.VITE_BMP_CONTA_DIGITO_TTF || '4');  // ✅ CORRETO: 4
      params.append('Conta.ContaPgto', import.meta.env.VITE_BMP_CONTA_PGTO_TTF || '00001594');  // ✅ CORRETO: 00001594
      params.append('Conta.TipoConta', String(import.meta.env.VITE_BMP_TIPO_CONTA_TTF || '3'));
      params.append('Conta.ModeloConta', String(import.meta.env.VITE_BMP_MODELO_CONTA_TTF || '1'));
      params.append('NumeroBanco', import.meta.env.VITE_BMP_531_BANCO || '531');
      
      // ✅ Parâmetros de data para filtro específico (corrigir timezone)
      if (filtros.de) {
        // ✅ CORREÇÃO: Usar split para evitar problemas de timezone
        const [ano, mes, dia] = filtros.de.split('-');
        params.append('Mes', mes);
        params.append('Ano', ano);
        params.append('DiaInicial', dia);
        
      }
      if (filtros.ate) {
        // ✅ CORREÇÃO: Usar split para evitar problemas de timezone
        const [ano, mes, dia] = filtros.ate.split('-');
        params.append('DiaFinal', dia);
      }
      
      // ✅ Se não tem filtros, usar estratégia simples que não cruza meses
      if (!filtros.de && !filtros.ate) {
        const hoje = new Date();
        
        // Estratégia simples: buscar mes atual ou mes anterior baseado na página
        const mesesParaTras = Math.floor((page - 1) / 5); // A cada 5 páginas, volta 1 mês
        const dataBusca = new Date(hoje);
        dataBusca.setMonth(hoje.getMonth() - mesesParaTras);
        
        params.append('Mes', (dataBusca.getMonth() + 1).toString().padStart(2, '0'));
        params.append('Ano', dataBusca.getFullYear().toString());
      }
    }
    
  } else if (provider === 'bitso') {
    // 🔍 DEBUG: Tentar diferentes estratégias para Bitso
    
    // 🚀 PAGINAÇÃO OTIMIZADA: Usar nextMarkers se disponíveis
    params.append('limit', Math.min(pageSize, 1000).toString()); // ✅ Respeitar limite máximo do backend
    
    // 📄 Se não é a primeira página, usar markers otimizados para esta página
    if (page > 1 && paginationState?.markers[page]) {
      const savedMarkers = paginationState.markers[page];
      if (savedMarkers?.payInsMarker) {
        params.append('payInsMarker', savedMarkers.payInsMarker);
      }
      if (savedMarkers?.payOutsMarker) {
        params.append('payOutsMarker', savedMarkers.payOutsMarker);
      }
    }
    
    // 🔧 FALLBACK: Manter page para compatibilidade com cálculos do backend
    params.append('page', page.toString());
    
    // Filtros de data
    if (filtros.de) params.append('start_date', filtros.de);
    if (filtros.ate) params.append('end_date', filtros.ate);
    
    // Tentar diferentes formatos de data também
    if (filtros.de) params.append('from_date', filtros.de);
    if (filtros.ate) params.append('to_date', filtros.ate);
    
    // Ordenação
    params.append('order', 'desc');
    params.append('sort', 'timestamp');
    params.append('sort_by', 'date');
    params.append('order_by', 'created_at');
    
    url = `/api/bitso/pix/extrato/conta`;
    

  } else {
    throw new Error(`Provider inválido: ${provider}`);
  }

  // Fazer requisição
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  const absoluteUrl = `${API_CONFIG.BASE_URL}${fullUrl}`;
  
  const response = await fetch(absoluteUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
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
  let items: MovimentoExtrato[] = [];
  let totalItems = 0;
  let totalPages = 0;
  let hasNextPage = false;
  let hasPrevPage = false;
  
  if (provider === 'bitso') {
    
    // 🚀 CORRIGIDO: Tentar ambos os formatos possíveis
    let transacoesBitso = null;
    
    if (data.sucesso && data.data?.transacoes) {
      transacoesBitso = data.data.transacoes;
    } else if (data.sucesso && data.transacoes) {
      transacoesBitso = data.transacoes;
    }
    
    if (transacoesBitso && Array.isArray(transacoesBitso)) {
      // Filtro local se necessário (já aplicado no backend, mas mantém por segurança)
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
      
      // 🚀 CORRIGIDO: Acessar dados de paginação da estrutura data.data (onde a Bitso envia)
      totalItems = data.data?.totalItems || data.data?.total || data.totalItems || data.total || items.length;
      totalPages = data.data?.totalPages || data.totalPages || Math.ceil(totalItems / pageSize);
      hasNextPage = data.data?.hasNextPage || data.data?.hasMore || data.hasNextPage || data.hasMore || false;
      hasPrevPage = data.data?.hasPrevPage || data.hasPrevPage || (page > 1);
      
      // 🔄 EXTRAIR E SALVAR nextMarkers otimizados para paginação
      const nextMarkers = data.nextMarkers || data.data?.nextMarkers || null;
      if (nextMarkers && (nextMarkers.payInsMarker || nextMarkers.payOutsMarker)) {
        setPaginationState?.(prev => ({
          ...prev,
          page: page,
          nextMarkers: nextMarkers,
          markers: { ...prev.markers, [page + 1]: nextMarkers }
        }));
      }
      
      // ✅ Log otimizado sem poluição

    } else {
      console.error('[useExtratoPaginado] Formato de resposta Bitso inválido:', {
        dataStructure: data,
        hasSuccesso: data.sucesso,
        hasDataTransacoes: !!(data.data?.transacoes),
        hasTransacoes: !!data.transacoes
      });
      throw new Error('Formato de resposta Bitso inválido - transações não encontradas');
    }
  } else {
    // 🚀 Resposta BMP/BMP-531 
    if (provider === 'bmp-531' && data.movimentos && Array.isArray(data.movimentos)) {
      // ✅ API BMP-531 /statement retorna { movimentos: [...] }
      items = data.movimentos.map((item: any) => formatarMovimentoDoBackend(item, provider));
      totalItems = data.movimentos.length;
      
    } else if (provider === 'bmp-531' && data.items && Array.isArray(data.items)) {
      // API BMP-531 alternativa com items
      items = data.items.map((item: any) => formatarMovimentoDoBackend(item, provider));
      totalItems = data.totalItems || data.total || items.length;
      
    } else if (provider === 'bmp' && data.movimentos && Array.isArray(data.movimentos)) {
      // ✅ NOVA API BMP 274 /statement retorna { movimentos: [...] }
      items = data.movimentos.map((item: any) => formatarMovimentoDoBackend(item, provider));
      totalItems = data.movimentos.length;
      
    } else if (provider === 'bmp' && data.items && Array.isArray(data.items)) {
      // API BMP legado (fallback)
      items = data.items.map((item: any) => formatarMovimentoDoBackend(item, provider));
      totalItems = data.total || data.totalItems || items.length;
      
    } else {
      throw new Error(`Formato de resposta ${provider.toUpperCase()} inválido - esperado: { movimentos: [...] } ou { items: [...] }`);
    }
  }

  // Calcular informações da página (se não foram definidas acima)
  if (!totalPages) {
    totalPages = Math.ceil(totalItems / pageSize);
    hasNextPage = page < totalPages;
    hasPrevPage = page > 1;
  }
  


  return {
    items,
    currentPage: page,
    totalPages,
    totalItems,
    hasNextPage,
    hasPrevPage,
    pageSize
  };
};

/**
 * Formatadores (copiados do sistema existente)
 */
const formatarMovimentoDoBackend = (item: any, provider: string): MovimentoExtrato => {
  // 🚨 CORRIGIDO: Mapeamento específico para BMP-531 vs outros providers
  let value = 0;
  let type: 'DÉBITO' | 'CRÉDITO' = 'DÉBITO';
  let dateTime = new Date().toISOString();
  
  if (provider === 'bmp-531' || provider === 'bmp') {
    // ✅ BMP-531 e BMP-274 usam MESMA API pura (campos específicos)
    value = Math.abs(parseFloat(item.vlrMovimento || item.valor || 0));
    
    // Identificar crédito/débito baseado no campo tipoLancamento ou valor
    if (item.tipoLancamento === 'C') {
      type = 'CRÉDITO';
    } else if (item.tipoLancamento === 'D') {
      type = 'DÉBITO';
    } else {
      // Fallback: baseado no valor (BMP usa valor positivo/negativo)
      const valorNumerico = parseFloat(item.vlrMovimento || item.valor || 0);
      if (valorNumerico > 0) {
        type = 'CRÉDITO';
      } else if (valorNumerico < 0) {
        type = 'DÉBITO';
      } else {
        // Último fallback: descrição
        const desc = (item.descricao || item.complemento || item.descricaoOperacao || '').toLowerCase();
        if (desc.includes('recebimento') || desc.includes('credito') || desc.includes('deposito') || desc.includes('pix recebido')) {
          type = 'CRÉDITO';
        } else {
          type = 'DÉBITO';
        }
      }
    }
    
    dateTime = item.dtMovimento || item.dtLancamento || item.dataHora || new Date().toISOString();
  } else {
    // Outros providers (Bitso, etc.) - campos padrão
    value = Math.abs(parseFloat(item.value || item.valor || 0));
    type = item.type || (parseFloat(item.valor || 0) > 0 ? 'CRÉDITO' : 'DÉBITO');
    dateTime = item.dateTime || item.data_movimento || new Date().toISOString();
  }
  
  // ✅ Mapear outros campos baseado no provider
  let client, document, code, descCliente, descricaoOperacao, identified;
  
  if (provider === 'bmp-531' || provider === 'bmp') {
    // Campos da API pura BMP-531 e BMP-274
    client = item.nome || item.descCliente || item.complemento || '—';
    document = item.documentoFederal || item.documento || '—';
    code = item.codigo || item.codigoTransacao || item.identificadorOperacao || Math.random().toString(36).substr(2, 9).toUpperCase();
    descCliente = item.descCliente || item.nome;
    descricaoOperacao = item.descricaoOperacao || item.descricao;
    identified = !!(item.nome || item.documentoFederal);
  } else {
    // Outros providers
    client = item.client || item.cliente || item.nome || '—';
    document = item.document || item.documento || '—';
    code = item.code || item.codigo || Math.random().toString(36).substr(2, 9).toUpperCase();
    descCliente = item.descCliente;
    descricaoOperacao = item.descricaoOperacao;
    identified = item.identified !== false;
  }

  return {
    id: item.id || item.codigo || Math.random().toString(36),
    dateTime: dateTime,
    value: value,
    type: type,
    document: document,
    client: client,
    identified: identified,
    code: code,
    descCliente: descCliente,
    descricaoOperacao: descricaoOperacao
  };
};

const formatarMovimentoBitso = (item: any): MovimentoExtrato => {
  const descricao = item.descricao || '';
  const clientePrincipal = item.tipo === 'CRÉDITO' 
    ? (item.pagador?.nome || item.pagador?.documento || 'Pagador não identificado')
    : (item.destinatario?.nome || item.destinatario?.documento || 'Destinatário não identificado');
    
  return {
    id: item.id || Math.random().toString(36),
    dateTime: item.data || new Date().toISOString(),
    value: Math.abs(parseFloat(item.valor || 0)),
    type: item.tipo === 'CRÉDITO' ? 'CRÉDITO' : 'DÉBITO',
    document: clientePrincipal || 'Cliente não identificado',
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
    }
  };
};

/**
 * Função para obter provider ativo
 */
const obterProviderAtivo = (): 'bmp' | 'bmp-531' | 'bitso' => {
  try {
    const currentAccount = JSON.parse(localStorage.getItem('currentAccount') || '{}');
    return currentAccount.provider || 'bmp';
  } catch {
    return 'bmp';
  }
};

/**
 * Hook principal
 */
export const useExtratoPaginado = ({
  filtros,
  enabled = true,
  pageSize = 1000,
  initialPage = 1
}: UseExtratoPaginadoOptions) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  
  // 🚀 Estado para rastrear markers da Bitso para paginação otimizada
  const [paginationState, setPaginationState] = useState<{
    page: number;
    nextMarkers?: {
      payInsMarker?: string;
      payOutsMarker?: string;
    };
    markers: Record<number, any>; // markers por página
  }>({
    page: 1,
    markers: {}
  });
  
  const provider = filtros.provider || obterProviderAtivo();

  // Query para a página atual
  const queryResult = useQuery({
    queryKey: ['extrato-paginado', provider, filtros, currentPage, pageSize],
    queryFn: () => buscarPagina({
      provider,
      filtros,
      page: currentPage,
      pageSize,
      paginationState,
      setPaginationState
    }),
    enabled,
    staleTime: 30000, // 30 segundos
    gcTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Funções de navegação
  const goToPage = (page: number) => {
    if (page >= 1 && page <= (queryResult.data?.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (queryResult.data?.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (queryResult.data?.hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const firstPage = () => {
    setCurrentPage(1);
  };

  const lastPage = () => {
    if (queryResult.data?.totalPages) {
      setCurrentPage(queryResult.data.totalPages);
    }
  };

  // Informações derivadas
  const pageInfo = useMemo(() => {
    if (!queryResult.data) {
      return null;
    }
    
    const { currentPage, totalPages, totalItems, pageSize } = queryResult.data;
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    
    return {
      startItem,
      endItem,
      totalItems,
      currentPage,
      totalPages,
      pageSize
    };
  }, [queryResult.data]);

  return {
    // Dados
    data: queryResult.data?.items || [],
    pageInfo,
    
    // Estados
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    
    // Navegação
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    
    // Utilidades
    refetch: queryResult.refetch,
    provider
  };
};
