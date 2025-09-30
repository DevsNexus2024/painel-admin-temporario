import React, { createContext, useContext, useState, ReactNode } from 'react';

// Lista de contas CorpX disponíveis
export const CORPX_ACCOUNTS = [
  {
    id: '1',
    razaoSocial: 'TTF SERVICOS DIGITAIS LTDA',
    cnpj: '14283885000198'
  },
  {
    id: '2', 
    razaoSocial: 'NEXUS COMERCIO E IMPORTACAO LTDA',
    cnpj: '62804797000137'
  },
  {
    id: '3',
    razaoSocial: 'FATTOR INCORPORACOES LTDA', 
    cnpj: '49741299000124'
  },
  {
    id: '4',
    razaoSocial: 'TRKBIT TECNOLOGIA E INFORMACAO LTDA',
    cnpj: '41586874000150'
  }
];

interface CorpXAccount {
  id: string;
  razaoSocial: string;
  cnpj: string;
}

interface CorpXContextType {
  selectedAccount: CorpXAccount;
  setSelectedAccount: (account: CorpXAccount) => void;
  taxDocument: string; // Para compatibilidade com código existente
  setTaxDocument: (taxDocument: string) => void;
}

const CorpXContext = createContext<CorpXContextType | undefined>(undefined);

interface CorpXProviderProps {
  children: ReactNode;
}

export function CorpXProvider({ children }: CorpXProviderProps) {
  const [selectedAccount, setSelectedAccount] = useState<CorpXAccount>(CORPX_ACCOUNTS[0]); // TTF como padrão

  // Função para manter compatibilidade com código existente
  const setTaxDocument = (taxDocument: string) => {
    const account = CORPX_ACCOUNTS.find(acc => acc.cnpj === taxDocument);
    if (account) {
      setSelectedAccount(account);
    }
  };

  return (
    <CorpXContext.Provider value={{
      selectedAccount,
      setSelectedAccount,
      taxDocument: selectedAccount.cnpj,
      setTaxDocument
    }}>
      {children}
    </CorpXContext.Provider>
  );
}

export function useCorpX() {
  const context = useContext(CorpXContext);
  if (context === undefined) {
    throw new Error('useCorpX deve ser usado dentro de um CorpXProvider');
  }
  return context;
}
