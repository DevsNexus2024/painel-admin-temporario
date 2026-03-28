import * as XLSX from 'xlsx';
import type { OTCBalanceHistory, OTCTransaction } from '@/types/otc';
import { otcService } from '@/services/otc';
import { formatOTCTimestamp, formatTimestamp } from '@/utils/date';

function getUsdValueFromHistory(
  historicoSaldo: OTCBalanceHistory[],
  transactionId: number | string,
  manualOperationId?: number
): number | null {
  if (!historicoSaldo.length) return null;

  let numericId: number;
  if (manualOperationId !== undefined) {
    numericId = manualOperationId;
  } else if (typeof transactionId === 'string' && transactionId.startsWith('conv_')) {
    numericId = parseInt(transactionId.replace('conv_', ''), 10);
  } else {
    numericId = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
  }

  const historyRecord = historicoSaldo.find(
    (h) =>
      h.transaction_id === numericId ||
      String(h.transaction_id) === String(transactionId) ||
      (manualOperationId !== undefined && h.transaction_id === manualOperationId)
  );

  return historyRecord?.usd_amount_change !== undefined ? historyRecord.usd_amount_change : null;
}

function getBrlValueFromHistory(
  historicoSaldo: OTCBalanceHistory[],
  transactionId: number | string,
  manualOperationId?: number
): number | null {
  if (!historicoSaldo.length) return null;

  let numericId: number;
  if (manualOperationId !== undefined) {
    numericId = manualOperationId;
  } else if (typeof transactionId === 'string' && transactionId.startsWith('conv_')) {
    numericId = parseInt(transactionId.replace('conv_', ''), 10);
  } else {
    numericId = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
  }

  const historyRecord = historicoSaldo.find(
    (h) =>
      (h.transaction_id === numericId ||
        String(h.transaction_id) === String(transactionId) ||
        (manualOperationId !== undefined && h.transaction_id === manualOperationId)) &&
      h.amount_change !== 0
  );

  return historyRecord?.amount_change ?? null;
}

function joinLines(...parts: string[]): string {
  return parts.filter(Boolean).join('\n');
}

function getTransactionLabel(transaction: OTCTransaction, historicoSaldo: OTCBalanceHistory[]): string {
  const type = transaction.type;
  switch (type) {
    case 'deposit':
      return 'Depósito';
    case 'withdrawal':
      return 'Saque';
    case 'manual_credit':
      return 'Crédito Manual';
    case 'manual_debit':
      return 'Débito Manual';
    case 'conversion': {
      const usdValue = pickUsd(transaction, historicoSaldo);
      if (transaction.notes?.includes('Conversão BRL→USD')) return 'Conversão BRL→USD';
      if (transaction.notes?.includes('ESTORNO - Conversão USD→BRL')) return 'Estorno Conversão USD→BRL';
      if (usdValue !== null && usdValue !== 0) {
        return usdValue > 0 ? 'Conversão (Crédito USD)' : 'Conversão (Débito USD)';
      }
      return 'Conversão';
    }
    case 'manual_adjustment': {
      if (transaction.notes?.includes('Conversão BRL→USD')) return 'Conversão BRL→USD';
      if (transaction.notes?.includes('ESTORNO - Conversão USD→BRL')) return 'Estorno Conversão USD→BRL';

      const manualOpIdAdj = transaction.manual_operation?.id;
      const usdValueAdj = getUsdValueFromHistory(historicoSaldo, transaction.id, manualOpIdAdj);
      const notesLowerAdj = transaction.notes?.toLowerCase() || '';

      if (transaction.amount === 0 && usdValueAdj !== null) {
        if (notesLowerAdj.includes('saque') && !notesLowerAdj.includes('conversão')) {
          return 'Débito USD';
        }
        if (!transaction.is_conversion && !notesLowerAdj.includes('conversão')) {
          return usdValueAdj > 0 ? 'Crédito USD' : 'Débito USD';
        }
        return usdValueAdj > 0 ? 'Conversão (Crédito USD)' : 'Conversão (Débito USD)';
      }

      return transaction.amount > 0 ? 'Crédito Manual' : 'Débito Manual';
    }
    default:
      return String(type);
  }
}

/** Mesmo que conversion branch sem manualOpId (como no componente React). */
function pickUsd(transaction: OTCTransaction, historicoSaldo: OTCBalanceHistory[]): number | null {
  return getUsdValueFromHistory(historicoSaldo, transaction.id);
}

function formatTransacaoCell(transaction: OTCTransaction, historicoSaldo: OTCBalanceHistory[]): string {
  const label = getTransactionLabel(transaction, historicoSaldo);
  const dateLine = ['manual_credit', 'manual_debit', 'manual_adjustment', 'conversion'].includes(transaction.type)
    ? formatTimestamp(transaction.date, 'dd/MM/yy HH:mm')
    : formatOTCTimestamp(transaction.date, 'dd/MM/yy HH:mm');
  return joinLines(label, dateLine);
}

function formatValorCell(transaction: OTCTransaction, historicoSaldo: OTCBalanceHistory[]): string {
  const manualOpId = transaction.manual_operation?.id;
  const usdValue = getUsdValueFromHistory(historicoSaldo, transaction.id, manualOpId);
  const notesLower = transaction.notes?.toLowerCase() || '';

  const isConversionType = transaction.type === 'conversion' || transaction.is_conversion === true;
  const isConversion = transaction.notes?.includes('Conversão BRL→USD') || isConversionType;
  const isConversionReversal = transaction.notes?.includes('ESTORNO - Conversão USD→BRL');
  const isCredit =
    !isConversion &&
    !isConversionReversal &&
    (transaction.type === 'deposit' ||
      transaction.type === 'manual_credit' ||
      (transaction.type === 'manual_adjustment' && transaction.amount > 0));

  const isRealConversion =
    transaction.type === 'conversion' ||
    (transaction.is_conversion === true &&
      !notesLower.includes('saque') &&
      (notesLower.includes('conversão') || notesLower.includes('conversão brl→usd')));

  const isUsdOperation =
    notesLower.includes('usd') ||
    transaction.notes?.includes('Conversão BRL→USD') ||
    transaction.notes?.includes('ESTORNO - Conversão USD→BRL') ||
    isRealConversion;

  if (isRealConversion) {
    const usdValueConv = getUsdValueFromHistory(historicoSaldo, transaction.id, manualOpId);
    const brlValueConv = getBrlValueFromHistory(historicoSaldo, transaction.id, manualOpId);
    if (usdValueConv !== null && usdValueConv !== 0) {
      const lines: string[] = [];
      if (brlValueConv !== null && brlValueConv !== 0) {
        lines.push(`-R$ ${Math.abs(brlValueConv).toFixed(2)}`);
      }
      lines.push(`${usdValueConv >= 0 ? '+' : ''}$ ${Math.abs(usdValueConv).toFixed(2)}`);
      lines.push('Conversão');
      return joinLines(...lines);
    }
  }

  if (isConversionReversal && usdValue !== null) {
    const brlValue = getBrlValueFromHistory(historicoSaldo, transaction.id, manualOpId);
    return joinLines(
      `+R$ ${Math.abs(brlValue || 0).toFixed(2)}`,
      `-$ ${Math.abs(usdValue).toFixed(2)}`,
      'Estorno USD→BRL'
    );
  }

  if (isConversion && usdValue !== null) {
    const brlValue = getBrlValueFromHistory(historicoSaldo, transaction.id, manualOpId);
    return joinLines(
      `-R$ ${Math.abs(brlValue || 0).toFixed(2)}`,
      `+$ ${Math.abs(usdValue).toFixed(2)}`,
      'Conversão BRL→USD'
    );
  }

  if (!isRealConversion && isUsdOperation && transaction.amount === 0 && usdValue !== null) {
    return joinLines(`${usdValue >= 0 ? '+' : ''}$ ${Math.abs(usdValue).toFixed(2)}`, 'USD');
  }

  if (isUsdOperation && transaction.amount !== 0 && usdValue !== null) {
    return joinLines(
      `${isCredit ? '+' : '-'}R$ ${Math.abs(transaction.amount).toFixed(2)}`,
      `${usdValue >= 0 ? '+' : ''}$ ${Math.abs(usdValue).toFixed(2)}`,
      'BRL + USD'
    );
  }

  return joinLines(`${isCredit ? '+' : '-'}R$ ${Math.abs(transaction.amount).toFixed(2)}`, 'BRL');
}

function formatSaldoAnteriorCell(transaction: OTCTransaction): string {
  const hasUsdBalanceBefore =
    transaction.usd_balance_before !== undefined && transaction.usd_balance_before !== null;
  const hasBrlBalanceBefore =
    transaction.saldo_anterior !== undefined && transaction.saldo_anterior !== null;
  const isUsdOnlyOperation = hasUsdBalanceBefore && !hasBrlBalanceBefore;

  if (isUsdOnlyOperation) {
    return `$ ${transaction.usd_balance_before!.toFixed(4)}`;
  }

  const lines: string[] = [];
  if (hasBrlBalanceBefore) {
    lines.push(`BRL: ${otcService.formatCurrency(transaction.saldo_anterior!)}`);
  }
  if (hasUsdBalanceBefore) {
    lines.push(`USD: $ ${transaction.usd_balance_before!.toFixed(4)}`);
  }
  return joinLines(...lines);
}

function formatSaldoPosteriorCell(transaction: OTCTransaction): string {
  const hasUsdBalanceAfter =
    transaction.usd_balance_after !== undefined && transaction.usd_balance_after !== null;
  const hasBrlBalanceAfter =
    transaction.saldo_posterior !== undefined && transaction.saldo_posterior !== null;
  const isUsdOnlyOperation = hasUsdBalanceAfter && !hasBrlBalanceAfter;

  if (isUsdOnlyOperation) {
    return `$ ${transaction.usd_balance_after!.toFixed(4)}`;
  }

  const lines: string[] = [];
  if (hasBrlBalanceAfter) {
    lines.push(`BRL: ${otcService.formatCurrency(transaction.saldo_posterior!)}`);
  }
  if (hasUsdBalanceAfter) {
    lines.push(`USD: $ ${transaction.usd_balance_after!.toFixed(4)}`);
  }
  return joinLines(...lines);
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'processed':
      return 'Processado';
    case 'pending':
      return 'Pendente';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

function formatDetalhesCell(transaction: OTCTransaction): string {
  const lines: string[] = [];
  if (transaction.payer_name) {
    lines.push(`Pagador: ${transaction.payer_name}`);
  }
  if (transaction.payer_document) {
    lines.push(otcService.formatDocument(transaction.payer_document));
  }
  if (transaction.notes) {
    lines.push(transaction.notes);
  }
  if (transaction.processed_by) {
    lines.push(`Processado por: ${transaction.processed_by}`);
  }
  return joinLines(...lines);
}

function formatBalanceHistoryOperacaoCell(history: OTCBalanceHistory): string {
  const hasUsdChange =
    history.usd_amount_change != null && history.usd_amount_change !== 0;
  const hasBrlChange = history.amount_change != null && history.amount_change !== 0;
  const isUsdOnlyOperation = !!hasUsdChange && !hasBrlChange;

  const op = `${history.operation_type}${isUsdOnlyOperation ? ' USD' : ''}`;
  const dateLine = formatTimestamp(history.created_at, 'dd/MM/yy HH:mm');
  return joinLines(op, dateLine);
}

function formatBalanceHistorySaldoAnterior(history: OTCBalanceHistory): string {
  const hasUsdChange =
    history.usd_amount_change != null && history.usd_amount_change !== 0;
  const hasBrlChange = history.amount_change != null && history.amount_change !== 0;
  const isUsdOnlyOperation = !!hasUsdChange && !hasBrlChange;

  if (isUsdOnlyOperation) {
    return `$ ${history.usd_balance_before?.toFixed(4) || '0.0000'}`;
  }

  const lines: string[] = [`BRL: ${otcService.formatCurrency(history.balance_before)}`];
  if (hasUsdChange) {
    lines.push(`USD: $ ${history.usd_balance_before?.toFixed(4) || '0.0000'}`);
  }
  return joinLines(...lines);
}

function formatBalanceHistoryAlteracao(history: OTCBalanceHistory): string {
  const hasUsdChange =
    history.usd_amount_change != null && history.usd_amount_change !== 0;
  const hasBrlChange = history.amount_change != null && history.amount_change !== 0;
  const isUsdOnlyOperation = !!hasUsdChange && !hasBrlChange;

  if (isUsdOnlyOperation) {
    const u = history.usd_amount_change;
    return `${u >= 0 ? '+' : ''}$ ${Math.abs(u).toFixed(4)}`;
  }

  const lines: string[] = [];
  if (hasBrlChange) {
    const b = history.amount_change;
    lines.push(`${b >= 0 ? '+' : ''}${otcService.formatCurrency(b)} BRL`);
  }
  if (hasUsdChange) {
    const u = history.usd_amount_change;
    lines.push(`${u >= 0 ? '+' : ''}$ ${Math.abs(u).toFixed(4)} USD`);
  }
  return joinLines(...lines);
}

function formatBalanceHistorySaldoPosterior(history: OTCBalanceHistory): string {
  const hasUsdChange =
    history.usd_amount_change != null && history.usd_amount_change !== 0;
  const hasBrlChange = history.amount_change != null && history.amount_change !== 0;
  const isUsdOnlyOperation = !!hasUsdChange && !hasBrlChange;

  if (isUsdOnlyOperation) {
    return `$ ${history.usd_balance_after?.toFixed(4) || '0.0000'}`;
  }

  const lines: string[] = [`BRL: ${otcService.formatCurrency(history.balance_after)}`];
  if (hasUsdChange) {
    lines.push(`USD: $ ${history.usd_balance_after?.toFixed(4) || '0.0000'}`);
  }
  return joinLines(...lines);
}

function formatBalanceHistoryDescricao(history: OTCBalanceHistory): string {
  return joinLines(history.description || '', `por ${history.created_by}`);
}

function sanitizeFilePart(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'cliente';
}

/** Gera workbook e dispara download no browser. */
export function downloadAdminClientStatementXlsx(params: {
  clientName: string;
  transactions: OTCTransaction[];
  balanceHistory: OTCBalanceHistory[];
  historicoSaldo: OTCBalanceHistory[];
}): void {
  const { clientName, transactions, balanceHistory, historicoSaldo } = params;

  const txHeaders = ['Transação', 'Valor', 'Saldo Anterior', 'Saldo Posterior', 'Status', 'Detalhes'] as const;
  const txRows: (string | number)[][] = transactions.map((t) => [
    formatTransacaoCell(t, historicoSaldo),
    formatValorCell(t, historicoSaldo),
    formatSaldoAnteriorCell(t),
    formatSaldoPosteriorCell(t),
    formatStatusLabel(t.status),
    formatDetalhesCell(t),
  ]);

  const histHeaders = [
    'Operação',
    'Saldo Anterior',
    'Alteração',
    'Saldo Posterior',
    'Descrição',
  ] as const;
  const histRows: (string | number)[][] = balanceHistory.map((h) => [
    formatBalanceHistoryOperacaoCell(h),
    formatBalanceHistorySaldoAnterior(h),
    formatBalanceHistoryAlteracao(h),
    formatBalanceHistorySaldoPosterior(h),
    formatBalanceHistoryDescricao(h),
  ]);

  const wsTx = XLSX.utils.aoa_to_sheet([[...txHeaders], ...txRows]);
  const wsHist = XLSX.utils.aoa_to_sheet([[...histHeaders], ...histRows]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transações');
  XLSX.utils.book_append_sheet(wb, wsHist, 'Histórico de Saldo');

  const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const base = `extrato-admin-${sanitizeFilePart(clientName)}-${dateStr}`;
  XLSX.writeFile(wb, `${base}.xlsx`);
}
