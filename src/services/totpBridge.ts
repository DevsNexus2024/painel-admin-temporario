/**
 * totpBridge — ponte entre a camada HTTP (fora do React) e o TotpProvider.
 *
 * O TotpProvider registra aqui sua função `requestTotp` ao montar. A camada
 * HTTP usa `fetchWithTotp`: se o backend responder 403 com erro de TOTP
 * (TOTP_REQUERIDO / TOTP_INVALIDO / MASTER_TOTP_*), abre o modal, pega o código
 * e REPETE a mesma requisição com o header `x-totp-code`.
 *
 * Seguro porque o guard do backend rejeita ANTES de executar a operação — um
 * 403 de TOTP significa que nada aconteceu, então repetir não duplica dinheiro.
 */
type TotpMode = 'user' | 'master';

type Requester = (opts?: {
  mode?: TotpMode;
  errorMessage?: string;
}) => Promise<string | null>;

let requester: Requester | null = null;

export function setTotpRequester(fn: Requester | null): void {
  requester = fn;
}

/**
 * Código TOTP digitado num campo fixo do painel. Quando presente, é anexado
 * direto na 1ª requisição (sem depender do modal). Simples e à prova de bala.
 */
let manualTotpCode = '';
export function setManualTotpCode(code: string): void {
  manualTotpCode = (code || '').replace(/\D/g, '').slice(0, 6);
}
export function getManualTotpCode(): string {
  return manualTotpCode;
}

interface TotpErrorInfo {
  isTotp: boolean;
  master: boolean;
  invalid: boolean;
}

function classify(body: any): TotpErrorInfo {
  // Lê tanto o formato plano (TCR: body.code/message/error-string) quanto o
  // envelope aninhado do NestJS/W3Build ({ error: { code, message } }).
  const code = body?.codigo ?? body?.code ?? body?.error?.code ?? body?.error ?? '';
  const message = body?.message ?? body?.mensagem ?? body?.error?.message ?? '';
  const s = `${code} ${message}`.toUpperCase();
  const isTotp =
    s.includes('TOTP_REQUERIDO') ||
    s.includes('TOTP_INVALIDO') ||
    s.includes('MASTER_TOTP');
  return {
    isTotp,
    master: s.includes('MASTER_TOTP'),
    invalid: s.includes('INVALIDO') || s.includes('INVÁLIDO'),
  };
}

async function peekJson(res: Response): Promise<any | null> {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

const MAX_TOTP_ATTEMPTS = 3;

/**
 * Igual ao fetch, mas trata 403 de TOTP pedindo o código e repetindo a
 * requisição. Se o usuário cancelar ou não houver requester, devolve a
 * resposta 403 original (o chamador trata como erro normal).
 */
export async function fetchWithTotp(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // Se o operador digitou um código no campo fixo do painel, manda já na 1ª tentativa.
  const usedManualCode = !!manualTotpCode;
  if (manualTotpCode) {
    init = {
      ...init,
      headers: { ...(init.headers as Record<string, string>), 'x-totp-code': manualTotpCode },
    };
  }
  let res = await fetch(input, init);
  if (res.status !== 403 || !requester) return res;

  let info = classify(await peekJson(res));
  if (!info.isTotp) return res;

  // Já havia código no campo do form e ele foi rejeitado: NÃO abrir o modal
  // (evita o prompt duplo). Devolve o 403 pro form mostrar o erro inline
  // (TOTP_REQUERIDO/TOTP_INVALIDO) e o operador corrigir no próprio campo.
  // O modal só serve de fallback quando NÃO havia código no campo.
  if (usedManualCode) return res;

  let errorMessage: string | undefined;
  for (let attempt = 0; attempt < MAX_TOTP_ATTEMPTS; attempt++) {
    const code = await requester({
      mode: info.master ? 'master' : 'user',
      errorMessage,
    });
    if (!code) return res; // usuário cancelou → devolve o 403 original

    const headers = { ...(init.headers as Record<string, string>), 'x-totp-code': code };
    // Descarta um AbortSignal possivelmente já expirado (timeout do request
    // original) — o usuário pode levar alguns segundos digitando o código.
    res = await fetch(input, { ...init, headers, signal: undefined });
    if (res.status !== 403) return res;

    info = classify(await peekJson(res));
    if (!info.isTotp) return res;
    errorMessage = 'Código inválido ou já utilizado. Tente novamente.';
  }
  return res;
}
