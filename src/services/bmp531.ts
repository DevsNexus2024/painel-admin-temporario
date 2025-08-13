/**
 * 🏦 BMP 531 Service
 * Serviço centralizado para todas as APIs do Banco Master BMP 531
 * 
 * ✅ ISOLAMENTO TOTAL: Este serviço só faz chamadas para BMP 531
 * ❌ JAMAIS misturar com outros provedores (Bitso, BMP padrão, etc.)
 */

import { API_CONFIG } from "@/config/api";
import { logger } from "@/utils/logger";

// ==================== CONFIGURAÇÕES ====================

/**
 * Configuração centralizada de endpoints BMP 531
 * ✅ Usando variáveis de ambiente e documentação oficial
 */
/**
 * Headers de autenticação para BMP-531
 * ✅ Inclui API credentials obrigatórias
 */
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY_BMP_531_TCR,
    'X-API-Secret': import.meta.env.VITE_API_SECRET_BMP_531_TCR
  };
}

const BMP531_CONFIG = {
  // 🌐 URL base da API - vem do .env
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  
  endpoints: {
    // Conta e Saldo
    saldo: '/bmp-531/account/saldo',
    extrato: '/bmp-531/account/extrato',
    
    // PIX - Operações
    pixEnviar: '/bmp-531/pix/enviar',
    pixPagarCopiaCola: '/bmp-531/pix/pagar-copia-cola',
    pixConsultarChave: '/bmp-531/pix/consultar-chave',
    pixStatusTransacao: '/bmp-531/pix/status',
    
    // PIX - Chaves
    pixChavesCriar: '/bmp-531/pix/chaves/criar',
    pixChavesListar: '/bmp-531/pix/chaves/listar',
    
    // PIX - QR Code
    pixQrCodeEstatico: '/bmp-531/pix/qrcode/estatico',
  },
  
  // 🔑 Dados bancários das variáveis de ambiente - TODOS do .env
  dadosBancarios: {
    agencia: import.meta.env.VITE_BMP_AGENCIA_TTF,
    agencia_digito: import.meta.env.VITE_BMP_AGENCIA_DIGITO_TTF,
    conta: import.meta.env.VITE_BMP_CONTA_TTF,
    conta_digito: import.meta.env.VITE_BMP_CONTA_DIGITO_TTF,
    conta_pgto: import.meta.env.VITE_BMP_CONTA_PGTO_TTF,
    tipo_conta: parseInt(import.meta.env.VITE_BMP_TIPO_CONTA_TTF, 10),
    modelo_conta: parseInt(import.meta.env.VITE_BMP_MODELO_CONTA_TTF, 10),
    pix_key: import.meta.env.VITE_CHAVE_BMP_531_TTF
  },
  
  // 🔐 Token de autenticação
  secretToken: import.meta.env.VITE_X_BMP531_SECRET_TOKEN,
  
  // Timeout padrão para requisições BMP 531
  timeout: 30000, // 30 segundos
  
  // Headers padrão
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
} as const;

// ==================== TIPOS ====================

export interface Bmp531SaldoResponse {
  sucesso: boolean;
  mensagem: string;
  saldoDisponivel: number;
  saldoBloqueado: number;
  saldoTotal: number;
  moeda: string;
  dadosConta?: {
    banco: string;
    agencia: string;
    conta: string;
    contaDigito: string;
    titular: string;
    documento: string;
  };
  dataConsulta: string;
}

export interface Bmp531ExtratoResponse {
  sucesso: boolean;
  mensagem: string;
  items: Bmp531Movimento[];
  totalRegistros: number;
  hasMore: boolean;
  cursor?: number;
  filtros?: {
    dataInicial?: string;
    dataFinal?: string;
  };
}

export interface Bmp531Movimento {
  // Campos conforme documentação da API BMP 531
  codigo?: string;
  codigoTransacao?: string;
  dtMovimento?: string;
  dtLancamento?: string;
  vlrMovimento?: number;
  nome?: string;
  documentoFederal?: string;
  complemento?: string;
  identificadorOperacao?: string;
  cdOperacao?: string;
  tipoMovimento?: 'D' | 'C'; // D = Débito, C = Crédito
  descricao?: string;
  
  // Campos alternativos (compatibilidade)
  id?: string;
  dataHora?: string;
  valor?: number;
  valorFormatado?: string;
  tipo?: 'CREDITO' | 'DEBITO';
  status?: string;
  descCliente?: string;
  cliente?: string;
  nomeCorrentista?: string;
  documento?: string;
  origem?: string;
  destino?: string;
}

export interface Bmp531PixEnviarRequest {
  chave: string;
  valor: number;
  descricao?: string;
  informacoesAdicionais?: string;
  remittanceInformation?: string;
}

export interface Bmp531PixEnviarResponse {
  sucesso: boolean;
  mensagem: string;
  codigoTransacao?: string;
  status?: string;
  dataTransacao?: string;
  valorTransacao?: number;
  chaveDestino?: string;
  nomeDestino?: string;
}

export interface Bmp531PixConsultarChaveRequest {
  chave: string;
}

export interface Bmp531PixConsultarChaveResponse {
  sucesso: boolean;
  mensagem: string;
  dadosChave?: {
    chave: string;
    tipoChave: number;
    nomeCorrentista: string;
    nomeFantasia: string;
    tipoPessoa: number;
    documentoFederal: string;
    conta: {
      conta: string;
      tipoConta: number;
      agencia: string;
      ispb: string | null;
    };
    banco: {
      descricao: string;
      numero: string;
      ispb: string;
    };
  };
}

export interface Bmp531PixChaveCriarRequest {
  tipoChave: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  chave?: string; // Opcional para EVP (chave aleatória)
  codigoMfa?: string;
  codigoAutenticacao?: string;
}

export interface Bmp531PixChaveCriarResponse {
  sucesso: boolean;
  mensagem: string;
  etapa: string;
  chave?: string;
  tipoChave?: string;
  codigoAutenticacao?: string;
  mfaEnviado?: boolean;
  proximoPasso?: string;
}

export interface Bmp531PixChavesListarResponse {
  sucesso: boolean;
  mensagem: string;
  total: number;
  chaves: Bmp531PixChave[];
  estatisticas: {
    totalChaves: number;
    porTipo: Record<string, number>;
    porTipoPessoa: Record<string, number>;
  };
  contaConsultada: {
    agencia: string;
    conta: string;
    contaDigito: string;
  };
}

export interface Bmp531PixChave {
  chave: string;
  tipoChave: {
    codigo: number;
    nome: string;
    descricao: string;
  };
  titular: {
    nome: string;
    documento: string;
    tipoPessoa: {
      codigo: number;
      nome: string;
    };
  };
  formatacao: string;
  configurada: boolean;
  dataCriacao?: string;
  status?: string;
}

// ==================== UTILITÁRIOS ====================



/**
 * Obtém dados bancários dinâmicos 
 * @param accountType - Tipo de conta: 'tcr' ou 'ttf' (padrão: 'ttf')
 */
function getDadosBancarios(accountType: 'tcr' | 'ttf' = 'ttf') {
  if (accountType === 'tcr') {
    // Dados da conta TCR - vem do .env
    return {
      agencia: import.meta.env.VITE_BMP_AGENCIA_TCR,
      agencia_digito: import.meta.env.VITE_BMP_AGENCIA_DIGITO_TCR,
      conta: import.meta.env.VITE_BMP_CONTA_TCR,
      conta_digito: import.meta.env.VITE_BMP_CONTA_DIGITO_TCR,
      conta_pgto: import.meta.env.VITE_BMP_CONTA_PGTO_TCR,
      tipo_conta: parseInt(import.meta.env.VITE_BMP_TIPO_CONTA_TCR, 10),
      modelo_conta: parseInt(import.meta.env.VITE_BMP_MODELO_CONTA_TCR, 10),
    };
  }
  
  // Dados da conta TTF (nova conta padrão)
  return { ...BMP531_CONFIG.dadosBancarios };
}

/**
 * Faz requisição HTTP com tratamento de erro padronizado
 */
async function makeRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${BMP531_CONFIG.baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(BMP531_CONFIG.timeout)
    });

    if (!response.ok) {
      const errorText = await response.text();      
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
    
  } catch (error: any) {
    
    if (error.name === 'TimeoutError') {
      throw new Error('Timeout: A requisição demorou muito para responder');
    }
    
    if (error.name === 'AbortError') {
      throw new Error('Requisição cancelada');
    }
    
    throw error;
  }
}

// ==================== SERVIÇOS DE CONTA ====================

/**
 * 💰 Consulta saldo da conta BMP 531
 * @param accountType - Tipo de conta: 'tcr' ou 'ttf' (padrão: 'ttf') 
 */
export async function getBmp531Saldo(accountType: 'tcr' | 'ttf' = 'ttf'): Promise<Bmp531SaldoResponse> {
  // ✅ SEGURO: Log sem dados bancários sensíveis
  logger.info('Consultando saldo bancário', {
    accountType: accountType.toUpperCase()
  }, 'BMP531Service');
  
  const dadosBancarios = getDadosBancarios(accountType);
  
  return makeRequest<Bmp531SaldoResponse>(
    BMP531_CONFIG.endpoints.saldo,
    { 
      method: 'GET'
    }
  );
}

/**
 * 📋 Consulta extrato da conta BMP 531
 * ✅ Sem limite de registros - busca todos os dados disponíveis
 * ✅ Suporte à paginação igual ao gerenciador de contas original
 * @param filtros - Filtros de data e paginação
 * @param accountType - Tipo de conta: 'tcr' ou 'ttf' (padrão: 'ttf')
 */
export async function getBmp531Extrato(filtros?: {
  de?: string;
  ate?: string;
  cursor?: number;
}, accountType: 'tcr' | 'ttf' = 'ttf'): Promise<Bmp531ExtratoResponse> {
  let endpoint = BMP531_CONFIG.endpoints.extrato;
  
  // Adicionar parâmetros de filtro se fornecidos
  if (filtros && Object.keys(filtros).length > 0) {
    const params = new URLSearchParams();
    
    if (filtros.de) {
      params.append('de', filtros.de);
    }
    if (filtros.ate) {
      params.append('ate', filtros.ate);
    }
    if (filtros.cursor) {
      params.append('cursor', filtros.cursor.toString());
    }
    
    endpoint += `?${params.toString()}`;
  }
  
  const dadosBancarios = getDadosBancarios(accountType);
  
  const resultado = await makeRequest<Bmp531ExtratoResponse>(
    endpoint,
    { 
      method: 'GET'
    }
  );
  
  return resultado;
}

// ==================== SERVIÇOS PIX ====================

/**
 * 💸 Envia PIX por chave - BMP 531
 * ✅ Conforme documentação: inclui dadosBancarios automaticamente
 * @param data - Dados do PIX a enviar
 * @param accountType - Tipo de conta: 'tcr' ou 'ttf' (padrão: 'ttf')
 */
export async function enviarPixBmp531(data: Bmp531PixEnviarRequest, accountType: 'tcr' | 'ttf' = 'ttf'): Promise<Bmp531PixEnviarResponse> {
  // ✅ SEGURO: Log sem dados sensíveis
  logger.info('Iniciando transferência PIX', {
    accountType: accountType.toUpperCase(),
    hasChave: !!data.chave,
    hasValor: !!data.valor,
    hasDescricao: !!data.descricao
  }, 'BMP531Service');
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    chave: data.chave,
    valor: data.valor,
    descricao: data.descricao,
    informacoesAdicionais: data.informacoesAdicionais,
    remittanceInformation: data.remittanceInformation,
    dadosBancarios: getDadosBancarios(accountType)
  };
  
  // ✅ SEGURO: Request sem dados sensíveis
  logger.debug('Request PIX preparado', {
    hasBody: !!requestBody,
    bodyKeys: Object.keys(requestBody),
    hasDadosBancarios: !!requestBody.dadosBancarios
  }, 'BMP531Service');
  
  // ✅ APENAS EM DESENVOLVIMENTO: Dados completos
  logger.sensitive('PIX request completo', { data, requestBody }, 'BMP531Service');
  
  return makeRequest<Bmp531PixEnviarResponse>(
    BMP531_CONFIG.endpoints.pixEnviar,
    {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }
  );
}

/**
 * 🔍 Consulta dados de uma chave PIX - BMP 531
 * ✅ Conforme documentação: GET com query parameter
 */
export async function consultarChavePixBmp531(data: Bmp531PixConsultarChaveRequest): Promise<Bmp531PixConsultarChaveResponse> {
  // ✅ SEGURO: Log sem expor chave PIX
  logger.info('Consultando chave PIX', {
    hasChave: !!data.chave,
    chaveLength: data.chave?.length || 0
  }, 'BMP531Service');
  
  // ✅ APENAS EM DESENVOLVIMENTO: Chave completa
  logger.sensitive('Chave PIX para consulta', { chave: data.chave }, 'BMP531Service');
  
  // ✅ Usar GET com query parameter conforme documentação
  const endpoint = `${BMP531_CONFIG.endpoints.pixConsultarChave}?chave=${encodeURIComponent(data.chave)}`;
  
  return makeRequest<Bmp531PixConsultarChaveResponse>(
    endpoint,
    {
      method: 'GET',
      // ✅ Incluir dados bancários no body mesmo sendo GET (conforme documentação)
      body: JSON.stringify({
        dadosBancarios: getDadosBancarios()
      })
    }
  );
}

/**
 * ➕ Cria nova chave PIX - BMP 531
 * ✅ Conforme documentação: inclui dadosBancarios automaticamente
 */
export async function criarChavePixBmp531(data: Bmp531PixChaveCriarRequest): Promise<Bmp531PixChaveCriarResponse> {
  // ✅ SEGURO: Log sem expor chave PIX
  logger.info('Criando chave PIX', {
    tipoChave: data.tipoChave,
    hasChave: !!data.chave,
    hasCodigoMfa: !!data.codigoMfa
  }, 'BMP531Service');
  
  // ✅ APENAS EM DESENVOLVIMENTO: Dados completos
  logger.sensitive('Criação de chave PIX', data, 'BMP531Service');
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    tipoChave: data.tipoChave,
    chave: data.chave,
    codigoMfa: data.codigoMfa,
    codigoAutenticacao: data.codigoAutenticacao,
    dadosBancarios: getDadosBancarios()
  };
  
  // ✅ SEGURO: Request sem dados sensíveis
  logger.debug('Request criação de chave preparado', {
    hasBody: !!requestBody,
    bodyKeys: Object.keys(requestBody)
  }, 'BMP531Service');
  
  return makeRequest<Bmp531PixChaveCriarResponse>(
    BMP531_CONFIG.endpoints.pixChavesCriar,
    {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }
  );
}

/**
 * 📝 Lista chaves PIX cadastradas - BMP 531
 * ✅ Conforme documentação: GET com dadosBancarios no body
 * @param accountType - Tipo de conta: 'tcr' ou 'ttf' (padrão: 'ttf')
 */
export async function listarChavesPixBmp531(accountType: 'tcr' | 'ttf' = 'ttf'): Promise<Bmp531PixChavesListarResponse> {

  
  // ✅ PADRONIZAR igual ao extrato: Enviar via query parameters
  const dadosBancarios = getDadosBancarios(accountType);
  const params = new URLSearchParams();
  
  // Adicionar dados bancários como query parameters
  Object.entries(dadosBancarios).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });
  
  const endpoint = `${BMP531_CONFIG.endpoints.pixChavesListar}?${params.toString()}`;

  
  return makeRequest<Bmp531PixChavesListarResponse>(
    endpoint,
    {
      method: 'GET' // ✅ GET com query parameters igual ao extrato
    }
  );
}



/**
 * 📱 Paga QR Code PIX (Copia e Cola) - BMP 531
 * ✅ Conforme documentação: pagar-copia-cola com dadosBancarios
 */
export async function pagarQrCodePixBmp531(data: {
  emv: string;
  valor?: number;
  descricao?: string;
}): Promise<Bmp531PixEnviarResponse> {

  
  // ✅ Usar endpoint correto e incluir dados bancários
  const requestBody = {
    emv: data.emv,
    valor: data.valor,
    descricao: data.descricao,
    dadosBancarios: getDadosBancarios()
  };
  
  // console.log('📱 [BMP531Service] Request body:', requestBody);
  
  return makeRequest<Bmp531PixEnviarResponse>(
    BMP531_CONFIG.endpoints.pixPagarCopiaCola,
    {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }
  );
}

/**
 * 📊 Cria QR Code Estático - BMP 531
 * ✅ Conforme documentação: qrcode/estatico com dadosBancarios
 */
export async function criarQrCodeEstaticoPixBmp531(data: {
  chave?: string;
  valor?: number;
  informacoesAdicionais?: string;
  idConciliacaoRecebedor?: string;
}): Promise<{
  sucesso: boolean;
  qrCode?: string;
  linkPagamento?: string;
  dados?: any;
  mensagem: string;
}> {
  // console.log('📊 [BMP531Service] Criando QR Code Estático...');
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    chave: data.chave, // Opcional - se omitida, usa pix_key dos dados bancários
    valor: data.valor, // Opcional - se omitido, QR de valor aberto
    informacoesAdicionais: data.informacoesAdicionais,
    idConciliacaoRecebedor: data.idConciliacaoRecebedor,
    dadosBancarios: getDadosBancarios()
  };
  
  // console.log('📊 [BMP531Service] Request body:', requestBody);
  
  return makeRequest<{
    sucesso: boolean;
    qrCode?: string;
    linkPagamento?: string;
    dados?: any;
    mensagem: string;
  }>(
    BMP531_CONFIG.endpoints.pixQrCodeEstatico,
    {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }
  );
}

/**
 * 🔍 Consulta status de transação PIX - BMP 531
 * ✅ Conforme documentação: GET /pix/status/{codigoTransacao}
 */
export async function consultarStatusTransacaoPixBmp531(codigoTransacao: string): Promise<{
  sucesso: boolean;
  codigoTransacao: string;
  status: string;
  dados?: {
    valorTransacao: number;
    dataHoraTransacao: string;
    nomeDestinatario: string;
  };
  mensagem: string;
}> {
  // console.log('🔍 [BMP531Service] Consultando status da transação...', codigoTransacao);
  
  const endpoint = `${BMP531_CONFIG.endpoints.pixStatusTransacao}/${codigoTransacao}`;
  
  return makeRequest<{
    sucesso: boolean;
    codigoTransacao: string;
    status: string;
    dados?: {
      valorTransacao: number;
      dataHoraTransacao: string;
      nomeDestinatario: string;
    };
    mensagem: string;
  }>(
    endpoint,
    {
      method: 'GET',
      // ✅ Incluir dados bancários no body mesmo sendo GET (conforme documentação)
      body: JSON.stringify({
        dadosBancarios: getDadosBancarios()
      })
    }
  );
}

// ==================== UTILITÁRIOS DE CONFIGURAÇÃO ====================

/**
 * 🔧 Obtém configuração atual dos endpoints
 */
export function getBmp531Config() {
  return { ...BMP531_CONFIG };
}

/**
 * 🔧 Atualiza configuração de timeout
 */
export function setBmp531Timeout(timeout: number) {
  (BMP531_CONFIG as any).timeout = timeout;
  // console.log(`🔧 [BMP531Service] Timeout atualizado para: ${timeout}ms`);
}

/**
 * 🔧 Obtém URL completa de um endpoint
 */
export function getBmp531EndpointUrl(endpoint: keyof typeof BMP531_CONFIG.endpoints): string {
  return `${BMP531_CONFIG.baseUrl}${BMP531_CONFIG.endpoints[endpoint]}`;
}

// ==================== EXPORT DEFAULT ====================

/**
 * Serviço principal BMP 531 com todas as funcionalidades
 * ✅ Atualizado com todos os endpoints da documentação
 * ✅ Suporte para contas TCR e TTF
 */
export const Bmp531Service = {
  // Conta - Compatibilidade (usa TTF por padrão)
  getSaldo: getBmp531Saldo,
  getExtrato: getBmp531Extrato,
  
  // Conta - Com suporte a tipos de conta
  getSaldoTCR: () => getBmp531Saldo('tcr'),
  getSaldoTTF: () => getBmp531Saldo('ttf'),
  getExtratoTCR: (filtros?: any) => getBmp531Extrato(filtros, 'tcr'),
  getExtratoTTF: (filtros?: any) => getBmp531Extrato(filtros, 'ttf'),
  
  // PIX - Operações (compatibilidade)
  enviarPix: enviarPixBmp531,
  consultarChave: consultarChavePixBmp531,
  pagarQrCode: pagarQrCodePixBmp531,
  consultarStatusTransacao: consultarStatusTransacaoPixBmp531,
  
  // PIX - Chaves (compatibilidade + específicas)
  criarChave: criarChavePixBmp531,
  listarChaves: listarChavesPixBmp531,
  listarChavesTCR: () => listarChavesPixBmp531('tcr'),
  listarChavesTTF: () => listarChavesPixBmp531('ttf'),
  
  // PIX - QR Code
  criarQrCodeEstatico: criarQrCodeEstaticoPixBmp531,
  
  // Configuração
  getConfig: getBmp531Config,
  setTimeout: setBmp531Timeout,
  getEndpointUrl: getBmp531EndpointUrl,
  getDadosBancarios: getDadosBancarios,
} as const;

export default Bmp531Service;
