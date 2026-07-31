import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Download, ArrowUpCircle, ArrowDownCircle, Loader2, FileText, Check, X, RefreshCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Calendar as CalendarIcon, CheckCircle, Filter, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { useNtxRealtime } from "@/hooks/useNtxRealtime";
import { NtxRealtimeService, NTX_MAX_PAGE_SIZE, NTX_MAX_WINDOW_DAYS } from "@/services/ntx-realtime";
import type { NtxTransactionDB, NtxStatementFilters } from "@/services/ntx-realtime";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";

/**
 * Extrato NTX Pay ↔ TCR — clone do ExtractTabBrasilCashTcr adaptado às restrições da NTX:
 * - statement é PROXY LIVE da NTX (sem botão Sincronizar — sync alimenta tabelas que esta tela não lê);
 * - size máx 100/página e janela de datas máx 31 dias → paginação/filtros são server-side;
 *   busca e faixas de valor refinam só a página carregada;
 * - filtros aceitam enum CRU (PAYMENT/CONFIRMED/...) mas a resposta volta TRADUZIDA ("Pix in"/"Confirmado");
 * - SEM ações PIX (decisão: Devolver/Bloquear não entram pra NTX) → allowPixActions={false} no modal;
 * - Compensar usa o backend provider-agnóstico com provider explícito 'ntx' (_providerCompensacao).
 */
export default function ExtractTabNtxTcr() {
  const { isConnected } = useNtxRealtime();

  // Estados de transações
  const [transactions, setTransactions] = useState<NtxTransactionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(NTX_MAX_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    total: 0,
    size: NTX_MAX_PAGE_SIZE,
    has_next: false,
    current_page: 1,
    total_pages: 1
  });

  // Estados de filtros - sem período padrão (igual TCR)
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PAYMENT' | 'WITHDRAW' | 'REFUND_IN' | 'REFUND_OUT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'ERROR'>('ALL');
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [specificAmount, setSpecificAmount] = useState<string>("");
  const [endToEndIdFilter, setEndToEndIdFilter] = useState<string>("");
  const [externalIdFilter, setExternalIdFilter] = useState<string>("");
  const [showReversalsOnly, setShowReversalsOnly] = useState(false);

  // Estados para funcionalidade de Compensação
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);
  const [compensatedRecords, setCompensatedRecords] = useState<Set<string>>(new Set());

  // Estado para controlar linha expandida
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Estado para métricas
  const [metrics, setMetrics] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    loading: false
  });

  // Mapeia o filtro de operação (enum cru da NTX) pro rótulo traduzido da resposta
  const matchOperationType = (tx: NtxTransactionDB, filter: string): boolean => {
    const e = tx.eventRaw.toLowerCase();
    if (filter === 'PAYMENT') return e.includes('pix in');
    if (filter === 'WITHDRAW') return e.includes('pix out');
    if (filter === 'REFUND_IN') return e.includes('refund in');
    if (filter === 'REFUND_OUT') return e.includes('refund out');
    return true;
  };

  // Mapeia o filtro de status (enum cru) pra variante do badge (resposta vem traduzida)
  const matchStatus = (tx: NtxTransactionDB, filter: string): boolean => {
    const variant = NtxRealtimeService.statusBadgeVariant(tx.status);
    if (filter === 'CONFIRMED') return variant === 'default';
    if (filter === 'PENDING') return variant === 'secondary';
    if (filter === 'ERROR') return variant === 'destructive';
    return true;
  };

  // Monta os filtros server-side (a NTX aceita status/type/datas/externalId/e2e na query)
  const buildApiFilters = (
    customDateFrom: Date | null,
    customDateTo: Date | null,
    page: number,
    applyFilters: boolean,
    size: number
  ): NtxStatementFilters => {
    const from = customDateFrom ?? dateFrom;
    const to = customDateTo ?? dateTo;

    let startDate: string | undefined;
    let endDate: string | undefined;
    if (from && to) {
      const f = new Date(from);
      f.setHours(0, 0, 0, 0);
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      startDate = f.toISOString();
      endDate = t.toISOString();
    }

    return {
      page,
      size,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(applyFilters && {
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(typeFilter !== 'ALL' && { type: typeFilter }),
        ...(endToEndIdFilter.trim() && { endToEndId: endToEndIdFilter.trim() }),
        ...(externalIdFilter.trim() && { externalId: externalIdFilter.trim() }),
      }),
    };
  };

  // ✅ Carregar transações (sem período padrão — API retorna os últimos registros)
  const fetchTransactions = async (customDateFrom?: Date | null, customDateTo?: Date | null, page: number = 1, applyFilters: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const filters = buildApiFilters(customDateFrom ?? null, customDateTo ?? null, page, applyFilters, recordsPerPage);
      const response = await NtxRealtimeService.getNtxStatement(filters);

      // ✅ SUBSTITUIR dados para cada página (não acumular)
      setTransactions(response.transactions);

      setPagination({
        total: response.total,
        size: recordsPerPage,
        has_next: response.hasNext || response.currentPage < response.totalPages,
        current_page: response.currentPage,
        total_pages: response.totalPages
      });

      toast.success(`Página ${response.currentPage}: ${response.transactions.length} transações`, {
        description: "Extrato NTX Pay TCR carregado",
        duration: 1500
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar transações');
      setTransactions([]);
      toast.error('Erro ao carregar extrato', {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Aplicar filtros (com período específico para API)
  const handleAplicarFiltros = () => {
    // ✅ Validar datas se ambas foram selecionadas (NTX limita a janela em 31 dias)
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        toast.error("Data inicial não pode ser maior que data final", {
          description: "Verifique as datas selecionadas",
          duration: 3000
        });
        return;
      }
      const windowDays = (dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000);
      if (windowDays > NTX_MAX_WINDOW_DAYS) {
        toast.error(`Janela máxima de ${NTX_MAX_WINDOW_DAYS} dias`, {
          description: "A NTX rejeita períodos maiores que 31 dias — reduza o intervalo",
          duration: 4000
        });
        return;
      }
    }

    // ✅ Validar valores mínimo e máximo
    if (minAmount && maxAmount) {
      const minValue = parseFloat(minAmount);
      const maxValue = parseFloat(maxAmount);
      if (!isNaN(minValue) && !isNaN(maxValue) && minValue > maxValue) {
        toast.error("Valor mínimo não pode ser maior que valor máximo", {
          description: "Verifique os valores informados",
          duration: 3000
        });
        return;
      }
    }

    // ✅ Recarregar com todos os filtros aplicados (sempre página 1 para novos filtros)
    fetchTransactions(dateFrom || null, dateTo || null, 1, true);

    toast.success("Filtros aplicados!", {
      description: "Carregando transações com os filtros selecionados",
      duration: 2000
    });
  };

  // ✅ Limpar filtros - retornar aos últimos registros
  const handleLimparFiltros = () => {
    setDateFrom(null);
    setDateTo(null);
    setDateRange({
      from: null,
      to: null
    });
    setSearchTerm("");
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setMinAmount("");
    setMaxAmount("");
    setSpecificAmount("");
    setEndToEndIdFilter("");
    setExternalIdFilter("");
    setShowReversalsOnly(false);
    setPagination(prev => ({ ...prev, current_page: 1 }));
    fetchTransactions(null, null, 1, false);
    toast.success("Filtros limpos!", {
      description: "Retornando aos últimos registros",
      duration: 2000
    });
  };

  // ✅ Refino client-side sobre a página carregada (busca/valores só existem aqui;
  // tipo/status/e2e/externalId refinam o que a API já filtrou)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // ✅ Filtro de operação
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(tx => matchOperationType(tx, typeFilter));
    }

    // ✅ Filtro de status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(tx => matchStatus(tx, statusFilter));
    }

    // ✅ Filtro de valor mínimo
    if (minAmount && minAmount.trim() !== '') {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
      }
    }

    // ✅ Filtro de valor máximo
    if (maxAmount && maxAmount.trim() !== '') {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
      }
    }

    // ✅ Filtro de valor específico
    if (specificAmount && specificAmount.trim() !== '') {
      const amount = parseFloat(specificAmount);
      if (!isNaN(amount) && amount > 0) {
        filtered = filtered.filter(tx => Math.abs(parseFloat(tx.amount) - amount) < 0.01);
      }
    }

    // ✅ Filtro de EndToEnd
    if (endToEndIdFilter && endToEndIdFilter.trim() !== '') {
      const endToEndLower = endToEndIdFilter.toLowerCase().trim();
      filtered = filtered.filter(tx => tx.endToEndId?.toLowerCase().includes(endToEndLower));
    }

    // ✅ Filtro de External ID
    if (externalIdFilter && externalIdFilter.trim() !== '') {
      const externalLower = externalIdFilter.toLowerCase().trim();
      filtered = filtered.filter(tx => tx.externalId?.toLowerCase().includes(externalLower));
    }

    // ✅ Filtro de busca geral
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(tx => {
        return (
          tx.counterpartName?.toLowerCase().includes(searchLower) ||
          tx.counterpartDocument?.toLowerCase().includes(searchLower) ||
          tx.transactionId?.toLowerCase().includes(searchLower) ||
          tx.endToEndId?.toLowerCase().includes(searchLower) ||
          tx.externalId?.toLowerCase().includes(searchLower) ||
          tx.description?.toLowerCase().includes(searchLower) ||
          tx.amount?.toString().includes(searchLower)
        );
      });
    }

    // ✅ Filtro de estornos
    if (showReversalsOnly) {
      filtered = filtered.filter(tx => tx.isRefund);
    }

    // ✅ Filtro de data no frontend (refino adicional após filtro da API)
    if (dateFrom && dateTo) {
      try {
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        filtered = filtered.filter(tx => {
          const txDate = new Date(tx.createdAt);
          return txDate >= fromDate && txDate <= toDate;
        });
      } catch (error) {
        // Em caso de erro, incluir a transação
      }
    }

    return filtered;
  }, [transactions, typeFilter, statusFilter, minAmount, maxAmount, specificAmount, endToEndIdFilter, externalIdFilter, searchTerm, showReversalsOnly, dateFrom, dateTo]);

  // ✅ Calcular métricas baseadas em filteredTransactions (escopo: página carregada)
  useEffect(() => {
    const deposits = filteredTransactions.filter(tx => tx.type === 'FUNDING');
    const withdrawals = filteredTransactions.filter(tx => tx.type === 'WITHDRAWAL');

    const depositAmount = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const withdrawalAmount = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    setMetrics({
      totalDeposits: deposits.length,
      totalWithdrawals: withdrawals.length,
      depositAmount: depositAmount,
      withdrawalAmount: withdrawalAmount,
      loading: loading
    });
  }, [filteredTransactions, loading]);

  // ✅ Carregar dados ao montar o componente - últimos registros (sem filtro de data)
  useEffect(() => {
    fetchTransactions(null, null, 1, false);
  }, []); // Manter [] para executar apenas na montagem

  // ✅ Sincronizar dateRange com dateFrom/dateTo
  useEffect(() => {
    if (dateRange.from) {
      setDateFrom(dateRange.from);
    }
    if (dateRange.to) {
      setDateTo(dateRange.to);
    }
  }, [dateRange]);

  const formatCurrency = (value: string | number) => {
    return NtxRealtimeService.formatCurrencyBRL(value as any);
  };

  const formatDate = (dateString: string) => {
    try {
      return NtxRealtimeService.formatDateBR(dateString);
    } catch {
      return dateString;
    }
  };

  const exportToCSV = async () => {
    try {
      toast.info('Preparando exportação...', { description: 'Buscando todos os registros NTX da TCR' });

      // ✅ Buscar TODAS as páginas com os filtros server-side atuais (size máx 100)
      let allTransactions: NtxTransactionDB[] = [];
      let page = 1;
      let hasMore = true;
      const MAX_PAGES = 300; // trava de segurança (30k linhas) — hasNext da API é quem encerra o loop

      while (hasMore && page <= MAX_PAGES) {
        const filters = buildApiFilters(dateFrom, dateTo, page, true, NTX_MAX_PAGE_SIZE);
        const response = await NtxRealtimeService.getNtxStatement(filters);
        allTransactions = [...allTransactions, ...response.transactions];

        hasMore = (response.hasNext || response.currentPage < response.totalPages) && response.transactions.length > 0;
        page += 1;
      }
      if (page > MAX_PAGES) {
        toast.warning(`Exportação truncada em ${MAX_PAGES * NTX_MAX_PAGE_SIZE} registros`, {
          description: 'Refine o período para exportar tudo'
        });
      }

      // ✅ Aplicar os mesmos refinos client-side do useMemo
      let transactionsToExport = allTransactions;

      if (typeFilter !== 'ALL') {
        transactionsToExport = transactionsToExport.filter(tx => matchOperationType(tx, typeFilter));
      }

      if (statusFilter !== 'ALL') {
        transactionsToExport = transactionsToExport.filter(tx => matchStatus(tx, statusFilter));
      }

      if (specificAmount) {
        const amount = parseFloat(specificAmount);
        transactionsToExport = transactionsToExport.filter(tx => Math.abs(parseFloat(tx.amount) - amount) < 0.01);
      } else {
        if (minAmount) {
          const min = parseFloat(minAmount);
          transactionsToExport = transactionsToExport.filter(tx => parseFloat(tx.amount) >= min);
        }
        if (maxAmount) {
          const max = parseFloat(maxAmount);
          transactionsToExport = transactionsToExport.filter(tx => parseFloat(tx.amount) <= max);
        }
      }

      if (endToEndIdFilter && endToEndIdFilter.trim() !== '') {
        const endToEndLower = endToEndIdFilter.toLowerCase().trim();
        transactionsToExport = transactionsToExport.filter(tx => tx.endToEndId?.toLowerCase().includes(endToEndLower));
      }

      if (externalIdFilter && externalIdFilter.trim() !== '') {
        const externalLower = externalIdFilter.toLowerCase().trim();
        transactionsToExport = transactionsToExport.filter(tx => tx.externalId?.toLowerCase().includes(externalLower));
      }

      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        transactionsToExport = transactionsToExport.filter((t: NtxTransactionDB) => {
          return (
            t.counterpartName?.toLowerCase().includes(searchLower) ||
            t.counterpartDocument?.toLowerCase().includes(searchLower) ||
            t.endToEndId?.toLowerCase().includes(searchLower) ||
            t.transactionId?.toLowerCase().includes(searchLower) ||
            t.externalId?.toLowerCase().includes(searchLower) ||
            t.amount.toString().includes(searchLower)
          );
        });
      }

      if (showReversalsOnly) {
        transactionsToExport = transactionsToExport.filter(tx => tx.isRefund);
      }

      // Gerar CSV com todas as colunas relevantes para TCR
      const headers = ['Data', 'Tipo', 'Operação', 'Status', 'Valor Bruto', 'Taxa', 'Valor Líquido', 'Nome Contraparte', 'Documento', 'Banco', 'End-to-End ID', 'Transaction ID', 'External ID', 'Descrição'];
      const rows = transactionsToExport.map((t: NtxTransactionDB) => [
        formatDate(t.createdAt),
        NtxRealtimeService.getTransactionTypeLabel(t.type),
        t.eventRaw,
        t.status,
        t.amount,
        t.feeAmount,
        t.finalAmount,
        t.counterpartName || '',
        t.counterpartDocument || '',
        t.counterpartBankName || '',
        t.endToEndId || '',
        t.transactionId || '',
        t.externalId || '',
        t.description || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `extrato-ntx-tcr-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(`${transactionsToExport.length} registros TCR exportados com sucesso!`, {
        description: `Arquivo: extrato-ntx-tcr-${new Date().toISOString().split('T')[0]}.csv`
      });
    } catch (error: any) {
      toast.error('Erro ao exportar extrato', {
        description: error.message || 'Não foi possível gerar o arquivo CSV'
      });
    }
  };

  const isRecordCompensated = (transaction: NtxTransactionDB): boolean => {
    const recordKey = `ntx-tcr-${transaction.id}`;
    return compensatedRecords.has(recordKey);
  };

  const handleCompensation = async (transaction: NtxTransactionDB, event: React.MouseEvent) => {
    event.stopPropagation();

    if (isRecordCompensated(transaction)) {
      toast.error('Registro já compensado');
      return;
    }

    // ✅ Converter para formato MovimentoExtrato esperado pelo modal (espelho do BrasilCash TCR).
    // value = amount = originalAmount BRUTO — mesmo valor que o webhook NTX credita.
    // descCliente carrega o externalId (caas436344xU{id}) → o extrairIdUsuario resolve pelo xU(\d+)
    // mesmo quando a busca por endtoend falhar.
    const descBase = `NTX TCR - ${transaction.externalId ? `${transaction.externalId} - ` : ''}${transaction.counterpartName || 'N/A'}`;
    let extractRecord: any = {
      id: transaction.transactionId,
      dateTime: transaction.createdAt,
      value: parseFloat(transaction.amount),
      type: transaction.type === 'FUNDING' ? 'CRÉDITO' : 'DÉBITO',
      client: transaction.counterpartName || 'N/A',
      document: transaction.counterpartDocument || '', // mascarado no statement — o converter descarta se não tiver 11-14 dígitos
      code: transaction.endToEndId,
      descCliente: descBase,
      identified: true,
      descricaoOperacao: descBase,
      status: transaction.status,
      _providerCompensacao: 'ntx', // provider explícito no payload da compensação (não usar heurística)
      _original: transaction
    };

    // ✅ Buscar id_usuario automaticamente via endtoend (IGUAL CorpX/BrasilCash TCR)
    try {
      toast.info('Buscando usuário...', {
        description: 'Verificando endtoend da transação via API'
      });

      const tcTransaction = {
        id: transaction.transactionId || transaction.endToEndId,
        _original: {
          idEndToEnd: transaction.endToEndId,
          endToEndId: transaction.endToEndId
        },
        code: transaction.endToEndId
      };

      const resultado = await TCRVerificacaoService.verificarTransacaoTCR(tcTransaction);

      if (resultado.encontrou && resultado.id_usuario) {
        extractRecord.descCliente = `Usuario ${resultado.id_usuario}; ${extractRecord.descCliente}`;

        toast.success(`Usuário encontrado: ID ${resultado.id_usuario}`, {
          description: 'Abrindo modal com todas as funcionalidades'
        });
      } else {
        toast.warning('Usuário não encontrado automaticamente', {
          description: transaction.externalId?.includes('xU')
            ? 'Modal aberto — ID extraído do External ID'
            : 'Modal aberto - você pode informar o ID manualmente'
        });
      }
    } catch (error) {
      toast.error('Erro na verificação automática', {
        description: 'Modal aberto - você pode informar o ID manualmente'
      });
    }

    // ✅ SEMPRE abrir o modal (com ou sem id_usuario encontrado)
    setSelectedCompensationRecord(extractRecord);
    setCompensationModalOpen(true);
  };

  const handleCloseCompensationModal = (wasSuccessful?: boolean) => {
    if (wasSuccessful && selectedCompensationRecord) {
      const recordKey = `ntx-tcr-${selectedCompensationRecord._original.id}`;
      setCompensatedRecords(prev => new Set(prev).add(recordKey));
      toast.success('Compensação realizada com sucesso!');
      fetchTransactions(dateFrom, dateTo, pagination.current_page, false); // Recarregar dados
    }

    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
  };

  // 🚀 Navegação de página server-side
  const handlePageChange = async (newPage: number) => {
    if (newPage >= 1) {
      await fetchTransactions(dateFrom, dateTo, newPage, false);
    } else {
      toast.error("Página inválida", {
        description: "Digite um número maior ou igual a 1",
        duration: 3000
      });
    }
  };

  const handlePreviousPage = () => {
    if (pagination.current_page > 1) {
      handlePageChange(pagination.current_page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.has_next) {
      handlePageChange(pagination.current_page + 1);
    }
  };

  const handleRecordsPerPageChange = (value: string) => {
    const size = parseInt(value, 10);
    if (Number.isNaN(size)) {
      return;
    }

    setRecordsPerPage(size);
    setPagination(prev => ({
      ...prev,
      size,
      current_page: 1
    }));
    fetchTransactions(dateFrom, dateTo, 1, false);
  };

  const generateReceipt = (tx: NtxTransactionDB, event: React.MouseEvent) => {
    event.stopPropagation();

    const tipoLabel = tx.type === 'FUNDING' ? 'Recebimento PIX' : 'Envio PIX';
    const statusLabel = tx.status || '-';
    const valorFormatado = formatCurrency(tx.amount);
    const dataFormatada = formatDate(tx.createdAt);

    // FUNDING: pagador = contraparte (quem enviou), beneficiário = TCR (conta NTX Pay)
    // WITHDRAWAL: pagador = TCR, beneficiário = contraparte
    const isWithdrawal = tx.type === 'WITHDRAWAL';

    const contraparteNome = tx.counterpartName || '-';
    const contraparteDoc = tx.counterpartDocument || '-';
    const contraparteBanco = tx.counterpartBankName || '-';
    const contraparteAgencia = tx.counterpartBranch || '-';
    const contraparteConta = tx.counterpartAccount || '-';

    const tcrNome = 'TCR — Conta NTX Pay';

    const pagadorNome = isWithdrawal ? tcrNome : contraparteNome;
    const pagadorDoc = isWithdrawal ? '-' : contraparteDoc;
    const pagadorBanco = isWithdrawal ? '-' : contraparteBanco;
    const pagadorAgencia = isWithdrawal ? '-' : contraparteAgencia;
    const pagadorConta = isWithdrawal ? '-' : contraparteConta;

    const beneficiarioNome = isWithdrawal ? contraparteNome : tcrNome;
    const beneficiarioDoc = isWithdrawal ? contraparteDoc : '-';
    const beneficiarioBanco = isWithdrawal ? contraparteBanco : '-';
    const beneficiarioAgencia = isWithdrawal ? contraparteAgencia : '-';
    const beneficiarioConta = isWithdrawal ? contraparteConta : '-';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante PIX - ${tx.endToEndId || tx.transactionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #1a1a1a;
    }
    .receipt {
      max-width: 480px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #ff8c00, #e67e00);
      color: #fff;
      padding: 24px;
      text-align: center;
    }
    .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 12px; opacity: 0.9; }
    .status-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255,255,255,0.25);
    }
    .amount-section {
      text-align: center;
      padding: 20px 24px;
      border-bottom: 1px dashed #e0e0e0;
    }
    .amount-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .amount-value {
      font-size: 32px;
      font-weight: 700;
      margin-top: 4px;
      color: ${tx.type === 'FUNDING' ? '#16a34a' : '#dc2626'};
    }
    .amount-type { font-size: 13px; color: #666; margin-top: 4px; }
    .section { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #ff8c00;
      margin-bottom: 10px;
    }
    .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 5px 0; }
    .row .label { font-size: 12px; color: #888; flex-shrink: 0; }
    .row .value { font-size: 12px; color: #1a1a1a; font-weight: 500; text-align: right; word-break: break-all; max-width: 60%; }
    .row .value.mono { font-family: 'SF Mono', 'Consolas', monospace; font-size: 11px; }
    .footer {
      padding: 16px 24px;
      text-align: center;
      color: #aaa;
      font-size: 10px;
      line-height: 1.5;
    }
    .print-btn {
      display: block;
      width: 480px;
      max-width: 100%;
      margin: 16px auto;
      padding: 12px;
      background: #ff8c00;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover { background: #e67e00; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Comprovante de ${tipoLabel}</h1>
      <div class="subtitle">NTX Pay &mdash; TCR</div>
      <div class="status-badge">${statusLabel}</div>
    </div>

    <div class="amount-section">
      <div class="amount-label">Valor da transação</div>
      <div class="amount-value">${tx.type === 'FUNDING' ? '+' : '-'} ${valorFormatado}</div>
      <div class="amount-type">${tipoLabel} &bull; ${dataFormatada}</div>
    </div>

    <div class="section">
      <div class="section-title">Pagador</div>
      <div class="row"><span class="label">Nome</span><span class="value">${pagadorNome}</span></div>
      <div class="row"><span class="label">CPF/CNPJ</span><span class="value mono">${pagadorDoc}</span></div>
      <div class="row"><span class="label">Banco</span><span class="value">${pagadorBanco}</span></div>
      <div class="row"><span class="label">Agência</span><span class="value mono">${pagadorAgencia}</span></div>
      <div class="row"><span class="label">Conta</span><span class="value mono">${pagadorConta}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Beneficiário</div>
      <div class="row"><span class="label">Nome</span><span class="value">${beneficiarioNome}</span></div>
      <div class="row"><span class="label">CPF/CNPJ</span><span class="value mono">${beneficiarioDoc}</span></div>
      <div class="row"><span class="label">Banco</span><span class="value">${beneficiarioBanco}</span></div>
      <div class="row"><span class="label">Agência</span><span class="value mono">${beneficiarioAgencia}</span></div>
      <div class="row"><span class="label">Conta</span><span class="value mono">${beneficiarioConta}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Identificação</div>
      <div class="row"><span class="label">End-to-End ID</span><span class="value mono">${tx.endToEndId || '-'}</span></div>
      <div class="row"><span class="label">Transaction ID</span><span class="value mono">${tx.transactionId || '-'}</span></div>
      ${tx.externalId ? `<div class="row"><span class="label">External ID</span><span class="value mono">${tx.externalId}</span></div>` : ''}
      <div class="row"><span class="label">Operação</span><span class="value">${tx.eventRaw || '-'}</span></div>
      ${parseFloat(tx.feeAmount) > 0 ? `<div class="row"><span class="label">Taxa</span><span class="value">${formatCurrency(tx.feeAmount)}</span></div>` : ''}
      ${tx.description ? `<div class="row"><span class="label">Descrição</span><span class="value">${tx.description}</span></div>` : ''}
    </div>

    <div class="footer">
      Documento gerado em ${new Date().toLocaleString('pt-BR')}<br/>
      NTX Pay &mdash; TCR &bull; Este comprovante não tem valor fiscal
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(html);
      receiptWindow.document.close();
    } else {
      toast.error('Pop-up bloqueado', {
        description: 'Permita pop-ups para gerar o comprovante'
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Tempo Real
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {pagination.total} transações
          </span>
        </div>

        <div className="flex gap-2">
          <Select
            value={recordsPerPage.toString()}
            onValueChange={handleRecordsPerPageChange}
            disabled={loading}
          >
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder="Registros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 registros</SelectItem>
              <SelectItem value="50">50 registros</SelectItem>
              <SelectItem value="100">100 registros</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions(dateFrom, dateTo, pagination.current_page, false)}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 bg-background border border-[rgba(255,140,0,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Depósitos</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#FF8C00]" />
            ) : (
              <>
                <p className="text-2xl font-bold text-[#FF8C00]">{metrics.totalDeposits}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.depositAmount)}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(255,140,0,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Saques</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#FF8C00]" />
            ) : (
              <>
                <p className="text-2xl font-bold text-[#FF8C00]">{metrics.totalWithdrawals}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.withdrawalAmount)}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(255,140,0,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor em Depósitos</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-green-500" />
            ) : (
              <p className="text-2xl font-bold text-green-500">
                {formatCurrency(metrics.depositAmount)}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(255,140,0,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor em Saques</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#FF8C00]" />
            ) : (
              <p className="text-2xl font-bold text-[#FF8C00]">
                {formatCurrency(metrics.withdrawalAmount)}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Filtros (sempre visíveis) */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          {/* Linha 1: Busca, Operação, Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, documento, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operação</label>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="PAYMENT">Pix In (recebimento)</SelectItem>
                  <SelectItem value="WITHDRAW">Pix Out (envio)</SelectItem>
                  <SelectItem value="REFUND_OUT">Refund Out (estorno recebido)</SelectItem>
                  <SelectItem value="REFUND_IN">Refund In (estorno enviado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="ERROR">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 1.5: End-to-End ID, External ID, Valor específico */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End-to-End ID</label>
              <Input
                placeholder="E18236120202511240407s0974cda408"
                value={endToEndIdFilter}
                onChange={(e) => setEndToEndIdFilter(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">External ID</label>
              <Input
                placeholder="caas436344xU1265"
                value={externalIdFilter}
                onChange={(e) => setExternalIdFilter(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor específico (R$)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={specificAmount}
                onChange={(e) => setSpecificAmount(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]"
              />
            </div>
          </div>

          {/* Linha 2: Data inicial, Data final, Valor mínimo, Valor máximo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal bg-background border-2 transition-all",
                      !dateRange.from && "text-muted-foreground",
                      dateRange.from && "border-[rgba(255,140,0,0.6)]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => {
                      if (date) {
                        setDateRange({ ...dateRange, from: date });
                      }
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 w-full justify-start text-left font-normal bg-background border-2 transition-all",
                      !dateRange.to && "text-muted-foreground",
                      dateRange.to && "border-[rgba(255,140,0,0.6)]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? (
                      format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => {
                      if (date) {
                        setDateRange({ ...dateRange, to: date });
                      }
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor mínimo</label>
              <Input
                type="number"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor máximo</label>
              <Input
                type="number"
                placeholder="0.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]"
              />
            </div>
          </div>

          {/* Linha 3: Checkbox e Botões de Ação */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reversals"
                  checked={showReversalsOnly}
                  onCheckedChange={(checked) => setShowReversalsOnly(checked as boolean)}
                  className="border-2"
                />
                <label htmlFor="reversals" className="text-sm font-medium cursor-pointer">
                  Apenas Estornos
                </label>
              </div>

              <span className="text-xs text-muted-foreground">
                Busca e valores refinam a página carregada • janela máx. {NTX_MAX_WINDOW_DAYS} dias
              </span>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando filtros...
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <Button
                onClick={handleAplicarFiltros}
                className="h-10 bg-orange-600 hover:bg-orange-700 text-white transition-all duration-200 rounded-md px-3 lg:px-4"
                disabled={loading}
              >
                <Filter className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={handleLimparFiltros}
                className="h-10 bg-black border border-orange-500 text-white hover:bg-orange-500 hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-500 mb-4">Erro ao carregar extrato</p>
            <Button onClick={() => fetchTransactions(dateFrom, dateTo, pagination.current_page, false)} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Nenhuma transação encontrada com esse filtro' : 'Nenhuma transação encontrada'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[1000px] overflow-y-auto relative">
              <table className="w-full">
                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">End-to-End</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">External ID</th>
                    <th className="w-32 p-3 text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, index) => (
                    <>
                    <tr
                      key={tx.id}
                      className={cn(
                        "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                        index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]",
                        expandedRow === tx.id && "bg-muted/10 dark:bg-muted/5"
                      )}
                      onClick={() => {
                        setExpandedRow(expandedRow === tx.id ? null : tx.id);
                      }}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {expandedRow === tx.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="text-sm">{formatDate(tx.createdAt).split(' ')[0]}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(tx.createdAt).split(' ')[1]}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {tx.type === 'FUNDING' ? (
                            <ArrowDownCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {NtxRealtimeService.getTransactionTypeLabel(tx.type)}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium">
                          {tx.counterpartName || 'N/A'}
                        </div>
                        {tx.isRefund && (
                          <Badge variant="destructive" className="text-xs mt-1">Estorno</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className={cn(
                          "text-sm font-bold",
                          tx.type === 'FUNDING' ? "text-green-600" : "text-red-600"
                        )}>
                          {tx.type === 'FUNDING' ? '+' : '-'} {formatCurrency(tx.amount)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={NtxRealtimeService.getStatusBadge(tx.status).variant} className="text-xs">
                          {NtxRealtimeService.getStatusBadge(tx.status).label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.endToEndId ? `${tx.endToEndId.substring(0, 20)}...` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.externalId ? `${tx.externalId.substring(0, 20)}...` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => generateReceipt(tx, e)}
                            className="h-7 w-7 p-0 hover:bg-[rgba(255,140,0,0.15)] text-muted-foreground hover:text-[#ff8c00]"
                            title="Gerar comprovante"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          {tx.type === 'FUNDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleCompensation(tx, e)}
                              disabled={isRecordCompensated(tx)}
                              className={cn(
                                "h-7 px-2 text-xs transition-all",
                                isRecordCompensated(tx)
                                  ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                  : "bg-[rgba(255,140,0,0.1)] hover:bg-[rgba(255,140,0,0.2)] text-[#ff8c00] border-[rgba(255,140,0,0.4)] hover:border-[rgba(255,140,0,0.6)]"
                              )}
                              title={isRecordCompensated(tx) ? "Já compensado" : "Realizar compensação"}
                            >
                              {isRecordCompensated(tx) ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Compensado
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Compensar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Linha expandida com detalhes */}
                    {expandedRow === tx.id && (
                      <tr className="bg-muted/5 dark:bg-muted/5 border-b border-border/50">
                        <td colSpan={8} className="p-0">
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-orange-700">Detalhes da Transação</h4>
                              <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Coluna 1: IDs e Operação */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Transaction ID</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm font-mono break-all">{tx.transactionId}</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(tx.transactionId);
                                        toast.success('Transaction ID copiado!');
                                      }}
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">End-to-End ID</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm font-mono break-all">{tx.endToEndId || '-'}</p>
                                    {tx.endToEndId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(tx.endToEndId);
                                          toast.success('End-to-End ID copiado!');
                                        }}
                                        className="h-6 w-6 p-0 flex-shrink-0"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {tx.externalId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">External ID</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono text-orange-600 font-semibold break-all">{tx.externalId}</p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(tx.externalId);
                                          toast.success('External ID copiado!');
                                        }}
                                        className="h-6 w-6 p-0 flex-shrink-0"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Operação</label>
                                  <p className="text-sm mt-1">{tx.eventRaw || '-'}</p>
                                </div>

                                {String(tx._original?.movementType || '') && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Movement Type</label>
                                    <p className="text-sm mt-1">{String(tx._original?.movementType)}</p>
                                  </div>
                                )}
                              </div>

                              {/* Coluna 2: Contraparte */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-orange-600 uppercase mb-2">Contraparte</h4>

                                {tx.counterpartName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{tx.counterpartName}</p>
                                  </div>
                                )}

                                {tx.counterpartDocument && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ (mascarado)</label>
                                    <p className="text-sm mt-1 font-mono">{tx.counterpartDocument}</p>
                                  </div>
                                )}

                                {tx.counterpartBankName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco</label>
                                    <p className="text-sm mt-1">🏦 {tx.counterpartBankName}</p>
                                  </div>
                                )}

                                {tx.counterpartIspb && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">ISPB</label>
                                    <p className="text-sm mt-1 font-mono">{tx.counterpartIspb}</p>
                                  </div>
                                )}

                                {tx.counterpartBranch && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Agência</label>
                                    <p className="text-sm mt-1 font-mono">{tx.counterpartBranch}</p>
                                  </div>
                                )}

                                {tx.counterpartAccount && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Conta</label>
                                    <p className="text-sm mt-1 font-mono">{tx.counterpartAccount}</p>
                                  </div>
                                )}
                              </div>

                              {/* Coluna 3: Valores */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-green-600 uppercase mb-2">Valores</h4>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Valor Bruto</label>
                                  <p className="text-sm mt-1 font-bold">{formatCurrency(tx.amount)}</p>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Taxa</label>
                                  <p className="text-sm mt-1">{formatCurrency(tx.feeAmount)}</p>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Valor Líquido</label>
                                  <p className="text-sm mt-1 font-bold">{formatCurrency(tx.finalAmount)}</p>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Moeda</label>
                                  <p className="text-sm mt-1">BRL</p>
                                </div>
                              </div>

                              {/* Coluna 4: Transação e Datas */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-blue-600 uppercase mb-2">Transação</h4>

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                                  <Badge variant={NtxRealtimeService.getStatusBadge(tx.status).variant} className="text-xs mt-1">
                                    {NtxRealtimeService.getStatusBadge(tx.status).label}
                                  </Badge>
                                </div>

                                {tx.description && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Descrição</label>
                                    <p className="text-sm mt-1 break-words">{tx.description}</p>
                                  </div>
                                )}

                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Criado em</label>
                                  <p className="text-sm mt-1">{formatDate(tx.createdAt)}</p>
                                </div>

                                {tx.processedAt && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Processado em</label>
                                    <p className="text-sm mt-1">{formatDate(tx.processedAt)}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <div className="text-sm text-muted-foreground">
                Mostrando {(pagination.current_page - 1) * pagination.size + 1} - {Math.min(pagination.current_page * pagination.size, pagination.total)} de {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={pagination.current_page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {pagination.current_page} / {pagination.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!pagination.has_next}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modal de Compensação — SEM ações PIX (Devolver/Bloquear não entram pra NTX) */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={handleCloseCompensationModal}
        extractRecord={selectedCompensationRecord}
        allowPixActions={false}
      />
    </div>
  );
}
