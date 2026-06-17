import { TOKEN_STORAGE } from '@/config/api';

/**
 * Bloqueio cautelar de saldo (M4) — hold reversível na conta TCR (TCR-APP).
 *
 * O backend vive no TCR-APP (`POST /api/admin/bloqueio-cautelar[/desbloquear]`). O painel
 * não fala com o TCR-APP por padrão, então a base vem de env (X_TCR_APP_BASE_URL). Sem ela
 * configurada (ex.: lab sem TCR-APP), as chamadas falham com mensagem clara.
 */

const TCR_APP_BASE_URL = ((import.meta.env.X_TCR_APP_BASE_URL as string) || '').replace(/\/+$/, '');

export interface BloqueioCautelarRequest {
  endToEndId: string;
  motivo?: string;
}

async function call(path: string, body: BloqueioCautelarRequest) {
  if (!TCR_APP_BASE_URL) {
    throw new Error('Bloqueio cautelar indisponível: X_TCR_APP_BASE_URL não configurado (painel→TCR-APP).');
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
  bloquear: (req: BloqueioCautelarRequest) => call('/api/admin/bloqueio-cautelar', req),
  desbloquear: (req: BloqueioCautelarRequest) => call('/api/admin/bloqueio-cautelar/desbloquear', req),
};
