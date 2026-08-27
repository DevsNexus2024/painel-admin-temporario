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
  obterSaldoContaDedicada,
  rotuloConta,
  ContaNaoConfiguradaError,
  type ContaDedicada,
  type FiltrosExtrato,
  type ResultadoSaldo,
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

export {
  CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  obterSaldoContaDedicada,
  rotuloConta,
  ContaNaoConfiguradaError,
  mapBrasilCashToTransactionDB,
};
export type { ContaDedicada, FiltrosExtrato, ResultadoSaldo, BrasilCashTransaction };

export const BrasilCashContaDedicadaService = {
  conta: CONTA_DEDICADA_BRASILCASH,
  contaEstaConfigurada,
  rotuloConta,
  buscarTransacoes: buscarTransacoesContaDedicada,
  obterSaldo: obterSaldoContaDedicada,
  mapBrasilCashToTransactionDB,
} as const;

export default BrasilCashContaDedicadaService;
