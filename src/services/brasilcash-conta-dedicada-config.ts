/**
 * Configuração da conta BrasilCash DEDICADA de cliente (tela /brasilcash-conta-dedicada).
 *
 * PORQUÊ este arquivo não importa nada: as funções abaixo carregam a regra de
 * dinheiro da tela (qual conta é consultada) e precisam ser verificáveis
 * isoladamente. O projeto não tem runner de teste, então o único jeito de provar
 * a regra sem adicionar dependência é compilar ESTE arquivo sozinho e exercitá-lo.
 * Não adicione import aqui.
 */

/** Conta dedicada endereçada pela tela. */
export interface ContaDedicada {
  /**
   * Identificador da conta COMO ELE CHEGA NO WEBHOOK da BrasilCash — é esse
   * valor que vira `brasilcash_transactions.account_id` no backend e que a rota
   * `GET /api/brasilcash/transactions?accountId=` resolve.
   *
   * ⚠️ NÃO é necessariamente um UUID: contas dedicadas do tipo TCR-mirror chegam
   * com o NÚMERO da conta (ex.: '6440869'). Preencha com o que o webhook manda,
   * não com o que parece mais bonito.
   */
  referenciaConta: string;
  /**
   * Balde `otc_id` em que as transações desta conta são gravadas.
   *
   * Vazio = balde DEFAULT (o backend filtra `otc_id IS NULL OR otc_id='DEFAULT'`),
   * que é o caso quando o webhook da conta chega com o token da conta-mãe.
   * Preencha SOMENTE se a conta grava em balde próprio — mandar o valor errado
   * devolve extrato vazio em silêncio, que é pior do que erro.
   */
  otcId: string;
  /**
   * Nome do CLIENTE dono do saldo — é ele que o suporte atende.
   *
   * ⚠️ NÃO é o titular bancário: nesta conta as duas pessoas são diferentes por
   * desenho (sub-conta da TTF vinculada a um cliente). Vazio = rótulo neutro;
   * o titular NUNCA entra aqui, senão a tela sugere que ele é o dono do dinheiro.
   */
  nomeExibicao: string;
  /** Titular BANCÁRIO da conta. Dado da conta, não dono do saldo. */
  titular: { razaoSocial: string; numeroConta: string; agencia: string };
  /**
   * Data do vínculo conta→cliente (YYYY-MM-DD). Movimento anterior a ela existiu
   * na conta mas NÃO é do cliente. Vazio desliga a marcação.
   */
  vinculadoEm: string;
}

/**
 * Conta dedicada do cliente — BrasilCash 2563738 (linha id=9 de brasilcash_accounts).
 *
 * `otcId` VAZIO é medido, não chutado: no dump de 2026-08-04 a linha desta conta
 * traz `otc_id='DEFAULT'`, o mesmo balde da conta da TCR. Logo a separação entre
 * as duas é feita SÓ pelo `brasilcash_account_id`, e mandar `x-otc-id` aqui
 * devolveria lista vazia em silêncio.
 *
 * `nomeExibicao` é o CLIENTE (NEW ZONE) — dono do saldo no ledger da TCR e quem o
 * suporte atende. `titular` é a empresa no nome da conta bancária (TTF). São
 * entidades DIFERENTES e a tela precisa manter as duas visíveis e separadas:
 * confundi-las faz o suporte atribuir o dinheiro à pessoa errada.
 */
export const CONTA_DEDICADA_BRASILCASH: ContaDedicada = {
  referenciaConta: 'f651bc06-563c-4b4b-9ab0-1f44d4259b4e',
  otcId: '',
  nomeExibicao: 'NEW ZONE',
  titular: { razaoSocial: 'TTF SERVIÇOS DIGITAIS LTDA', numeroConta: '2563738', agencia: '1' },
  vinculadoEm: '2026-08-23',
};

/**
 * Rótulo da tela. Identifica o CLIENTE.
 *
 * Nunca cai no titular bancário: nesta conta ele não é o dono do saldo, e
 * exibi-lo como título da tela faria o suporte atribuir o dinheiro à pessoa errada.
 */
export function rotuloConta(conta: ContaDedicada): string {
  const nome = conta.nomeExibicao.trim();
  if (nome) return nome;
  const ref = conta.referenciaConta.trim();
  return ref ? 'Conta dedicada (cliente não identificado)' : 'Conta não configurada';
}

/**
 * A transação é anterior ao vínculo conta→cliente?
 *
 * Compara só a parte YYYY-MM-DD, em texto. PORQUÊ não fazer aritmética de data:
 * o backend grava `created_at` com deslocamentos manuais de fuso
 * (`DATE_SUB(NOW(), INTERVAL 4 HOUR)`) e o front trata o sufixo 'Z' como hora
 * local. Comparar instantes aqui daria uma precisão que o dado não tem.
 *
 * O próprio dia do vínculo conta como NÃO anterior — é a fronteira ambígua, e
 * marcar a favor do cliente evita acusar de alheio o que talvez seja dele.
 */
export function ehAnteriorAoVinculo(dataISO: string, vinculadoEm: string): boolean {
  const corte = (vinculadoEm ?? '').trim();
  const data = (dataISO ?? '').trim();
  if (corte.length < 10 || data.length < 10) return false;
  return data.slice(0, 10) < corte.slice(0, 10);
}

/** Erro de configuração ausente. Existe para o chamador não confundir com erro de rede. */
export class ContaNaoConfiguradaError extends Error {
  constructor() {
    super(
      'A conta desta tela ainda não foi configurada. Fale com o suporte técnico para liberá-la.',
    );
    this.name = 'ContaNaoConfiguradaError';
    // Sem isto, `instanceof` quebra quando o TS compila para ES5.
    Object.setPrototypeOf(this, ContaNaoConfiguradaError.prototype);
  }
}

export function contaEstaConfigurada(conta: ContaDedicada): boolean {
  return conta.referenciaConta.trim().length > 0;
}

/** Filtros aceitos pelo extrato. Espelha o contrato da rota, sem importar o tipo. */
export interface FiltrosExtrato {
  accountId?: string;
  endToEndId?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  status?: string;
  method?: string;
  type?: string;
  external_id?: string;
  limit?: number;
  offset?: number;
}

export interface RequisicaoExtrato {
  params: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * Monta query e headers de conta para `GET /api/brasilcash/transactions`.
 *
 * REGRA DE DINHEIRO — lança quando a conta não está configurada, em vez de
 * devolver uma requisição sem `accountId`. O serviço compartilhado
 * (`brasilcash-realtime.ts`, `getTransactions`) faz `filters?.accountId ||
 * TCR_ACCOUNT_ID`: uma requisição sem conta viraria o EXTRATO DA TCR exibido sob
 * o nome do cliente. Por isso a conta configurada também sobrescreve qualquer
 * `accountId` que venha nos filtros — esta tela consulta uma conta só.
 */
export function montarRequisicaoExtrato(
  conta: ContaDedicada,
  filtros: FiltrosExtrato,
): RequisicaoExtrato {
  if (!contaEstaConfigurada(conta)) {
    throw new ContaNaoConfiguradaError();
  }

  const params: Record<string, string> = {
    accountId: conta.referenciaConta.trim(),
  };

  if (filtros.endToEndId) params.endToEndId = filtros.endToEndId;
  if (filtros.startDate) params.startDate = filtros.startDate;
  if (filtros.endDate) params.endDate = filtros.endDate;
  if (filtros.amount !== undefined) params.amount = String(filtros.amount);
  if (filtros.status) params.status = filtros.status;
  if (filtros.method) params.method = filtros.method;
  if (filtros.type) params.type = filtros.type;
  if (filtros.external_id) params.external_id = filtros.external_id;
  if (filtros.limit !== undefined) params.limit = String(Math.min(filtros.limit, 2000));
  if (filtros.offset !== undefined) params.offset = String(filtros.offset);

  const headers: Record<string, string> = {};
  const otc = conta.otcId.trim();
  if (otc) headers['x-otc-id'] = otc;

  return { params, headers };
}

/**
 * Saldo da conta dedicada.
 *
 * NÃO HÁ CAMINHO hoje — medido no backend em 2026-08-27, os três eixos estão fechados:
 *  - `x-otc-id` com valor novo → o switch de credenciais é fechado
 *    (DEFAULT/7802755/1715917/TTF/RXP) e lança;
 *  - `x-otc-id: BCTCR:<slot>` → barrado pelo regex do header (o ':' não passa);
 *  - `X-Account-Id` → o serviço HTTP de BaaS APAGA o header justamente no caminho
 *    que precisaria dele, e a checagem de identidade é pulada quando o header
 *    existe. Resultado: devolveria o saldo da conta-mãe (TCR) em silêncio.
 *
 * Por isso esta função devolve indisponibilidade em vez de um número. É o ponto
 * de integração para quando houver caminho: trocar o corpo daqui e o card passa
 * a exibir valor. Nunca devolver 0 — zero é um número, e número errado em tela
 * de dinheiro é pior do que falha visível.
 */
export type ResultadoSaldo =
  | { status: 'indisponivel'; motivo: string }
  | { status: 'ok'; disponivelCentavos: number; bloqueadoCentavos: number; futuroCentavos: number };

export function obterSaldoContaDedicada(conta: ContaDedicada): ResultadoSaldo {
  if (!contaEstaConfigurada(conta)) {
    return {
      status: 'indisponivel',
      motivo: 'A conta desta tela ainda não foi configurada.',
    };
  }
  return {
    status: 'indisponivel',
    motivo: 'Não foi possível obter o saldo desta conta.',
  };
}

/** Campos da transação usados para identificar a compensação. */
export interface TransacaoParaCompensacao {
  /** `id` da linha em brasilcash_transactions. */
  id: number | string;
  /** `pix_id` — único por perna da transferência. */
  transactionId: string;
  /** `end_to_end_id`; string vazia quando o banco gravou NULL. */
  endToEndId: string;
  /**
   * Tipo cru da BrasilCash ('dict', 'manual', 'staticQrcode', 'P2P'…).
   *
   * ⚠️ Chama-se `method` por causa do mapper compartilhado
   * (`brasilcash-realtime.ts:367`, `method: tx.type || 'pix'`), que joga o campo
   * `type` da API neste nome. NÃO é cashin/cashout — isso é o campo `type`.
   */
  method: string;
}

export interface IdentificacaoCompensacao {
  /** Vai no campo `id` do MovimentoExtrato. */
  id: string;
  /** Vai no campo `code` — vira `id_transacao` na compensação. */
  code: string;
  /** Transferência interna BrasilCash sem E2E. */
  transferenciaInternaSemE2E: boolean;
  /** Libera Devolver/Bloquear PIX no modal. */
  permitirAcoesPix: boolean;
}

/**
 * Identificação da compensação — port do fix `364c7a6` da tela TCR.
 *
 * Transferência interna (P2P) NÃO tem E2E: a sync grava `end_to_end_id` NULL,
 * porque o `trace_id` da API é um hex compartilhado pelas duas pernas, não um
 * E2E. Sem tratamento, a compensação manual dessas linhas é barrada antes de
 * chamar a API. Usa-se então o `pix_id` (único por perna) como `id_transacao`, e
 * o `id` da linha como `id` do registro — assim a validação do serviço
 * (`id_transacao !== id`) segue barrando só registro sem identificador.
 *
 * PORQUÊ isto importa MAIS nesta tela do que na TCR: a conta desta tela recebe
 * de muitos terceiros, então transferência interna é caso corriqueiro aqui.
 *
 * Devolver/bloquear PIX só fazem sentido com E2E real — sem ele, o `code` é um
 * pix_id e as ações postariam um identificador que o PIX não reconhece.
 */
export function montarIdentificacaoCompensacao(
  tx: TransacaoParaCompensacao,
): IdentificacaoCompensacao {
  const e2e = (tx.endToEndId ?? '').trim();
  const pixId = (tx.transactionId ?? '').trim();

  const transferenciaInternaSemE2E = !e2e && tx.method === 'P2P' && !!pixId;

  return {
    id: transferenciaInternaSemE2E ? String(tx.id) : tx.transactionId,
    code: e2e || (transferenciaInternaSemE2E ? pixId : ''),
    transferenciaInternaSemE2E,
    permitirAcoesPix: !!e2e,
  };
}
