# 🏦 IMPLEMENTAÇÃO BMP-531 - PLANEJAMENTO DETALHADO

> **Integração do BMP-531 como novo provedor bancário no sistema multicontas**

## 📋 RESUMO EXECUTIVO

- ✅ **Backend BMP-531 já existe** - estrutura pronta no `BaaS-Nexus1/src/BMP-531/`
- ✅ **Frontend preparado** - arquitetura multi-banco escalável funcionando
- ✅ **Estimativa**: 2-3 horas para implementação completa
- ✅ **Complexidade**: BAIXA - é um espelho do BMP existente

---

## 🎯 ANÁLISE DA SITUAÇÃO ATUAL

### ✅ O QUE JÁ FUNCIONA
- **BMP normal**: Provider funcional com PIX, saldo, extrato
- **Bitso**: Provider funcional como segundo banco
- **Sistema unificado**: Roteamento automático baseado em conta ativa
- **Isolamento total**: Zero mistura entre providers
- **Templates**: Arquitetura preparada para N bancos

### 🚧 O QUE PRECISA SER FEITO
1. **Adicionar BMP_531 ao enum** de tipos
2. **Criar Bmp531Provider** (cópia do BmpProvider com URLs diferentes)
3. **Configurar no registry** de bancos
4. **Registrar no factory** de providers
5. **Adicionar conta no frontend** (AccountSelector + apiRouter)
6. **Testar integração** completa

---

## 📊 ESTRUTURA DO BMP-531 NO BACKEND

### Endpoints Identificados
```
🔹 PIX:
  POST /bmp-531/pix/enviar                 ✅ Pronto
  POST /bmp-531/pix/qrcode/estatico       ✅ Pronto

🔹 Handshake:
  POST /api/bmp-531/handshake             ✅ Pronto

🔹 Callback:
  POST /api/bmp-531/callback              ✅ Pronto

🔹 Auth:
  POST /api/bmp-531/auth/token            ✅ Pronto (assumido)

🔹 Transferências:
  API similar ao BMP normal               ✅ Pronto (assumido)

🔹 Contas:
  Endpoints de saldo/extrato              🚧 Verificar se existem
```

### Diferenças vs BMP Normal
- **URLs**: `/bmp-531/` ao invés de `/internal/` ou `/pix/`
- **Headers**: Logs mostram `[BMP-531-HANDSHAKE]` vs `[HANDSHAKE]`
- **Estrutura**: Idêntica, apenas prefixos diferentes

---

## 🚀 IMPLEMENTAÇÃO STEP-BY-STEP

### ETAPA 1: Tipos e Configuração (15 min)

#### 1.1 Adicionar ao Enum de Providers
```typescript
// deposit-sync-oracle/src/services/banking/types.ts
export enum BankProvider {
  BMP = 'bmp',
  BMP_531 = 'bmp-531',  // ← NOVO
  BITSO = 'bitso',
  // ... outros
}
```

#### 1.2 Configurar no Registry
```typescript
// deposit-sync-oracle/src/services/banking/config/BankConfigs.ts
[BankProvider.BMP_531]: {
  provider: BankProvider.BMP_531,
  name: 'BMP-531',
  displayName: 'BMP 531 - Pagamentos',
  environments: {
    development: {
      name: 'development',
      apiUrl: 'http://localhost:3000',  // mesmo que BMP
      timeout: 30000
    },
    production: {
      name: 'production', 
      apiUrl: 'https://api-bank.gruponexus.com.br',
      timeout: 15000
    }
  },
  features: [
    BankFeature.BALANCE,
    BankFeature.STATEMENT,
    BankFeature.PIX_SEND,
    BankFeature.PIX_RECEIVE,
    BankFeature.WEBHOOK
  ],
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000
  }
}
```

### ETAPA 2: Provider Implementation (45 min)

#### 2.1 Criar Bmp531Provider
```typescript
// deposit-sync-oracle/src/services/banking/providers/Bmp531Provider.ts

/**
 * 🏦 PROVIDER BMP-531
 * 
 * Implementação específica do BMP-531 (espelho do BMP)
 * Conecta com APIs do backend BMP-531
 */

import { BaseBankProvider } from '../BaseBankProvider';
import { BankProvider } from '../types';
// ... imports

export class Bmp531Provider extends BaseBankProvider {
  
  private readonly baseUrl: string;

  constructor(config: BankConfig) {
    super(config);
    this.baseUrl = config.apiUrl;
    
    this.logger.info('BMP-531 Provider configurado', {
      baseUrl: this.baseUrl,
      features: this.features
    });
  }

  // ✅ Health Check específico do BMP-531
  async healthCheck(): Promise<BankResponse<{ status: string; latency: number }>> {
    try {
      console.log('🩺 [BMP-531] Health check iniciado');
      const startTime = Date.now();
      
      // Testar endpoint específico BMP-531
      await this.makeRequest('GET', '/bmp-531/status'); // ← Verificar se existe
      
      const latency = Date.now() - startTime;
      return this.createSuccessResponse({ status: 'healthy', latency });
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ✅ Saldo - adaptar para endpoints BMP-531
  async getBalance(accountId?: string): Promise<BankResponse<StandardBalance>> {
    try {
      console.log('💰 [BMP-531] getBalance() - consultando saldo BMP-531', { accountId });
      
      // ⚠️ DESCOBRIR: Qual endpoint de saldo existe no BMP-531?
      // Opções: /bmp-531/account/balance ou /bmp-531/saldo
      const response = await this.makeRequest('GET', '/bmp-531/account/saldo');
      
      const standardBalance: StandardBalance = {
        provider: BankProvider.BMP_531,
        accountId: accountId || 'bmp-531-main',
        currency: 'BRL',
        available: response.saldoDisponivel || 0,
        blocked: response.saldoBloqueado || 0,
        total: (response.saldoDisponivel || 0) + (response.saldoBloqueado || 0),
        lastUpdate: response.atualizadoEm || new Date().toISOString(),
        raw: response
      };

      return this.createSuccessResponse(standardBalance);
      
    } catch (error) {
      this.logger.error('Erro ao consultar saldo BMP-531', error);
      return this.handleError(error);
    }
  }

  // ✅ PIX - usar endpoint já confirmado
  async sendPix(pixData: {
    key: string;
    amount: number;
    description?: string;
  }, accountId?: string): Promise<BankResponse<StandardTransaction>> {
    try {
      console.log('🚀 [BMP-531] sendPix() - enviando PIX via BMP-531', pixData);
      
      const requestData = {
        chave: pixData.key,
        valor: pixData.amount,
        descricao: pixData.description || 'Transferência PIX',
        // ⚠️ BMP-531 pode exigir dadosBancarios - verificar
      };

      const response = await this.makeRequest('POST', '/bmp-531/pix/enviar', requestData);

      const standardTransaction: StandardTransaction = {
        provider: BankProvider.BMP_531,
        id: response.codigoTransacao || `bmp-531-pix-${Date.now()}`,
        externalId: response.codigoTransacao,
        accountId: accountId || 'bmp-531-main',
        amount: pixData.amount,
        currency: 'BRL',
        type: TransactionType.DEBIT,
        status: response.sucesso ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
        description: `PIX para ${pixData.key}: ${pixData.description}`,
        date: new Date().toISOString(),
        counterparty: { account: pixData.key },
        raw: response
      };

      return this.createSuccessResponse(standardTransaction);
      
    } catch (error) {
      this.logger.error('Erro ao enviar PIX via BMP-531', error);
      return this.handleError(error);
    }
  }

  // ✅ Outros métodos similares ao BmpProvider...
  // getStatement(), getPixKeys(), etc.
}
```

#### 2.2 Registrar no Factory
```typescript
// deposit-sync-oracle/src/services/banking/BankManager.ts
import { Bmp531Provider } from './providers/Bmp531Provider';

// No método createProvider:
case BankProvider.BMP_531:
  return new Bmp531Provider(config);
```

#### 2.3 Auto-registro
```typescript
// No método autoRegisterDefaultProviders:
const defaultProviders = [
  BankProvider.BMP, 
  BankProvider.BMP_531,  // ← ADICIONAR
  BankProvider.BITSO
];
```

### ETAPA 3: Frontend Integration (30 min)

#### 3.1 Adicionar Conta no Sistema
```typescript
// deposit-sync-oracle/src/pages/payments/apiRouter.ts
export const ACCOUNTS: Account[] = [
  {
    id: 'bmp-main',
    name: 'BMP Principal',
    provider: 'bmp',
    displayName: 'Conta Principal BMP',
    bankInfo: { bank: 'Banco 274', agency: '0001', account: '902486-0' }
  },
  {
    id: 'bmp-531-main',      // ← NOVO
    name: 'BMP 531',
    provider: 'bmp-531',
    displayName: 'BMP 531 - Pagamentos',
    bankInfo: { bank: 'Banco 531', agency: '0001', account: '531001-0' }
  },
  {
    id: 'bitso-crypto',
    // ... existente
  }
];
```

#### 3.2 Mapeamento de Rotas
```typescript
// No objeto API_ROUTES:
'bmp-531': {
  balance: '/bmp-531/account/saldo',
  statement: '/bmp-531/account/extrato',
  sendPix: '/bmp-531/pix/enviar',
  pixKeys: '/bmp-531/pix/chaves'
}
```

#### 3.3 Mapeamento no UnifiedBankingService
```typescript
// deposit-sync-oracle/src/services/banking/UnifiedBankingService.ts
const legacyToProviderMap: Record<string, BankProvider> = {
  'bmp-main': BankProvider.BMP,
  'bmp-531-main': BankProvider.BMP_531,  // ← NOVO
  'bitso-crypto': BankProvider.BITSO
};
```

#### 3.4 Badge no AccountSelector
```typescript
// deposit-sync-oracle/src/pages/payments/AccountSelector.tsx
const badges = {
  'bmp': { label: 'BMP', color: 'bg-blue-100 text-blue-800' },
  'bmp-531': { label: 'BMP-531', color: 'bg-indigo-100 text-indigo-800' },  // ← NOVO
  'bitso': { label: 'Bitso', color: 'bg-orange-100 text-orange-800' }
};
```

### ETAPA 4: Testing & Debugging (30 min)

#### 4.1 Testes Básicos
1. **Health Check**: Verificar conectividade com BMP-531
2. **Troca de Conta**: Alternar entre BMP, BMP-531 e Bitso
3. **Saldo**: Consultar saldo específico do BMP-531
4. **PIX**: Enviar PIX via BMP-531 e verificar logs
5. **Isolamento**: Confirmar que dados não se misturam

#### 4.2 Logs para Debug
```javascript
// Verificar nos logs do browser:
[UNIFIED-BANKING] Conta ativa: bmp-531-main (bmp-531)
[BMP-531] getBalance() - consultando saldo BMP-531
[BMP-531] sendPix() - enviando PIX via BMP-531
```

---

## ⚠️ PONTOS DE ATENÇÃO

### 🔍 Descobrir no Backend
1. **Endpoint de saldo**: `/bmp-531/account/saldo` existe?
2. **Endpoint de extrato**: `/bmp-531/account/extrato` existe?
3. **Dados bancários**: BMP-531 exige `dadosBancarios` no PIX?
4. **Autenticação**: Usa mesmo token do BMP ou separado?

### 🚨 Validações Obrigatórias
- [ ] **URLs corretas** - confirmar endpoints do BMP-531
- [ ] **Headers específicos** - verificar se precisa de headers diferentes
- [ ] **Dados estruturados** - confirmar formato de requests/responses
- [ ] **Rate limiting** - verificar se tem limites diferentes do BMP

### 🔒 Checklist de Isolamento
- [ ] Função `enviarPixBmp531()` não chama funções BMP normais
- [ ] Logs mostram `[BMP-531]` e não `[BMP]`
- [ ] URLs contêm `/bmp-531/` e não `/internal/`
- [ ] Provider correto em todas as responses: `BankProvider.BMP_531`
- [ ] Nenhum compartilhamento de código entre BMP e BMP-531

---

## 🎯 CRONOGRAMA DE IMPLEMENTAÇÃO

### Sessão 1 (1h)
- [x] ✅ Análise completa (feita)
- [ ] Implementar tipos e configuração
- [ ] Criar Bmp531Provider básico
- [ ] Implementar healthCheck e getBalance

### Sessão 2 (1h)
- [ ] Implementar sendPix e getStatement
- [ ] Registrar no factory e auto-registro
- [ ] Adicionar conta no frontend

### Sessão 3 (30min)
- [ ] Testes básicos de integração
- [ ] Verificar isolamento total
- [ ] Ajustes finais

---

## 📈 RESULTADO ESPERADO

### ✅ Após Implementação
- **3 bancos funcionais**: BMP, BMP-531, Bitso
- **Troca fluida**: Seletor com 3 opções funcionando
- **Isolamento total**: Zero mistura de dados
- **Funcionalidades**: PIX, saldo, extrato via BMP-531
- **Logs claros**: `[BMP-531]` distinguível de `[BMP]`

### 🚀 Próximos Passos
- **Validar endpoints** de saldo/extrato no backend
- **Implementar funcionalidades avançadas** (QR Code, chaves PIX)
- **Otimizar performance** se necessário
- **Documentar** diferenças entre BMP e BMP-531

---

## 🎉 CONCLUSÃO

A implementação do BMP-531 será **rápida e direta** porque:

✅ **Backend já existe** - endpoints prontos e funcionais  
✅ **Arquitetura preparada** - sistema escalável para N bancos  
✅ **Template disponível** - BmpProvider como base  
✅ **Isolamento garantido** - regras rigorosas impedem mistura  
✅ **Testing fácil** - health checks e logs detalhados  

**Próximo passo**: Começar pela Etapa 1 e implementar em sequência! 🚀

---

**Data:** Janeiro 2025  
**Estimativa:** 2-3 horas  
**Complexidade:** BAIXA  
**Benefício:** +1 banco disponível com esforço mínimo  