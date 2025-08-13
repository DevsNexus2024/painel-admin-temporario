# 🔧 EXEMPLO DE SUBSTITUIÇÃO DE LOGS CRÍTICOS
**Data:** Janeiro 2025  
**Objetivo:** Exemplos práticos para substituir console.logs problemáticos

---

## 🚨 SUBSTITUIÇÕES URGENTES

### **1. config/api.ts - DADOS SENSÍVEIS**

#### ❌ **ANTES (PROBLEMÁTICO):**
```typescript
// Expõe configurações em produção
console.log(`🔧 Ambiente: ${FORCE_ENVIRONMENT.toUpperCase()} (FORÇADO)`);
console.log(`🔧 API Base URL: ${baseUrl}`);
console.log(`🔍 API Diagnóstico URL: ${DIAGNOSTICO_API_URL}`);

// Expõe headers e tokens
console.log(`📋 Headers:`, headers);
console.log(`📦 Body:`, options.body);
```

#### ✅ **DEPOIS (SEGURO):**
```typescript
import { logger } from '@/utils/logger';

// Apenas em desenvolvimento
logger.debug('Configuração da API carregada', {
  hasBaseUrl: !!baseUrl,
  hasDiagnosticoUrl: !!DIAGNOSTICO_API_URL,
  environment: FORCE_ENVIRONMENT
});

// Headers sem dados sensíveis
logger.apiRequest(options.method || 'GET', url.split('?')[0]);
logger.debug('Requisição enviada', {
  hasHeaders: !!headers,
  hasBody: !!options.body
});
```

### **2. services/bmp531.ts - DADOS FINANCEIROS**

#### ❌ **ANTES (VAZAMENTO CRÍTICO):**
```typescript
// Expõe dados financeiros
console.log(`💸 [BMP531Service] Enviando PIX da conta ${accountType.toUpperCase()}...`, { 
  chave: data.chave,   // ⚠️ CHAVE PIX EXPOSTA!
  valor: data.valor,   // ⚠️ VALOR EXPOSTO!
});

// Request body completo exposto
console.log('💸 [BMP531Service] Request body:', requestBody);
```

#### ✅ **DEPOIS (PROTEGIDO):**
```typescript
import { logger } from '@/utils/logger';

// Dados não sensíveis apenas
logger.info('Iniciando transferência PIX', {
  accountType: accountType.toUpperCase(),
  hasChave: !!data.chave,
  hasValor: !!data.valor,
  hasDescricao: !!data.descricao
}, 'BMP531Service');

// Request sem dados sensíveis
logger.debug('Request preparado', {
  hasBody: !!requestBody,
  bodyKeys: requestBody ? Object.keys(requestBody) : []
}, 'BMP531Service');

// Dados sensíveis apenas em desenvolvimento
logger.sensitive('PIX data', data, 'BMP531Service');
```

### **3. services/extrato.ts - DADOS BANCÁRIOS**

#### ❌ **ANTES (PROBLEMA DE SEGURANÇA):**
```typescript
// URL completa exposta
console.log(`🔵 [EXTRATO-SEGURO] URL ${provider.toUpperCase()}: ${fullUrl}`);

// Dados bancários expostos
console.log(`✅ [EXTRATO-SEGURO] Resposta ${provider.toUpperCase()} recebida:`, {
  hasItems: !!result?.items,
  itemCount: result?.items?.length || 0
});

// Primeira transação exposta
console.log(`🔒 [EXTRATO-SEGURO] Primeira transação:`, movimentosFormatados[0]);
```

#### ✅ **DEPOIS (SANITIZADO):**
```typescript
import { logger, usePerformanceTimer } from '@/utils/logger';

// URL sem parâmetros sensíveis
logger.apiRequest('GET', endpoint, 'ExtratoService');

// Resposta sem dados sensíveis
logger.info('Extrato recebido', {
  provider: provider.toUpperCase(),
  hasItems: !!result?.items,
  itemCount: result?.items?.length || 0,
  success: !!result?.sucesso
}, 'ExtratoService');

// Performance tracking
const endTimer = usePerformanceTimer('Consulta extrato', 'ExtratoService');
// ... operação ...
endTimer();

// Dados sensíveis apenas em dev
logger.sensitive('Primeira transação', {
  hasData: !!movimentosFormatados[0],
  keys: movimentosFormatados[0] ? Object.keys(movimentosFormatados[0]) : []
}, 'ExtratoService');
```

---

## 🛠️ PATTERNS DE SUBSTITUIÇÃO

### **Pattern 1: Dados Financeiros**
```typescript
// ❌ NUNCA fazer
console.log('PIX enviado:', { valor: 1000, chave: 'usuario@email.com' });

// ✅ SEMPRE fazer
logger.info('PIX processado', { 
  hasValor: !!valor, 
  hasChave: !!chave,
  status: 'success' 
});
```

### **Pattern 2: URLs e Endpoints**
```typescript
// ❌ NUNCA fazer
console.log('Chamando API:', `https://api.com/pix?token=abc123`);

// ✅ SEMPRE fazer
logger.apiRequest('POST', '/pix', 'ComponentName');
```

### **Pattern 3: Responses de API**
```typescript
// ❌ NUNCA fazer
console.log('Response:', response);

// ✅ SEMPRE fazer
logger.apiResponse(response.status, 'Operação concluída', 'ComponentName');
```

### **Pattern 4: Estados React**
```typescript
// ❌ NUNCA fazer  
console.log('Estado atualizado:', novoEstado);

// ✅ SEMPRE fazer
import { stateLog } from '@/utils/logger';
stateLog('ComponentName', 'estadoNome', { hasData: !!novoEstado });
```

---

## 📋 CHECKLIST DE MIGRAÇÃO

### **Para cada arquivo com console.log:**

#### **Etapa 1: Importar Logger**
```typescript
import { logger } from '@/utils/logger';
```

#### **Etapa 2: Identificar Tipo de Log**
- [ ] **Dados sensíveis?** → `logger.sensitive()` ou remover
- [ ] **Debug info?** → `logger.debug()`
- [ ] **Informação?** → `logger.info()`
- [ ] **Aviso?** → `logger.warn()`
- [ ] **Erro?** → `logger.error()`

#### **Etapa 3: Sanitizar Dados**
- [ ] Remover valores reais
- [ ] Usar flags `has*` 
- [ ] Contar items em vez de mostrar
- [ ] Ocultar URLs completas

#### **Etapa 4: Adicionar Contexto**
```typescript
logger.info('mensagem', dados, 'NomeDoComponente');
```

---

## 🚀 SCRIPT DE BUSCA E SUBSTITUIÇÃO

### **Regex para encontrar logs problemáticos:**

```bash
# Encontrar logs com dados sensíveis
grep -r "console\.log.*\(chave\|valor\|saldo\|token\|secret\)" src/

# Encontrar logs com URLs
grep -r "console\.log.*http" src/

# Encontrar logs com objetos completos
grep -r "console\.log.*," src/ | grep -v "has"
```

### **Comandos de substituição rápida:**

```bash
# Substituir imports de console por logger
find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/console\.log/logger.debug/g'

# Adicionar import do logger
find src/ -name "*.ts" -o -name "*.tsx" | xargs grep -l "logger\." | xargs sed -i '1i import { logger } from "@/utils/logger";'
```

---

## ⚡ IMPLEMENTAÇÃO RÁPIDA

### **Arquivos para migrar AGORA (Ordem de prioridade):**

1. **`config/api.ts`** - Configurações expostas
2. **`services/bmp531.ts`** - Dados PIX expostos  
3. **`services/extrato.ts`** - Dados bancários expostos
4. **`services/auth.ts`** - Tokens expostos
5. **`pages/payments/*.tsx`** - Transações expostas

### **Tempo estimado por arquivo:**
- **Pequeno** (< 5 logs): 10 minutos
- **Médio** (5-15 logs): 20 minutos  
- **Grande** (15+ logs): 30 minutos

**Total estimado:** 4-6 horas para migração completa

---

**🎯 Resultado:** Sistema de logs seguro, performático e configurável por ambiente.
