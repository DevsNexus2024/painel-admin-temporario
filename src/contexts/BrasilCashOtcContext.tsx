import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Lista de contas OTC BrasilCash disponíveis
// ⚠️ IMPORTANTE: Não incluir conta TCR (já existe em /brasilcash-tcr)
// ⚠️ Não incluir opção "ALL" - apenas as duas contas OTC específicas
export const BRASILCASH_OTC_ACCOUNTS = [
  {
    id: 'OTC_7802755',
    name: 'BrasilCash OTC 7802755',
    accountId: null as string | null,
    tenantId: null,
    otcId: '7802755',
    accountType: 'otc' as const,
    available: true,
    pixKey: '',
  },
  {
    id: 'OTC_1715917',
    name: 'BrasilCash OTC 1715917',
    accountId: null as string | null,
    tenantId: null,
    otcId: '1715917',
    accountType: 'otc' as const,
    available: true,
    pixKey: '',
  },
];

export interface BrasilCashOtcAccount {
  id: string;
  name: string;
  /** UUID da conta BrasilCash (mesmo usado como accountId na API de transações). Enviado como X-Account-Id no pagamento por QR Code. */
  accountId: string | null;
  tenantId: null;
  otcId: string;
  accountType: 'otc';
  available: boolean;
  pixKey?: string;
}

interface BrasilCashOtcContextType {
  selectedAccount: BrasilCashOtcAccount;
  setSelectedAccount: (account: BrasilCashOtcAccount) => void;
  otcId: string;
  getRequestHeaders: () => Record<string, string>;
}

const BrasilCashOtcContext = createContext<BrasilCashOtcContextType | undefined>(undefined);

interface BrasilCashOtcProviderProps {
  children: ReactNode;
}

// Helper para obter token de autenticação
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || 
         localStorage.getItem('jwt_token') || 
         sessionStorage.getItem('auth_token') || 
         sessionStorage.getItem('jwt_token');
}

export function BrasilCashOtcProvider({ children }: BrasilCashOtcProviderProps) {
  // Padrão: primeira conta (OTC 7802755)
  const [selectedAccount, setSelectedAccount] = useState<BrasilCashOtcAccount>(BRASILCASH_OTC_ACCOUNTS[0]);
  
  // Helper para gerar headers corretos baseado na conta selecionada
  const getRequestHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Sempre adicionar header x-otc-id (sempre há uma conta selecionada)
    headers['x-otc-id'] = selectedAccount.otcId;
    // UUID da conta para endpoints que exigem X-Account-Id (ex.: pagamento por QR Code)
    if (selectedAccount.accountId) {
      headers['X-Account-Id'] = selectedAccount.accountId;
    }

    return headers;
  }, [selectedAccount]);
  
  return (
    <BrasilCashOtcContext.Provider value={{
      selectedAccount,
      setSelectedAccount,
      otcId: selectedAccount.otcId,
      getRequestHeaders,
    }}>
      {children}
    </BrasilCashOtcContext.Provider>
  );
}

export function useBrasilCashOtc() {
  const context = useContext(BrasilCashOtcContext);
  if (context === undefined) {
    throw new Error('useBrasilCashOtc deve ser usado dentro de um BrasilCashOtcProvider');
  }
  return context;
}
