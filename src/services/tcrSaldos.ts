import { toast } from "sonner";

const BASE_URL = 'https://vps80270.cloudpublic.com.br:8081';
const AUTH_HEADER = 'ISRVdeWTZ5jYFKJQytjH9ZylF1ZrwhTdrrdKY4uFqXm041XIL3aVjCwojSH1EeYbUOQjPx0aO';

export interface UsuarioSaldo {
  id_usuario: number;
  nome: string;
  id_brasil_bitcoin: string;
  saldos: {
    BRL: number;
    USDT: number;
  };
}

export interface Paginacao {
  pagina_atual: number;
  por_pagina: number;
  total_usuarios: number;
  total_paginas: number;
}

export interface UsuariosSaldosResponse {
  mensagem: string;
  response: {
    usuarios: UsuarioSaldo[];
    paginacao: Paginacao;
  };
}

export interface SaldoBrbtc {
  BRL: { available: number; total: number };
  USDT: { available: number; total: number };
}

export interface SaldoPublicoResponse {
  mensagem: string;
  response: {
    data: SaldoBrbtc;
  };
}

export type UsuariosSaldosQuery = Partial<{
  pagina: number;
  por_pagina: number;
  nome: string;
  id_usuario: number;
  id_whitelabel: number;
}>;

export class TcrSaldosService {
  static async listarUsuariosSaldos(params: UsuariosSaldosQuery = {}): Promise<UsuariosSaldosResponse> {
    try {
      // Usar URLSearchParams diretamente para construir a query string
      const searchParams = new URLSearchParams();
      
      // Parâmetros de paginação (obrigatórios para a API)
      searchParams.append('pagina', String(params.pagina || 1));
      searchParams.append('por_pagina', String(params.por_pagina || 50));
      
      // Adicionar apenas parâmetros opcionais válidos e não vazios
      if (params.nome && params.nome.trim()) {
        searchParams.append('nome', params.nome.trim());
      }
      if (params.id_usuario && params.id_usuario > 0) {
        searchParams.append('id_usuario', String(params.id_usuario));
      }
      if (params.id_whitelabel && params.id_whitelabel > 0) {
        searchParams.append('id_whitelabel', String(params.id_whitelabel));
      }
      
      // Construir URL final
      const queryString = searchParams.toString();
      const fullUrl = queryString 
        ? `${BASE_URL}/v1/usuarios/saldos-publico?${queryString}`
        : `${BASE_URL}/v1/usuarios/saldos-publico`;

      console.log('🔍 [TCR-SALDOS] Fazendo requisição para:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'xPassRouteTCR': AUTH_HEADER,
        },
        signal: AbortSignal.timeout(30000)
      });

      const data = await response.json();
      console.log('📦 [TCR-SALDOS] Resposta recebida:', data);

      if (!response.ok) {
        console.error('❌ [TCR-SALDOS] Erro HTTP:', response.status, data);
        throw new Error(data?.erro || data?.mensagem || `Erro HTTP ${response.status}`);
      }
      
      return data as UsuariosSaldosResponse;
    } catch (error) {
      console.error('❌ [TCR-SALDOS] Erro ao listar usuários/saldos:', error);
      throw error;
    }
  }

  static async consultarSaldoBrbtc(contaBRBTC: string): Promise<SaldoPublicoResponse> {
    if (!contaBRBTC) {
      const msg = 'Conta BRBTC (id_brasil_bitcoin) não informada';
      toast.error('Conferência inválida', { description: msg });
      throw new Error(msg);
    }

    try {
      console.log('🔍 [TCR-SALDOS] Consultando saldo BRBTC para conta:', contaBRBTC);
      
      const response = await fetch(`${BASE_URL}/brbtc/v1/saldo-publico`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'xPassRouteTCR': AUTH_HEADER,
          'brbtc-from-account': contaBRBTC, // Usar minúsculo para evitar problemas de CORS
        },
        signal: AbortSignal.timeout(30000)
      });

      console.log('📦 [TCR-SALDOS] Status da resposta:', response.status);
      const data = await response.json();
      console.log('📦 [TCR-SALDOS] Dados da conferência:', data);

      if (!response.ok) {
        console.error('❌ [TCR-SALDOS] Erro HTTP na conferência:', response.status, data);
        throw new Error(data?.erro || data?.mensagem || `Erro HTTP ${response.status}`);
      }
      
      return data as SaldoPublicoResponse;
    } catch (error) {
      console.error('❌ [TCR-SALDOS] Erro ao consultar saldo público BRBTC:', error);
      throw error;
    }
  }
}

export type SaldosComparacao = {
  brl: { local: number; externo: number; diferenca: number };
  usdt: { local: number; externo: number; diferenca: number };
};

export const compararSaldos = (usuario: UsuarioSaldo, externo: SaldoBrbtc): SaldosComparacao => {
  const toFixedNum = (n: number, decimals: number) => Number(n.toFixed(decimals));

  const localBRL = Number(usuario.saldos?.BRL || 0);
  const localUSDT = Number(usuario.saldos?.USDT || 0);

  const externoBRL = Number(externo?.BRL?.available ?? externo?.BRL?.total ?? 0);
  const externoUSDT = Number(externo?.USDT?.available ?? externo?.USDT?.total ?? 0);

  // BRL com 2 casas, USDT com 8
  const brlDiff = toFixedNum(localBRL - externoBRL, 2);
  const usdtDiff = toFixedNum(localUSDT - externoUSDT, 8);

  return {
    brl: { local: toFixedNum(localBRL, 2), externo: toFixedNum(externoBRL, 2), diferenca: brlDiff },
    usdt: { local: toFixedNum(localUSDT, 8), externo: toFixedNum(externoUSDT, 8), diferenca: usdtDiff },
  };
};


