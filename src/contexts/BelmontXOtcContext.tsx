import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Contas BelmontX OTC disponíveis
 * Conforme documentação: https://otc.uneverhide.com.br/docs/API_BELMONTX_FRONTEND.md
 * - TTF: Transferência de Títulos Financeiros
 * - RXP: Conta RXP
 */
export type BelmontXOtcAccountType = 'ttf' | 'rxp';

export const BELMONTX_OTC_ACCOUNTS = [
  {
    id: 'ttf' as const,
    label: 'TTF',
    description: 'Transferência de Títulos Financeiros',
    available: true,
  },
  {
    id: 'rxp' as const,
    label: 'RXP',
    description: 'Conta RXP',
    available: true,
  },
] as const;

export type BelmontXOtcAccount = (typeof BELMONTX_OTC_ACCOUNTS)[number];

interface BelmontXOtcContextType {
  selectedAccount: BelmontXOtcAccountType;
  setSelectedAccount: (account: BelmontXOtcAccountType) => void;
}

const BelmontXOtcContext = createContext<BelmontXOtcContextType | undefined>(undefined);

interface BelmontXOtcProviderProps {
  children: ReactNode;
}

export function BelmontXOtcProvider({ children }: BelmontXOtcProviderProps) {
  const [selectedAccount, setSelectedAccount] = useState<BelmontXOtcAccountType>('ttf');

  return (
    <BelmontXOtcContext.Provider value={{ selectedAccount, setSelectedAccount }}>
      {children}
    </BelmontXOtcContext.Provider>
  );
}

export function useBelmontXOtc() {
  const context = useContext(BelmontXOtcContext);
  if (context === undefined) {
    throw new Error('useBelmontXOtc deve ser usado dentro de um BelmontXOtcProvider');
  }
  return context;
}
