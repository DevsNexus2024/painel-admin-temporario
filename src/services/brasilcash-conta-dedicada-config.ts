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
 * Saldo da conta dedicada — `GET /api/brasilcash/account/me/balance`.
 *
 * CAMINHO (backend desde 2026-09-04, `brasilcash-account.controller.ts`,
 * `enderecar()`): a rota recebe o `x-account-id` e resolve a credencial POR
 * DENTRO — conta vinculada de credencial própria (tcr_mirror_accounts, OWN) é
 * lida com a chave sintética `BCTCR:<account_ref>`, sem X-Account-Id, e a
 * resposta é conferida contra a conta pedida. Qualquer `x-otc-id` é ignorado
 * nesse caso; por isso ele NÃO é enviado aqui — não há como o header apontar
 * para outra conta.
 *
 * O que continua verdade: nunca devolver 0 no lugar de falha. Zero é um número,
 * e número errado em tela de dinheiro é pior do que falha visível. Por isso a
 * interpretação da resposta (`interpretarSaldoBrasilCash`) só produz `ok` com
 * inteiros vindos do provider; qualquer outra coisa é indisponibilidade.
 */
export type ResultadoSaldo =
  | { status: 'indisponivel'; motivo: string }
  | { status: 'ok'; disponivelCentavos: number; bloqueadoCentavos: number; futuroCentavos: number };

export function obterSaldoIndisponivel(motivo: string): ResultadoSaldo {
  const texto = (motivo ?? '').trim();
  return {
    status: 'indisponivel',
    motivo: texto || 'Não foi possível obter o saldo desta conta.',
  };
}

export interface RequisicaoSaldo {
  headers: Record<string, string>;
}

/**
 * Headers de `GET /api/brasilcash/account/me/balance`. Só `x-account-id`: a
 * conta decide a credencial no backend. Lança se a conta não estiver
 * configurada — sem `x-account-id` a rota devolve o saldo da conta DEFAULT (TCR).
 */
export function montarRequisicaoSaldo(conta: ContaDedicada): RequisicaoSaldo {
  if (!contaEstaConfigurada(conta)) {
    throw new ContaNaoConfiguradaError();
  }
  return { headers: { 'x-account-id': conta.referenciaConta.trim() } };
}

/**
 * Interpreta a resposta do saldo. A rota devolve `{ available, blocked, future }`
 * em CENTAVOS (int64, cada um "pode ser null" pela doc do provider).
 *
 * REGRA: `available` nulo ou não inteiro = indisponível (não há saldo a exibir).
 * `blocked`/`future` nulos viram 0 — são parcelas, e "sem bloqueio" é um zero
 * legítimo; mas um valor presente e não inteiro também derruba o resultado,
 * porque um número quebrado ao lado de um certo passa por saldo real.
 */
export function interpretarSaldoBrasilCash(resposta: unknown): ResultadoSaldo {
  if (!resposta || typeof resposta !== 'object') {
    return obterSaldoIndisponivel('O serviço não devolveu o saldo desta conta.');
  }
  const r = resposta as Record<string, unknown>;
  const disponivel = r.available;
  if (typeof disponivel !== 'number' || !Number.isInteger(disponivel)) {
    return obterSaldoIndisponivel('O serviço não devolveu o saldo disponível desta conta.');
  }
  const parcela = (v: unknown): number | null => {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' && Number.isInteger(v) ? v : null;
  };
  const bloqueado = parcela(r.blocked);
  const futuro = parcela(r.future);
  if (bloqueado === null || futuro === null) {
    return obterSaldoIndisponivel('O serviço devolveu um saldo em formato inesperado.');
  }
  return {
    status: 'ok',
    disponivelCentavos: disponivel,
    bloqueadoCentavos: bloqueado,
    futuroCentavos: futuro,
  };
}

// ─── Sincronização do extrato ────────────────────────────────────────────────

/** Período que a TELA oferece, em ISO `YYYY-MM-DD`. */
export interface PeriodoSync {
  startDate: string;
  endDate: string;
}

export class PeriodoDeSyncInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodoDeSyncInvalidoError';
    Object.setPrototypeOf(this, PeriodoDeSyncInvalidoError.prototype);
  }
}

/** Corpo de `POST /api/brasilcash/transactions/sync`. Espelha `SyncStatementDto`. */
export interface CorpoSyncBrasilCash {
  startDate: string;
  endDate: string;
}

export interface RequisicaoSync {
  body: CorpoSyncBrasilCash;
  headers: Record<string, string>;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Monta `POST /api/brasilcash/transactions/sync` para a conta desta tela.
 *
 * REGRA DE DINHEIRO — o sync ESCREVE (`brasilcash_transactions`), então o alvo
 * não pode ser escolhido pelo operador:
 *
 * 1. A conta vai SEMPRE em `x-account-id`, lida da config. A assinatura não
 *    aceita conta: o operador escolhe o PERÍODO, nunca a CONTA.
 * 2. `x-otc-id` NÃO é enviado. No backend a conta vinculada decide a credencial
 *    (`BCTCR:<account_ref>`) e a guarda de extrato cruzado recusa qualquer
 *    credencial que leia outra conta — mandar o header só abriria margem para
 *    apontar a credencial errada.
 * 3. A cerca de conta roda ANTES da validação de janela: conta não configurada
 *    não vira requisição, nem parcial.
 */
export function montarRequisicaoSync(conta: ContaDedicada, periodo: PeriodoSync): RequisicaoSync {
  if (!contaEstaConfigurada(conta)) {
    throw new ContaNaoConfiguradaError();
  }

  const startDate = (periodo?.startDate ?? '').trim();
  const endDate = (periodo?.endDate ?? '').trim();

  if (!startDate || !endDate) {
    throw new PeriodoDeSyncInvalidoError('Informe a data inicial e a data final do período que deseja sincronizar.');
  }
  if (!DATA_ISO.test(startDate) || !DATA_ISO.test(endDate)) {
    throw new PeriodoDeSyncInvalidoError('As datas do período precisam ser dias válidos do calendário.');
  }
  // Comparação textual: em ISO `YYYY-MM-DD` a ordem alfabética é a cronológica,
  // e assim a regra não depende de fuso — o mesmo motivo de `ehAnteriorAoVinculo`.
  if (startDate > endDate) {
    throw new PeriodoDeSyncInvalidoError('A data inicial não pode ser posterior à data final.');
  }

  return {
    body: { startDate, endDate },
    headers: { 'x-account-id': conta.referenciaConta.trim() },
  };
}

/**
 * Traduz o erro do sync para uma frase de operador. O detalhe técnico fica no
 * console; a tela recebe a frase — sem corpo de resposta, status ou tabela.
 */
export function traduzirErroDeSync(erro: unknown): string {
  if (erro instanceof PeriodoDeSyncInvalidoError || erro instanceof ContaNaoConfiguradaError) {
    return erro.message;
  }

  const bruto = erro instanceof Error ? erro.message : String(erro ?? '');

  if (/sess(ã|a)o expirou|token/i.test(bruto)) {
    return 'Sua sessão expirou. Entre novamente para sincronizar o extrato.';
  }

  const status = Number(/status:\s*(\d{3})/.exec(bruto)?.[1] ?? 0);
  if (status === 400 || status === 422) {
    return 'O período informado não foi aceito pelo serviço. Revise as datas e tente novamente.';
  }
  if (status === 401) return 'Sua sessão expirou. Entre novamente para sincronizar o extrato.';
  if (status === 403) return 'Você não tem permissão para sincronizar o extrato desta conta.';
  if (status === 404) return 'O serviço de sincronização não foi encontrado. Fale com o suporte técnico.';
  if (status === 409) {
    return 'Esta conta ainda não está pronta para sincronizar. Fale com o suporte técnico.';
  }
  if (status === 429) {
    return 'Muitas sincronizações seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (status >= 500) {
    return 'O serviço de sincronização está indisponível no momento. Tente novamente em instantes.';
  }
  return 'Não foi possível sincronizar o extrato desta conta. Tente novamente em alguns instantes.';
}

/** Resultado de `POST /api/brasilcash/transactions/sync` (só o que a tela usa). */
export interface ResultadoSync {
  success: boolean;
  statistics?: {
    created?: number;
    skipped?: number;
    feeTransactions?: number;
    errors?: number;
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
  /** TED recebida: nunca tem E2E (o BACEN só emite para PIX). */
  tedSemE2E: boolean;
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
  const metodo = String(tx.method ?? '').trim().toUpperCase();

  const transferenciaInternaSemE2E = !e2e && metodo === 'P2P' && !!pixId;

  // TED recebida (a BrasilCash passou a receber em 23/09/2026) NUNCA tem E2E: o BACEN só emite
  // endToEndId para PIX. Sem este caso, `code` saía vazio e `id` ficava com o pix_id, então
  // `extrairEndToEnd` caía no último fallback (o próprio `id`) e a cerca `id_transacao === id`
  // matava a compensação antes de chamar a API — com a mensagem enganosa de que o E2E não pôde
  // ser extraído. Mesmo tratamento da P2P: o identificador é o pix_id, único por lançamento.
  const tedSemE2E = !e2e && metodo === 'TED' && !!pixId;

  const semE2ePorNatureza = transferenciaInternaSemE2E || tedSemE2E;

  return {
    id: semE2ePorNatureza ? String(tx.id) : tx.transactionId,
    code: e2e || (semE2ePorNatureza ? pixId : ''),
    transferenciaInternaSemE2E,
    tedSemE2E,
    permitirAcoesPix: !!e2e,
  };
}
