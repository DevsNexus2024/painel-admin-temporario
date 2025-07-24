import { API_CONFIG, buildApiUrl, getApiHeaders } from "@/config/api";

// ❌ REMOVIDO: import { apiRouter } from "@/pages/payments/apiRouter";
// 🚨 CRÍTICO: Roteamento isolado para dados financeiros

// Tipos para o serviço de extrato
export interface ExtratoFiltros {
  de?: string; // Data inicial no formato YYYY-MM-DD
  ate?: string; // Data final no formato YYYY-MM-DD
  cursor?: number; // Offset para paginação
  provider?: 'bmp' | 'bitso'; // 🚨 OBRIGATÓRIO: Provider explícito
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
  
  // *** CAMPOS ESPECÍFICOS DA BITSO ***
  // Apenas preenchidos quando provider === 'bitso'
  bitsoData?: {
    // Dados do pagador (quem enviou o PIX)
    pagador?: {
      nome?: string;
      documento?: string;
      chave?: string;
      tipo_chave?: string;
      banco?: string;
      conta?: string;
      agencia?: string;
    };
    
    // Dados do destinatário (quem recebeu o PIX)  
    destinatario?: {
      nome?: string;
      documento?: string;
      chave?: string;
      tipo_chave?: string;
      banco?: string;
      conta?: string;
      agencia?: string;
    };
    
    // Dados técnicos da transação
    metadados?: {
      metodo?: string;
      protocolo?: string;
      moeda?: string;
      taxa?: number;
      referencia?: string;
      observacoes?: string;
      motivo_falha?: string;
      end_to_end_id?: string;
      integration?: string;
      origin_id?: string;
    };
    
    // Origem da transação
    origem: 'pay-in' | 'payout';
    provider: 'bitso';
  };
}

export interface ExtratoResponse {
  items: MovimentoExtrato[];
  hasMore: boolean;
  cursor: number | null;
  provider: string; // 🚨 CRÍTICO: Sempre identificar a fonte
}

export interface ExtratoApiResponse {
  items: any[];
  hasMore: boolean;
  cursor: number | null;
}

/**
 * 🚨 SERVIÇO ISOLADO E SEGURO PARA DADOS FINANCEIROS
 * 
 * Consulta extrato com validação rigorosa de provedor
 * ❌ NÃO usa singleton apiRouter 
 * ✅ Requer provider explícito
 * ✅ Validação obrigatória de rota
 * ✅ Logs de segurança detalhados
 */
export const consultarExtrato = async (filtros: ExtratoFiltros = {}): Promise<ExtratoResponse> => {
  try {
    // 🚨 VALIDAÇÃO CRÍTICA: Provider obrigatório
    if (!filtros.provider) {
      const error = "🚨 ERRO CRÍTICO: Provider obrigatório para dados financeiros!";
      console.error(error);
      throw new Error(error);
    }

    const provider = filtros.provider;
    console.log(`🔒 [EXTRATO-SEGURO] Iniciando consulta ISOLADA`);
    console.log(`🏦 [EXTRATO-SEGURO] Provider EXPLÍCITO: ${provider}`);
    console.log(`📋 [EXTRATO-SEGURO] Filtros:`, filtros);

    let result: any;
    let endpoint: string;
    let baseUrl: string;

    // 🚨 ROTEAMENTO ISOLADO E EXPLÍCITO
    if (provider === 'bmp') {
      console.log(`🔵 [EXTRATO-SEGURO] ===== ROTA BMP EXCLUSIVA =====`);
      baseUrl = API_CONFIG.BASE_URL;
      endpoint = '/internal/account/extrato';
      
      // Preparar parâmetros BMP
      const params: Record<string, string> = {};
      if (filtros.de) params.start_date = filtros.de;
      if (filtros.ate) params.end_date = filtros.ate;
      if (filtros.cursor !== undefined) params.cursor = filtros.cursor.toString();
      
      const queryString = new URLSearchParams(params).toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
      const fullUrl = `${baseUrl}${fullEndpoint}`;
      
      console.log(`🔵 [EXTRATO-SEGURO] URL BMP: ${fullUrl}`);
      
      // Chamada direta e isolada para BMP
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'baas-frontend/1.0.0',
          // Token de autenticação se necessário
          ...(localStorage.getItem('auth_token') && {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          })
        },
        signal: AbortSignal.timeout(30000)
      });

      result = await response.json();
      
      if (!response.ok) {
        throw new Error(`BMP API Error ${response.status}: ${result.message || response.statusText}`);
      }
      
      console.log(`✅ [EXTRATO-SEGURO] Resposta BMP recebida:`, {
        hasItems: !!result?.items,
        itemsCount: result?.items?.length || 0
      });

    } else if (provider === 'bitso') {
      console.log(`🟠 [EXTRATO-SEGURO] ===== ROTA BITSO EXCLUSIVA =====`);
      baseUrl = `${API_CONFIG.BASE_URL}/api/bitso`;
      endpoint = '/pix/extrato';
      
      // Preparar parâmetros Bitso - NÃO enviar cursor=0 pois a API não aceita
      const params: Record<string, string> = {};
      // Só adicionar cursor se for maior que 0
      if (filtros.cursor !== undefined && filtros.cursor > 0) {
        params.cursor = filtros.cursor.toString();
      }
      
      const queryString = new URLSearchParams(params).toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
      const fullUrl = `${baseUrl}${fullEndpoint}`;
      
      console.log(`🟠 [EXTRATO-SEGURO] URL BITSO: ${fullUrl}`);
      
      // Chamada direta e isolada para Bitso
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'baas-frontend/1.0.0'
          // Bitso usa autenticação HMAC no backend
        },
        signal: AbortSignal.timeout(30000)
      });

      result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Bitso API Error ${response.status}: ${result.message || response.statusText}`);
      }
      
      console.log(`✅ [EXTRATO-SEGURO] Resposta Bitso recebida:`, {
        sucesso: result?.sucesso,
        hasData: !!result?.data,
        hasTransacoes: !!result?.data?.transacoes,
        transacoesCount: result?.data?.transacoes?.length || 0
      });

    } else {
      const error = `🚨 ERRO CRÍTICO: Provider inválido: ${provider}`;
      console.error(error);
      throw new Error(error);
    }

    // 🚨 PROCESSAMENTO ISOLADO POR PROVIDER
    let movimentosFormatados: MovimentoExtrato[];
    let hasMore = false;
    let cursor = null;
    
    if (provider === 'bitso') {
      console.log(`🟠 [EXTRATO-SEGURO] Processando dados Bitso...`);
      // Dados Bitso já vêm normalizados do backend
      if (!result.sucesso || !result.data || !result.data.transacoes) {
        throw new Error('🚨 Formato de resposta Bitso inválido');
      }
      
      movimentosFormatados = result.data.transacoes.map(item => formatarMovimentoBitso(item));
      hasMore = false; // TODO: implementar paginação Bitso
      cursor = null;
      
    } else { // provider === 'bmp'
      console.log(`🔵 [EXTRATO-SEGURO] Processando dados BMP...`);
      // Dados BMP no formato original
      if (!result.items || !Array.isArray(result.items)) {
        throw new Error('🚨 Formato de resposta BMP inválido');
      }
      
      movimentosFormatados = result.items.map(item => formatarMovimentoDoBackend(item));
      hasMore = result.hasMore || false;
      cursor = result.cursor || null;
    }

    // Ordenar por data no frontend (garantia adicional)
    movimentosFormatados.sort((a, b) => {
      const dataA = new Date(a.dateTime);
      const dataB = new Date(b.dateTime);
      return dataB.getTime() - dataA.getTime(); // Mais recente primeiro
    });
    
    console.log(`✅ [EXTRATO-SEGURO] ${movimentosFormatados.length} transações formatadas para provider: ${provider}`);
    console.log(`🔒 [EXTRATO-SEGURO] Primeira transação:`, movimentosFormatados[0] ? {
      data: movimentosFormatados[0].dateTime,
      valor: movimentosFormatados[0].value,
      tipo: movimentosFormatados[0].type
    } : 'Nenhuma transação');

    return {
      items: movimentosFormatados,
      hasMore,
      cursor,
      provider // 🚨 CRÍTICO: Sempre retornar provider para validação
    };
  } catch (error) {
    console.error("🚨 [EXTRATO-SEGURO] Erro crítico:", error);
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
 * Formatar movimento Bitso para o formato esperado pelo frontend
 * @param item Item normalizado do Bitso (com todos os campos novos)
 * @returns Movimento formatado
 */
const formatarMovimentoBitso = (item: any): MovimentoExtrato => {
  // Extrair informações da descrição para identificar cliente (fallback)
  const descricao = item.descricao || '';
  const clienteMatch = descricao.match(/- (.+)$/);
  const clienteFallback = clienteMatch ? clienteMatch[1] : undefined;
  
  // Usar dados do pagador/destinatário conforme tipo da transação
  let clientePrincipal = clienteFallback;
  if (item.tipo === 'CRÉDITO' && item.pagador?.nome) {
    clientePrincipal = item.pagador.nome; // Para créditos, mostrar quem enviou
  } else if (item.tipo === 'DÉBITO' && item.destinatario?.nome) {
    clientePrincipal = item.destinatario.nome; // Para débitos, mostrar quem recebeu
  }
  
  return {
    id: item.id || Math.random().toString(36),
    dateTime: item.data || new Date().toISOString(),
    value: Math.abs(parseFloat(item.valor || 0)),
    type: item.tipo === 'CRÉDITO' ? 'CRÉDITO' : 'DÉBITO',
    // INVERTIDO: document agora tem informações detalhadas do cliente/banco
    document: clientePrincipal || 'Cliente não identificado',
    // INVERTIDO: client agora tem o documento (CPF/CNPJ)
    client: item.tipo === 'CRÉDITO' 
      ? (item.pagador?.documento || '—') 
      : (item.destinatario?.documento || '—'),
    identified: true, // Bitso sempre retorna dados identificados
    code: item.endToEndId || item.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
    
    // *** DADOS ESPECÍFICOS DA BITSO ***
    bitsoData: {
      pagador: item.pagador ? {
        nome: item.pagador.nome || undefined,
        documento: item.pagador.documento || undefined,
        chave: item.pagador.chave || undefined,
        tipo_chave: item.pagador.tipo_chave || undefined,
        banco: item.pagador.banco || undefined,
        conta: item.pagador.conta || undefined,
        agencia: item.pagador.agencia || undefined
      } : undefined,
      
      destinatario: item.destinatario ? {
        nome: item.destinatario.nome || undefined,
        documento: item.destinatario.documento || undefined,
        chave: item.destinatario.chave || undefined,
        tipo_chave: item.destinatario.tipo_chave || undefined,
        banco: item.destinatario.banco || undefined,
        conta: item.destinatario.conta || undefined,
        agencia: item.destinatario.agencia || undefined
      } : undefined,
      
      metadados: item.metadados ? {
        metodo: item.metadados.metodo || undefined,
        protocolo: item.metadados.protocolo || undefined,
        moeda: item.metadados.moeda || 'BRL',
        taxa: item.metadados.taxa || undefined,
        referencia: item.metadados.referencia || undefined,
        observacoes: item.metadados.observacoes || undefined,
        motivo_falha: item.metadados.motivo_falha || undefined,
        end_to_end_id: item.metadados.end_to_end_id || item.endToEndId || undefined,
        integration: item.metadados.integration || undefined,
        origin_id: item.metadados.origin_id || undefined
      } : undefined,
      
      origem: item.origem || 'pay-in',
      provider: 'bitso'
    }
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