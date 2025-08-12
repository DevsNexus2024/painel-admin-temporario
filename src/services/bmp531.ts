/**
 * 🏦 BMP 531 Service
 * Serviço centralizado para todas as APIs do Banco Master BMP 531
 * 
 * ✅ ISOLAMENTO TOTAL: Este serviço só faz chamadas para BMP 531
 * ❌ JAMAIS misturar com outros provedores (Bitso, BMP padrão, etc.)
 */

import { API_CONFIG } from "@/config/api";

// ==================== CONFIGURAÇÕES ====================

/**
 * Configuração centralizada de endpoints BMP 531
 * ✅ Usando variáveis de ambiente e documentação oficial
 */
const BMP531_CONFIG = {
  // 🌐 URL base da API do Grupo Nexus
  baseUrl: 'https://api-bank.gruponexus.com.br',
  
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
  
  // 🔑 Dados bancários das variáveis de ambiente (Frontend - import.meta.env)
  dadosBancarios: {
    agencia: import.meta.env.VITE_AG_BMP_531_TCR || '0001',
    agencia_digito: import.meta.env.VITE_AG_DG_BMP_531_TCR || '8',
    conta: import.meta.env.VITE_CONTA_BMP_531_TCR || '157',
    conta_digito: import.meta.env.VITE_CONTA_DG_BMP_531_TCR || '8',
    conta_pgto: `0000${import.meta.env.VITE_CONTA_BMP_531_TCR || '157'}${import.meta.env.VITE_CONTA_DG_BMP_531_TCR || '8'}`, // Formatação: 00001578
    tipo_conta: parseInt(import.meta.env.VITE_TIPO_BMP_531_TCR || '3'),
    modelo_conta: parseInt(import.meta.env.VITE_MODELO_BMP_531_TCR || '1'),
    pix_key: import.meta.env.VITE_CHAVE_BMP_531_TCR || 'ca3d35ae-bfb2-409e-9892-53fadd15f4ad'
  },
  
  // 🔐 Token de autenticação
  secretToken: import.meta.env.VITE_X_BMP531_SECRET_TOKEN || 'a7f8d9c2e4b6a1f3e8d7c9b2f5a8e1d4c7b9f2e5a8d1c4f7b9e2d5a8c1f4e7b9d2',
  
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
 * Obtém headers padrão com token de autenticação BMP 531
 */
function getAuthHeaders(): HeadersInit {
  return {
    ...BMP531_CONFIG.defaultHeaders,
    'X_BMP531_SECRET_TOKEN': BMP531_CONFIG.secretToken,
  };
}

/**
 * Obtém dados bancários das variáveis de ambiente
 */
function getDadosBancarios() {
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
  
  console.log(`🏦 [BMP531Service] ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(BMP531_CONFIG.timeout)
    });

    console.log(`🏦 [BMP531Service] Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [BMP531Service] Erro ${response.status}:`, errorText);
      
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ [BMP531Service] Resposta recebida:`, data);
    
    return data;
    
  } catch (error: any) {
    console.error(`❌ [BMP531Service] Erro na requisição:`, error);
    
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
 */
export async function getBmp531Saldo(): Promise<Bmp531SaldoResponse> {
  console.log('💰 [BMP531Service] Consultando saldo...');
  
  return makeRequest<Bmp531SaldoResponse>(
    BMP531_CONFIG.endpoints.saldo,
    { method: 'GET' }
  );
}

/**
 * 📋 Consulta extrato da conta BMP 531
 * ✅ Sem limite de registros - busca todos os dados disponíveis
 * ✅ Suporte à paginação igual ao gerenciador de contas original
 */
export async function getBmp531Extrato(filtros?: {
  de?: string;
  ate?: string;
  cursor?: number;
}): Promise<Bmp531ExtratoResponse> {
  console.log('📋 [BMP531Service] Consultando extrato BMP-531...');
  
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
  
  const resultado = await makeRequest<Bmp531ExtratoResponse>(
    endpoint,
    { method: 'GET' }
  );
  
  console.log(`✅ [BMP531Service] ${resultado?.items?.length || 0} registros carregados`);
  
  return resultado;
}

// ==================== SERVIÇOS PIX ====================

/**
 * 💸 Envia PIX por chave - BMP 531
 * ✅ Conforme documentação: inclui dadosBancarios automaticamente
 */
export async function enviarPixBmp531(data: Bmp531PixEnviarRequest): Promise<Bmp531PixEnviarResponse> {
  console.log('💸 [BMP531Service] Enviando PIX...', { 
    chave: data.chave, 
    valor: data.valor,
    descricao: data.descricao 
  });
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    chave: data.chave,
    valor: data.valor,
    descricao: data.descricao,
    informacoesAdicionais: data.informacoesAdicionais,
    remittanceInformation: data.remittanceInformation,
    dadosBancarios: getDadosBancarios()
  };
  
  console.log('💸 [BMP531Service] Request body:', requestBody);
  
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
  console.log('🔍 [BMP531Service] Consultando chave PIX...', data.chave);
  
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
  console.log('➕ [BMP531Service] Criando chave PIX...', { 
    tipoChave: data.tipoChave,
    chave: data.chave 
  });
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    tipoChave: data.tipoChave,
    chave: data.chave,
    codigoMfa: data.codigoMfa,
    codigoAutenticacao: data.codigoAutenticacao,
    dadosBancarios: getDadosBancarios()
  };
  
  console.log('➕ [BMP531Service] Request body:', requestBody);
  
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
 */
export async function listarChavesPixBmp531(): Promise<Bmp531PixChavesListarResponse> {
  console.log('📝 [BMP531Service] Listando chaves PIX...');
  
  // ✅ Para GET requests, dados bancários devem ir como query parameters
  const dadosBancarios = getDadosBancarios();
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
      method: 'GET'
      // ✅ Sem body para GET requests
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
  console.log('📱 [BMP531Service] Pagando QR Code PIX (Copia e Cola)...', { 
    emv: data.emv.substring(0, 50) + '...', 
    valor: data.valor 
  });
  
  // ✅ Usar endpoint correto e incluir dados bancários
  const requestBody = {
    emv: data.emv,
    valor: data.valor,
    descricao: data.descricao,
    dadosBancarios: getDadosBancarios()
  };
  
  console.log('📱 [BMP531Service] Request body:', requestBody);
  
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
  console.log('📊 [BMP531Service] Criando QR Code Estático...', { 
    chave: data.chave,
    valor: data.valor 
  });
  
  // ✅ Incluir dados bancários conforme documentação
  const requestBody = {
    chave: data.chave, // Opcional - se omitida, usa pix_key dos dados bancários
    valor: data.valor, // Opcional - se omitido, QR de valor aberto
    informacoesAdicionais: data.informacoesAdicionais,
    idConciliacaoRecebedor: data.idConciliacaoRecebedor,
    dadosBancarios: getDadosBancarios()
  };
  
  console.log('📊 [BMP531Service] Request body:', requestBody);
  
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
  console.log('🔍 [BMP531Service] Consultando status da transação...', codigoTransacao);
  
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
  console.log(`🔧 [BMP531Service] Timeout atualizado para: ${timeout}ms`);
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
 */
export const Bmp531Service = {
  // Conta
  getSaldo: getBmp531Saldo,
  getExtrato: getBmp531Extrato,
  
  // PIX - Operações
  enviarPix: enviarPixBmp531,
  consultarChave: consultarChavePixBmp531,
  pagarQrCode: pagarQrCodePixBmp531,
  consultarStatusTransacao: consultarStatusTransacaoPixBmp531,
  
  // PIX - Chaves
  criarChave: criarChavePixBmp531,
  listarChaves: listarChavesPixBmp531,
  
  // PIX - QR Code
  criarQrCodeEstatico: criarQrCodeEstaticoPixBmp531,
  
  // Configuração
  getConfig: getBmp531Config,
  setTimeout: setBmp531Timeout,
  getEndpointUrl: getBmp531EndpointUrl,
  getDadosBancarios: getDadosBancarios,
} as const;

export default Bmp531Service;
