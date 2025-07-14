
export interface TcrDeposit {
  id: number;
  documento_bb_colaborador: string | null;
  nome_bb_colaborador: string | null;
  wallet_address: string | null;
  hash: string | null;
  comprovante_hash: string | null;
  id_externo_bb: number;
  status_nome: string;
  status_codigo_referencia: string;
  quantia: string;
  data: string;
  rede_nome: string | null;
  moeda_nome: string;
  moeda_sigla: string;
  moeda_logo: string;
  moeda_is_cripto: number;
  usuario_email: string;
  usuario_nome: string;
}

export interface TcrResponse {
  mensagem: string;
  response: {
    id_usuario: number;
    usuario_email: string;
    id_bbc_usuario: string;
    itens_total: number;
    paginas_total: number;
    pagina_atual: number;
    proxima_pagina: number;
    por_pagina: number;
    depositos: TcrDeposit[];
  };
}

export interface ExternalDeposit {
  id: number;
  value: string;
  coin: string;
  bank: string;
  status: string;
  timestamp: number;
  userDocument: string;
  fromDocument: string;
  fromName: string;
}

export interface ComparisonResult {
  tcrDeposit: TcrDeposit | null;
  externalDeposit: ExternalDeposit;
  status: 'matched' | 'not_found' | 'mismatch';
}
