/**
 * Verificador da regra de dinheiro da tela /corpx-conta-dedicada.
 *
 * PORQUÊ ESTE ARQUIVO EXISTE: o projeto não tem runner de teste, e a regra que
 * este verificador exercita não é cosmética — ela decide QUAL CONTA o extrato
 * consulta. Errar isso não dá erro: dá extrato VAZIO, ou o extrato de outra
 * conta, sob o nome do cliente.
 *
 * A conta do Edition tem QUATRO identificadores circulando na documentação e no
 * código (UUID do mirror, id do extrato, alias do saldo, CNPJ). Só UM serve para
 * `accountId=`. O `BigInt()` do backend recusa o UUID e o alias com 400 — barulho
 * visível —, mas ACEITA o CNPJ, porque ele é numérico: vira
 * `corpx_account_id: 61504259000164n`, casa zero linha, e devolve extrato vazio
 * EM SILÊNCIO. É esse o caso que este verificador existe para travar.
 *
 * COMO RODAR (o `tsc` do projeto, não um baixado da rede):
 *   ./node_modules/.bin/tsc --target ES2020 --module commonjs --strict \
 *     --outDir /tmp/verif-corpx src/services/corpx-conta-dedicada-config.ts \
 *     src/services/corpx-conta-dedicada-config.test-verificador.ts \
 *   && node /tmp/verif-corpx/corpx-conta-dedicada-config.test-verificador.js
 *
 * O nome carrega `test-` de propósito: o `rollupOptions.external` do
 * `vite.config.ts` externaliza qualquer id que contenha `test-`, então este
 * arquivo não entra no bundle nem por acidente.
 */

import {
  CONTA_DEDICADA_CORPX,
  IDENTIFICADORES_CONHECIDOS_DA_CONTA,
  HEADER_CONTEXTO_DE_CONTA,
  IDS_DE_EXTRATO_PERMITIDOS,
  DOCUMENTOS_DE_SYNC_PERMITIDOS,
  ContaNaoConfiguradaError,
  IdentificadorDeExtratoInvalidoError,
  DocumentoDeSyncInvalidoError,
  PeriodoDeSyncInvalidoError,
  contaEstaConfigurada,
  garantirIdentificadorDeExtrato,
  garantirDocumentoDeSync,
  montarRequisicaoSync,
  traduzirErroDeSync,
  garantirAliasDeSaldo,
  montarRequisicaoExtrato,
  interpretarSaldoCorpX,
  obterSaldoIndisponivel,
  rotuloConta,
  titularEstaPendente,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  normalizarLinha,
  type ContaDedicadaCorpX,
} from './corpx-conta-dedicada-config';

let falhas = 0;
let passes = 0;

function ok(descricao: string, condicao: boolean, detalhe = ''): void {
  if (condicao) {
    passes += 1;
    console.log(`  PASS  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  } else {
    falhas += 1;
    console.log(`  FAIL  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Executa `fn` e devolve o erro lançado, ou null se não lançou. */
function capturar(fn: () => unknown): Error | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e as Error;
  }
}

// ---------------------------------------------------------------------------
console.log('\n== 1. A CERCA DE IDENTIFICADOR — os quatro identificadores da conta ==\n');

// Estes quatro valores são a mesma conta em quatro vocabulários diferentes.
// Um único deles endereça o extrato; os outros três precisam LANÇAR.
const OS_QUATRO: Array<{ rotulo: string; valor: string; deveAceitar: boolean }> = [
  { rotulo: 'id do extrato (corpx_account_id)', valor: '51807', deveAceitar: true },
  { rotulo: 'accountRef UUID (mirror)', valor: '1ac33d8a-f065-4b12-8ef9-0a878e718b34', deveAceitar: false },
  { rotulo: 'alias do header de saldo', valor: 'EDITION', deveAceitar: false },
  { rotulo: 'CNPJ (o que fura EM SILÊNCIO)', valor: '61504259000164', deveAceitar: false },
];

for (const caso of OS_QUATRO) {
  const erro = capturar(() => garantirIdentificadorDeExtrato(caso.valor));
  if (caso.deveAceitar) {
    ok(`ACEITA  ${caso.rotulo} = ${caso.valor}`, erro === null, erro ? `lançou: ${erro.message}` : 'sem erro');
  } else {
    ok(
      `RECUSA  ${caso.rotulo} = ${caso.valor}`,
      erro instanceof IdentificadorDeExtratoInvalidoError,
      erro ? `lançou ${erro.name}: ${erro.message}` : 'NÃO LANÇOU (degradou em silêncio)',
    );
  }
}

// O CNPJ merece asserção própria: ele é o único que o backend ACEITA.
// `BigInt('61504259000164')` não lança — logo "é numérico" não é validação.
console.log('\n-- o CNPJ é numérico e o BigInt do backend o aceitaria --');
const bigIntAceitaCnpj = capturar(() => BigInt('61504259000164')) === null;
const bigIntRecusaUuid = capturar(() => BigInt('1ac33d8a-f065-4b12-8ef9-0a878e718b34')) !== null;
const bigIntRecusaAlias = capturar(() => BigInt('EDITION')) !== null;
ok('BigInt() ACEITA o CNPJ (por isso a cerca do front não pode confiar em "é numérico")', bigIntAceitaCnpj);
ok('BigInt() recusa o UUID (o backend devolveria 400 — falha visível)', bigIntRecusaUuid);
ok('BigInt() recusa o alias (o backend devolveria 400 — falha visível)', bigIntRecusaAlias);

// A cerca é allowlist por igualdade normalizada — não substring, não "startsWith".
console.log('\n-- a cerca é igualdade, não substring --');
for (const quase of ['051807', '51807 ', ' 51807', '5180', '518070', '51807x']) {
  const erro = capturar(() => garantirIdentificadorDeExtrato(quase));
  const aceitoEsperado = quase.trim() === '51807';
  ok(
    `${aceitoEsperado ? 'ACEITA' : 'RECUSA'}  ${JSON.stringify(quase)}`,
    aceitoEsperado ? erro === null : erro instanceof IdentificadorDeExtratoInvalidoError,
  );
}

// ---------------------------------------------------------------------------
console.log('\n== 2. A CONTA CONFIGURADA NA TELA ==\n');

ok('a conta está configurada', contaEstaConfigurada(CONTA_DEDICADA_CORPX));
ok(
  'o idExtrato configurado passa pela própria cerca',
  capturar(() => garantirIdentificadorDeExtrato(CONTA_DEDICADA_CORPX.idExtrato)) === null,
  `idExtrato = ${CONTA_DEDICADA_CORPX.idExtrato}`,
);
ok(
  'o idExtrato NÃO é o UUID do mirror',
  CONTA_DEDICADA_CORPX.idExtrato !== CONTA_DEDICADA_CORPX.accountRefMirror,
);
ok('o idExtrato NÃO é o CNPJ', CONTA_DEDICADA_CORPX.idExtrato !== CONTA_DEDICADA_CORPX.cnpj);
ok('o idExtrato NÃO é o alias do saldo', CONTA_DEDICADA_CORPX.idExtrato !== CONTA_DEDICADA_CORPX.aliasSaldo);
ok(
  'os quatro identificadores estão registrados para diagnóstico',
  IDENTIFICADORES_CONHECIDOS_DA_CONTA.length === 4,
  `${IDENTIFICADORES_CONHECIDOS_DA_CONTA.length} registrados`,
);

// ---------------------------------------------------------------------------
console.log('\n== 3. montarRequisicaoExtrato — a conta errada não vira consulta ==\n');

// O cenário real: alguém troca o `idExtrato` por outro identificador da MESMA
// conta, porque os quatro aparecem juntos na documentação. Com o CNPJ, o backend
// devolveria 200 e lista vazia. A tela tem que recusar antes de perguntar.
for (const caso of OS_QUATRO) {
  const conta: ContaDedicadaCorpX = { ...CONTA_DEDICADA_CORPX, idExtrato: caso.valor };
  const erro = capturar(() => montarRequisicaoExtrato(conta, {}));
  if (caso.deveAceitar) {
    ok(`conta com ${caso.rotulo}: MONTA a requisição`, erro === null);
  } else {
    ok(
      `conta com ${caso.rotulo}: LANÇA em vez de consultar`,
      erro instanceof IdentificadorDeExtratoInvalidoError,
      erro ? erro.name : 'NÃO LANÇOU — consultaria e devolveria vazio em silêncio',
    );
  }
}

const contaVazia: ContaDedicadaCorpX = { ...CONTA_DEDICADA_CORPX, idExtrato: '' };
ok(
  'conta sem idExtrato lança ContaNaoConfiguradaError (não é erro de rede)',
  capturar(() => montarRequisicaoExtrato(contaVazia, {})) instanceof ContaNaoConfiguradaError,
);
ok('contaEstaConfigurada() é falso para conta sem idExtrato', !contaEstaConfigurada(contaVazia));

// ---------------------------------------------------------------------------
console.log('\n== 4. O accountId do filtro NUNCA vence o da conta ==\n');

const req = montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, {});
ok('sem filtro, accountId = id do extrato', req.params.accountId === '51807', `accountId=${req.params.accountId}`);

// Cada um dos outros três identificadores tentando entrar pelo filtro.
for (const caso of OS_QUATRO.filter((c) => !c.deveAceitar)) {
  const r = montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, { accountId: caso.valor });
  ok(
    `filtro com ${caso.rotulo} é sobrescrito`,
    r.params.accountId === '51807',
    `accountId=${r.params.accountId}`,
  );
}

// Conta de OUTRO cliente tentando entrar pelo filtro.
const outraConta = montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, { accountId: '99999' });
ok('filtro com conta de terceiro é sobrescrito', outraConta.params.accountId === '51807');

// `accountId` nunca sai de lá — nem quando o filtro é vazio/undefined.
const semNada = montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, { accountId: undefined });
ok('accountId presente mesmo com filtro undefined', semNada.params.accountId === '51807');

// Os demais filtros continuam funcionando (a cerca não pode quebrar a tela).
const comFiltros = montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, {
  startDate: '2026-09-01',
  endDate: '2026-09-08',
  transactionType: 'C',
  limit: 5000,
  offset: 40,
});
ok('startDate passa', comFiltros.params.startDate === '2026-09-01');
ok('endDate passa', comFiltros.params.endDate === '2026-09-08');
ok('transactionType passa', comFiltros.params.transactionType === 'C');
ok('limit é teto de 2000 (limite da rota)', comFiltros.params.limit === 2000, `limit=${comFiltros.params.limit}`);
ok('offset passa', comFiltros.params.offset === 40);
ok('offset negativo é normalizado para 0', montarRequisicaoExtrato(CONTA_DEDICADA_CORPX, { offset: -5 }).params.offset === 0);

// ---------------------------------------------------------------------------
console.log('\n== 5. SALDO — alias correto, e o ZERO ARMADO desarmado ==\n');

ok(
  'o saldo é endereçado pelo ALIAS, não pelo id do extrato',
  garantirAliasDeSaldo(CONTA_DEDICADA_CORPX) === 'EDITION',
  `alias=${garantirAliasDeSaldo(CONTA_DEDICADA_CORPX)}`,
);
ok(
  'conta sem alias LANÇA em vez de mandar header vazio (a rota responderia com a conta padrão)',
  capturar(() => garantirAliasDeSaldo({ ...CONTA_DEDICADA_CORPX, aliasSaldo: '' })) instanceof
    ContaNaoConfiguradaError,
);
ok('o header de contexto está registrado', HEADER_CONTEXTO_DE_CONTA === 'x-corpx-account-context');

const indisponivel = obterSaldoIndisponivel('Falha de teste');
ok('saldo indisponível é estado, não número', indisponivel.status === 'indisponivel');
ok(
  'saldo indisponível NÃO carrega zero em campo nenhum',
  !Object.prototype.hasOwnProperty.call(indisponivel, 'disponivelCentavos'),
  JSON.stringify(indisponivel),
);

// 🔴 O CASO MEDIDO: `consultarSaldoCorpX` (services/corpx.ts:133) NUNCA lança.
// Em qualquer falha ela devolve este objeto — todo zerado, com `erro: true`.
// Ler `saldo` sem olhar `erro` renderiza "R$ 0,00" como se fosse saldo real.
console.log('\n-- o objeto que o catch de consultarSaldoCorpX devolve --');
const RESPOSTA_DE_FALHA_REAL = {
  erro: true,
  globalBalance: 0,
  saldo: 0,
  saldoDisponivel: 0,
  saldoBloqueado: 0,
  limite: 0,
  limiteBloqueado: 0,
};
const saldoDeFalha = interpretarSaldoCorpX(RESPOSTA_DE_FALHA_REAL);
ok(
  'erro:true com zeros vira INDISPONÍVEL, nunca R$ 0,00',
  saldoDeFalha.status === 'indisponivel',
  `status=${saldoDeFalha.status}`,
);
ok(
  'nenhum zero sobrevive na tradução',
  JSON.stringify(saldoDeFalha).indexOf('0') === -1 || saldoDeFalha.status === 'indisponivel',
  JSON.stringify(saldoDeFalha),
);
ok(
  'abort (null) vira INDISPONÍVEL',
  interpretarSaldoCorpX(null).status === 'indisponivel',
);
ok(
  'resposta em formato inesperado vira INDISPONÍVEL (não assume zero)',
  interpretarSaldoCorpX({ erro: false, saldo: 'muitos reais' }).status === 'indisponivel',
);
ok(
  'saldo REALMENTE zero (erro:false, números de verdade) é exibido como zero',
  interpretarSaldoCorpX({ erro: false, saldo: 0, saldoDisponivel: 0, saldoBloqueado: 0 }).status === 'ok',
);

const saldoBom = interpretarSaldoCorpX({
  erro: false,
  saldo: 1234.56,
  saldoDisponivel: 1000.5,
  saldoBloqueado: 234.06,
});
ok('saldo válido vira ok', saldoBom.status === 'ok');
ok(
  'reais viram centavos sem erro de ponto flutuante',
  saldoBom.status === 'ok' && saldoBom.disponivelCentavos === 100050 && saldoBom.totalCentavos === 123456,
  saldoBom.status === 'ok' ? `disponivel=${saldoBom.disponivelCentavos} total=${saldoBom.totalCentavos}` : '',
);

// ---------------------------------------------------------------------------
console.log('\n== 6. RÓTULO — cliente, nunca titular bancário ==\n');

ok('rótulo é o cliente', rotuloConta(CONTA_DEDICADA_CORPX) === 'EDITION LIMITED', rotuloConta(CONTA_DEDICADA_CORPX));
ok(
  'sem nomeExibicao, cai em rótulo neutro (não inventa titular)',
  rotuloConta({ ...CONTA_DEDICADA_CORPX, nomeExibicao: '' }) === 'Conta dedicada (cliente não identificado)',
);
ok(
  'o titular bancário está declarado PENDENTE, não chutado',
  titularEstaPendente(CONTA_DEDICADA_CORPX),
  `titular.razaoSocial=${JSON.stringify(CONTA_DEDICADA_CORPX.titular.razaoSocial)}`,
);
ok(
  'o titular pendente NÃO foi preenchido com o nome do cliente',
  CONTA_DEDICADA_CORPX.titular.razaoSocial !== CONTA_DEDICADA_CORPX.nomeExibicao,
);

// ---------------------------------------------------------------------------
console.log('\n== 7. vinculadoEm — pendente, marca desligada ==\n');

ok(
  'vinculadoEm está vazio (dado não medido — não foi inventado)',
  CONTA_DEDICADA_CORPX.vinculadoEm === '',
);
ok(
  'com vinculadoEm vazio, NENHUMA linha é marcada "anterior ao vínculo"',
  ehAnteriorAoVinculo('2020-01-01T00:00:00Z', CONTA_DEDICADA_CORPX.vinculadoEm) === false,
);
ok('a função funciona quando a data for preenchida', ehAnteriorAoVinculo('2026-08-01', '2026-09-01') === true);
ok('o próprio dia do vínculo NÃO é anterior', ehAnteriorAoVinculo('2026-09-01', '2026-09-01') === false);

// ---------------------------------------------------------------------------
console.log('\n== 8. IDENTIFICAÇÃO DA COMPENSAÇÃO ==\n');

const comE2E = montarIdentificacaoCompensacao({
  id: 10,
  transactionId: 'tx-abc',
  endToEndId: 'E12345678202609081200abcdefghij',
});
ok('com E2E, o code é o E2E', comE2E.code === 'E12345678202609081200abcdefghij');
ok('com E2E, ações PIX liberadas', comE2E.permitirAcoesPix === true);

const semE2E = montarIdentificacaoCompensacao({ id: 11, transactionId: 'tx-def', endToEndId: '' });
ok('sem E2E, ações PIX bloqueadas', semE2E.permitirAcoesPix === false);
ok('sem E2E, o code não vira um id que o PIX não reconhece', semE2E.code === '');
ok('transactionId diferente do E2E: o id é o transactionId', comE2E.id === 'tx-abc', `id=${comE2E.id}`);

/**
 * 🔴 CASO REAL (prod, 2026-09-09): as linhas do webhook CorpX v2 chegam com
 * `nrMovimento` IGUAL ao E2E (`corpx_transactions.nr_movimento = end_to_end`).
 * A compensação (`realizarCompensacaoBRBTC`) recusa `id_transacao === id`. Se o
 * `id` do registro for o `transactionId`, ele É o E2E, a cerca dispara e o
 * operador vê "EndToEndId (id_transacao) é obrigatório… Não foi possível extrair
 * do registro" sem nenhuma chamada de API. O `id` tem de cair para a LINHA.
 */
const E2E_REAL_V2 = 'E00416968202609091724kC41kSrawUr';
const nrMovIgualE2E = montarIdentificacaoCompensacao({
  id: 1545128,
  transactionId: E2E_REAL_V2,
  endToEndId: E2E_REAL_V2,
});
ok('nrMovimento igual ao E2E: o id vira o id da LINHA', nrMovIgualE2E.id === '1545128', `id=${nrMovIgualE2E.id}`);
ok('nrMovimento igual ao E2E: o code continua sendo o E2E', nrMovIgualE2E.code === E2E_REAL_V2);
ok(
  'nrMovimento igual ao E2E: id ≠ code (a cerca da compensação não dispara)',
  nrMovIgualE2E.id !== nrMovIgualE2E.code,
);
const semNrMov = montarIdentificacaoCompensacao({ id: 12, transactionId: '', endToEndId: E2E_REAL_V2 });
ok('sem transactionId: o id é o id da linha, nunca o E2E', semNrMov.id === '12', `id=${semNrMov.id}`);

// ---------------------------------------------------------------------------
console.log('\n== 9. CONTRATO DA ROTA — o extrato real, campo a campo ==\n');

/**
 * 🔴 FIXTURE COM O FORMATO REAL DA RESPOSTA de GET /api/corpx/transactions.
 *
 * Não é inventado: os nomes vêm do modelo Prisma `CorpXTransaction`
 * (BaaS-W3Build/prisma/schema.prisma:931-970), que `listTransactions`
 * (corpx.service.ts:1315-1343) devolve com `...rest` — ou seja, os campos do
 * modelo, mais `transactionDatetimeUtc`, `transactionDatetime`
 * (America/Sao_Paulo), `transactionDate`, `createdAt`, `updatedAt` e
 * `corpxAccount`.
 *
 * O campo do E2E chama-se `endToEnd`. NÃO existe `endToEndId` na resposta — esse
 * é o nome do molde BrasilCash, e era o que a tela lia. O tipo compartilhado
 * `CorpXTransactionItem` (src/types/corpx.ts:54) também declara `endToEndId`, e
 * como a interface tem `[key: string]: any` (linha 64) o TypeScript aceita a
 * leitura errada em silêncio — por isso o `tsc` ficava verde com a tela quebrada.
 */
const RESPOSTA_REAL_DA_ROTA = {
  id: 123,
  corpx_account_id: 51807,
  nrMovimento: '73356f12-d70a-452a-983e-9db121979d29',
  endToEnd: 'E18236120202509052003s01c86b276a',
  transactionDatetime: '2025-09-05T15:03:15-03:00',
  transactionDatetimeUtc: '2025-09-05T18:03:15.000Z',
  transactionDate: '2025-09-05',
  description: 'TRANS RECEBIDA PIX - Diogo Palomares Rufino',
  amount: '10.00000000',
  transactionType: 'C',
  balanceAfter: '44532.85000000',
  payerDocument: '07037637920',
  payerName: 'Diogo Palomares Rufino',
  beneficiaryDocument: '61504259000164',
  beneficiaryName: 'EDITION LIMITED',
  source: 'STATEMENT',
  pixStatus: null,
  pixType: null,
};

const linha = normalizarLinha(RESPOSTA_REAL_DA_ROTA as never);

// (a) o E2E é extraído do campo do CONTRATO
ok(
  'extrai o E2E do campo `endToEnd` do contrato',
  linha.endToEndId === 'E18236120202509052003s01c86b276a',
  `endToEndId=${JSON.stringify(linha.endToEndId)}`,
);

// (b) a condição que dispara o lookup do usuário (`if (tx.endToEndId)`) fica verdadeira
ok(
  'a condição que dispara verificarTransacaoTCR fica VERDADEIRA',
  !!linha.endToEndId,
  linha.endToEndId ? 'lookup do id_usuario acontece' : 'lookup NUNCA acontece — modal abre sem usuário',
);

// (c) as ações de PIX ficam liberadas
const idComE2eReal = montarIdentificacaoCompensacao({
  id: linha.id,
  transactionId: linha.transactionId,
  endToEndId: linha.endToEndId,
});
ok(
  'permitirAcoesPix fica VERDADEIRO (a seção "Ações sobre este PIX" renderiza)',
  idComE2eReal.permitirAcoesPix === true,
  `permitirAcoesPix=${idComE2eReal.permitirAcoesPix}`,
);
ok(
  'o code da compensação é o E2E real, não vazio',
  idComE2eReal.code === 'E18236120202509052003s01c86b276a',
  `code=${JSON.stringify(idComE2eReal.code)}`,
);

// Os demais campos do contrato que a tela lê
ok('nrMovimento vira transactionId', linha.transactionId === '73356f12-d70a-452a-983e-9db121979d29');
ok('transactionType C vira direcao C', linha.direcao === 'C');
ok('amount string vira número', linha.amount === 10, `amount=${linha.amount}`);
ok('payerName vira contraparte na ENTRADA', linha.contraparteNome === 'Diogo Palomares Rufino');
ok('payerDocument vira documento da contraparte na ENTRADA', linha.contraparteDocumento === '07037637920');
ok('transactionDatetime vira a data da linha', linha.createdAt === '2025-09-05T15:03:15-03:00');
ok('source é lido', linha.source === 'STATEMENT');
ok('pixStatus null não vira a string "null"', linha.status === '', `status=${JSON.stringify(linha.status)}`);

// Saída (débito): a contraparte é o beneficiário.
const linhaDebito = normalizarLinha({ ...RESPOSTA_REAL_DA_ROTA, transactionType: 'D' } as never);
ok('na SAÍDA a contraparte é o beneficiário', linhaDebito.contraparteNome === 'EDITION LIMITED');
ok('na SAÍDA o documento é o do beneficiário', linhaDebito.contraparteDocumento === '61504259000164');

// Tolerância ao nome do molde: se algum caminho ainda entregar `endToEndId`, a
// linha continua funcionando. Aceitar o contrato NÃO pode quebrar o legado.
const linhaMolde = normalizarLinha({
  id: 9,
  nrMovimento: 'nr-9',
  endToEndId: 'E00000000202509052003s01c86b276a',
  transactionType: 'C',
  amount: '5.00',
} as never);
ok(
  'ainda aceita `endToEndId` (nome do molde) quando `endToEnd` não vier',
  linhaMolde.endToEndId === 'E00000000202509052003s01c86b276a',
  `endToEndId=${JSON.stringify(linhaMolde.endToEndId)}`,
);

// Sem E2E nenhum: continua vazio, e as ações de PIX seguem bloqueadas.
const linhaSemE2E = normalizarLinha({ id: 7, nrMovimento: 'nr-7', transactionType: 'C', amount: '1.00' } as never);
ok('sem E2E em nenhum nome, fica vazio', linhaSemE2E.endToEndId === '');
ok(
  'sem E2E, as ações de PIX seguem bloqueadas',
  montarIdentificacaoCompensacao({
    id: linhaSemE2E.id,
    transactionId: linhaSemE2E.transactionId,
    endToEndId: linhaSemE2E.endToEndId,
  }).permitirAcoesPix === false,
);

// ---------------------------------------------------------------------------
console.log('\n== 10. SYNC — o documento do sync NÃO é o id do extrato ==\n');

// 🔴 POR QUE ESTA SEÇÃO EXISTE — os dois vocabulários se cruzam aqui.
//
// O extrato é endereçado pelo `idExtrato` (`51807`) e RECUSA o CNPJ (seção 1).
// O sync (`POST /api/corpx/sync`) é o oposto: o alvo vai no CORPO, como
// `taxDocument`, e ali o identificador legítimo é o CNPJ. Ou seja, o MESMO valor
// que a cerca do extrato existe para recusar é o único que o sync aceita.
//
// Duas cercas, duas allowlists DISJUNTAS. O que esta seção trava é a troca entre
// elas: nenhum dos dois identificadores pode atravessar para o outro lado.

// A matriz: cada identificador da conta contra as DUAS cercas.
// Nenhuma linha tem `true` nas duas colunas — é isso que prova que um não vira o outro.
const MATRIZ_DAS_DUAS_CERCAS: Array<{
  rotulo: string;
  valor: string;
  aceitoNoExtrato: boolean;
  aceitoNoSync: boolean;
}> = [
  { rotulo: 'id do extrato', valor: '51807', aceitoNoExtrato: true, aceitoNoSync: false },
  { rotulo: 'CNPJ', valor: '61504259000164', aceitoNoExtrato: false, aceitoNoSync: true },
  { rotulo: 'accountRef UUID', valor: '1ac33d8a-f065-4b12-8ef9-0a878e718b34', aceitoNoExtrato: false, aceitoNoSync: false },
  { rotulo: 'alias do saldo', valor: 'EDITION', aceitoNoExtrato: false, aceitoNoSync: false },
];

for (const caso of MATRIZ_DAS_DUAS_CERCAS) {
  const erroExtrato = capturar(() => garantirIdentificadorDeExtrato(caso.valor));
  const erroSync = capturar(() => garantirDocumentoDeSync(caso.valor));

  ok(
    `EXTRATO ${caso.aceitoNoExtrato ? 'ACEITA' : 'RECUSA'} ${caso.rotulo} (${caso.valor})`,
    caso.aceitoNoExtrato ? erroExtrato === null : erroExtrato instanceof IdentificadorDeExtratoInvalidoError,
    erroExtrato ? erroExtrato.name : 'não lançou',
  );
  ok(
    `SYNC    ${caso.aceitoNoSync ? 'ACEITA' : 'RECUSA'} ${caso.rotulo} (${caso.valor})`,
    caso.aceitoNoSync ? erroSync === null : erroSync instanceof DocumentoDeSyncInvalidoError,
    erroSync ? erroSync.name : 'não lançou',
  );
  ok(
    `${caso.rotulo} NUNCA é aceito pelas duas cercas ao mesmo tempo`,
    !(caso.aceitoNoExtrato && caso.aceitoNoSync),
  );
}

// As duas asserções que o gate pede, nomeadas: uma não vira a outra.
console.log('\n-- um identificador não vira o outro --');
ok(
  'o CNPJ continua RECUSADO como id de extrato',
  capturar(() => garantirIdentificadorDeExtrato('61504259000164')) instanceof IdentificadorDeExtratoInvalidoError,
);
ok(
  'o 51807 é RECUSADO como documento de sync',
  capturar(() => garantirDocumentoDeSync('51807')) instanceof DocumentoDeSyncInvalidoError,
);
ok(
  'as duas allowlists são disjuntas (nenhum valor em comum)',
  !DOCUMENTOS_DE_SYNC_PERMITIDOS.some((d) => IDS_DE_EXTRATO_PERMITIDOS.includes(d)),
  `sync=${JSON.stringify(DOCUMENTOS_DE_SYNC_PERMITIDOS)} extrato=${JSON.stringify(IDS_DE_EXTRATO_PERMITIDOS)}`,
);
ok(
  'o campo do sync na config é PRÓPRIO, não o do extrato',
  CONTA_DEDICADA_CORPX.documentoParaSync === '61504259000164' &&
    CONTA_DEDICADA_CORPX.documentoParaSync !== CONTA_DEDICADA_CORPX.idExtrato,
  `documentoParaSync=${CONTA_DEDICADA_CORPX.documentoParaSync} idExtrato=${CONTA_DEDICADA_CORPX.idExtrato}`,
);

// A cerca do sync é igualdade normalizada — não substring, não "é numérico".
// `BigInt` aceitaria todos estes; nenhum deles é a conta do Edition.
console.log('\n-- a cerca do sync é igualdade, não substring nem "é numérico" --');
for (const quase of [
  '061504259000164',
  '6150425900016',
  '615042590001640',
  '61504259000165',
  '11222333000181',
  '',
  '   ',
]) {
  const erro = capturar(() => garantirDocumentoDeSync(quase));
  ok(`RECUSA documento de sync ${JSON.stringify(quase)}`, erro !== null, erro ? erro.name : 'NÃO LANÇOU');
}

// Formatação do próprio CNPJ certo é normalizada para dígitos, não recusada.
ok(
  'aceita o CNPJ do Edition formatado (normaliza para dígitos)',
  garantirDocumentoDeSync('61.504.259/0001-64') === '61504259000164',
  garantirDocumentoDeSync('61.504.259/0001-64'),
);

// ---------------------------------------------------------------------------
console.log('\n== 11. montarRequisicaoSync — o alvo sai da CONFIG, nunca do chamador ==\n');

const PERIODO_OK = { startDate: '2026-09-01', endDate: '2026-09-08' };

const sync = montarRequisicaoSync(CONTA_DEDICADA_CORPX, PERIODO_OK);
ok('o corpo leva o CNPJ do Edition', sync.body.taxDocument === '61504259000164', `taxDocument=${sync.body.taxDocument}`);
ok('o corpo NÃO leva o id do extrato', sync.body.taxDocument !== '51807');
ok('startDate passa', sync.body.startDate === '2026-09-01');
ok('endDate passa', sync.body.endDate === '2026-09-08');
ok('dryRun é explicitamente false (nunca undefined)', sync.body.dryRun === false);

// O corpo é montado campo a campo: não existe chave extra vinda do chamador.
ok(
  'o corpo tem EXATAMENTE os quatro campos do contrato',
  JSON.stringify(Object.keys(sync.body).sort()) === JSON.stringify(['dryRun', 'endDate', 'startDate', 'taxDocument']),
  JSON.stringify(Object.keys(sync.body).sort()),
);

// 🔴 O caso do gate: qualquer OUTRO documento no montador LANÇA.
console.log('\n-- qualquer outro documento no montador LANÇA --');
for (const outro of ['51807', '11222333000181', '14283885000198', 'EDITION', '1ac33d8a-f065-4b12-8ef9-0a878e718b34', '']) {
  const contaAdulterada: ContaDedicadaCorpX = { ...CONTA_DEDICADA_CORPX, documentoParaSync: outro };
  const erro = capturar(() => montarRequisicaoSync(contaAdulterada, PERIODO_OK));
  ok(
    `conta com documentoParaSync=${JSON.stringify(outro)} LANÇA em vez de sincronizar`,
    erro !== null,
    erro ? erro.name : 'NÃO LANÇOU — sincronizaria a conta errada',
  );
}

// `14283885000198` é o CNPJ da TTF: uma conta REAL de outro cliente. Se a cerca
// fosse "é um CNPJ válido" em vez de allowlist, este passaria — e o sync
// escreveria em `corpx_transactions` de terceiro.
ok(
  'o CNPJ de OUTRA conta real (TTF) é recusado pelo montador',
  capturar(() => montarRequisicaoSync({ ...CONTA_DEDICADA_CORPX, documentoParaSync: '14283885000198' }, PERIODO_OK))
    instanceof DocumentoDeSyncInvalidoError,
);

// Validação de janela — falha ANTES de montar corpo nenhum.
console.log('\n-- validação da janela --');
ok(
  'data inicial depois da final LANÇA',
  capturar(() => montarRequisicaoSync(CONTA_DEDICADA_CORPX, { startDate: '2026-09-08', endDate: '2026-09-01' }))
    instanceof PeriodoDeSyncInvalidoError,
);
ok(
  'período sem data inicial LANÇA',
  capturar(() => montarRequisicaoSync(CONTA_DEDICADA_CORPX, { startDate: '', endDate: '2026-09-01' }))
    instanceof PeriodoDeSyncInvalidoError,
);
ok(
  'período sem data final LANÇA',
  capturar(() => montarRequisicaoSync(CONTA_DEDICADA_CORPX, { startDate: '2026-09-01', endDate: '' }))
    instanceof PeriodoDeSyncInvalidoError,
);
ok(
  'data em formato não-ISO LANÇA',
  capturar(() => montarRequisicaoSync(CONTA_DEDICADA_CORPX, { startDate: '01/09/2026', endDate: '08/09/2026' }))
    instanceof PeriodoDeSyncInvalidoError,
);
ok(
  'mesmo dia é janela VÁLIDA (sincronizar um dia só)',
  montarRequisicaoSync(CONTA_DEDICADA_CORPX, { startDate: '2026-09-01', endDate: '2026-09-01' }).body.startDate ===
    '2026-09-01',
);

// A cerca do documento vem ANTES da janela: conta errada não chega a validar data.
ok(
  'documento errado LANÇA mesmo com janela válida (a cerca vem primeiro)',
  capturar(() => montarRequisicaoSync({ ...CONTA_DEDICADA_CORPX, documentoParaSync: '51807' }, PERIODO_OK))
    instanceof DocumentoDeSyncInvalidoError,
);

// ---------------------------------------------------------------------------
console.log('\n== 12. MENSAGEM DE ERRO DO SYNC — sem vazar internals ==\n');

const RETORNOS_DO_BACKEND: Array<{ rotulo: string; status: number; esperado: string }> = [
  { rotulo: '409 (sync já em andamento)', status: 409, esperado: 'andamento' },
  { rotulo: '429 (throttle)', status: 429, esperado: 'Aguarde' },
  { rotulo: '400 (validação da rota)', status: 400, esperado: 'período' },
  { rotulo: '401 (sessão)', status: 401, esperado: 'sessão' },
  { rotulo: '403 (permissão)', status: 403, esperado: 'permissão' },
  { rotulo: '500 (indisponível)', status: 500, esperado: 'indisponível' },
];

for (const caso of RETORNOS_DO_BACKEND) {
  const msg = traduzirErroDeSync(new Error(`HTTP error! status: ${caso.status} - {"table":"corpx_transactions"}`));
  ok(`${caso.rotulo} vira frase de operador`, msg.includes(caso.esperado), msg);
  ok(`${caso.rotulo} NÃO vaza o corpo do backend`, !msg.includes('corpx_transactions') && !msg.includes('status:'), msg);
}

// A cerca redige a própria mensagem: ela já é para o operador, e explica o engano.
const msgCerca = traduzirErroDeSync(new DocumentoDeSyncInvalidoError('51807'));
ok('erro da cerca do sync chega inteiro ao operador', msgCerca.includes('id do extrato'), msgCerca);
ok('erro da cerca não vaza nome de tabela/env', !/corpx_transactions|process\.env|Bearer/.test(msgCerca), msgCerca);

// Erro desconhecido nunca vira eco do texto cru.
const msgOpaca = traduzirErroDeSync(new Error('ECONNREFUSED 10.0.0.5:5432 pg_hba.conf'));
ok('erro desconhecido vira frase genérica', !msgOpaca.includes('pg_hba'), msgOpaca);

// ---------------------------------------------------------------------------
console.log(`\n===== ${passes} PASS · ${falhas} FAIL =====\n`);
if (falhas > 0) {
  process.exit(1);
}
