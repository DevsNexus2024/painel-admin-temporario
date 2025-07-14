//AQUIIIIIIIIII

import { API_CONFIG, buildApiUrl, getApiHeaders } from "@/config/api";

// Tipos para o serviço PIX
export interface PixTransferRequest {
  chave: string;
  valor: number;
  descricao?: string;
}

export interface PixQRCodeRequest {
  emv: string;
  valor?: number;
  descricao?: string;
}

export interface PixCreateKeyRequest {
  tipoChave: string;
  chave?: string;
  codigoMfa?: string;
  codigoAutenticacao?: string;
}

export interface PixTransferResponse {
  sucesso: boolean;
  codigoTransacao?: string;
  status?: string;
  mensagem: string;
}

export interface PixCreateKeyResponse {
  sucesso: boolean;
  etapa: string;
  mensagem: string;
  codigoAutenticacao?: string;
  chave?: string;
  tipoChave?: string;
  mfaEnviado?: boolean;
  proximoPasso?: string;
}

export interface PixKey {
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
}

export interface PixKeysListResponse {
  sucesso: boolean;
  mensagem: string;
  total: number;
  chaves: PixKey[];
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

// Interface para consulta de chave PIX
export interface PixKeyConsultResponse {
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
  detalhesConsulta: any;
  ticket: string;
  sucesso: boolean;
  mensagem: string | null;
}

// Interface para leitura de QR code
export interface QRCodeReadResponse {
  tipoQRCode: string;
  codigoLeituraQRCode: string;
  tpQRCode: number;
  chave: string;
  reutilizavel: any;
  reutilizavelEspecificado: any;
  valor: number;
  valorEspecificado: boolean;
  documentoFederal: string;
  informacoesAdicionais: string;
  idConciliacaoRecebedor: string;
  nome: string;
  cidade: string;
  url: string | null;
  sucesso: boolean;
  mensagem: string;
}

/**
 * Envia transferência PIX por chave
 * @param data Dados da transferência (chave, valor, descrição)
 * @returns Promise com resultado da transferência
 */
export const enviarPixPorChave = async (data: PixTransferRequest): Promise<PixTransferResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.ENVIAR);
    
    console.log("Enviando requisição para:", url);
    console.log("Dados:", data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        sucesso: false,
        mensagem: mensagemErro
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao enviar PIX:", error);
    
    let mensagemErro = 'Erro desconhecido ao processar transferência PIX';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      sucesso: false,
      mensagem: mensagemErro
    };
  }
};

/**
 * Processa pagamento via QR Code/EMV
 * @param data Dados do pagamento (emv, valor opcional, descrição)
 * @returns Promise com resultado do pagamento
 */
export const pagarComQRCode = async (data: PixQRCodeRequest): Promise<PixTransferResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.PAGAR_QR);
    
    console.log("Enviando pagamento QR Code para:", url);
    console.log("Dados:", data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        sucesso: false,
        mensagem: mensagemErro
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao pagar via QR Code:", error);
    
    let mensagemErro = 'Erro desconhecido ao processar pagamento via QR Code';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      sucesso: false,
      mensagem: mensagemErro
    };
  }
};

/**
 * Valida formato de código EMV/QR Code PIX
 * @param emvCode Código EMV a ser validado
 * @returns boolean indicando se o código é válido
 */
export const validarCodigoEMV = (emvCode: string): boolean => {
  if (!emvCode || typeof emvCode !== 'string') return false;
  
  // Remover espaços em branco e quebras de linha para validação
  const cleanCode = emvCode.trim().replace(/\s+/g, '');
  
  // Validações básicas mais flexíveis para código EMV PIX:
  // 1. Deve ter pelo menos 30 caracteres após limpeza (reduzido de 50)
  // 2. Deve conter "BR.GOV.BCB.PIX" (identificador PIX) OU começar com "00020126"
  // 3. Validação de caracteres mais flexível
  
  if (cleanCode.length < 30) return false;
  
  // Deve conter identificador PIX OU começar com padrão EMV
  const hasPixIdentifier = cleanCode.includes('BR.GOV.BCB.PIX');
  const hasEmvFormat = cleanCode.startsWith('00020126');
  
  if (!hasPixIdentifier && !hasEmvFormat) return false;
  
  // Validação de caracteres mais flexível - aceita alfanuméricos e símbolos comuns
  if (!/^[a-zA-Z0-9\.\-_*\/\+\=\@\#\$\%\&\(\)\[\]\{\}\;\:\,\<\>\?\|\!\~\`\^\'\"\\]+$/.test(cleanCode)) {
    return false;
  }
  
  console.log('[EMV-VALIDATION] Código validado:', { 
    length: cleanCode.length, 
    hasPixIdentifier, 
    hasEmvFormat,
    valid: true 
  });
  
  return true;
};

/**
 * Valida formato de chave PIX
 * @param chave Chave PIX a ser validada
 * @param tipo Tipo da chave
 * @returns boolean indicando se a chave é válida
 */
export const validarChavePix = (chave: string, tipo: string): boolean => {
  if (!chave || !tipo) return false;

  switch (tipo.toLowerCase()) {
    case 'cpf':
      // Remover pontos e hífens e validar se tem 11 dígitos
      const cpfLimpo = chave.replace(/[.-]/g, '');
      return /^\d{11}$/.test(cpfLimpo);
      
    case 'cnpj':
      // Remover pontos, barras e hífens e validar se tem 14 dígitos
      const cnpjLimpo = chave.replace(/[./-]/g, '');
      return /^\d{14}$/.test(cnpjLimpo);
      
    case 'email':
      // Validação básica de email
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave);
      
    case 'telefone':
      // Telefone: remover caracteres especiais e validar formato brasileiro
      const phoneLimpo = chave.replace(/[^\d]/g, '');
      // Aceita formato: +5511999999999, 11999999999, ou 5511999999999
      return /^(\+?55)?[1-9]{2}9?[0-9]{8}$/.test(phoneLimpo);
      
    case 'aleatoria':
      // Chave aleatória: deve ter formato UUID-like
      return /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(chave);
      
    default:
      return false;
  }
};

/**
 * Formatar chave PIX conforme o tipo
 * @param chave Chave PIX bruta
 * @param tipo Tipo da chave
 * @returns Chave formatada
 */
export const formatarChavePix = (chave: string, tipo: string): string => {
  if (!chave) return '';

  switch (tipo.toLowerCase()) {
    case 'cpf':
      const cpf = chave.replace(/[^\d]/g, '');
      if (cpf.length <= 11) {
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
      return chave;
      
    case 'cnpj':
      const cnpj = chave.replace(/[^\d]/g, '');
      if (cnpj.length <= 14) {
        return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      return chave;
      
    case 'telefone':
      // Remove todos os caracteres que não são dígitos
      const phone = chave.replace(/[^\d]/g, '');
      
      // Se já tem código do país (55) e tem 13 dígitos total
      if (phone.length === 13 && phone.startsWith('55')) {
        // Formato: +55 (xx) 9xxxx-xxxx
        return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
      }
      // Se tem apenas o número local (11 dígitos)
      else if (phone.length === 11) {
        // Formato: (xx) 9xxxx-xxxx (sem código do país)
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      }
      // Se tem 10 dígitos (número fixo)
      else if (phone.length === 10) {
        // Formato: (xx) xxxx-xxxx
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      }
      // Se tem código do país + número de 10 dígitos (fixo)
      else if (phone.length === 12 && phone.startsWith('55')) {
        // Formato: +55 (xx) xxxx-xxxx
        return phone.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
      }
      
      // Se não conseguir formatar, retorna o valor original
      return chave;
      
    case 'email':
    case 'aleatoria':
    default:
      return chave;
  }
};

/**
 * Cria uma nova chave PIX
 * @param data Dados para criação da chave (tipoChave, chave, codigoMfa, codigoAutenticacao)
 * @returns Promise com resultado da criação ou solicitação de MFA
 */
export const criarChavePix = async (data: PixCreateKeyRequest): Promise<PixCreateKeyResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.CHAVES_CRIAR);
    
    console.log("Criando chave PIX para:", url);
    console.log("Dados:", data);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        sucesso: false,
        etapa: 'ERRO',
        mensagem: mensagemErro
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao criar chave PIX:", error);
    
    let mensagemErro = 'Erro desconhecido ao criar chave PIX';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      sucesso: false,
      etapa: 'ERRO',
      mensagem: mensagemErro
    };
  }
};

/**
 * Lista todas as chaves PIX da conta
 * @returns Promise com lista de chaves PIX
 */
export const listarChavesPix = async (): Promise<PixKeysListResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.CHAVES_LISTAR);
    
    console.log("Listando chaves PIX para:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        sucesso: false,
        mensagem: mensagemErro,
        total: 0,
        chaves: [],
        estatisticas: {
          totalChaves: 0,
          porTipo: {},
          porTipoPessoa: {}
        },
        contaConsultada: {
          agencia: '',
          conta: '',
          contaDigito: ''
        }
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao listar chaves PIX:", error);
    
    let mensagemErro = 'Erro desconhecido ao listar chaves PIX';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      sucesso: false,
      mensagem: mensagemErro,
      total: 0,
      chaves: [],
      estatisticas: {
        totalChaves: 0,
        porTipo: {},
        porTipoPessoa: {}
      },
      contaConsultada: {
        agencia: '',
        conta: '',
        contaDigito: ''
      }
    };
  }
};

/**
 * Remove formatação de uma chave PIX para envio à API
 * @param chave Chave PIX formatada
 * @returns Chave PIX limpa (apenas números/caracteres válidos)
 */
const limparFormatacaoChave = (chave: string): string => {
  if (!chave) return '';
  
  // Para CPF/CNPJ: remover pontos, hífens e barras
  if (chave.includes('.') || chave.includes('-') || chave.includes('/')) {
    return chave.replace(/[.\-/]/g, '');
  }
  
  // Para telefone: remover parênteses, espaços, hífens e manter apenas + e números
  if (chave.includes('(') || chave.includes(')') || chave.includes(' ')) {
    return chave.replace(/[^\d+]/g, '');
  }
  
  // Para email e chave aleatória: retornar como está
  return chave;
};

/**
 * Consulta uma chave PIX para obter informações do destinatário
 * @param chave - Chave PIX a ser consultada
 * @returns Dados do destinatário da chave
 */
export const consultarChavePix = async (chave: string): Promise<PixKeyConsultResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.CONSULTAR);
    
    // Limpar formatação da chave para envio à API
    const chaveLimpa = limparFormatacaoChave(chave);
    
    // Parâmetros para consulta (dados da conta vêm do backend via middleware)
    const queryParams = {
      'chave': chaveLimpa
    };
    
    console.log("Consultando chave PIX para:", url);
    console.log("Chave original:", chave);
    console.log("Chave limpa:", chaveLimpa);
    console.log("Parâmetros:", queryParams);
    
    // Construir query string
    const queryString = new URLSearchParams(queryParams).toString();
    const fullUrl = `${url}?${queryString}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        chave: '',
        tipoChave: 0,
        nomeCorrentista: '',
        nomeFantasia: '',
        tipoPessoa: 0,
        documentoFederal: '',
        conta: {
          conta: '',
          tipoConta: 0,
          agencia: '',
          ispb: null,
        },
        banco: {
          descricao: '',
          numero: '',
          ispb: '',
        },
        detalhesConsulta: null,
        ticket: '',
        sucesso: false,
        mensagem: mensagemErro,
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao consultar chave PIX:", error);
    
    let mensagemErro = 'Erro desconhecido ao consultar chave PIX';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      chave: '',
      tipoChave: 0,
      nomeCorrentista: '',
      nomeFantasia: '',
      tipoPessoa: 0,
      documentoFederal: '',
      conta: {
        conta: '',
        tipoConta: 0,
        agencia: '',
        ispb: null,
      },
      banco: {
        descricao: '',
        numero: '',
        ispb: '',
      },
      detalhesConsulta: null,
      ticket: '',
      sucesso: false,
      mensagem: mensagemErro,
    };
  }
};

/**
 * Lê um código QR PIX para extrair informações
 * @param emvCode - Código EMV do QR PIX
 * @returns Dados do QR code lido
 */
export const lerQRCodePix = async (emvCode: string): Promise<QRCodeReadResponse> => {
  try {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.PIX.QRCODE_LER);
    
    // Parâmetros para leitura do QR code (dados da conta vêm do backend via middleware)
    const queryParams = {
      'emv': emvCode
    };
    
    console.log("Lendo QR code PIX para:", url);
    console.log("Parâmetros:", queryParams);
    
    // Construir query string
    const queryString = new URLSearchParams(queryParams).toString();
    const fullUrl = `${url}?${queryString}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });

    console.log("Status da resposta:", response.status);
    console.log("Headers da resposta:", Object.fromEntries(response.headers.entries()));
    
    // Sempre tentar extrair o JSON primeiro, independente do status
    let result;
    try {
      result = await response.json();
      console.log("Resposta JSON da API:", JSON.stringify(result, null, 2));
    } catch (jsonError) {
      console.error("Erro ao fazer parse do JSON:", jsonError);
      
      // Tentar obter o texto da resposta para logs mais detalhados
      try {
        const textResponse = await response.text();
        console.log("Resposta como texto:", textResponse);
      } catch (textError) {
        console.error("Erro ao obter resposta como texto:", textError);
      }
      
      // Se não conseguir fazer parse do JSON, retorna erro genérico
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    // Se não ok, mas temos JSON válido, usar a mensagem do backend
    if (!response.ok) {
      console.log("Resposta não OK. Extraindo mensagem de erro...");
      
      // Tentar extrair a mensagem de erro de diferentes formatos possíveis
      let mensagemErro = '';
      
      // Formato 1: {mensagem: "erro"}
      if (result.mensagem) {
        mensagemErro = result.mensagem;
      }
      // Formato 2: {message: "erro"}  
      else if (result.message) {
        mensagemErro = result.message;
      }
      // Formato 3: {error: "erro"}
      else if (result.error) {
        mensagemErro = result.error;
      }
      // Formato 4: {errorMessage: "erro"}
      else if (result.errorMessage) {
        mensagemErro = result.errorMessage;
      }
      // Formato 5: {response: {message: "erro"}}
      else if (result.response && result.response.message) {
        mensagemErro = result.response.message;
      }
      // Formato 6: {response: {mensagem: "erro"}}
      else if (result.response && result.response.mensagem) {
        mensagemErro = result.response.mensagem;
      }
      // Formato 7: {data: {message: "erro"}}
      else if (result.data && result.data.message) {
        mensagemErro = result.data.message;
      }
      // Formato 8: {data: {mensagem: "erro"}}
      else if (result.data && result.data.mensagem) {
        mensagemErro = result.data.mensagem;
      }
      // Fallback: se a resposta inteira é uma string
      else if (typeof result === 'string') {
        mensagemErro = result;
      }
      // Último fallback: erro genérico
      else {
        mensagemErro = `Erro HTTP ${response.status}: ${response.statusText}`;
      }
      
      console.log("Mensagem de erro extraída:", mensagemErro);
      
      return {
        tipoQRCode: '',
        codigoLeituraQRCode: '',
        tpQRCode: 0,
        chave: '',
        reutilizavel: null,
        reutilizavelEspecificado: null,
        valor: 0,
        valorEspecificado: false,
        documentoFederal: '',
        informacoesAdicionais: '',
        idConciliacaoRecebedor: '',
        nome: '',
        cidade: '',
        url: null,
        sucesso: false,
        mensagem: mensagemErro,
      };
    }

    // Se tudo ok, retornar resultado
    console.log("Resposta de sucesso. Resultado:", result);
    return result;
  } catch (error) {
    console.error("Erro ao ler QR code PIX:", error);
    
    let mensagemErro = 'Erro desconhecido ao ler QR code PIX';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        mensagemErro = 'Timeout: A requisição demorou muito para responder';
      } else if (error.message.includes('fetch')) {
        mensagemErro = 'Erro de conexão: Verifique sua internet ou se o servidor está disponível';
      } else {
        mensagemErro = error.message;
      }
    }
    
    console.log("Mensagem de erro final (catch):", mensagemErro);
    
    // Retorna resposta de erro padronizada
    return {
      tipoQRCode: '',
      codigoLeituraQRCode: '',
      tpQRCode: 0,
      chave: '',
      reutilizavel: null,
      reutilizavelEspecificado: null,
      valor: 0,
      valorEspecificado: false,
      documentoFederal: '',
      informacoesAdicionais: '',
      idConciliacaoRecebedor: '',
      nome: '',
      cidade: '',
      url: null,
      sucesso: false,
      mensagem: mensagemErro,
    };
  }
}; 