// Export CSV nativo (sem dependência externa)

const BOM = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentos
const SEPARATOR = ';'; // ponto-e-vírgula para compatibilidade com Excel BR

function sanitizeCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).replace(/"/g, '""');
  // Previne formula injection: valores que começam com =, +, -, @, \t, \r
  // são interpretados como fórmulas pelo Excel
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

export function exportToCSV(
  data: Record<string, any>[],
  columns: { key: string; label: string }[],
  filename: string,
): void {
  if (data.length === 0) return;

  const header = columns.map(c => `"${c.label}"`).join(SEPARATOR);

  const rows = data.map(row =>
    columns.map(col => sanitizeCell(row[col.key])).join(SEPARATOR)
  );

  const csv = BOM + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// Variante que aceita mapper inline — evita criar array intermediário de objetos formatados
// Para datasets grandes (100k+), reduz uso de memória de 3 cópias para 2
export function exportToCSVMapped<T>(
  data: T[],
  columns: { key: string; label: string }[],
  mapper: (item: T) => Record<string, any>,
  filename: string,
): void {
  if (data.length === 0) return;

  const header = columns.map(c => `"${c.label}"`).join(SEPARATOR);

  // Gera cada row sob demanda sem acumular array formatado em memória
  const parts: string[] = [BOM, header];
  for (const item of data) {
    const row = mapper(item);
    parts.push('\n' + columns.map(col => sanitizeCell(row[col.key])).join(SEPARATOR));
  }

  const blob = new Blob(parts, { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== Colunas pré-definidas para cada tipo de relatório =====

export const OTC_STATEMENT_COLUMNS = [
  { key: 'date', label: 'Data' },
  { key: 'type', label: 'Tipo' },
  { key: 'description', label: 'Descrição' },
  { key: 'amount', label: 'Valor (BRL)' },
  { key: 'usd_amount', label: 'Valor (USD)' },
  { key: 'conversion_rate', label: 'Taxa Conversão' },
  { key: 'saldo_posterior', label: 'Saldo Após' },
  { key: 'status', label: 'Status' },
  { key: 'payer_name', label: 'Pagador' },
  { key: 'payer_document', label: 'Doc. Pagador' },
];

export const OTC_CONVERSIONS_COLUMNS = [
  { key: 'created_at', label: 'Data' },
  { key: 'brl_amount', label: 'Valor BRL' },
  { key: 'usd_amount', label: 'Valor USD' },
  { key: 'conversion_rate', label: 'Taxa' },
  { key: 'brl_balance_after', label: 'Saldo BRL Após' },
  { key: 'usd_balance_after', label: 'Saldo USD Após' },
  { key: 'description', label: 'Descrição' },
  { key: 'admin_name', label: 'Admin' },
];

export const BANKING_COLUMNS = [
  { key: 'date', label: 'Data' },
  { key: 'provider', label: 'Provider' },
  { key: 'type', label: 'Tipo' },
  { key: 'amount', label: 'Valor (BRL)' },
  { key: 'status', label: 'Status' },
  { key: 'endToEndId', label: 'End-to-End ID' },
  { key: 'payerName', label: 'Pagador' },
  { key: 'payerDocument', label: 'Doc. Pagador' },
  { key: 'beneficiaryName', label: 'Beneficiário' },
  { key: 'beneficiaryDocument', label: 'Doc. Beneficiário' },
  { key: 'pixKey', label: 'Chave PIX' },
];

export const TARIFA_COLUMNS = [
  { key: 'date', label: 'Data' },
  { key: 'provider', label: 'Provider' },
  { key: 'amount', label: 'Valor (BRL)' },
  { key: 'description', label: 'Descrição' },
  { key: 'transactionId', label: 'ID Transação' },
  { key: 'accountName', label: 'Conta' },
];
