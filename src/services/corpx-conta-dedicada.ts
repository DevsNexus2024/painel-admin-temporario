/**
 * 🏦 CorpX — conta DEDICADA do Edition (tela /corpx-conta-dedicada)
 *
 * Transporte HTTP da tela. A regra de QUAL conta é consultada mora em
 * `corpx-conta-dedicada-config.ts` (sem imports, verificável isolado).
 *
 * Reusa os clientes de `services/corpx.ts` — aquele arquivo NÃO é alterado por
 * este. Reusar importa: `listarTransacoes` e `consultarSaldo` passam por
 * `fetchWithTotp`, que trata o desafio de TOTP. Um fetch próprio aqui pularia
 * esse tratamento.
 */

import CorpXService from '@/services/corpx';
import type { CorpXTransactionsResponse, CorpXTransactionItem, CorpXSyncResponse } from '@/types/corpx';
import {
  CONTA_DEDICADA_CORPX,
  contaEstaConfigurada,
  garantirAliasDeSaldo,
  garantirIdentificadorDeExtrato,
  garantirDocumentoDeSync,
  montarRequisicaoExtrato,
  montarRequisicaoSync,
  traduzirErroDeSync,
  DocumentoDeSyncInvalidoError,
  PeriodoDeSyncInvalidoError,
  type PeriodoSync,
  interpretarSaldoCorpX,
  obterSaldoIndisponivel,
  rotuloConta,
  titularEstaPendente,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  normalizarLinha,
  ContaNaoConfiguradaError,
  IdentificadorDeExtratoInvalidoError,
  LIMITE_MAXIMO_EXTRATO,
  type ContaDedicadaCorpX,
  type FiltrosExtrato,
  type ResultadoSaldo,
  type LinhaExtrato,
} from '@/services/corpx-conta-dedicada-config';

/**
 * Traduz o erro cru do cliente para uma frase que o operador entende.
 *
 * PORQUÊ existe: `listarTransacoesCorpX` lança
 * `HTTP error! status: <N> - <corpo cru do backend>`. Esse texto vai direto pra
 * tela se ninguém intervier — e ele carrega o corpo da resposta do backend, que
 * é exatamente o tipo de coisa que não deve aparecer pro usuário. O detalhe
 * técnico continua no console; a tela recebe a frase.
 *
 * O status é extraído por regex porque é o único handle disponível sem alterar
 * `services/corpx.ts` (fora do escopo desta fase).
 */
function traduzirErroDeExtrato(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro ?? '');

  // Erros da própria cerca já vêm redigidos para o operador.
  if (erro instanceof IdentificadorDeExtratoInvalidoError || erro instanceof ContaNaoConfiguradaError) {
    return bruto;
  }

  if (/token de autentica/i.test(bruto)) {
    return 'Sua sessão expirou. Entre novamente para consultar o extrato.';
  }

  const status = Number(/status:\s*(\d{3})/.exec(bruto)?.[1] ?? 0);
  if (status === 401) return 'Sua sessão expirou. Entre novamente para consultar o extrato.';
  if (status === 403) return 'Você não tem permissão para ver o extrato desta conta.';
  if (status === 404) return 'O extrato desta conta não foi encontrado. Fale com o suporte técnico.';
  if (status === 429) return 'Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.';
  if (status >= 500) return 'O serviço de extrato está indisponível no momento. Tente novamente em instantes.';

  return 'Não foi possível carregar o extrato desta conta. Tente novamente.';
}

/**
 * 📊 Extrato da conta dedicada — `GET /api/corpx/transactions`
 *
 * Lança se a conta não estiver configurada ou se o identificador não for o do
 * extrato. NÃO existe caminho em que esta função consulte outra conta: o
 * `accountId` sai de `montarRequisicaoExtrato`, que o sobrescreve sempre.
 */
export async function buscarTransacoesContaDedicada(
  filtros: FiltrosExtrato = {},
  conta: ContaDedicadaCorpX = CONTA_DEDICADA_CORPX,
  options?: { signal?: AbortSignal },
): Promise<CorpXTransactionsResponse> {
  const { params } = montarRequisicaoExtrato(conta, filtros);

  try {
    return await CorpXService.listarTransacoes(params, options);
  } catch (erro) {
    // AbortError sobe intacto: quem cancelou sabe o que fazer com ele.
    if ((erro as { name?: string })?.name === 'AbortError') throw erro;
    console.error('[CORPX-CONTA-DEDICADA] Falha ao carregar extrato:', erro);
    throw new Error(traduzirErroDeExtrato(erro));
  }
}

/**
 * 💰 Saldo da conta dedicada — `GET /api/corpx-v2/balance`
 *
 * Endereçado pelo ALIAS (`x-corpx-account-context: EDITION`), que é outro
 * vocabulário da mesma conta — o saldo não conhece o id do extrato.
 *
 * 🔴 PORQUÊ esta função não devolve `number`: `consultarSaldoCorpX` NUNCA lança.
 * Em qualquer falha — token inválido, HTTP != 2xx, exceção de rede — ela devolve
 * `{ erro: true, saldo: 0, saldoDisponivel: 0, saldoBloqueado: 0, ... }`. Quem ler
 * `saldo` sem olhar `erro` exibe "R$ 0,00" numa tela de dinheiro como se fosse o
 * saldo real do cliente. `interpretarSaldoCorpX` é quem desarma esses zeros; esta
 * função nunca devolve `status: 'ok'` sem números vindos do provider.
 */
export async function obterSaldoContaDedicada(
  conta: ContaDedicadaCorpX = CONTA_DEDICADA_CORPX,
  options?: { signal?: AbortSignal },
): Promise<ResultadoSaldo> {
  let alias: string;
  try {
    alias = garantirAliasDeSaldo(conta);
  } catch (erro) {
    return obterSaldoIndisponivel(erro instanceof Error ? erro.message : '');
  }

  try {
    const resposta = await CorpXService.consultarSaldo(alias, options);
    return interpretarSaldoCorpX(resposta);
  } catch (erro) {
    // A função reusada não deveria lançar, mas se um dia lançar o resultado
    // continua sendo indisponibilidade — nunca um zero.
    console.error('[CORPX-CONTA-DEDICADA] Falha ao consultar saldo:', erro);
    return obterSaldoIndisponivel('Não foi possível obter o saldo desta conta.');
  }
}

/**
 * 🔄 Sincronização do extrato — `POST /api/corpx/sync`
 *
 * 🔴 A ASSINATURA É A CERCA. Esta função NÃO recebe documento: o alvo sai de
 * `montarRequisicaoSync`, que o lê da config e o passa pela allowlist. Não existe
 * como a tela — nem um operador pelo formulário — apontar a sincronização para
 * outra conta, porque não há por onde passar um documento.
 *
 * PORQUÊ isso importa mais aqui do que no extrato: `POST /api/corpx/sync` recebe
 * o alvo no CORPO e é o único endpoint do controller sem `RbacGuard`. Ele
 * ESCREVE (upsert em `corpx_transactions`), enquanto o extrato só lê. Um alvo
 * escolhível transformaria esta tela no gatilho para gravar movimento na conta
 * de qualquer CNPJ.
 *
 * O operador escolhe o PERÍODO. A CONTA é dada.
 */
export async function sincronizarExtratoContaDedicada(
  periodo: PeriodoSync,
  conta: ContaDedicadaCorpX = CONTA_DEDICADA_CORPX,
): Promise<CorpXSyncResponse> {
  // Lança antes de qualquer I/O: conta errada ou janela inválida não vira request.
  const { body } = montarRequisicaoSync(conta, periodo);

  try {
    return await CorpXService.sincronizarExtrato(body);
  } catch (erro) {
    console.error('[CORPX-CONTA-DEDICADA] Falha ao sincronizar extrato:', erro);
    throw new Error(traduzirErroDeSync(erro));
  }
}

export {
  CONTA_DEDICADA_CORPX,
  contaEstaConfigurada,
  garantirIdentificadorDeExtrato,
  garantirDocumentoDeSync,
  garantirAliasDeSaldo,
  montarRequisicaoExtrato,
  montarRequisicaoSync,
  traduzirErroDeSync,
  DocumentoDeSyncInvalidoError,
  PeriodoDeSyncInvalidoError,
  interpretarSaldoCorpX,
  obterSaldoIndisponivel,
  rotuloConta,
  titularEstaPendente,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  normalizarLinha,
  ContaNaoConfiguradaError,
  IdentificadorDeExtratoInvalidoError,
  LIMITE_MAXIMO_EXTRATO,
};
export type { ContaDedicadaCorpX, FiltrosExtrato, ResultadoSaldo, LinhaExtrato, CorpXTransactionItem, PeriodoSync };

export const CorpXContaDedicadaService = {
  conta: CONTA_DEDICADA_CORPX,
  contaEstaConfigurada,
  rotuloConta,
  buscarTransacoes: buscarTransacoesContaDedicada,
  obterSaldo: obterSaldoContaDedicada,
  sincronizarExtrato: sincronizarExtratoContaDedicada,
} as const;

export default CorpXContaDedicadaService;
