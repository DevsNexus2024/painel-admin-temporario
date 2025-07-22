# Guia de Implementação - Sistema de Múltiplas Contas

## 📋 Visão Geral

Este guia descreve a implementação de um sistema de gerenciamento de múltiplas contas no painel de pagamentos PIX, permitindo alternar entre diferentes provedores financeiros (BMP, Bitso, etc.) mantendo a mesma interface mas consumindo APIs diferenciadas.

## 🎯 Objetivos

- ✅ Transformar o card "Dados Bancários" em um dropdown seletor de contas
- ✅ Permitir alternar entre múltiplas contas de diferentes provedores
- ✅ Manter a mesma UI/UX mas com APIs dinâmicas baseadas na conta selecionada
- ✅ Preparar o frontend para futuras integrações (Bitso, BMP-531, etc.)
- ✅ Implementar sistema de roteamento inteligente de APIs

## 🏗️ Arquitetura Atual vs. Nova Arquitetura

### Atual
```
TopBarPayments -> Saldo Fixo (BMP) + Dados Bancários Estáticos
PaymentsPage -> Tabs (Extrato, Ações PIX, Chaves PIX) com APIs fixas
Services -> API fixa para BMP (/internal/*)
```

### Nova Arquitetura
```
AccountProvider (Context) -> Gerencia conta ativa
├── AccountSelector (Dropdown) -> Alterna entre contas
├── DynamicAPI (Service) -> Roteamento inteligente de APIs
└── Components -> Reagem à mudança de conta ativa
```

## 📊 Estrutura de Dados

### Tipos de Conta
```typescript
// types/account.ts
export interface Account {
  id: string;
  name: string;
  provider: 'bmp' | 'bitso' | 'mutual-pay';
  displayName: string;
  bankingInfo: {
    bank?: string;
    agency?: string;
    account?: string;
    accountType?: string;
    document?: string;
  };
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    pix: boolean;
    balance: boolean;
    extract: boolean;
    keys: boolean;
  };
  config: {
    baseUrl?: string;
    apiPrefix: string;
    requiresAuth: boolean;
  };
}

export interface AccountBalance {
  available: number;
  locked: number;
  pending: number;
  currency: string;
  lastUpdate: string;
}

export interface AccountContext {
  accounts: Account[];
  activeAccount: Account | null;
  switchAccount: (accountId: string) => void;
  isLoading: boolean;
  error: string | null;
}
```

## 🔧 Componentes a Implementar

### 1. Context Provider
```typescript
// contexts/AccountContext.tsx
export const AccountProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lógica de gerenciamento de contas
  const switchAccount = (accountId: string) => {
    // Implementar troca de conta
  };

  return (
    <AccountContext.Provider value={{accounts, activeAccount, switchAccount, isLoading, error}}>
      {children}
    </AccountContext.Provider>
  );
};
```

### 2. Account Selector
```typescript
// components/AccountSelector.tsx
export const AccountSelector: React.FC = () => {
  const { accounts, activeAccount, switchAccount } = useAccount();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
          {/* Card atual de dados bancários transformado em trigger */}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {accounts.map(account => (
          <DropdownMenuItem key={account.id} onClick={() => switchAccount(account.id)}>
            {/* Item da conta */}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### 3. Dynamic API Service
```typescript
// services/dynamicApi.ts
export class DynamicApiService {
  private getApiConfig(provider: string) {
    const configs = {
      'bmp': {
        baseUrl: API_CONFIG.BASE_URL,
        endpoints: API_CONFIG.ENDPOINTS
      },
      'bitso': {
        baseUrl: 'https://api.bitso.com',
        endpoints: {
          BALANCE: '/api/v3/balance/',
          // Outros endpoints específicos do Bitso
        }
      },
      'mutual-pay': {
        baseUrl: API_CONFIG.BASE_URL,
        endpoints: {
          // Endpoints específicos do MutualPay
        }
      }
    };
    return configs[provider];
  }

  async makeRequest(provider: string, endpoint: string, options?: RequestInit) {
    const config = this.getApiConfig(provider);
    // Implementar lógica de requisição dinâmica
  }
}
```

### 4. Hooks Adaptativos
```typescript
// hooks/useAccountSaldo.ts
export const useAccountSaldo = () => {
  const { activeAccount } = useAccount();
  
  return useQuery({
    queryKey: ['saldo', activeAccount?.id],
    queryFn: () => dynamicApiService.getSaldo(activeAccount?.provider),
    enabled: !!activeAccount,
  });
};

// hooks/useAccountExtrato.ts
// hooks/useAccountPixKeys.ts
// etc...
```

## 🗂️ Configuração de Contas

### Contas Iniciais (Mock/Desenvolvimento)
```typescript
// config/accounts.ts
export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'bmp-principal',
    name: 'BMP Principal',
    provider: 'bmp',
    displayName: 'Conta Principal BMP',
    bankingInfo: {
      bank: 'Banco 274',
      agency: '0001',
      account: '902486-0',
      accountType: '3',
      document: '09024860'
    },
    status: 'active',
    features: {
      pix: true,
      balance: true,
      extract: true,
      keys: true
    },
    config: {
      apiPrefix: '/internal',
      requiresAuth: true
    }
  },
  {
    id: 'bitso-crypto',
    name: 'Bitso Crypto',
    provider: 'bitso',
    displayName: 'Bitso - Conta Crypto',
    bankingInfo: {
      bank: 'Bitso Exchange',
      agency: 'N/A',
      account: 'CRYPTO-001',
      accountType: 'Crypto'
    },
    status: 'inactive', // Inicialmente inativa
    features: {
      pix: false,
      balance: true,
      extract: true,
      keys: false
    },
    config: {
      apiPrefix: '/bitso',
      requiresAuth: true
    }
  }
];
```

## 🛣️ Roteamento de APIs

### Mapeamento de Endpoints
```typescript
// services/apiRouter.ts
export const API_ROUTER = {
  'bmp': {
    saldo: '/internal/account/saldo',
    extrato: '/internal/account/extrato',
    pixEnviar: '/internal/pix/enviar',
    pixChaves: '/internal/pix/chaves/listar',
    pixConsultar: '/internal/pix/consultar-chave'
  },
  'bitso': {
    saldo: '/api/v3/balance/',
    extrato: '/api/v3/ledger/',
    // PIX não disponível para Bitso
  },
  'mutual-pay': {
    saldo: '/mutual/account/balance',
    extrato: '/mutual/account/extract',
    pixEnviar: '/mutual/pix/send',
    // etc...
  }
};
```

## 📱 Modificações nos Componentes Existentes

### TopBarPayments.tsx
```typescript
// Substituir o card estático de dados bancários pelo AccountSelector
const TopBarPayments = () => {
  const { activeAccount } = useAccount();
  const { data: saldoData, error } = useAccountSaldo();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Card de Saldo - continua igual mas usa dados da conta ativa */}
      <SaldoCard saldo={saldoData} error={error} />
      
      {/* Card de Dados Bancários -> Transformado em AccountSelector */}
      <AccountSelector />
    </div>
  );
};
```

### PaymentsPage/index.tsx
```typescript
// Envolver com AccountProvider e adicionar indicador de conta ativa
const PaymentsPage = () => {
  return (
    <AccountProvider>
      <div className="min-h-screen bg-background">
        <TopBarPayments />
        
        {/* Indicador de conta ativa */}
        <AccountIndicator />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <Tabs defaultValue="extract" className="w-full">
            {/* Resto do componente continua igual */}
          </Tabs>
        </div>
      </div>
    </AccountProvider>
  );
};
```

### Formulários PIX
```typescript
// SendByKeyForm.tsx - Adaptar para usar a conta ativa
const SendByKeyForm = () => {
  const { activeAccount } = useAccount();
  const pixEnviarMutation = useAccountPixEnviar();

  // Verificar se a conta ativa suporta PIX
  if (!activeAccount?.features.pix) {
    return <FeatureNotAvailable feature="PIX" />;
  }

  // Resto da implementação...
};
```

## 🎨 Melhorias na UX

### Indicadores Visuais
```typescript
// components/AccountIndicator.tsx
export const AccountIndicator = () => {
  const { activeAccount } = useAccount();
  
  return (
    <div className="bg-primary/10 border-b border-primary/20 py-2 px-4">
      <div className="container mx-auto flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {activeAccount?.displayName}
        </Badge>
        <StatusDot status={activeAccount?.status} />
      </div>
    </div>
  );
};
```

### Estados de Loading
```typescript
// components/AccountLoadingStates.tsx
export const AccountSwitchLoader = () => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Alternando conta...</span>
      </div>
    </Card>
  </div>
);
```

## 🔀 Plano de Implementação

### Fase 1: Estrutura Base (Semana 1)
- [ ] Criar tipos TypeScript para contas
- [ ] Implementar AccountContext
- [ ] Criar AccountSelector básico
- [ ] Configurar contas iniciais (mock)

### Fase 2: Integração com APIs (Semana 2)
- [ ] Implementar DynamicApiService
- [ ] Criar hooks adaptativos (useAccountSaldo, etc.)
- [ ] Modificar TopBarPayments
- [ ] Adaptar formulários PIX

### Fase 3: Melhorias UX (Semana 3)
- [ ] Implementar indicadores visuais
- [ ] Estados de loading/erro
- [ ] Persistência da conta selecionada
- [ ] Feedback de features não disponíveis

### Fase 4: Integrações Reais (Futuro)
- [ ] Integração com Bitso API
- [ ] Integração com MutualPay
- [ ] Configuração dinâmica de contas via backend
- [ ] Sistema de permissões por conta

## 🧪 Estratégia de Testes

### Desenvolvimento Local
```typescript
// utils/mockAccounts.ts
export const MOCK_ACCOUNTS_FOR_TESTING = [
  // Conta BMP (real)
  INITIAL_ACCOUNTS[0],
  
  // Conta Bitso (mock)
  {
    ...INITIAL_ACCOUNTS[1],
    status: 'active' // Ativar para testes
  },
  
  // Conta de teste
  {
    id: 'test-account',
    name: 'Conta de Teste',
    provider: 'bmp',
    displayName: 'Conta para Testes',
    // ...config
  }
];
```

### Simulação de APIs
```typescript
// services/mockApiService.ts
export const mockApiResponses = {
  bitso: {
    balance: () => ({
      success: true,
      payload: [
        { currency: 'btc', available: '0.12345678' },
        { currency: 'mxn', available: '1234.56' }
      ]
    })
  }
};
```

## 🔒 Considerações de Segurança

### Validação de Contas
- Verificar permissões antes de exibir contas
- Validar se usuário tem acesso à conta selecionada
- Implementar timeout para troca de contas

### Persistência Segura
```typescript
// utils/accountStorage.ts
export const ACCOUNT_STORAGE = {
  get: (): string | null => {
    try {
      return localStorage.getItem('selected_account_id');
    } catch {
      return null;
    }
  },
  
  set: (accountId: string): void => {
    // Validar se conta existe antes de persistir
    if (isValidAccountId(accountId)) {
      localStorage.setItem('selected_account_id', accountId);
    }
  }
};
```

## 📚 Recursos Adicionais

### Documentação de Referência
- [API BMP Atual](../BaaS-Nexus1/src/BMP/front-endpoints/)
- [Implementação Bitso](../BaaS-Nexus1/src/Bitso/implementacaoBitso.md)
- [Configuração de APIs](./src/config/api.ts)

### Ferramentas Úteis
- React Query para cache de dados por conta
- Zustand como alternativa ao Context API
- React Hook Form para formulários adaptativos

---

**Próximos Passos**: Começar pela Fase 1, criando a estrutura base do sistema de contas e testando com as contas mockadas antes de integrar com APIs reais. 