/**
 * Normalização de dados de extrato para operações OTC
 *
 * Converte dados de qualquer provider (CorpX, BrasilCash, Bitso, BelmontX, BMP)
 * para um formato padrão único enviado à API /api/otc/operations.
 *
 * Formato normalizado garante:
 * - Mesma estrutura para todos os bancos
 * - Dados do depositante (payer) sempre presentes quando disponíveis
 * - Compatibilidade com AntiDuplicacaoService do backend (campos por provider)
 */

import type { MovimentoExtrato } from '@/services/extrato';

/**
 * Formato normalizado enviado à API - único para todos os providers.
 * Inclui campos padrão + aliases por provider para compatibilidade com backend.
 */
export interface NormalizedExtractForOTC {
  /** Código principal (EndToEnd para PIX, codigoTransacao para BMP) */
  reference_code: string;
  /** ID secundário (nrMovimento, transactionId, etc.) */
  reference_external_id: string;
  /** Data/hora da transação original (ISO) */
  reference_date: string;
  /** Nome do depositante (quem enviou o PIX) */
  payer_name: string | null;
  /** CPF/CNPJ do depositante */
  payer_document: string | null;
  /** Valor da transação */
  amount: number;
  /** Status da transação (CONFIRMED, COMPLETED, etc.) */
  status: string | null;
  /** Provider de origem */
  provider: string;
  /**
   * Aliases por provider - mesclados no objeto para o backend extrair.
   * CorpX: idEndToEnd, nrMovimento, data, hora
   * Bitso/BrasilCash/BelmontX: endToEndId, id, dateTime
   * BMP: codigoTransacao, codigo, dtMovimento
   */
  idEndToEnd?: string;
  nrMovimento?: string;
  data?: string;
  hora?: string;
  endToEndId?: string;
  id?: string;
  dateTime?: string;
  codigoTransacao?: string;
  codigo?: string;
  dtMovimento?: string;
}

function normalizeDocument(doc: unknown): string | null {
  if (doc == null || doc === '') return null;
  const s = String(doc).replace(/\D/g, '');
  return s.length >= 11 ? s : null;
}

function normalizeDate(d: unknown): string {
  if (!d) return new Date().toISOString();
  try {
    const date = d instanceof Date ? d : new Date(String(d));
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Extrai nome e documento do depositante de qualquer estrutura de provider
 */
function extractPayerFromRecord(record: MovimentoExtrato): { name: string | null; document: string | null } {
  const orig = record._original as Record<string, unknown> | undefined;
  const rawExtrato = orig?.rawExtrato as Record<string, unknown> | undefined;
  const payer = rawExtrato?.payer as Record<string, unknown> | undefined;
  const pagador = rawExtrato?.pagador as Record<string, unknown> | undefined;

  // Nome: prioridade depositante/pagador
  const name =
    (record.client as string) ||
    (orig?.payerName as string) ||
    (orig?.payer_name as string) ||
    (payer?.fullName as string) ||
    (payer?.name as string) ||
    (pagador?.fullName as string) ||
    (pagador?.nome as string) ||
    null;

  // Documento
  const document =
    normalizeDocument(record.document) ||
    normalizeDocument(orig?.payerTaxId) ||
    normalizeDocument(orig?.payer_document) ||
    normalizeDocument(payer?.document) ||
    normalizeDocument(pagador?.document) ||
    normalizeDocument(pagador?.documento) ||
    null;

  return { name: name || null, document };
}

/**
 * Normaliza extrato de qualquer provider para formato padrão OTC
 */
export function normalizeExtractToOTC(
  extractRecord: MovimentoExtrato,
  provider: string
): NormalizedExtractForOTC {
  const orig = extractRecord._original as Record<string, unknown> | undefined;
  const { name: payer_name, document: payer_document } = extractPayerFromRecord(extractRecord);

  const amount = Number(extractRecord.value) || 0;
  const dateTime = normalizeDate(
    extractRecord.dateTime ||
      orig?.createdAt ||
      orig?.dateTime ||
      orig?.transactionDatetimeUtc ||
      orig?.transactionDatetime ||
      orig?.dtMovimento
  );

  let reference_code: string;
  let reference_external_id: string;
  const aliases: NormalizedExtractForOTC['_provider_aliases'] = {};

  switch (provider.toLowerCase()) {
    case 'corpx': {
      const idEndToEnd =
        (orig?.idEndToEnd as string) ||
        (orig?.originalItem as Record<string, unknown>)?.idEndToEnd ||
        (orig?.endToEnd as string) ||
        (orig?.endToEndId as string) ||
        (orig?.rawExtrato as Record<string, unknown>)?.idEndToEnd ||
        (extractRecord.code as string) ||
        '';
      const nrMovimento =
        (orig?.nrMovimento as string) ||
        (orig?.id as string) ||
        (extractRecord.id as string) ||
        '';
      reference_code = idEndToEnd;
      reference_external_id = nrMovimento;
      const dateStr = dateTime.split('T')[0];
      const timeStr = dateTime.split('T')[1]?.slice(0, 8) || '00:00:00';
      aliases.idEndToEnd = idEndToEnd;
      aliases.nrMovimento = nrMovimento;
      aliases.data = dateStr;
      aliases.hora = timeStr;
      break;
    }

    case 'brasilcash':
    case 'belmontx':
    case 'bitso': {
      const endToEndId =
        (orig?.endToEndId as string) ||
        (orig?.end_to_end_id as string) ||
        (orig?.endToEnd as string) ||
        (extractRecord.code as string) ||
        '';
      const transactionId =
        (orig?.transactionId as string) ||
        (orig?.id as string) ||
        (extractRecord.id as string) ||
        '';
      reference_code = endToEndId;
      reference_external_id = transactionId;
      aliases.endToEndId = endToEndId;
      aliases.id = transactionId;
      aliases.dateTime = dateTime;
      break;
    }

    case 'bmp531':
    case 'bmp274': {
      const codigoTransacao =
        (orig?.codigoTransacao as string) ||
        (extractRecord.code as string) ||
        '';
      const codigo = (orig?.codigo as string) || (extractRecord.id as string) || '';
      reference_code = codigoTransacao;
      reference_external_id = codigo;
      aliases.codigoTransacao = codigoTransacao;
      aliases.codigo = codigo;
      aliases.dtMovimento = dateTime;
      break;
    }

    default: {
      reference_code = (extractRecord.code as string) || '';
      reference_external_id = (extractRecord.id as string) || '';
      aliases.endToEndId = reference_code;
      aliases.id = reference_external_id;
      aliases.dateTime = dateTime;
    }
  }

  const status =
    (orig?.pixStatus as string) ||
    (orig?.status as string) ||
    (orig?.rawWebhook as Record<string, unknown>)?.status ||
    null;

  return {
    reference_code,
    reference_external_id,
    reference_date: dateTime,
    payer_name,
    payer_document,
    amount,
    status,
    provider: provider.toLowerCase(),
    ...aliases,
  } as NormalizedExtractForOTC;
}
