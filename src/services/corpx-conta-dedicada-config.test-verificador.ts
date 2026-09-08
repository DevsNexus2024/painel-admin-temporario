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
  ContaNaoConfiguradaError,
  IdentificadorDeExtratoInvalidoError,
  contaEstaConfigurada,
  garantirIdentificadorDeExtrato,
  garantirAliasDeSaldo,
  montarRequisicaoExtrato,
  interpretarSaldoCorpX,
  obterSaldoIndisponivel,
  rotuloConta,
  titularEstaPendente,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
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

// ---------------------------------------------------------------------------
console.log(`\n===== ${passes} PASS · ${falhas} FAIL =====\n`);
if (falhas > 0) {
  process.exit(1);
}
