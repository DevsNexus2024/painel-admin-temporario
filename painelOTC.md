# 🚀 **Prompt para Implementação do Painel OTC Frontend**

---

## 📋 **Contexto do Projeto**

Implementamos um **Sistema OTC (Over-the-Counter)** completo no backend para controlar transações de clientes que movimentam grandes volumes. O sistema já está **100% funcional** e precisa de uma interface administrativa web.

## 🎯 **Objetivo**

Criar uma **tela/painel administrativo separado** para gerenciar o sistema OTC, com interface moderna e funcional para:

- **Listar e gerenciar clientes OTC**
- **Visualizar saldos e extratos detalhados**
- **Executar operações manuais (crédito/débito)**
- **Monitorar estatísticas e métricas**
- **Consultar histórico de operações**

## 🏗️ **Especificações Técnicas**

### **Base URL da API**
```
https://api-bank.gruponexus.com.br/api/otc
```

### **Autenticação**
- Todas as APIs requerem autenticação Bearer Token
- Privilégios de administrador necessários
- Header: `Authorization: Bearer <token>`

---

## 🔌 **APIs Disponíveis**

### **1. Listar Clientes OTC**
```http
GET /api/otc/clients
```

**Query Parameters:**
- `is_active` (boolean): Filtrar por status ativo
- `search` (string): Buscar por nome, documento ou chave PIX
- `page` (number): Página (default: 1)
- `limit` (number): Limite por página (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "clientes": [
      {
        "id": 1,
        "name": "João Silva",
        "document": "12345678901",
        "pix_key": "joao@exemplo.com",
        "pix_key_type": "email",
        "is_active": true,
        "current_balance": 1500.50,
        "total_transactions": 25,
        "user": {
          "id": 2,
          "name": "João Silva",
          "email": "joao@exemplo.com"
        },
        "created_at": "2025-01-15T10:00:00Z",
        "updated_at": "2025-01-15T10:00:00Z"
      }
    ],
    "estatisticas": {
      "total_clientes": 10,
      "clientes_ativos": 8,
      "clientes_inativos": 2,
      "total_saldo": 15000.00,
      "total_transacoes": 150
    }
  }
}
```

### **2. Criar Cliente OTC**
```http
POST /api/otc/clients
```

**Body:**
```json
{
  "user_id": 2,
  "client_name": "João Silva",
  "client_document": "12345678901",
  "pix_key": "joao@exemplo.com",
  "pix_key_type": "email"
}
```

**Tipos de Chave PIX:** `cpf`, `cnpj`, `email`, `phone`, `random`

### **3. Obter Cliente Específico**
```http
GET /api/otc/clients/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva",
    "document": "12345678901",
    "pix_key": "joao@exemplo.com",
    "pix_key_type": "email",
    "is_active": true,
    "current_balance": 1500.50,
    "last_updated": "2025-01-15T15:30:00Z",
    "user": {
      "id": 2,
      "name": "João Silva",
      "email": "joao@exemplo.com"
    },
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

### **4. Obter Saldo do Cliente**
```http
GET /api/otc/clients/{id}/balance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client_id": 1,
    "client_name": "João Silva",
    "current_balance": 1500.50,
    "last_updated": "2025-01-15T15:30:00Z",
    "last_transaction_id": 125
  }
}
```

### **5. Obter Extrato do Cliente**
```http
GET /api/otc/clients/{id}/statement
```

**Query Parameters:**
- `page` (number): Página (default: 1)
- `limit` (number): Limite por página (default: 50)
- `dateFrom` (string): Data inicial (YYYY-MM-DD)
- `dateTo` (string): Data final (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "cliente": {
      "id": 1,
      "name": "João Silva",
      "document": "12345678901",
      "pix_key": "joao@exemplo.com",
      "current_balance": 1500.50,
      "last_updated": "2025-01-15T15:30:00Z"
    },
    "transacoes": [
      {
        "id": 125,
        "type": "deposit",
        "amount": 500.00,
        "date": "2025-01-15T15:30:00Z",
        "status": "processed",
        "payer_name": "Maria Santos",
        "payer_document": "98765432100",
        "bmp_identifier": "27400010902486053781325000115",
        "notes": "Depósito PIX processado automaticamente via webhook"
      }
    ],
    "historico_saldo": [
      {
        "id": 50,
        "balance_before": 1000.50,
        "balance_after": 1500.50,
        "amount_change": 500.00,
        "operation_type": "deposit",
        "description": "Depósito PIX de +R$ 500.00",
        "created_at": "2025-01-15T15:30:00Z",
        "transaction_id": 125,
        "created_by": "Sistema"
      }
    ],
    "paginacao": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "total_pages": 1
    }
  }
}
```

### **6. Criar Operação Manual**
```http
POST /api/otc/operations
```

**Body:**
```json
{
  "otc_client_id": 1,
  "operation_type": "credit",
  "amount": 100.00,
  "description": "Crédito por operação OTC realizada"
}
```

**Tipos de Operação:**
- `credit`: Adicionar crédito ao saldo (requer `amount`)
- `debit`: Remover valor do saldo (requer `amount`)
- `lock`: Bloquear conta (apenas anotação)
- `unlock`: Desbloquear conta (apenas anotação)
- `note`: Adicionar anotação

**Response:**
```json
{
  "success": true,
  "message": "Operação manual criada com sucesso",
  "data": {
    "success": true,
    "operation_id": 15,
    "transaction_id": 126,
    "client_name": "João Silva",
    "operation_type": "credit",
    "amount": 100.00,
    "new_balance": 1600.50,
    "description": "Crédito por operação OTC realizada"
  }
}
```

### **7. Listar Operações Manuais**
```http
GET /api/otc/operations
```

**Query Parameters:**
- `otc_client_id` (number): Filtrar por cliente
- `page` (number): Página (default: 1)
- `limit` (number): Limite por página (default: 50)

### **8. Obter Estatísticas**
```http
GET /api/otc/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientes": {
      "total": 10,
      "ativos": 8,
      "inativos": 2
    },
    "transacoes": {
      "total": 150,
      "hoje": 5
    },
    "valores": {
      "total_depositos": 50000.00,
      "total_saques": 15000.00,
      "saldo_total": 35000.00
    }
  }
}
```

---

## 🎨 **Especificações da Interface**

### **1. Dashboard Principal**
- **Cards de Estatísticas:**
  - Total de clientes (ativos/inativos)
  - Saldo total do sistema
  - Transações do dia
  - Volume total (depósitos/saques)

- **Gráficos:**
  - Evolução de saldo ao longo do tempo
  - Volume de transações por dia
  - Top 10 clientes por volume

### **2. Lista de Clientes**
- **Tabela com colunas:**
  - Nome do cliente
  - Documento (CPF/CNPJ)
  - Chave PIX
  - Saldo atual (destacar negativos em vermelho)
  - Status (ativo/inativo)
  - Total de transações
  - Data de criação
  - Ações (ver extrato, editar, operações)

- **Funcionalidades:**
  - Busca/filtro por nome, documento ou chave PIX
  - Filtro por status (ativo/inativo)
  - Paginação
  - Ordenação por colunas
  - Botão "Novo Cliente"

### **3. Modal/Página de Extrato**
- **Informações do cliente:**
  - Nome, documento, chave PIX
  - Saldo atual (destacar se negativo)
  - Última atualização

- **Filtros:**
  - Data inicial e final
  - Tipo de transação
  - Valor mínimo/máximo

- **Tabela de transações:**
  - Data/hora
  - Tipo (depósito/saque/manual)
  - Valor (+ verde, - vermelho)
  - Pagador/Recebedor
  - Status
  - Observações
  - Saldo após transação

- **Histórico de saldo:**
  - Linha do tempo de alterações
  - Saldo antes/depois
  - Usuário responsável (se manual)

### **4. Modal de Operação Manual**
- **Formulário:**
  - Seleção do cliente (dropdown/autocomplete)
  - Tipo de operação (radio buttons)
  - Valor (se aplicável)
  - Descrição (obrigatória)
  - Botão confirmar com dupla confirmação

- **Validações:**
  - Valor obrigatório para crédito/débito
  - Descrição sempre obrigatória
  - Confirmação antes de executar

### **5. Modal de Novo Cliente**
- **Formulário:**
  - Nome do cliente
  - CPF/CNPJ
  - Chave PIX
  - Tipo da chave PIX
  - Usuário vinculado (dropdown)

- **Validações:**
  - CPF/CNPJ válido
  - Chave PIX única
  - Formato correto conforme tipo

---

## 🔄 **Fluxos de Funcionamento**

### **Fluxo 1: Consultar Extrato**
1. Admin clica em "Ver Extrato" do cliente
2. Sistema abre modal/página com dados do cliente
3. Admin pode filtrar por data/tipo
4. Sistema exibe transações e histórico paginado
5. Admin pode fazer operação manual direto do extrato

### **Fluxo 2: Operação Manual**
1. Admin clica em "Nova Operação" ou "Operar" do cliente
2. Sistema abre modal de operação
3. Admin seleciona tipo, valor e descrição
4. Sistema pede confirmação
5. Admin confirma, sistema executa
6. Sistema exibe sucesso e atualiza saldo

### **Fluxo 3: Criar Cliente**
1. Admin clica em "Novo Cliente"
2. Sistema abre formulário
3. Admin preenche dados
4. Sistema valida e cria
5. Cliente aparece na lista

---

## 🎯 **Funcionalidades Específicas**

### **Tempo Real**
- **Atualização automática de saldos** (polling ou WebSocket)
- **Notificações** quando novos depósitos chegam
- **Refresh automático** das estatísticas

### **Responsividade**
- **Desktop-first** (prioridade)
- **Mobile-friendly** para consultas
- **Tablet** para operações básicas

### **Ações Rápidas**
- **Botões de ação** diretos na tabela
- **Atalhos de teclado** para operações frequentes
- **Bulk operations** para múltiplos clientes

### **Exportação**
- **Export CSV/Excel** da lista de clientes
- **Export PDF** do extrato do cliente
- **Relatórios** periódicos

---

## 🔧 **Requisitos Técnicos**

### **Stack Sugerida**
- **React** com hooks ou **Vue.js**
- **Tailwind CSS** ou **Material-UI**
- **Axios** para requisições HTTP
- **React Query** ou **SWR** para cache
- **Date-fns** para manipulação de datas

### **Componentes Necessários**
- **DataTable** com paginação/filtros
- **Modal/Dialog** para operações
- **Form** com validação
- **Charts** para dashboard
- **DatePicker** para filtros
- **Autocomplete** para seleção

### **Estado/Cache**
- **Cache das listas** para performance
- **Invalidação** após operações
- **Estado global** para dados compartilhados

---

## 🛡️ **Segurança e Validações**

### **Validações Frontend**
- **Validação de CPF/CNPJ**
- **Validação de email/telefone** para PIX
- **Validação de valores** (positivos para operações)
- **Sanitização** de inputs

### **Tratamento de Erros**
- **Mensagens amigáveis** para erros da API
- **Fallbacks** para conexão perdida
- **Retry automático** para operações falhadas

### **Confirmações**
- **Dupla confirmação** para operações que afetam saldo
- **Preview** antes de executar operações
- **Logs** das ações do usuário

---

## 📱 **Layout/UI Sugerido**

### **Cores**
- **Verde:** Saldos positivos, depósitos
- **Vermelho:** Saldos negativos, saques
- **Azul:** Ações primárias, links
- **Cinza:** Informações neutras

### **Tipografia**
- **Valores monetários:** Destaque, fonte maior
- **Dados críticos:** Bold, contraste alto
- **Metadados:** Fonte menor, cor suave

### **Iconografia**
- **Depósitos:** Seta para cima, verde
- **Saques:** Seta para baixo, vermelho
- **Operações manuais:** Ícone de engrenagem
- **Status:** Indicadores visuais claros

---

## 🚀 **Entregáveis Esperados**

1. **Painel administrativo completo** com todas as funcionalidades
2. **Responsivo** para desktop e mobile
3. **Código limpo** e bem documentado
4. **Testes unitários** dos componentes principais
5. **README** com instruções de instalação/uso

---

## 💡 **Observações Importantes**

- **Saldos podem ser negativos** (destacar visualmente)
- **Todas as operações são auditadas** (mostrar quem fez o quê)
- **Processamento automático** via webhook (explicar na UI)
- **Chaves PIX são únicas** (validar no frontend)
- **Descrições são obrigatórias** em operações manuais

---

## 🎯 **Priorização**

### **Prioridade 1 (MVP):**
- Lista de clientes
- Extrato básico
- Operações manuais
- Dashboard com estatísticas

### **Prioridade 2:**
- Filtros avançados
- Exportação
- Gráficos
- Notificações

### **Prioridade 3:**
- Tempo real
- Bulk operations
- Relatórios avançados
- Mobile otimizado

---

**Dúvidas ou esclarecimentos sobre as APIs/funcionamento podem ser direcionadas para o desenvolvedor backend responsável.**