import { TOKEN_STORAGE } from '@/config/api';

/**
 * Bloqueio cautelar de saldo (M4) — hold reversível na conta TCR (TCR-APP).
 *
 * O backend vive no TCR-APP (`POST /api/tcr-baas/bloqueio-cautelar[/desbloquear]`). REUSA a base que o
 * painel JÁ usa pro TCR-APP: `X_DIAGNOSTICO_API_URL` (mesma do tcrSaldos.ts; = vps80270:8081 em prod).
 * `X_TCR_APP_BASE_URL` fica como override opcional. SEM fallback hardcoded de propósito: no lab, sem a
 * env, falha com mensagem clara (não vaza pro TCR-APP de prod). Auth = Bearer do login (igual
 * compensacao-brbtc.ts — o TCR-APP deriva idUsuarioAutenticado/TokenCrypAccess do próprio token).
 */

const TCR_APP_BASE_URL = (
  ((import.meta.env.X_TCR_APP_BASE_URL as string) || (import.meta.env.X_DIAGNOSTICO_API_URL as string) || '')
).replace(/\/+$/, '');

export interface BloqueioCautelarRequest {
  endToEndId: string;
  motivo?: string;
}

async function call(path: string, body: BloqueioCautelarRequest) {
  if (!TCR_APP_BASE_URL) {
    throw new Error('Bloqueio cautelar indisponível: base do TCR-APP não configurada (X_DIAGNOSTICO_API_URL ou X_TCR_APP_BASE_URL).');
  }
  const token = TOKEN_STORAGE.get();
  const resp = await fetch(`${TCR_APP_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.mensagem || data?.message || `Falha (HTTP ${resp.status})`);
  }
  return data;
}

export const bloqueioCautelarService = {
  bloquear: (req: BloqueioCautelarRequest) => call('/api/tcr-baas/bloqueio-cautelar', req),
  desbloquear: (req: BloqueioCautelarRequest) => call('/api/tcr-baas/bloqueio-cautelar/desbloquear', req),
};
