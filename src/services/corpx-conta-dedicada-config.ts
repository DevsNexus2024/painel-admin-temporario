/**
 * Configuração da conta CorpX DEDICADA do Edition (tela /corpx-conta-dedicada).
 *
 * PORQUÊ este arquivo não importa nada: as funções abaixo carregam a regra de
 * dinheiro da tela — qual conta é consultada — e precisam ser verificáveis
 * isoladamente. O projeto não tem runner de teste, então o único jeito de provar
 * a regra sem adicionar dependência é compilar ESTE arquivo sozinho e exercitá-lo
 * (ver `corpx-conta-dedicada-config.test-verificador.ts`). Não adicione import aqui.
 */

/**
 * Conta dedicada endereçada pela tela.
 *
 * ⚠️ ESTA CONTA TEM QUATRO IDENTIFICADORES. Eles aparecem juntos na documentação
 * e no código, e são intercambiáveis para um humano — não para o backend. Cada
 * campo abaixo diz explicitamente ONDE o valor entra, porque trocar um pelo outro
 * não dá erro de compilação e nem sempre dá erro de runtime.
 */
export interface ContaDedicadaCorpX {
  /**
   * O id que endereça o EXTRATO: `corpx_transactions.corpx_account_id`. É este,
   * e somente este, que vai em `GET /api/corpx/transactions?accountId=`.
   *
   * ⚠️ NÃO é o UUID do mirror, NÃO é o CNPJ, NÃO é o alias. Ver
   * `IDS_DE_EXTRATO_PERMITIDOS` para o porquê de a troca ser silenciosa.
   */
  idExtrato: string;
  /**
   * Alias da conta no header `x-corpx-account-context` do SALDO
   * (`GET /api/corpx-v2/balance`). É outro vocabulário: o saldo não conhece o
   * `idExtrato`, e o extrato não conhece o alias.
   */
  aliasSaldo: string;
  /**
   * `accountRef` do espelho (`tcr_mirror_accounts`). Guardado para diagnóstico e
   * para a cerca conseguir dizer QUAL identificador foi passado por engano.
   * Não endereça nem extrato nem saldo.
   */
  accountRefMirror: string;
  /**
   * CNPJ da empresa. Guardado para diagnóstico — e porque é o identificador
   * PERIGOSO: ver `IDS_DE_EXTRATO_PERMITIDOS`.
   */
  cnpj: string;
  /**
   * Nome do CLIENTE dono do saldo — é ele que o suporte atende.
   *
   * ⚠️ NÃO é o titular bancário. Vazio = rótulo neutro; o titular NUNCA entra
   * aqui, senão a tela sugere que ele é o dono do dinheiro.
   */
  nomeExibicao: string;
  /**
   * Titular BANCÁRIO da conta. Dado da conta, não dono do saldo.
   *
   * Campos vazios = PENDENTE (não medido nesta fase). A tela rotula como
   * pendente em vez de repetir o nome do cliente aqui: são entidades diferentes,
   * e fundi-las faz o suporte atribuir o dinheiro à pessoa errada.
   */
  titular: { razaoSocial: string; numeroConta: string; agencia: string };
  /**
   * Data do vínculo conta→cliente (YYYY-MM-DD). Movimento anterior a ela existiu
   * na conta mas NÃO é do cliente. Vazio DESLIGA a marcação.
   */
  vinculadoEm: string;
  /**
   * Documento que endereça o SYNC (`POST /api/corpx/sync`), no corpo, como
   * `taxDocument`. É o CNPJ — e aqui ele é o identificador LEGÍTIMO.
   *
   * ⚠️ CAMPO PRÓPRIO, DE PROPÓSITO — não reusa `idExtrato` nem `cnpj`.
   * O sync e o extrato são vocabulários OPOSTOS sobre a mesma conta: o extrato é
   * endereçado por `51807` e RECUSA o CNPJ; o sync é endereçado pelo CNPJ e
   * RECUSA o `51807`. Um campo compartilhado entre os dois seria o caminho para
   * a troca silenciosa que `DOCUMENTOS_DE_SYNC_PERMITIDOS` existe para travar.
   */
  documentoParaSync: string;
}

/**
 * 🔴 ALLOWLIST DOS IDS QUE PODEM ENDEREÇAR O EXTRATO — a cerca desta tela.
 *
 * PORQUÊ uma allowlist por igualdade, e não uma validação estrutural:
 *
 * O backend (`corpx.service.ts`) converte o `accountId` recebido com `BigInt()`.
 * Dos quatro identificadores desta conta:
 *  - o UUID `1ac33d8a-…`     → `BigInt()` lança → 400. Falha VISÍVEL, tudo bem.
 *  - o alias `EDITION`       → `BigInt()` lança → 400. Falha VISÍVEL, tudo bem.
 *  - o CNPJ `61504259000164` → **`BigInt()` ACEITA**, porque é numérico. Vira
 *    `corpx_account_id: 61504259000164n`, casa ZERO linha, e a rota devolve 200
 *    com lista vazia. O operador vê "nenhuma transação" e conclui que a conta
 *    não movimentou.
 *
 * Ou seja: "o identificador é numérico" NÃO é validação — é exatamente o teste
 * que o caso perigoso passa. Por isso a cerca é igualdade contra uma lista
 * fechada, e não `typeof`, regex de dígitos, comprimento, `includes` ou
 * `startsWith` (`'051807'` e `'518070'` são outra conta, ou nenhuma).
 */
export const IDS_DE_EXTRATO_PERMITIDOS: readonly string[] = ['51807'];

/** Rótulo de cada identificador conhecido, para a mensagem de erro dizer o que foi passado. */
export const IDENTIFICADORES_CONHECIDOS_DA_CONTA: ReadonlyArray<{
  valor: string;
  rotulo: string;
  ondeSeUsa: string;
}> = [
  { valor: '51807', rotulo: 'id do extrato', ondeSeUsa: 'accountId= do extrato — este é o correto' },
  {
    valor: '1ac33d8a-f065-4b12-8ef9-0a878e718b34',
    rotulo: 'accountRef do espelho (UUID)',
    ondeSeUsa: 'tcr_mirror_accounts — não endereça o extrato',
  },
  {
    valor: 'EDITION',
    rotulo: 'alias do saldo',
    ondeSeUsa: 'header x-corpx-account-context — não endereça o extrato',
  },
  {
    valor: '61504259000164',
    rotulo: 'CNPJ da empresa',
    ondeSeUsa: 'cadastro — não endereça o extrato, e por ser numérico devolveria lista VAZIA sem erro',
  },
];

/**
 * Nome do header que endereça a conta no SALDO. Constante documental: quem monta
 * a requisição de saldo é `consultarSaldoCorpX` (`services/corpx.ts`), que já
 * envia este header. Fica registrado aqui para o leitor não confundir os dois
 * vocabulários da mesma conta.
 */
export const HEADER_CONTEXTO_DE_CONTA = 'x-corpx-account-context';

/**
 * Conta dedicada do Edition — cliente TCR 4142.
 *
 * `idExtrato` é `51807`: é o valor gravado em `corpx_transactions.corpx_account_id`
 * para as linhas desta conta. Os outros três campos existem para diagnóstico e
 * para a cerca conseguir nomear o engano — nenhum deles vai para a query.
 *
 * `titular` e `vinculadoEm` estão VAZIOS de propósito: são dados que esta fase não
 * mediu. Preencher com palpite seria pior do que deixar pendente — o titular
 * bancário viraria "dono do dinheiro" aos olhos do suporte, e uma data de vínculo
 * errada marcaria movimento do cliente como alheio (ou o contrário).
 */
export const CONTA_DEDICADA_CORPX: ContaDedicadaCorpX = {
  idExtrato: '51807',
  aliasSaldo: 'EDITION',
  accountRefMirror: '1ac33d8a-f065-4b12-8ef9-0a878e718b34',
  cnpj: '61504259000164',
  nomeExibicao: 'EDITION LIMITED',
  titular: { razaoSocial: '', numeroConta: '', agencia: '' },
  vinculadoEm: '',
  documentoParaSync: '61504259000164',
};

/* ===========================================================================
 * SYNC — `POST /api/corpx/sync`
 *
 * 🔴 O VOCABULÁRIO AQUI É O INVERSO DO VOCABULÁRIO DO EXTRATO.
 *
 * O extrato é endereçado por `accountId=51807` e a cerca dele RECUSA o CNPJ
 * (ver `IDS_DE_EXTRATO_PERMITIDOS`). O sync é o contrário: o alvo vai no CORPO,
 * como `taxDocument`, e ali o CNPJ é o identificador LEGÍTIMO — o `51807` não
 * significa nada.
 *
 * Ou seja: o valor que uma cerca existe para recusar é exatamente o que a outra
 * exige. Por isso são DUAS allowlists disjuntas, dois erros com nome próprio e
 * dois campos separados na config (`idExtrato` e `documentoParaSync`). Reusar um
 * campo para os dois papéis seria construir o caminho da troca silenciosa.
 *
 * 🔴 POR QUE A CERCA MORA DO LADO DE CÁ, e não só na tela: `POST /api/corpx/sync`
 * recebe o alvo no CORPO e — diferente do resto do controller — não passa por
 * `RbacGuard`. Um alvo escolhido pelo operador (campo livre, seletor, filtro)
 * viraria upsert em `corpx_transactions` de QUALQUER CNPJ. Nesta tela o alvo é
 * dado: sai da config, passa pela cerca, e não existe assinatura que aceite um
 * documento vindo da UI. O furo do endpoint é do backend e continua de pé — o
 * que está travado aqui é o front deixar de ser gatilho dele.
 * =========================================================================== */

/**
 * 🔴 ALLOWLIST DOS DOCUMENTOS QUE PODEM SER ALVO DO SYNC.
 *
 * Fechada, por igualdade sobre dígitos normalizados — nunca `includes`,
 * `startsWith` ou "parece um CNPJ". Um teste de FORMATO aceitaria o CNPJ de
 * qualquer outro cliente (a suíte prova isso com o CNPJ real da TTF), e o sync
 * escreveria no extrato de terceiro.
 */
export const DOCUMENTOS_DE_SYNC_PERMITIDOS: readonly string[] = ['61504259000164'];

/** Só dígitos. Normalizar na ESCRITA e na LEITURA: `61.504.259/0001-64` é o mesmo documento. */
function apenasDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * Documento de sync errado — a cerca do sync.
 *
 * Erro com NOME PRÓPRIO, separado de `IdentificadorDeExtratoInvalidoError`: quem
 * trata precisa conseguir dizer QUAL das duas cercas mordeu, senão a mensagem
 * manda o operador conferir o identificador errado.
 */
export class DocumentoDeSyncInvalidoError extends Error {
  readonly documentoRecebido: string;

  constructor(valor: string) {
    const recebido = (valor ?? '').trim();
    const conhecido = IDENTIFICADORES_CONHECIDOS_DA_CONTA.find(
      (i) => i.valor.trim().toUpperCase() === recebido.toUpperCase(),
    );
    const explicacao = conhecido
      ? `O valor informado é o ${conhecido.rotulo} desta conta, que não endereça a sincronização.`
      : 'O valor informado não é um documento autorizado para sincronização.';
    super(
      `Sincronização não iniciada: o documento da conta está errado. ${explicacao} ` +
        'A operação foi interrompida de propósito — com este valor a sincronização gravaria ' +
        'movimento na conta errada. Fale com o suporte técnico.',
    );
    this.name = 'DocumentoDeSyncInvalidoError';
    this.documentoRecebido = recebido;
    Object.setPrototypeOf(this, DocumentoDeSyncInvalidoError.prototype);
  }
}

/** Janela de sincronização inválida. Erro de INPUT do operador — o texto é instrução, não diagnóstico. */
export class PeriodoDeSyncInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'PeriodoDeSyncInvalidoError';
    Object.setPrototypeOf(this, PeriodoDeSyncInvalidoError.prototype);
  }
}

/**
 * A CERCA DO SYNC. Devolve o documento normalizado (só dígitos) ou lança.
 *
 * Igualdade normalizada contra a allowlist. `51807` cai aqui: é o id do extrato,
 * não um documento — e a mensagem diz isso ao operador.
 */
export function garantirDocumentoDeSync(valor: string): string {
  const informado = (valor ?? '').trim();

  // Nada informado = conta sem configuração. Só ESTE caso é "não configurada":
  // um valor não-numérico (o alias `EDITION`, por exemplo) também normaliza para
  // string vazia, e reportá-lo como "sem configuração" mandaria o operador
  // procurar o problema no lugar errado — o problema é que puseram o
  // identificador ERRADO no campo do sync.
  if (!informado) {
    throw new ContaNaoConfiguradaError('A conta desta tela está sem o documento de sincronização.');
  }

  const documento = apenasDigitos(informado);
  if (!documento || !DOCUMENTOS_DE_SYNC_PERMITIDOS.includes(documento)) {
    throw new DocumentoDeSyncInvalidoError(informado);
  }
  return documento;
}

/** Corpo de `POST /api/corpx/sync`. Espelha `CorpXSyncRequest` sem importar o tipo. */
export interface CorpoSyncCorpX {
  taxDocument: string;
  startDate: string;
  endDate: string;
  dryRun: boolean;
}

export interface RequisicaoSync {
  body: CorpoSyncCorpX;
}

/** Período que a TELA oferece, em ISO `YYYY-MM-DD`. */
export interface PeriodoSync {
  startDate: string;
  endDate: string;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Monta o corpo de `POST /api/corpx/sync`.
 *
 * REGRA DE DINHEIRO — três invariantes:
 *
 * 1. `taxDocument` sai SEMPRE da conta configurada. A assinatura não aceita
 *    documento: não existe como a tela passar um alvo. O operador escolhe o
 *    PERÍODO, nunca a CONTA.
 * 2. A cerca roda ANTES da validação de janela e antes de montar qualquer campo.
 *    Conta errada não chega a virar requisição — nem parcial.
 * 3. O corpo é montado campo a campo, nunca com espalhamento do chamador, e
 *    `dryRun` é explicitamente `false` (um `undefined` deixaria o default para o
 *    backend decidir).
 */
export function montarRequisicaoSync(conta: ContaDedicadaCorpX, periodo: PeriodoSync): RequisicaoSync {
  if (!contaEstaConfigurada(conta)) {
    throw new ContaNaoConfiguradaError();
  }

  // A cerca vem primeiro: o alvo é decidido antes de olhar a janela.
  const taxDocument = garantirDocumentoDeSync(conta.documentoParaSync);

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

  return { body: { taxDocument, startDate, endDate, dryRun: false } };
}

/**
 * Traduz o erro do sync para uma frase de operador.
 *
 * PORQUÊ existe (e por que mora NESTE arquivo, e não no de transporte):
 * `sincronizarExtratoCorpX` (`services/corpx.ts`) lança
 * `new Error(parsed?.message || 'HTTP error! status: <N>')` — ou seja, o corpo da
 * resposta do backend vai direto para a tela se ninguém intervier. Essa regra
 * precisa ser VERIFICÁVEL, e só é verificável isolada aqui; o detalhe técnico
 * fica no console, a tela recebe a frase.
 */
export function traduzirErroDeSync(erro: unknown): string {
  // Erros das cercas e da janela já vêm redigidos para o operador.
  if (
    erro instanceof DocumentoDeSyncInvalidoError ||
    erro instanceof PeriodoDeSyncInvalidoError ||
    erro instanceof ContaNaoConfiguradaError
  ) {
    return erro.message;
  }

  const bruto = erro instanceof Error ? erro.message : String(erro ?? '');

  if (/token de autentica|sess(ã|a)o expirou/i.test(bruto)) {
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
    return 'Já existe uma sincronização em andamento para esta conta. Espere a atual terminar antes de pedir outra.';
  }
  if (status === 429) {
    return 'Muitas sincronizações seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (status >= 500) {
    return 'O serviço de sincronização está indisponível no momento. Tente novamente em instantes.';
  }

  return 'Não foi possível sincronizar o extrato desta conta. Tente novamente.';
}

/** Erro de configuração ausente. Existe para o chamador não confundir com erro de rede. */
export class ContaNaoConfiguradaError extends Error {
  constructor(oQueFalta = 'A conta desta tela ainda não foi configurada.') {
    super(`${oQueFalta} Fale com o suporte técnico para liberá-la.`);
    this.name = 'ContaNaoConfiguradaError';
    // Sem isto, `instanceof` quebra quando o TS compila para ES5.
    Object.setPrototypeOf(this, ContaNaoConfiguradaError.prototype);
  }
}

/**
 * Erro de identificador errado — a cerca desta tela.
 *
 * Lança em vez de degradar: uma consulta com o identificador errado devolveria
 * 400 (barulho) ou 200-com-lista-vazia (silêncio). É o segundo que precisa ser
 * travado aqui, porque na tela ele é indistinguível de "conta sem movimento".
 */
export class IdentificadorDeExtratoInvalidoError extends Error {
  readonly identificadorRecebido: string;

  constructor(valor: string) {
    const recebido = (valor ?? '').trim();
    const conhecido = IDENTIFICADORES_CONHECIDOS_DA_CONTA.find(
      (i) => i.valor.trim().toUpperCase() === recebido.toUpperCase(),
    );
    // O painel é interno, então a mensagem pode nomear o identificador para o
    // operador entender o que houve. Nenhum segredo, tabela, env ou stack sai daqui.
    const explicacao = conhecido
      ? `O valor informado é o ${conhecido.rotulo} desta conta (${conhecido.ondeSeUsa}).`
      : 'O valor informado não é um identificador de extrato reconhecido para esta conta.';
    super(
      `Extrato não consultado: o identificador da conta está errado. ${explicacao} ` +
        'A consulta foi interrompida de propósito — com este valor o extrato voltaria vazio, ' +
        'como se a conta não tivesse movimento. Fale com o suporte técnico.',
    );
    this.name = 'IdentificadorDeExtratoInvalidoError';
    this.identificadorRecebido = recebido;
    Object.setPrototypeOf(this, IdentificadorDeExtratoInvalidoError.prototype);
  }
}

/**
 * A CERCA. Devolve o id normalizado ou lança.
 *
 * Igualdade normalizada contra a allowlist — nunca substring, prefixo ou teste
 * de formato.
 */
export function garantirIdentificadorDeExtrato(valor: string): string {
  const id = (valor ?? '').trim();
  if (!id) {
    throw new ContaNaoConfiguradaError('A conta desta tela está sem identificador de extrato.');
  }
  if (!IDS_DE_EXTRATO_PERMITIDOS.includes(id)) {
    throw new IdentificadorDeExtratoInvalidoError(id);
  }
  return id;
}

/**
 * Alias do saldo, ou lança.
 *
 * PORQUÊ lançar em vez de seguir sem alias: `consultarSaldoCorpX` monta o header
 * `x-corpx-account-context` com o que receber. Um alias vazio viraria um header
 * vazio, e a rota responderia no contexto padrão do backend — ou seja, o saldo de
 * OUTRA conta exibido sob o nome deste cliente.
 */
export function garantirAliasDeSaldo(conta: ContaDedicadaCorpX): string {
  const alias = (conta?.aliasSaldo ?? '').trim();
  if (!alias) {
    throw new ContaNaoConfiguradaError('A conta desta tela está sem o identificador de saldo.');
  }
  return alias;
}

export function contaEstaConfigurada(conta: ContaDedicadaCorpX): boolean {
  return (conta?.idExtrato ?? '').trim().length > 0;
}

/**
 * Rótulo da tela. Identifica o CLIENTE.
 *
 * Nunca cai no titular bancário: ele não é o dono do saldo, e exibi-lo como
 * título da tela faria o suporte atribuir o dinheiro à pessoa errada.
 */
export function rotuloConta(conta: ContaDedicadaCorpX): string {
  const nome = (conta?.nomeExibicao ?? '').trim();
  if (nome) return nome;
  return contaEstaConfigurada(conta) ? 'Conta dedicada (cliente não identificado)' : 'Conta não configurada';
}

/** O titular bancário foi medido? Vazio = pendente, e a tela diz isso em vez de inventar. */
export function titularEstaPendente(conta: ContaDedicadaCorpX): boolean {
  return !(conta?.titular?.razaoSocial ?? '').trim();
}

/**
 * A transação é anterior ao vínculo conta→cliente?
 *
 * Compara só a parte YYYY-MM-DD, em texto. PORQUÊ não fazer aritmética de data:
 * o backend grava datas com deslocamentos manuais de fuso e o front trata o
 * sufixo 'Z' como hora local. Comparar instantes daria uma precisão que o dado
 * não tem.
 *
 * `vinculadoEm` vazio devolve sempre `false` — a marca fica DESLIGADA enquanto a
 * data não for medida. Chutar a data marcaria movimento do cliente como alheio.
 *
 * O próprio dia do vínculo conta como NÃO anterior: é a fronteira ambígua, e
 * marcar a favor do cliente evita acusar de alheio o que talvez seja dele.
 */
export function ehAnteriorAoVinculo(dataISO: string, vinculadoEm: string): boolean {
  const corte = (vinculadoEm ?? '').trim();
  const data = (dataISO ?? '').trim();
  if (corte.length < 10 || data.length < 10) return false;
  return data.slice(0, 10) < corte.slice(0, 10);
}

/**
 * Filtros que a TELA oferece. Nomes do vocabulário da tela, traduzidos para o
 * contrato da rota em `montarRequisicaoExtrato`.
 *
 * ⚠️ `accountId` está aqui só para espelhar o contrato da rota — ele é ACEITO E
 * IGNORADO. Esta tela consulta UMA conta, e quem decide qual é a configuração.
 */
export interface FiltrosExtrato {
  accountId?: string | number;
  transactionType?: 'C' | 'D';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  exactAmount?: number;
  endToEnd?: string;
  search?: string;
  pixStatus?: string;
  pixType?: string;
  source?: string;
  payerDocument?: string;
  beneficiaryDocument?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

/**
 * Parâmetros que saem daqui para `GET /api/corpx/transactions`.
 *
 * Espelha `CorpXTransactionsParams` (`@/types/corpx`) sem importar o tipo — este
 * arquivo não importa nada de propósito. `accountId` é OBRIGATÓRIO aqui, ao
 * contrário do tipo da rota: numa tela de conta dedicada, requisição sem conta
 * não é um caso válido.
 */
export interface ParametrosExtratoCorpX {
  accountId: string;
  transactionType?: 'C' | 'D';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  exactAmount?: number;
  endToEnd?: string;
  search?: string;
  pixStatus?: string;
  pixType?: string;
  source?: string;
  payerDocument?: string;
  beneficiaryDocument?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface RequisicaoExtrato {
  params: ParametrosExtratoCorpX;
}

/** Teto de registros da rota `GET /api/corpx/transactions`. */
export const LIMITE_MAXIMO_EXTRATO = 2000;

/**
 * Monta os parâmetros de `GET /api/corpx/transactions`.
 *
 * REGRA DE DINHEIRO — duas invariantes:
 *
 * 1. `accountId` é SEMPRE preenchido, e sempre pela conta configurada. Nunca
 *    condicional a input: sem ele a rota responde no escopo que ela mesma
 *    escolher, e o extrato de outra conta apareceria sob o nome deste cliente.
 *    Por isso `filtros.accountId` é SOBRESCRITO, não mesclado — e o objeto é
 *    montado campo a campo, nunca com `...filtros`, que deixaria uma chave
 *    `accountId` do chamador vencer a da conta.
 *
 * 2. O id passa pela CERCA antes de virar consulta. Se a conta tiver sido
 *    configurada com outro dos seus quatro identificadores, esta função LANÇA.
 *    Não existe caminho em que ela devolva parâmetros que o backend responderia
 *    com 200 e lista vazia.
 */
export function montarRequisicaoExtrato(
  conta: ContaDedicadaCorpX,
  filtros: FiltrosExtrato,
): RequisicaoExtrato {
  if (!contaEstaConfigurada(conta)) {
    throw new ContaNaoConfiguradaError();
  }

  // A cerca vem ANTES de montar qualquer coisa: nada de requisição parcial.
  const accountId = garantirIdentificadorDeExtrato(conta.idExtrato);

  const params: ParametrosExtratoCorpX = { accountId };

  if (filtros?.transactionType) params.transactionType = filtros.transactionType;
  if (filtros?.startDate) params.startDate = filtros.startDate;
  if (filtros?.endDate) params.endDate = filtros.endDate;
  if (filtros?.exactAmount !== undefined) params.exactAmount = filtros.exactAmount;
  if (filtros?.minAmount !== undefined) params.minAmount = filtros.minAmount;
  if (filtros?.maxAmount !== undefined) params.maxAmount = filtros.maxAmount;
  if (filtros?.endToEnd) params.endToEnd = filtros.endToEnd.trim();
  if (filtros?.search) params.search = filtros.search.trim();
  if (filtros?.pixStatus) params.pixStatus = filtros.pixStatus;
  if (filtros?.pixType) params.pixType = filtros.pixType;
  if (filtros?.source) params.source = filtros.source;
  if (filtros?.payerDocument) params.payerDocument = filtros.payerDocument;
  if (filtros?.beneficiaryDocument) params.beneficiaryDocument = filtros.beneficiaryDocument;
  if (filtros?.order) params.order = filtros.order;
  if (filtros?.limit !== undefined) {
    params.limit = Math.min(Math.max(1, Math.trunc(filtros.limit)), LIMITE_MAXIMO_EXTRATO);
  }
  if (filtros?.offset !== undefined) params.offset = Math.max(0, Math.trunc(filtros.offset));

  return { params };
}

/**
 * Saldo da conta dedicada, como união discriminada.
 *
 * PORQUÊ não `number`: falha de saldo tem que ser um ESTADO, não um zero.
 * `consultarSaldoCorpX` (`services/corpx.ts`) NUNCA lança — em qualquer falha ela
 * devolve `{ erro: true, saldo: 0, saldoDisponivel: 0, ... }`. Ler esse objeto sem
 * olhar o `erro` renderiza "R$ 0,00" como se fosse saldo real. Numa tela de
 * dinheiro, número errado é pior do que falha visível.
 */
export type ResultadoSaldo =
  | { status: 'indisponivel'; motivo: string }
  | { status: 'ok'; disponivelCentavos: number; bloqueadoCentavos: number; totalCentavos: number };

/**
 * Constrói o estado de indisponibilidade. Existe para o chamador não ter como
 * inventar um `{ status: 'ok', ...: 0 }` no catch.
 */
export function obterSaldoIndisponivel(motivo: string): ResultadoSaldo {
  return {
    status: 'indisponivel',
    motivo: (motivo ?? '').trim() || 'Não foi possível obter o saldo desta conta.',
  };
}

/**
 * Traduz a resposta de `consultarSaldoCorpX` para o estado da tela.
 *
 * É AQUI que o zero armado é desarmado. Três caminhos viram indisponibilidade:
 *  - `null` (a consulta foi abortada);
 *  - `erro === true` (o catch da função devolveu o objeto todo zerado);
 *  - campo numérico ausente/NaN (resposta em formato inesperado).
 * Só um payload com números de verdade vira `status: 'ok'`.
 *
 * Recebe `unknown` de propósito: o tipo não importa a origem, e assim continua
 * verificável isolado.
 */
export function interpretarSaldoCorpX(resposta: unknown): ResultadoSaldo {
  if (resposta === null || resposta === undefined) {
    return obterSaldoIndisponivel('A consulta de saldo não foi concluída.');
  }

  const r = resposta as {
    erro?: boolean;
    saldo?: unknown;
    saldoDisponivel?: unknown;
    saldoBloqueado?: unknown;
  };

  if (r.erro === true) {
    // Os zeros que vêm junto são placeholder do catch, não saldo. Nunca exibi-los.
    return obterSaldoIndisponivel('Não foi possível obter o saldo desta conta.');
  }

  const emCentavos = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.round(v * 100);
  };

  const disponivel = emCentavos(r.saldoDisponivel);
  const bloqueado = emCentavos(r.saldoBloqueado);
  const total = emCentavos(r.saldo);

  if (disponivel === null || bloqueado === null || total === null) {
    return obterSaldoIndisponivel('O saldo veio em um formato que a tela não reconhece.');
  }

  return {
    status: 'ok',
    disponivelCentavos: disponivel,
    bloqueadoCentavos: bloqueado,
    totalCentavos: total,
  };
}

/**
 * Linha do extrato já normalizada para a tabela.
 *
 * PORQUÊ mora aqui e não dentro do componente: `normalizarLinha` é a tradução do
 * CONTRATO da rota para o que a tela exibe. Errar um nome de campo aqui não dá
 * erro de compilação — `CorpXTransactionItem` (`src/types/corpx.ts:64`) tem
 * `[key: string]: any`, então QUALQUER nome é aceito e devolve `undefined`. Foi
 * exatamente assim que o E2E sumiu da tela em produção. Uma regra que falha em
 * silêncio precisa ser verificável isolada, e neste módulo ela é.
 */
export interface LinhaExtrato {
  id: string;
  createdAt: string;
  amount: number;
  /** 'C' = entrada na conta do cliente; 'D' = saída. */
  direcao: 'C' | 'D';
  contraparteNome: string;
  contraparteDocumento: string;
  endToEndId: string;
  transactionId: string;
  descricao: string;
  status: string;
  pixType: string;
  source: string;
  original: TransacaoBrutaCorpX;
}

/**
 * A linha COMO A ROTA DEVOLVE. Estrutural, sem importar o tipo compartilhado —
 * este módulo não importa nada de propósito.
 *
 * Os nomes vêm do modelo Prisma `CorpXTransaction`, que `listTransactions`
 * devolve com `...rest`. Note `endToEnd` — sem sufixo `Id`.
 */
export interface TransacaoBrutaCorpX {
  id?: number | string;
  nrMovimento?: string;
  /** Nome do CONTRATO. */
  endToEnd?: string;
  /** Nome do molde BrasilCash. Tolerado na leitura, não é o do contrato. */
  endToEndId?: string;
  transactionDatetime?: string;
  transactionDatetimeUtc?: string;
  transactionDate?: string;
  description?: string;
  amount?: string | number;
  transactionType?: string;
  payerName?: string;
  payerDocument?: string;
  beneficiaryName?: string;
  beneficiaryDocument?: string;
  source?: string;
  pixStatus?: string | null;
  pixType?: string | null;
  corpx_account_id?: number | string | null;
  [chave: string]: unknown;
}

/** `amount` chega como string da rota; valor não-numérico vira 0. */
export function paraNumero(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Traduz a linha da rota para a linha da tabela. */
export function normalizarLinha(tx: TransacaoBrutaCorpX): LinhaExtrato {
  const direcao: 'C' | 'D' = tx.transactionType === 'D' ? 'D' : 'C';
  // Numa entrada, a contraparte é quem pagou; numa saída, quem recebeu.
  const contraparteNome = (direcao === 'C' ? tx.payerName : tx.beneficiaryName) || '';
  const contraparteDocumento = (direcao === 'C' ? tx.payerDocument : tx.beneficiaryDocument) || '';

  // 🔴 O CONTRATO CHAMA ESTE CAMPO DE `endToEnd`, SEM SUFIXO.
  // `endToEndId` é o nome do molde BrasilCash. Ler só o nome do molde deixou a
  // tela sem E2E em produção: coluna com "-", lookup do id_usuario nunca
  // disparado, e a seção "Ações sobre este PIX" sem renderizar — tudo em
  // silêncio, porque `[key: string]: any` no tipo compartilhado aceita qualquer
  // nome e devolve `undefined`.
  //
  // `||` e não `??`: um E2E vazio é o mesmo caso que E2E ausente, e deve cair
  // para a alternativa em vez de parar num `''`.
  const endToEnd = String(tx.endToEnd || tx.endToEndId || '');

  return {
    id: String(tx.id ?? tx.nrMovimento ?? endToEnd ?? ''),
    createdAt: String(tx.transactionDatetime ?? tx.transactionDatetimeUtc ?? tx.transactionDate ?? ''),
    amount: Math.abs(paraNumero(tx.amount)),
    direcao,
    contraparteNome,
    contraparteDocumento,
    endToEndId: endToEnd,
    transactionId: String(tx.nrMovimento ?? ''),
    descricao: String(tx.description ?? ''),
    status: String(tx.pixStatus ?? ''),
    pixType: String(tx.pixType ?? ''),
    source: String(tx.source ?? ''),
    original: tx,
  };
}

/** Campos da transação usados para identificar a compensação. */
export interface TransacaoParaCompensacao {
  /** `id` da linha em `corpx_transactions`. */
  id: number | string;
  /** Identificador da transação na CorpX (`nrMovimento`, quando houver). */
  transactionId: string;
  /** `end_to_end_id`; string vazia quando o banco gravou NULL. */
  endToEndId: string;
}

export interface IdentificacaoCompensacao {
  /** Vai no campo `id` do MovimentoExtrato. */
  id: string;
  /** Vai no campo `code` — vira `id_transacao` na compensação. */
  code: string;
  /** Libera Devolver/Bloquear PIX no modal. */
  permitirAcoesPix: boolean;
}

/**
 * Identificação da compensação.
 *
 * Devolver/bloquear PIX só fazem sentido com E2E REAL. Sem ele, qualquer outro
 * identificador colocado em `code` seria postado ao PIX como se fosse um E2E — e
 * o PIX não o reconhece. Por isso `code` fica vazio e as ações ficam bloqueadas,
 * em vez de mandar um id qualquer e deixar o provider decidir.
 */
export function montarIdentificacaoCompensacao(
  tx: TransacaoParaCompensacao,
): IdentificacaoCompensacao {
  const e2e = (tx?.endToEndId ?? '').trim();
  const transactionId = (tx?.transactionId ?? '').trim();

  // 🔴 `id` NUNCA pode ser o próprio E2E. A compensação
  // (`compensacao-brbtc.ts`, `realizarCompensacaoBRBTC`) recusa quando
  // `id_transacao === id` — é a cerca contra "E2E preenchido com o id da linha".
  // Nas linhas que chegam pelo webhook CorpX v2, `nrMovimento` É o E2E (medido em
  // prod em 2026-09-09: `corpx_transactions.nr_movimento = end_to_end` para
  // source CORPX_V2). Usar `transactionId` como `id` nesse caso colidia com o
  // E2E e a compensação morria ANTES de chamar qualquer API, com "EndToEndId
  // (id_transacao) é obrigatório… Não foi possível extrair do registro".
  // Quando o identificador da transação é o E2E, o `id` é o id da LINHA.
  const idProprio = transactionId && transactionId !== e2e ? transactionId : String(tx?.id ?? '');

  return {
    id: idProprio,
    code: e2e,
    permitirAcoesPix: !!e2e,
  };
}
