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
import { toast } from 'sonner';

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
 * Refresher do access token, injetado de fora pelo authService — mesmo padrão de
 * injeção do `requester` acima, pra evitar ciclo de import totpBridge↔auth↔config/api.
 * Retorna o NOVO access token em caso de sucesso, ou null se não há refresh válido.
 */
let tokenRefresher: (() => Promise<string | null>) | null = null;

export function setTokenRefresher(fn: (() => Promise<string | null>) | null): void {
  tokenRefresher = fn;
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

/**
 * [RATE LIMIT] §4.2 — rotas de saída têm rate limit (429). Mostra uma mensagem
 * amigável (deduplicada por janela curta pra não empilhar toast). NÃO faz auto-retry:
 * repetir um pix-out automaticamente é risco de double-send (money-path-baseline).
 */
let lastRateLimitToastAt = 0;
function notifyRateLimited(): void {
  const now = Date.now();
  if (now - lastRateLimitToastAt < 5000) return; // 1 aviso a cada 5s
  lastRateLimitToastAt = now;
  toast.warning('Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.');
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

// Timeout da retry pós-refresh (401). Valor fixo e generoso: o timeout por-request do
// caller (API_CONFIG.TIMEOUT) não é alcançável aqui sem ciclo de import, e um auto-retry
// sem humano não pode pendurar pra sempre.
const AUTH_RETRY_TIMEOUT_MS = 60_000;

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
  // [RATE LIMIT] 429 em qualquer rota (inclui pix-out): avisa o usuário e devolve a
  // resposta pro caller tratar. Sem retry automático — pix-out não se repete sozinho.
  if (res.status === 429) {
    notifyRateLimited();
    return res;
  }

  // [AUTH] 401 = JWT vencido/inválido → barrado na AUTENTICAÇÃO, antes de qualquer
  // efeito (ordem dos guards: auth → autz → idempotência → negócio). Como nada
  // aconteceu no servidor, renovar o access e repetir a MESMA requisição é seguro —
  // não duplica dinheiro (mesmo argumento do retry de 403-TOTP abaixo). Tentativa
  // única; se ainda 401, devolve pro caller, que limpa a sessão e vai pro /login.
  // Cobre o caso que o refresh proativo do AuthContext não pega (timer pausado em
  // aba de background / máquina dormindo): aqui é a rede de segurança reativa.
  if (res.status === 401 && tokenRefresher) {
    const newToken = await tokenRefresher();
    if (newToken) {
      init = {
        ...init,
        headers: {
          ...(init.headers as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        },
        // Timeout fresco: NÃO reusar o signal original (pode ter expirado durante o
        // refresh) nem deixar a retry sem teto (auto-retry sem humano não pode pendurar).
        signal: AbortSignal.timeout(AUTH_RETRY_TIMEOUT_MS),
      };
      res = await fetch(input, init);
      if (res.status === 429) {
        notifyRateLimited();
        return res;
      }
    }
  }

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
