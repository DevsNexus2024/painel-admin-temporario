import { API_CONFIG, getApiHeaders } from "@/config/api";

const PIX_PERMISSIONS_BASE_URL = API_CONFIG.CORPX_V2_BASE_URL || 'https://api-bank-v2.gruponexus.com.br';

/** scopeType disponíveis na API PIX-Out */
export type PixPermissionScopeType =
  | 'USER'
  | 'TENANT'
  | 'API_CLIENT'
  | 'GLOBAL'
  | 'CORPX_ACCOUNT'    // UUID de corpx_accounts.corpx_v2_account_id (header x-corpx-account-context)
  | 'BRASILCASH_ACCOUNT'; // UUID de brasilcash_accounts.account_id (header x-account-id)

export interface PixPermission {
  id: string;
  scopeType: PixPermissionScopeType;
  scopeId: string;
  keyType: 'PIX_KEY' | 'QR_PREFIX' | 'ANY';
  keyValue: string;
  label?: string;
  isActive: boolean;
  expiresAt?: string;
  createdBy: string;
  revokedBy?: string;
  revokedAt?: string;
  revokeNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePixPermissionDTO {
  scopeType: PixPermissionScopeType;
  scopeId: string;
  keyType: 'PIX_KEY' | 'QR_PREFIX' | 'ANY';
  keyValue: string;
  label?: string;
  expiresAt?: string;
}

export interface PixPermissionFilters {
  scopeType?: PixPermissionScopeType;
  scopeId?: string;
  isActive?: boolean;
}

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> => {
  const url = `${PIX_PERMISSIONS_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...getApiHeaders(), ...(options.headers as Record<string, string>) },
  });
  if (!response.ok) {
    const err: any = new Error(`HTTP ${response.status}`);
    err.response = { status: response.status, data: await response.json().catch(() => ({})) };
    throw err;
  }
  const data = await response.json();
  return { data };
};

export const pixPermissionsService = {
  list: async (filters?: PixPermissionFilters) => {
    const params = new URLSearchParams();
    if (filters?.scopeType) params.append('scopeType', filters.scopeType);
    if (filters?.scopeId) params.append('scopeId', filters.scopeId);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const queryString = params.toString();
    const url = `/api/pix-permissions${queryString ? `?${queryString}` : ''}`;
    return request<PixPermission[]>(url);
  },

  create: async (data: CreatePixPermissionDTO) => {
    return request<PixPermission>('/api/pix-permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getById: async (id: string) => {
    return request<PixPermission>(`/api/pix-permissions/${id}`);
  },

  revoke: async (id: string, revokeNote?: string) => {
    return request<PixPermission>(`/api/pix-permissions/${id}`, {
      method: 'DELETE',
      ...(revokeNote && { body: JSON.stringify({ revokeNote }) }),
    });
  }
};
