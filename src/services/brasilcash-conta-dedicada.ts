/**
 * 🏦 BrasilCash — conta DEDICADA de cliente (tela /brasilcash-conta-dedicada)
 *
 * Transporte HTTP da tela. A regra de qual conta é consultada mora em
 * `brasilcash-conta-dedicada-config.ts` (sem imports, verificável isolado).
 *
 * Espelha `brasilcash-realtime.ts` (tela /brasilcash-tcr) e REUSA os mapeadores
 * de lá — aquele arquivo não é alterado por este.
 */

import {
  mapBrasilCashToTransactionDB,
  type BrasilCashTransaction,
  type BrasilCashTransactionsResponse,
} from '@/services/brasilcash-realtime';
import {
  CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  montarRequisicaoExtrato,
  montarRequisicaoSaldo,
  interpretarSaldoBrasilCash,
  obterSaldoIndisponivel,
  montarRequisicaoSync,
  traduzirErroDeSync,
  PeriodoDeSyncInvalidoError,
  rotuloConta,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  ContaNaoConfiguradaError,
  type ContaDedicada,
  type FiltrosExtrato,
  type ResultadoSaldo,
  type PeriodoSync,
  type ResultadoSync,
} from '@/services/brasilcash-conta-dedicada-config';

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

function getAuthToken(): string | null {
  return (
    localStorage.getItem('auth_token') ||
    localStorage.getItem('jwt_token') ||
    sessionStorage.getItem('auth_token') ||
    sessionStorage.getItem('jwt_token')
  );
}

/**
 * 📊 Extrato da conta dedicada — GET /api/brasilcash/transactions
 *
 * Lança `ContaNaoConfiguradaError` se a conta não estiver preenchida: sem
 * `accountId` o backend devolveria o extrato da conta DEFAULT (TCR).
 */
export async function buscarTransacoesContaDedicada(
  filtros: FiltrosExtrato = {},
  conta: ContaDedicada = CONTA_DEDICADA_BRASILCASH,
): Promise<BrasilCashTransactionsResponse> {
  const { params, headers: headersConta } = montarRequisicaoExtrato(conta, filtros);

  const token = getAuthToken();
  if (!token) {
    throw new Error('Sua sessão expirou. Entre novamente para consultar o extrato.');
  }

  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/api/brasilcash/transactions?${query}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...headersConta,
    },
  });

  if (!response.ok) {
    // A resposta do backend traz { error: { code, message } }; preferimos a
    // mensagem dele quando existe, senão uma frase que o operador entende.
    const corpo = await response.json().catch(() => ({}) as Record<string, unknown>);
    const msg =
      (corpo as { error?: { message?: string } })?.error?.message ||
      (corpo as { message?: string })?.message;
    if (response.status === 403) {
      throw new Error('Você não tem permissão para ver o extrato desta conta.');
    }
    throw new Error(msg || 'Não foi possível carregar o extrato desta conta. Tente novamente.');
  }

  return (await response.json()) as BrasilCashTransactionsResponse;
}

/**
 * 💰 Saldo da conta dedicada — GET /api/brasilcash/account/me/balance
 *
 * Endereçado SÓ pelo `x-account-id` da config: no backend a conta vinculada
 * decide a credencial (chave própria `BCTCR:<account_ref>`, sem X-Account-Id) e
 * a resposta é conferida contra a conta pedida.
 *
 * 🔴 PORQUÊ nunca lança e nunca devolve `number`: toda falha — sessão, HTTP,
 * rede, formato — vira `{ status: 'indisponivel' }`. Devolver 0 (ou deixar um
 * zero armado atrás de um `if`) exibiria "R$ 0,00" numa tela de dinheiro como se
 * fosse o saldo real do cliente. `interpretarSaldoBrasilCash` só produz `ok` com
 * inteiros vindos do provider.
 */
export async function obterSaldoContaDedicada(
  conta: ContaDedicada = CONTA_DEDICADA_BRASILCASH,
  options?: { signal?: AbortSignal },
): Promise<ResultadoSaldo> {
  let headersConta: Record<string, string>;
  try {
    headersConta = montarRequisicaoSaldo(conta).headers;
  } catch (erro) {
    return obterSaldoIndisponivel(erro instanceof Error ? erro.message : '');
  }

  const token = getAuthToken();
  if (!token) {
    return obterSaldoIndisponivel('Sua sessão expirou. Entre novamente para consultar o saldo.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/brasilcash/account/me/balance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...headersConta,
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      const corpo = await response.json().catch(() => ({}) as Record<string, unknown>);
      const msg =
        (corpo as { error?: { message?: string } })?.error?.message ||
        (corpo as { message?: string })?.message;
      console.error('[BRASILCASH-CONTA-DEDICADA] Saldo HTTP', response.status, msg);
      if (response.status === 401) {
        return obterSaldoIndisponivel('Sua sessão expirou. Entre novamente para consultar o saldo.');
      }
      if (response.status === 403) {
        return obterSaldoIndisponivel('Você não tem permissão para ver o saldo desta conta.');
      }
      if (response.status === 409) {
        return obterSaldoIndisponivel('Esta conta ainda não está pronta para consulta. Fale com o suporte.');
      }
      return obterSaldoIndisponivel('Não foi possível obter o saldo desta conta.');
    }

    return interpretarSaldoBrasilCash(await response.json());
  } catch (erro) {
    if ((erro as { name?: string })?.name === 'AbortError') {
      return obterSaldoIndisponivel('Consulta cancelada.');
    }
    console.error('[BRASILCASH-CONTA-DEDICADA] Falha ao consultar saldo:', erro);
    return obterSaldoIndisponivel('Não foi possível obter o saldo desta conta.');
  }
}

/**
 * 🔄 Sincronização do extrato — POST /api/brasilcash/transactions/sync
 *
 * 🔴 A ASSINATURA É A CERCA. Esta função NÃO recebe conta: o alvo sai de
 * `montarRequisicaoSync`, que o lê da config e o manda em `x-account-id`. Não
 * existe como a tela — nem um operador pelo formulário — apontar a sincronização
 * para outra conta, porque não há por onde passar uma conta.
 *
 * O operador escolhe o PERÍODO. A CONTA é dada. Uma chamada, sem retry: o
 * backend já tem retry por página e é idempotente (cria só o que não existe).
 */
export async function sincronizarExtratoContaDedicada(
  periodo: PeriodoSync,
  conta: ContaDedicada = CONTA_DEDICADA_BRASILCASH,
): Promise<ResultadoSync> {
  // Lança antes de qualquer I/O: conta errada ou janela inválida não vira request.
  const { body, headers: headersConta } = montarRequisicaoSync(conta, periodo);

  const token = getAuthToken();
  if (!token) {
    throw new Error('Sua sessão expirou. Entre novamente para sincronizar o extrato.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/brasilcash/transactions/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...headersConta,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const corpo = await response.json().catch(() => ({}) as Record<string, unknown>);
      const msg =
        (corpo as { error?: { message?: string } })?.error?.message ||
        (corpo as { message?: string })?.message;
      console.error('[BRASILCASH-CONTA-DEDICADA] Sync HTTP', response.status, msg);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as ResultadoSync;
  } catch (erro) {
    console.error('[BRASILCASH-CONTA-DEDICADA] Falha ao sincronizar extrato:', erro);
    throw new Error(traduzirErroDeSync(erro));
  }
}

export {
  CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  rotuloConta,
  ehAnteriorAoVinculo,
  montarIdentificacaoCompensacao,
  montarRequisicaoSaldo,
  interpretarSaldoBrasilCash,
  obterSaldoIndisponivel,
  montarRequisicaoSync,
  traduzirErroDeSync,
  PeriodoDeSyncInvalidoError,
  ContaNaoConfiguradaError,
  mapBrasilCashToTransactionDB,
};
export type {
  ContaDedicada,
  FiltrosExtrato,
  ResultadoSaldo,
  PeriodoSync,
  ResultadoSync,
  BrasilCashTransaction,
};

export const BrasilCashContaDedicadaService = {
  conta: CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  rotuloConta,
  buscarTransacoes: buscarTransacoesContaDedicada,
  obterSaldo: obterSaldoContaDedicada,
  sincronizarExtrato: sincronizarExtratoContaDedicada,
  mapBrasilCashToTransactionDB,
} as const;

export default BrasilCashContaDedicadaService;
