# 🔧 Corrigir Sincronização Prisma com Banco

## Problema
O backend não está salvando os novos campos (`reference_external_id`, `reference_provider`, etc.) porque o Prisma não reconhece essas colunas.

## Solução

### 1. Confirmar que migration foi executada no banco
```sql
-- Execute no Workbench:
DESCRIBE otc_manual_operations;
```

### 2. Sincronizar Prisma com banco atualizado
```bash
cd BaaS-Nexus1

# Puxar estrutura atual do banco para o Prisma
npx prisma db pull

# Gerar cliente Prisma atualizado
npx prisma generate
```

### 3. Reiniciar backend
```bash
# Parar o backend (Ctrl+C)
# Iniciar novamente
npm start
```

### 4. Testar novamente
- Tente creditar um registro do extrato
- Verifique se os dados são salvos no banco
- Teste a proteção contra duplicação

## Logs para verificar

### Backend deve mostrar:
```
[OTC-CONTROLLER] Criando operação manual: {
  otc_client_id: 9,
  operation_type: 'credit',
  reference_external_id: 'cc1fbf5d5aeb065db1b23823308ac0f8',
  reference_provider: 'bitso'
}
```

### Banco deve ter dados:
```sql
SELECT reference_external_id, reference_provider FROM otc_manual_operations ORDER BY id DESC LIMIT 1;
```

## Se ainda não funcionar

Verifique se o Prisma schema foi atualizado:
```bash
# Ver se as colunas aparecem no schema
cat prisma/schema.prisma | grep reference_
```

Se não aparecerem, execute manualmente o `db pull` novamente. 