import { api } from '@/config/api';

/**
 * Serviço de DEVOLUÇÃO de PIX (M4). Chama o BaaS-TCR, que valida o PIN, dispara o estorno
 * no motor (W3Build) e roteia o débito pro ledger certo (OTC inline ou TCR via fan-out).
 * O valor/conta são resolvidos server-side pelo endToEndId — o painel só manda provider + e2e + pin.
 */

const OTC_BASE_URL = '/api/otc';

export type PixRefundProvider = 'brasilcash' | 'corpx_v2';
export type PixRefundReason = 'USER_REQUESTED' | 'FRAUD' | 'OPERATIONAL_FAULT';

export interface CreatePixRefundRequest {
  provider: PixRefundProvider;
  endToEndId: string;
  pin: string;
  reason?: PixRefundReason;
}

export interface PixRefundResult {
  status: 'DONE' | 'ALREADY_REFUNDED' | 'IN_PROGRESS' | 'UNCERTAIN' | 'FAILED';
  provider: string;
  endToEndId: string;
  amount?: number;
  refundId?: string;
  tenantId?: string;
  message?: string;
  debit?: { applied?: boolean; ledger?: string; warning?: string; reason?: string };
}

export interface PixRefundResponse {
  success: boolean;
  message?: string;
  data: PixRefundResult;
}

export const otcPixRefundService = {
  async criarDevolucao(payload: CreatePixRefundRequest): Promise<PixRefundResponse> {
    const response = await api.post<PixRefundResponse>(`${OTC_BASE_URL}/pix-refunds`, payload);
    return response.data;
  },
};
