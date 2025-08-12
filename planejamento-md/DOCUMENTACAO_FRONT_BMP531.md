# 📋 Documentação de Integração - Front-end com APIs BMP-531

## 🚀 Visão Geral

As APIs do módulo `front-endpoints` da BMP-531 foram desenvolvidas para serem **totalmente dinâmicas**, sem dados hardcoded. Todos os endpoints exigem que os **dados bancários do usuário** sejam enviados nas requisições.

## 🏦 Estrutura dos Dados Bancários

**⚠️ IMPORTANTE:** Todos os endpoints que manipulam transações exigem o objeto `dadosBancarios` no body da requisição:

```json
{
  "dadosBancarios": {
    "agencia": "0001",
    "agencia_digito": "8", 
    "conta": "157",
    "conta_digito": "8",
    "conta_pgto": "00001578",
    "tipo_conta": 3,
    "modelo_conta": 1,
    "pix_key": "usuario@email.com" // Apenas para QR Code estático
  }
}
```

**Campos obrigatórios:**
- `agencia`: Código da agência
- `conta`: Número da conta
- `conta_digito`: Dígito verificador da conta
- `conta_pgto`: Conta formatada para pagamento
- `tipo_conta`: Tipo da conta (numérico)
- `modelo_conta`: Modelo da conta (numérico)

## 💰 Módulo PIX

### 1. Enviar PIX
**Endpoint:** `POST /bmp-531/pix/enviar`

```javascript
const enviarPix = async (dadosTransferencia) => {
  const response = await fetch('/bmp-531/pix/enviar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chave: dadosTransferencia.chave, // Obrigatório
      valor: dadosTransferencia.valor, // Obrigatório (number)
      descricao: dadosTransferencia.descricao, // Opcional
      informacoesAdicionais: dadosTransferencia.informacoesAdicionais, // Opcional
      remittanceInformation: dadosTransferencia.remittanceInformation, // Opcional
      dadosBancarios: {
        agencia: dadosTransferencia.agencia,
        agencia_digito: dadosTransferencia.agenciaDigito,
        conta: dadosTransferencia.conta,
        conta_digito: dadosTransferencia.contaDigito,
        conta_pgto: dadosTransferencia.contaPgto,
        tipo_conta: dadosTransferencia.tipoConta,
        modelo_conta: dadosTransferencia.modeloConta
      }
    })
  });
  
  return await response.json();
};
```

**Resposta:**
```json
{
  "sucesso": true,
  "codigoTransacao": "12345678",
  "status": "concluido",
  "mensagem": "Transferência PIX realizada com sucesso"
}
```

### 2. Pagar PIX Copia e Cola
**Endpoint:** `POST /bmp-531/pix/pagar-copia-cola`

```javascript
const pagarCopiaCola = async (dadosPagamento) => {
  const response = await fetch('/bmp-531/pix/pagar-copia-cola', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      emv: dadosPagamento.emv, // Obrigatório - código do QR
      valor: dadosPagamento.valor, // Opcional - se não informado, usa valor do QR
      descricao: dadosPagamento.descricao, // Opcional
      dadosBancarios: {
        agencia: dadosPagamento.agencia,
        agencia_digito: dadosPagamento.agenciaDigito,
        conta: dadosPagamento.conta,
        conta_digito: dadosPagamento.contaDigito,
        conta_pgto: dadosPagamento.contaPgto,
        tipo_conta: dadosPagamento.tipoConta,
        modelo_conta: dadosPagamento.modeloConta
      }
    })
  });
  
  return await response.json();
};
```

### 3. Criar QR Code Estático
**Endpoint:** `POST /bmp-531/pix/qrcode/estatico`

```javascript
const criarQRCodeEstatico = async (dadosQR) => {
  const response = await fetch('/bmp-531/pix/qrcode/estatico', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chave: dadosQR.chave, // Opcional - se omitida, usa pix_key dos dados bancários
      valor: dadosQR.valor, // Opcional - se omitido, QR de valor aberto
      informacoesAdicionais: dadosQR.informacoesAdicionais, // Opcional
      idConciliacaoRecebedor: dadosQR.idConciliacao, // Opcional
      dadosBancarios: {
        agencia: dadosQR.agencia,
        agencia_digito: dadosQR.agenciaDigito,
        conta: dadosQR.conta,
        conta_digito: dadosQR.contaDigito,
        conta_pgto: dadosQR.contaPgto,
        tipo_conta: dadosQR.tipoConta,
        modelo_conta: dadosQR.modeloConta,
        pix_key: dadosQR.pixKey // Chave PIX padrão da conta
      }
    })
  });
  
  return await response.json();
};
```

**Resposta:**
```json
{
  "sucesso": true,
  "qrCode": "00020126330014BR.GOV.BCB.PIX...",
  "linkPagamento": "https://....",
  "dados": {...},
  "mensagem": "QR Code estático criado com sucesso"
}
```

### 4. Consultar Chave PIX
**Endpoint:** `GET /bmp-531/pix/consultar-chave?chave={chave}`

```javascript
const consultarChavePix = async (chave, dadosBancarios = null) => {
  const url = `/bmp-531/pix/consultar-chave?chave=${encodeURIComponent(chave)}`;
  
  const response = await fetch(url, {
    method: 'GET', // ⚠️ É GET, mas com body para dados bancários opcionais
    headers: {
      'Content-Type': 'application/json'
    },
    body: dadosBancarios ? JSON.stringify({
      dadosBancarios: dadosBancarios
    }) : undefined
  });
  
  return await response.json();
};
```

### 5. Listar Chaves PIX
**Endpoint:** `GET /bmp-531/pix/chaves/listar`

```javascript
const listarChavesPix = async (dadosBancarios = null) => {
  const response = await fetch('/bmp-531/pix/chaves/listar', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    body: dadosBancarios ? JSON.stringify({
      dadosBancarios: dadosBancarios
    }) : undefined
  });
  
  return await response.json();
};
```

### 6. Criar Chave PIX
**Endpoint:** `POST /bmp-531/pix/chaves/criar`

```javascript
const criarChavePix = async (dadosChave) => {
  const response = await fetch('/bmp-531/pix/chaves/criar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tipoChave: dadosChave.tipoChave, // Obrigatório: 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'
      chave: dadosChave.chave, // Opcional para chave aleatória
      codigoMfa: dadosChave.codigoMfa, // Necessário na 2ª chamada para email/telefone
      codigoAutenticacao: dadosChave.codigoAutenticacao, // Retornado na 1ª chamada
      dadosBancarios: {
        agencia: dadosChave.agencia,
        agencia_digito: dadosChave.agenciaDigito,
        conta: dadosChave.conta,
        conta_digito: dadosChave.contaDigito,
        conta_pgto: dadosChave.contaPgto,
        tipo_conta: dadosChave.tipoConta,
        modelo_conta: dadosChave.modeloConta
      }
    })
  });
  
  return await response.json();
};

// Exemplo de uso - Chave aleatória (criação direta)
const chaveAleatoria = await criarChavePix({
  tipoChave: 'aleatoria',
  agencia: '0001',
  // ... outros dados bancários
});

// Exemplo de uso - Email (fluxo com MFA)
// 1ª Chamada
const primeiraEtapa = await criarChavePix({
  tipoChave: 'email',
  chave: 'usuario@email.com',
  agencia: '0001',
  // ... outros dados bancários
});
// Resposta: { "etapa": "MFA_SOLICITADO", "codigoAutenticacao": "uuid-123" }

// 2ª Chamada (após receber SMS/Email com código)
const segundaEtapa = await criarChavePix({
  tipoChave: 'email',
  chave: 'usuario@email.com',
  codigoMfa: '123456', // Código recebido por SMS/Email
  codigoAutenticacao: primeiraEtapa.codigoAutenticacao,
  agencia: '0001',
  // ... outros dados bancários
});
```

**Resposta para criação direta (CPF/CNPJ/Aleatória):**
```json
{
  "sucesso": true,
  "etapa": "CHAVE_CRIADA",
  "mensagem": "Chave PIX criada com sucesso"
}
```

**Resposta para primeira etapa (Email/Telefone):**
```json
{
  "sucesso": true,
  "etapa": "MFA_SOLICITADO",
  "codigoAutenticacao": "uuid-bmp-531-abc123",
  "mensagem": "Código MFA enviado. Informe o código na próxima chamada."
}
```

### 7. Consultar Status de Transação
**Endpoint:** `GET /bmp-531/pix/status/{codigoTransacao}`

```javascript
const consultarStatusTransacao = async (codigoTransacao, dadosBancarios = null) => {
  const response = await fetch(`/bmp-531/pix/status/${codigoTransacao}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    body: dadosBancarios ? JSON.stringify({
      dadosBancarios: dadosBancarios
    }) : undefined
  });
  
  return await response.json();
};
```

**Resposta:**
```json
{
  "sucesso": true,
  "codigoTransacao": "TX123456789",
  "status": "CONCLUIDO",
  "dados": {
    "valorTransacao": 100.50,
    "dataHoraTransacao": "2024-01-15T10:30:00Z",
    "nomeDestinatario": "João Silva"
  },
  "mensagem": "Status da transação consultado com sucesso"
}
```

## 💳 Módulo Account

### 1. Consultar Saldo
**Endpoint:** `GET /bmp-531/account/saldo`

```javascript
const consultarSaldo = async () => {
  const response = await fetch('/bmp-531/account/saldo', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Resposta:**
```json
{
  "saldoDisponivel": 1500.50,
  "saldoBloqueado": 0.00,
  "saldoAgendado": 0.00,
  "atualizadoEm": "2024-01-15T10:30:00Z"
}
```

### 2. Consultar Extrato
**Endpoint:** `GET /bmp-531/account/extrato?de={de}&ate={ate}&cursor={cursor}`

```javascript
const consultarExtrato = async (filtros = {}) => {
  const params = new URLSearchParams();
  
  if (filtros.de) params.append('de', filtros.de); // YYYY-MM-DD
  if (filtros.ate) params.append('ate', filtros.ate); // YYYY-MM-DD
  if (filtros.cursor) params.append('cursor', filtros.cursor); // Número para paginação
  
  const url = `/bmp-531/account/extrato${params.toString() ? '?' + params.toString() : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Resposta:**
```json
{
  "items": [
    {
      "codigo": "123",
      "codigoTransacao": "TX123456",
      "dtMovimento": "2024-01-15",
      "dtLancamento": "2024-01-15T10:30:00Z",
      "vlrMovimento": -50.00,
      "nome": "João Silva",
      "documentoFederal": "12345678901",
      "complemento": "PIX Enviado",
      "identificadorOperacao": "PIX123",
      "cdOperacao": "540",
      "tipoMovimento": "D",
      "descricao": "Transferência PIX"
    }
  ],
  "hasMore": true,
  "cursor": 50
}
```

## 🛡️ Tratamento de Erros

Todas as APIs retornam errors no formato:

```json
{
  "sucesso": false,
  "mensagem": "Descrição do erro",
  "status": "erro"
}
```

## 📝 Observações Importantes

1. **Nenhum dado é hardcoded** - Todos os dados bancários devem vir do front-end
2. **Validação obrigatória** - Campos marcados como obrigatórios geram erro 400 se ausentes
3. **Paginação** - Extrato suporta paginação via parâmetro `cursor`
4. **Período máximo** - Extrato com filtro de data tem limite de 6 meses
5. **Autenticação** - Endpoints são públicos no momento (sem middleware de auth)
6. **Chaves PIX** - São automaticamente limpas de formatação (pontos, traços, etc.)

## 🔄 Exemplos de Fluxos Completos

### Fluxo 1: Enviar PIX
```javascript
// 1. Consultar saldo antes de enviar
const saldo = await consultarSaldo();
console.log('Saldo disponível:', saldo.saldoDisponivel);

// 2. Consultar chave PIX antes de enviar
const chaveInfo = await consultarChavePix('usuario@email.com', dadosBancarios);

// 3. Enviar PIX se chave válida
if (chaveInfo.sucesso) {
  const resultado = await enviarPix({
    chave: 'usuario@email.com',
    valor: 100.50,
    descricao: 'Pagamento produto',
    agencia: '0001',
    conta: '157',
    conta_digito: '8',
    conta_pgto: '00001578',
    tipo_conta: 3,
    modelo_conta: 1
  });
  
  // 4. Consultar status da transação
  if (resultado.sucesso) {
    const status = await consultarStatusTransacao(resultado.codigoTransacao);
    console.log('Status:', status.status);
  }
}

// 5. Consultar extrato para verificar transação
const extrato = await consultarExtrato({ cursor: 0 });
```

### Fluxo 2: Criar Chave PIX (Email com MFA)
```javascript
const dadosBancarios = {
  agencia: '0001',
  agencia_digito: '8',
  conta: '157',
  conta_digito: '8',
  conta_pgto: '00001578',
  tipo_conta: 3,
  modelo_conta: 1
};

// 1. Primeira chamada - solicitar MFA
const etapa1 = await criarChavePix({
  tipoChave: 'email',
  chave: 'novo@email.com',
  ...dadosBancarios
});

if (etapa1.etapa === 'MFA_SOLICITADO') {
  // 2. Usuário recebe código por SMS/Email
  const codigoMfa = prompt('Digite o código MFA recebido:');
  
  // 3. Segunda chamada - confirmar com MFA
  const etapa2 = await criarChavePix({
    tipoChave: 'email',
    chave: 'novo@email.com',
    codigoMfa: codigoMfa,
    codigoAutenticacao: etapa1.codigoAutenticacao,
    ...dadosBancarios
  });
  
  if (etapa2.etapa === 'CHAVE_CRIADA') {
    console.log('Chave PIX criada com sucesso!');
    
    // 4. Listar chaves para confirmar
    const chaves = await listarChavesPix(dadosBancarios);
    console.log('Chaves ativas:', chaves);
  }
}
```

### Fluxo 3: Pagar QR Code (Copia e Cola)
```javascript
// 1. Usuário escaneou QR Code e obteve o EMV
const emvQrCode = '00020126330014BR.GOV.BCB.PIX2711www.bb.com.br6304A9B0';

// 2. Pagar usando o EMV
const resultadoPagamento = await pagarCopiaCola({
  emv: emvQrCode,
  valor: 50.00, // Opcional - se não informado, usa valor do QR
  descricao: 'Pagamento via QR Code',
  agencia: '0001',
  agencia_digito: '8',
  conta: '157',
  conta_digito: '8',
  conta_pgto: '00001578',
  tipo_conta: 3,
  modelo_conta: 1
});

if (resultadoPagamento.sucesso) {
  console.log('Pagamento realizado:', resultadoPagamento.codigoTransacao);
  
  // 3. Acompanhar status do pagamento
  const status = await consultarStatusTransacao(resultadoPagamento.codigoTransacao);
  console.log('Status atual:', status.status);
}
```

### Fluxo 4: Criar QR Code para Recebimento
```javascript
// 1. Criar QR Code com valor fixo
const qrFixo = await criarQRCodeEstatico({
  chave: 'minha@chave.com', // Opcional - usa pix_key dos dados bancários se omitida
  valor: 150.00,
  informacoesAdicionais: 'Pagamento de produto #123',
  agencia: '0001',
  agencia_digito: '8',
  conta: '157',
  conta_digito: '8',
  conta_pgto: '00001578',
  tipo_conta: 3,
  modelo_conta: 1,
  pix_key: 'minha@chave.com' // Chave padrão da conta
});

console.log('QR Code gerado:', qrFixo.qrCode);
console.log('Link de pagamento:', qrFixo.linkPagamento);

// 2. Criar QR Code com valor em aberto
const qrAberto = await criarQRCodeEstatico({
  informacoesAdicionais: 'Doação livre',
  // valor omitido = QR Code em aberto
  agencia: '0001',
  // ... outros dados bancários
});
```
