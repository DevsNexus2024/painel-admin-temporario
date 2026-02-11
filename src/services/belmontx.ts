import { TOKEN_STORAGE } from "@/config/api";

/**
 * Base URL da API BelmontX
 * Conforme documentação: https://vps80270.cloudpublic.com.br:8081/api/belmontx
 */
const BELMONTX_API_BASE = "https://vps80270.cloudpublic.com.br:8081/api/belmontx";

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface BelmontXExtratoParams {
  dataInicio: string; // YYYY-MM-DD (obrigatório)
  dataFim?: string; // YYYY-MM-DD (opcional)
  tipo?: "credito" | "debito"; // Opcional
  virtualAccount?: string; // Opcional: ID da conta virtual
  txId?: string; // Opcional: Código TxID específico
  pagina?: number; // Opcional: Número da página (padrão: 1)
  porPagina?: number; // Opcional: Registros por página (máx: 100)
}

export interface BelmontXTransacao {
  codigoTransacao: string;
  idEnvio: string | null;
  valor: number; // Negativo para débito, positivo para crédito
  tipo: "credito" | "debito";
  tipoTransacao: string; // "PixIn", "PixOut", "Tarifa", etc.
  tipoStatusTransacao: string; // "Sucesso", etc.
  nome: string; // Nome da pessoa/empresa
  documento: string; // CPF/CNPJ (pode estar mascarado)
  ispb: string;
  observacao: string | null;
  endToEnd: string;
  txid: string | null;
  virtualAccount: string | null;
  dataHoraTransacao: string; // ISO format
}

export interface BelmontXExtratoResponse {
  mensagem: string;
  response: {
    success: boolean;
    provider: "belmontx";
    sucesso: boolean;
    mensagem: string;
    qtdRegistros: number; // Quantidade total de registros
    paginaAtual: number; // Página atual
    qtdPaginas: number; // Quantidade total de páginas
    transacoes: BelmontXTransacao[];
  };
}

export interface BelmontXSaldoResponse {
  mensagem: string;
  response: {
    success: boolean;
    saldoCentavos: number;
    saldoReais: string;
    provider: "belmontx";
  };
}

export interface BelmontXTransferirPixRequest {
  chavePixDestino: string; // Obrigatório
  valor: number; // Obrigatório: valor em reais (max: 100000)
  idEnvio?: string; // Opcional: código de idempotência
  descricao?: string; // Opcional: texto para comprovante (max 140)
  numeroDocumento?: string; // Opcional: CPF/CNPJ do pagador
}

export interface BelmontXTransferirPixResponse {
  mensagem: string;
  response: {
    success: boolean;
    idEnvio: string;
    valorCentavos: number;
    valorReais: number;
    provider: "belmontx";
    dadosOriginais?: any;
  };
}

export interface BelmontXDevolverPixRequest {
  endToEnd: string; // Obrigatório: identificador da transação original
  valor: number; // Obrigatório: valor a devolver em reais
  descricao?: string; // Opcional: texto para comprovante (max 140)
}

export interface BelmontXDevolverPixResponse {
  mensagem: string;
  response: {
    success: boolean;
    endToEnd: string;
    valorReais: number;
    provider: "belmontx";
  };
}

export interface BelmontXBuscarTransacaoParams {
  codigoTransacao?: string;
  idEnvio?: string;
  endToEnd?: string;
}

export interface BelmontXBuscarTransacaoResponse {
  mensagem: string;
  response: {
    success: boolean;
    provider: "belmontx";
    transacao: BelmontXTransacao;
  };
}

// ============================================================================
// FUNÇÕES DE API
// ============================================================================

/**
 * Obter token JWT do storage
 */
function getAuthToken(): string {
  const token = TOKEN_STORAGE.get();
  if (!token) {
    throw new Error("Token de autenticação não encontrado. Faça login novamente.");
  }
  return token;
}

/**
 * Construir URL com query parameters
 */
function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });
  return query.toString();
}

/**
 * Consultar extrato/histórico de transações
 * Endpoint conforme documentação: GET /api/belmontx/extrato
 * Query params: dataInicio (obrigatório), dataFim?, tipo?, virtualAccount?, txId?, pagina?, porPagina?
 */
export async function consultarExtratoBelmontX(
  params: BelmontXExtratoParams
): Promise<BelmontXExtratoResponse> {
  const token = getAuthToken();

  // Validar dataInicio obrigatória conforme documentação
  if (!params.dataInicio) {
    throw new Error("dataInicio é obrigatória (formato YYYY-MM-DD)");
  }

  const queryParams: Record<string, any> = {
    dataInicio: params.dataInicio,
  };

  if (params.dataFim) queryParams.dataFim = params.dataFim;
  if (params.tipo) queryParams.tipo = params.tipo;
  if (params.virtualAccount) queryParams.virtualAccount = params.virtualAccount;
  if (params.txId) queryParams.txId = params.txId;
  if (params.pagina) queryParams.pagina = params.pagina;
  if (params.porPagina) {
    // Validar que porPagina não exceda o máximo de 100 conforme documentação
    const porPaginaValue = Math.min(params.porPagina, 100);
    queryParams.porPagina = porPaginaValue;
  }

  const queryString = buildQueryString(queryParams);
  // Endpoint conforme documentação: GET /api/belmontx/extrato
  const endpoint = `${BELMONTX_API_BASE}/extrato?${queryString}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao consultar extrato BelmontX");
  }

  return response.json();
}

/**
 * Consultar saldo atual
 */
/**
 * Consultar saldo atual da conta BelmontX
 * Endpoint conforme documentação: GET /api/belmontx/saldo
 */
export async function consultarSaldoBelmontX(): Promise<BelmontXSaldoResponse> {
  const token = getAuthToken();

  // Endpoint conforme documentação: GET /api/belmontx/saldo
  const endpoint = `${BELMONTX_API_BASE}/saldo`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao consultar saldo BelmontX");
  }

  return response.json();
}

/**
 * Transferir PIX
 * Endpoint conforme documentação: POST /api/belmontx/transferir-pix
 * Body: { chavePixDestino, valor, idEnvio?, descricao?, numeroDocumento? }
 */
export async function transferirPixBelmontX(
  payload: BelmontXTransferirPixRequest
): Promise<BelmontXTransferirPixResponse> {
  const token = getAuthToken();

  // Validações conforme documentação
  if (!payload.chavePixDestino) {
    throw new Error("chavePixDestino é obrigatória");
  }
  if (!payload.valor || payload.valor <= 0) {
    throw new Error("valor deve ser maior que zero");
  }
  if (payload.valor > 100000) {
    throw new Error("valor máximo é R$ 100.000,00");
  }

  // Endpoint conforme documentação: POST /api/belmontx/transferir-pix
  const endpoint = `${BELMONTX_API_BASE}/transferir-pix`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao transferir PIX BelmontX");
  }

  return response.json();
}

/**
 * Devolver PIX (reverso)
 * Endpoint conforme documentação: POST /api/belmontx/devolver-pix
 * Body: { endToEnd, valor, descricao? }
 */
export async function devolverPixBelmontX(
  payload: BelmontXDevolverPixRequest
): Promise<BelmontXDevolverPixResponse> {
  const token = getAuthToken();

  // Validações conforme documentação
  if (!payload.endToEnd) {
    throw new Error("endToEnd é obrigatório");
  }
  if (!payload.valor || payload.valor <= 0) {
    throw new Error("valor deve ser maior que zero");
  }

  // Endpoint conforme documentação: POST /api/belmontx/devolver-pix
  const endpoint = `${BELMONTX_API_BASE}/devolver-pix`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao devolver PIX BelmontX");
  }

  return response.json();
}

/**
 * Buscar transação específica
 */
export async function buscarTransacaoBelmontX(
  params: BelmontXBuscarTransacaoParams
): Promise<BelmontXBuscarTransacaoResponse> {
  const token = getAuthToken();

  // Validar que exatamente 1 parâmetro foi informado
  const paramsCount = [params.codigoTransacao, params.idEnvio, params.endToEnd].filter(Boolean).length;
  if (paramsCount !== 1) {
    throw new Error("Informe exatamente 1 parâmetro: codigoTransacao, idEnvio ou endToEnd");
  }

  const queryParams: Record<string, any> = {};
  if (params.codigoTransacao) queryParams.codigoTransacao = params.codigoTransacao;
  if (params.idEnvio) queryParams.idEnvio = params.idEnvio;
  if (params.endToEnd) queryParams.endToEnd = params.endToEnd;

  const queryString = buildQueryString(queryParams);
  const endpoint = `${BELMONTX_API_BASE}/buscar-transacao?${queryString}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao buscar transação BelmontX");
  }

  return response.json();
}

/**
 * Invalidar token BelmontX (força novo login)
 */
export async function invalidarTokenBelmontX(): Promise<{ mensagem: string }> {
  const token = getAuthToken();

  const endpoint = `${BELMONTX_API_BASE}/invalidar-token`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ mensagem: response.statusText }));
    throw new Error(errorPayload.mensagem || errorPayload.erro || "Erro ao invalidar token BelmontX");
  }

  return response.json();
}

// ============================================================================
// FUNÇÕES DE COMPATIBILIDADE (para facilitar migração)
// ============================================================================

/**
 * Função de compatibilidade: mapeia consultas antigas para consultarExtratoBelmontX
 * @deprecated Use consultarExtratoBelmontX diretamente
 */
export async function fetchBelmontXTransactions(
  params: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    tipo?: "credito" | "debito";
  }
): Promise<BelmontXExtratoResponse> {
  // Converter parâmetros para formato BelmontX
  const belmontXParams: BelmontXExtratoParams = {
    dataInicio: params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dataFim: params.endDate,
    tipo: params.tipo,
    pagina: params.offset ? Math.floor(params.offset / (params.limit || 100)) + 1 : 1,
    porPagina: params.limit || 100,
  };

  return consultarExtratoBelmontX(belmontXParams);
}
