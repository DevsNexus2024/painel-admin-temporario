import React, { createContext, useContext, useState, ReactNode } from 'react';

// Alias para conta TCR (CorpX v2 - header X-Corpx-Account-Context)
export const TCR_CORPX_ALIAS = 'TCR';

// Lista de contas CorpX disponíveis
// ✅ IMPORTANTE: apiAccountId deve corresponder ao campo `id` da tabela `corpx_accounts`
// ✅ corpxAlias: usado no header X-Corpx-Account-Context para APIs CorpX v2
export const CORPX_ACCOUNTS = [
  {
    id: 'ALL',
    razaoSocial: 'Todas as contas',
    cnpj: 'ALL',
    available: true,
  },
  {
    id: '1',
    razaoSocial: 'TTF SERVICOS DIGITAIS LTDA',
    cnpj: '14283885000198',
    available: true,
    apiAccountId: 1,
    corpxAlias: 'TTF',
  },
  {
    id: '2',
    razaoSocial: 'TRKBIT TECNOLOGIA E INFORMACAO LTDA',
    cnpj: '41586874000150',
    available: true,
    apiAccountId: 2,
    corpxAlias: 'TRKBIT',
  },
  {
    id: '3',
    razaoSocial: 'NEXUS COMERCIO E IMPORTACAO LTDA',
    cnpj: '62804797000137',
    available: true,
    apiAccountId: 3,
    corpxAlias: 'NEXUS',
  },
  {
    id: '4',
    razaoSocial: 'THE GOOD CELL LTDA',
    cnpj: '49730998000179',
    available: true,
    apiAccountId: 52505,
    corpxAlias: 'TGC',
  },
  // A conta do EDITION LIMITED (id '5') saiu daqui: ela migrou do OTC para o app
  // TCR e é atendida pela tela dedicada /corpx-conta-dedicada. Esta lista é o
  // vocabulário da /corpx (OTC) — manter a conta aqui a deixaria no seletor, no
  // saldo consolidado e no crédito ao OTC, que é justamente a porta antiga.
  //
  // Consequência deliberada: `getCorpxAliasByCnpj('61504259000164')` passa a
  // devolver `undefined`. Todos os consumidores do alias já falham FECHADO
  // (erro visível) em vez de seguir sem o header `x-corpx-account-context` —
  // um alias vazio faria a API responder no contexto default, ou seja, o
  // saldo/extrato de OUTRA conta sob o nome deste cliente.
  {
    id: '6',
    razaoSocial: 'RXP SERVICOS DIGITAIS LTDA',
    cnpj: '24586576000140',
    available: true,
    apiAccountId: 52255,
    corpxAlias: 'RXP',
  },
  // Sub-conta CorpX "RXP Conta 3" (OTC, 12/09/2026). MESMO CNPJ da RXP mãe:
  // por isso a identidade desta linha é o `corpxAlias` (SUB3) e o `apiAccountId`
  // (corpx_accounts 52508), nunca o CNPJ. `getCorpxAliasByCnpj` continua
  // devolvendo a RXP mãe para este CNPJ — quem precisa da sub-conta tem de ler
  // `selectedAccount.corpxAlias` (ver useCorpXSaldo).
  {
    id: '7',
    razaoSocial: 'RXP SERVICOS DIGITAIS LTDA (Conta 3)',
    cnpj: '24586576000140',
    available: true,
    apiAccountId: 52508,
    corpxAlias: 'SUB3',
  },
];

interface CorpXAccount {
  id: string;
  razaoSocial: string;
  cnpj: string;
  available: boolean;
  apiAccountId?: number;
  corpxAlias?: string; // Alias para header X-Corpx-Account-Context (CorpX v2)
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
  // Padrão: consolidado (ALL)
  const [selectedAccount, setSelectedAccount] = useState<CorpXAccount>(CORPX_ACCOUNTS[0]);

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

/** CNPJ da TCR (não aparece no seletor CorpX, mas precisa do alias para APIs v2) */
const TCR_CNPJ = '53781325000115';

/** Obtém o alias CorpX v2 a partir do CNPJ */
export function getCorpxAliasByCnpj(cnpj: string): string | undefined {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits === TCR_CNPJ) return TCR_CORPX_ALIAS;
  const account = CORPX_ACCOUNTS.find(
    (acc) => acc.id !== 'ALL' && (acc.cnpj || '').replace(/\D/g, '') === digits
  );
  return account?.corpxAlias;
}
