import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Download, ArrowUpCircle, ArrowDownCircle, Loader2, FileText, Check, X, RefreshCcw, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Calendar as CalendarIcon, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";
import { BrasilCashRealtimeService } from "@/services/brasilcash-realtime";
import type { BrasilCashTransactionDB, BrasilCashTransactionFilters } from "@/services/brasilcash-realtime";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";

// Constantes para TCR BrasilCash
const TCR_ACCOUNT_ID = BrasilCashRealtimeService.TCR_ACCOUNT_ID;

export default function ExtractTabBrasilCashTcr() {
  // WebSocket filtrado para TCR (mantendo compatibilidade por enquanto)
  const { isConnected } = useFilteredBitsoWebSocket({
    context: 'tcr',
    tenantId: 2,
  });

  // Estados de transações
  const [transactions, setTransactions] = useState<BrasilCashTransactionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(2000); // Usar limite máximo da API
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 2000, // Limite máximo da API
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1
  });

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: BrasilCashRealtimeService.getDateStringDaysAgo(7),
    end: BrasilCashRealtimeService.getTodayDateString()
  });
  
  // Estado para o Date Range Picker
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FUNDING' | 'WITHDRAWAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED'>('ALL');
  const [methodTypeFilter, setMethodTypeFilter] = useState<'ALL' | 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode'>('ALL');
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [specificAmount, setSpecificAmount] = useState<string>("");
  const [endToEndIdFilter, setEndToEndIdFilter] = useState<string>("");
  const [externalIdFilter, setExternalIdFilter] = useState<string>("");
  const [showReversalsOnly, setShowReversalsOnly] = useState(false);

  // Estados para sincronização de extrato
  const [syncing, setSyncing] = useState(false);
  const [syncDateRange, setSyncDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [showSyncDatePicker, setShowSyncDatePicker] = useState(false);

  // Estados para funcionalidade de Compensação
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);
  const [compensatedRecords, setCompensatedRecords] = useState<Set<string>>(new Set());

  // Estado para controlar linha expandida
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Estado para métricas
  const [metrics, setMetrics] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    loading: false
  });

  // Buscar transações do BrasilCash
  const fetchTransactions = async (resetOffset: boolean = false, overrideLimit?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const limit = overrideLimit ?? recordsPerPage;
      const offset = resetOffset ? 0 : pagination.offset;
      
      // Converter filtros de status
      // Nota: Quando PENDING, não filtramos na API (busca pending e processing) e filtramos localmente
      let statusFilterApi: 'pending' | 'processing' | 'paid' | 'refused' | undefined;
      if (statusFilter === 'COMPLETE') statusFilterApi = 'paid';
      else if (statusFilter === 'FAILED') statusFilterApi = 'refused';
      // Para PENDING, não filtramos na API (vai buscar todos e filtrar localmente)
      
      // Converter filtros de tipo para method
      let methodFilter: 'cashin' | 'cashout' | undefined;
      if (typeFilter === 'FUNDING') methodFilter = 'cashin';
      else if (typeFilter === 'WITHDRAWAL') methodFilter = 'cashout';
      
      // Converter filtro de tipo de método
      let typeFilterApi: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode' | undefined;
      if (methodTypeFilter !== 'ALL') {
        typeFilterApi = methodTypeFilter;
      }
      
      // Valor específico - backend já espera em reais
      let amountFilter: number | undefined;
      if (specificAmount) {
        amountFilter = parseFloat(specificAmount);
      }
      
      const filters: BrasilCashTransactionFilters = {
        accountId: TCR_ACCOUNT_ID,
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        status: statusFilterApi,
        method: methodFilter,
        type: typeFilterApi,
        endToEndId: endToEndIdFilter.trim() || undefined,
        external_id: externalIdFilter.trim() || undefined,
        amount: amountFilter,
        limit,
        offset,
      };
      
      // Buscar todas as páginas se necessário
      let allMappedTransactions: BrasilCashTransactionDB[] = [];
      let currentOffset = offset;
      let hasMore = true;
      let totalFromApi = 0;
      
      while (hasMore) {
        const currentFilters: BrasilCashTransactionFilters = {
          ...filters,
          limit,
          offset: currentOffset,
        };
        
        const response = await BrasilCashRealtimeService.getTransactions(currentFilters);
        
      // Converter dados do BrasilCash para formato BrasilCashTransactionDB
      const mappedTransactions = (response.data || [])
        .map(BrasilCashRealtimeService.mapBrasilCashToTransactionDB)
        // Filtrar transações com event_type 'tarifa'
        .filter(tx => tx.eventType !== 'tarifa');
      allMappedTransactions = [...allMappedTransactions, ...mappedTransactions];
        
        // Atualizar informações de paginação
        totalFromApi = response.pagination?.total ?? allMappedTransactions.length;
        hasMore = response.pagination?.has_more ?? false;
        
        // Se não há mais páginas ou já buscamos todas as transações, parar
        if (!hasMore || allMappedTransactions.length >= totalFromApi) {
          break;
        }
        
        // Avançar para próxima página
        currentOffset += limit;
        
        // Limite de segurança: não buscar mais de 10 páginas de uma vez
        if (currentOffset >= limit * 10) {
          break;
        }
      }
      
      // Aplicar filtros locais que não estão na API (min/max amount)
      let filtered = allMappedTransactions;
      
      // Filtros de valor mínimo e máximo (já que a API só suporta valor exato)
      if (!specificAmount) {
        if (minAmount) {
          const min = parseFloat(minAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
        }
        if (maxAmount) {
          const max = parseFloat(maxAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
        }
      }
      
      setTransactions(filtered);
      
      // Atualizar paginação baseada na resposta
      const total = totalFromApi > 0 ? totalFromApi : filtered.length;
      const hasMorePages = hasMore;
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

      setPagination({
        total,
        limit,
        offset,
        has_more: hasMorePages,
        current_page: Math.floor(offset / limit) + 1,
        total_pages: totalPages
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar transações');
      toast.error('Erro ao carregar extrato', {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Buscar métricas de todas as transações
  const fetchMetrics = async () => {
    setMetrics(prev => ({ ...prev, loading: true }));
    
    try {
      // Converter filtros de status
      // Nota: Quando PENDING, não filtramos na API (busca pending e processing) e filtramos localmente
      let statusFilterApi: 'pending' | 'processing' | 'paid' | 'refused' | undefined;
      if (statusFilter === 'COMPLETE') statusFilterApi = 'paid';
      else if (statusFilter === 'FAILED') statusFilterApi = 'refused';
      // Para PENDING, não filtramos na API (vai buscar todos e filtrar localmente)
      
      // Converter filtros de tipo para method
      let methodFilter: 'cashin' | 'cashout' | undefined;
      if (typeFilter === 'FUNDING') methodFilter = 'cashin';
      else if (typeFilter === 'WITHDRAWAL') methodFilter = 'cashout';
      
      // Converter filtro de tipo de método
      let typeFilterApi: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode' | undefined;
      if (methodTypeFilter !== 'ALL') {
        typeFilterApi = methodTypeFilter;
      }
      
      // Valor específico - backend já espera em reais
      let amountFilter: number | undefined;
      if (specificAmount) {
        amountFilter = parseFloat(specificAmount);
      }
      
      // Buscar TODAS as transações com os filtros aplicados
      const filters: BrasilCashTransactionFilters = {
        accountId: TCR_ACCOUNT_ID,
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        status: statusFilterApi,
        method: methodFilter,
        type: typeFilterApi,
        endToEndId: endToEndIdFilter.trim() || undefined,
        external_id: externalIdFilter.trim() || undefined,
        amount: amountFilter,
        limit: 2000, // Máximo permitido pela API
        offset: 0,
      };
      
      const response = await BrasilCashRealtimeService.getTransactions(filters);

      const allTransactions = (response.data || [])
        .map(BrasilCashRealtimeService.mapBrasilCashToTransactionDB)
        // Filtrar transações com event_type 'tarifa'
        .filter(tx => tx.eventType !== 'tarifa');
      
      // Aplicar os mesmos filtros locais
      let filtered = allTransactions;
      
      // Filtrar por status PENDING localmente (inclui pending e processing da API)
      if (statusFilter === 'PENDING') {
        filtered = filtered.filter(tx => tx.status === 'PENDING');
      } else if (statusFilter !== 'ALL') {
        filtered = filtered.filter(tx => tx.status === statusFilter);
      }
      
      if (specificAmount) {
        const amount = parseFloat(specificAmount);
        filtered = filtered.filter(tx => Math.abs(parseFloat(tx.amount) - amount) < 0.01);
      } else {
        if (minAmount) {
          const min = parseFloat(minAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
        }
        if (maxAmount) {
          const max = parseFloat(maxAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
        }
      }
      
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(tx => 
          tx.payerName?.toLowerCase().includes(searchLower) ||
          tx.payeeName?.toLowerCase().includes(searchLower) ||
          tx.payerTaxId?.toLowerCase().includes(searchLower) ||
          tx.transactionId?.toLowerCase().includes(searchLower) ||
          tx.endToEndId?.toLowerCase().includes(searchLower) ||
          tx.reconciliationId?.toLowerCase().includes(searchLower) ||
          tx.description?.toLowerCase().includes(searchLower) ||
          tx.amount?.toString().includes(searchLower)
        );
      }
      
      // Calcular métricas
      const deposits = filtered.filter(tx => tx.type === 'FUNDING');
      const withdrawals = filtered.filter(tx => tx.type === 'WITHDRAWAL');
      
      const depositAmount = deposits.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const withdrawalAmount = withdrawals.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      setMetrics({
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        depositAmount: depositAmount,
        withdrawalAmount: withdrawalAmount,
        loading: false
      });
    } catch (err: any) {
      console.error('Erro ao buscar métricas:', err);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchTransactions(true);
    fetchMetrics();
  }, []);

  // Aplicar filtros automaticamente quando mudarem (exceto data e busca)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(true);
      fetchMetrics();
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timer);
  }, [typeFilter, statusFilter, methodTypeFilter, minAmount, maxAmount, specificAmount, endToEndIdFilter, externalIdFilter, showReversalsOnly, searchTerm]);

  // Sincronizar dateRange com dateFilter
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      setDateFilter({
        start: formatDate(dateRange.from),
        end: formatDate(dateRange.to)
      });
    }
  }, [dateRange]);

  // Aplicar filtro de data apenas quando tiver AMBAS as datas
  useEffect(() => {
    if (dateFilter.start && dateFilter.end) {
      const timer = setTimeout(() => {
        fetchTransactions(true);
        fetchMetrics();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [dateFilter.start, dateFilter.end]); // Dependências específicas para evitar disparo individual

  // Filtro de busca local (frontend)
  const filteredTransactions = useMemo(() => {
    // Filtrar tarifas primeiro
    let filtered = transactions.filter(tx => tx.eventType !== 'tarifa');
    
    if (!searchTerm.trim()) return filtered;

    const searchLower = searchTerm.toLowerCase().trim();
    return filtered.filter(tx => {
      return (
        tx.payerName?.toLowerCase().includes(searchLower) ||
        tx.payeeName?.toLowerCase().includes(searchLower) ||
        tx.payerTaxId?.toLowerCase().includes(searchLower) ||
        tx.transactionId?.toLowerCase().includes(searchLower) ||
        tx.endToEndId?.toLowerCase().includes(searchLower) ||
        tx.reconciliationId?.toLowerCase().includes(searchLower) ||
        tx.description?.toLowerCase().includes(searchLower) ||
        tx.amount?.toString().includes(searchLower)
      );
    });
  }, [transactions, searchTerm]);

  const formatCurrency = (value: string | number) => {
    return BrasilCashRealtimeService.formatCurrency(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return BrasilCashRealtimeService.formatUTCToLocalString(dateString);
    } catch {
      return dateString;
    }
  };

  const exportToCSV = async () => {
    try {
      toast.info('Preparando exportação...', { description: 'Buscando todos os registros TCR do BrasilCash' });
      
      // ✅ Buscar TODOS os registros do BrasilCash para TCR
      let allTransactions: BrasilCashTransactionDB[] = [];
      let offset = 0;
      const limit = 2000; // Máximo permitido pela API
      let hasMore = true;

      while (hasMore) {
        // Converter filtros para exportação
        // Nota: Quando PENDING, não filtramos na API (busca pending e processing) e filtramos localmente
        let statusFilterApi: 'pending' | 'processing' | 'paid' | 'refused' | undefined;
        if (statusFilter === 'COMPLETE') statusFilterApi = 'paid';
        else if (statusFilter === 'FAILED') statusFilterApi = 'refused';
        // Para PENDING, não filtramos na API (vai buscar todos e filtrar localmente)
        
        let methodFilter: 'cashin' | 'cashout' | undefined;
        if (typeFilter === 'FUNDING') methodFilter = 'cashin';
        else if (typeFilter === 'WITHDRAWAL') methodFilter = 'cashout';
        
        let typeFilterApi: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode' | undefined;
        if (methodTypeFilter !== 'ALL') {
          typeFilterApi = methodTypeFilter;
        }
        
        let amountFilter: number | undefined;
        if (specificAmount) {
          amountFilter = parseFloat(specificAmount);
        }
        
        const filters: BrasilCashTransactionFilters = {
          accountId: TCR_ACCOUNT_ID,
          startDate: dateFilter.start,
          endDate: dateFilter.end,
          status: statusFilterApi,
          method: methodFilter,
          type: typeFilterApi,
          endToEndId: endToEndIdFilter.trim() || undefined,
          external_id: externalIdFilter.trim() || undefined,
          amount: amountFilter,
          limit,
          offset,
        };
        
        const response = await BrasilCashRealtimeService.getTransactions(filters);

        const mappedTransactions = (response.data || [])
          .map(BrasilCashRealtimeService.mapBrasilCashToTransactionDB)
          // Filtrar transações com event_type 'tarifa'
          .filter(tx => tx.eventType !== 'tarifa');
        allTransactions = [...allTransactions, ...mappedTransactions];

        hasMore = response.pagination?.has_more || false;
        offset += limit;
      }

      // Aplicar filtros locais
      let transactionsToExport = allTransactions;
      
      if (typeFilter !== 'ALL') {
        transactionsToExport = transactionsToExport.filter(tx => tx.type === typeFilter);
      }
      
      // Filtrar por status PENDING localmente (inclui pending e processing da API)
      if (statusFilter === 'PENDING') {
        transactionsToExport = transactionsToExport.filter(tx => tx.status === 'PENDING');
      } else if (statusFilter !== 'ALL') {
        transactionsToExport = transactionsToExport.filter(tx => tx.status === statusFilter);
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
      
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        transactionsToExport = transactionsToExport.filter((t: BrasilCashTransactionDB) => {
          return (
            t.payerName?.toLowerCase().includes(searchLower) ||
            t.payeeName?.toLowerCase().includes(searchLower) ||
            t.endToEndId?.toLowerCase().includes(searchLower) ||
            t.transactionId?.toLowerCase().includes(searchLower) ||
            t.reconciliationId?.toLowerCase().includes(searchLower) ||
            t.amount.toString().includes(searchLower)
          );
        });
      }

      // Gerar CSV com todas as colunas relevantes para TCR
      const headers = ['Data', 'Tipo', 'Status', 'Valor', 'Moeda', 'Nome Pagador', 'Nome Beneficiário', 'Banco', 'End-to-End ID', 'Transaction ID', 'External ID', 'Descrição'];
      const rows = transactionsToExport.map((t: BrasilCashTransactionDB) => [
        formatDate(t.createdAt),
        BrasilCashRealtimeService.getTransactionTypeLabel(t.type),
        t.status,
        t.amount,
        t.currency,
        t.payerName || '',
        t.payeeName || '',
        t.payerBankName || '',
        t.endToEndId || '',
        t.transactionId || '',
        t.reconciliationId || '', // External ID
        t.description || '' // Descrição
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `extrato-brasilcash-tcr-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success(`${transactionsToExport.length} registros TCR exportados com sucesso!`, {
        description: `Arquivo: extrato-brasilcash-tcr-${new Date().toISOString().split('T')[0]}.csv`
      });
    } catch (error: any) {
      toast.error('Erro ao exportar extrato', {
        description: error.message || 'Não foi possível gerar o arquivo CSV'
      });
    }
  };

  const isRecordCompensated = (transaction: BrasilCashTransactionDB): boolean => {
    const recordKey = `brasilcash-tcr-${transaction.id}`;
    return compensatedRecords.has(recordKey);
  };

  const handleCompensation = async (transaction: BrasilCashTransactionDB, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isRecordCompensated(transaction)) {
      toast.error('Registro já compensado');
      return;
    }
    
    // ✅ Converter para formato MovimentoExtrato esperado pelo modal (IGUAL CorpX TCR)
    let extractRecord = {
      id: transaction.transactionId,
      dateTime: transaction.createdAt,
      value: parseFloat(transaction.amount),
      type: transaction.type === 'FUNDING' ? 'CRÉDITO' : 'DÉBITO',
      client: transaction.type === 'FUNDING' 
        ? (transaction.payerName || 'N/A')  // Quem enviou (para depósitos)
        : (transaction.payeeName || 'N/A'),  // Quem recebeu (para saques)
      document: transaction.payerTaxId || '',
      code: transaction.endToEndId,
      descCliente: `BrasilCash TCR - ${transaction.type === 'FUNDING' 
        ? (transaction.payerName || 'N/A')
        : (transaction.payeeName || 'N/A')}`,
      identified: true,
      descricaoOperacao: `BrasilCash TCR - ${transaction.type === 'FUNDING' 
        ? (transaction.payerName || 'N/A')
        : (transaction.payeeName || 'N/A')}`,
      _original: transaction
    };
    
    // ✅ Buscar id_usuario automaticamente via endtoend (IGUAL CorpX TCR)
    try {
      toast.info('Buscando usuário...', {
        description: 'Verificando endtoend da transação via API'
      });
      
      // Criar objeto compatível com TCRVerificacaoService
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
        // ✅ ENCONTROU! Modificar descCliente para incluir o ID do usuário
        extractRecord.descCliente = `Usuario ${resultado.id_usuario}; ${extractRecord.descCliente}`;
        
        toast.success(`Usuário encontrado: ID ${resultado.id_usuario}`, {
          description: 'Abrindo modal com todas as funcionalidades'
        });
      } else {
        // ❌ Não encontrou - mostrar aviso mas abrir modal mesmo assim
        toast.warning('Usuário não encontrado automaticamente', {
          description: 'Modal aberto - você pode informar o ID manualmente'
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
      const recordKey = `brasilcash-tcr-${selectedCompensationRecord._original.id}`;
      setCompensatedRecords(prev => new Set(prev).add(recordKey));
      toast.success('Compensação realizada com sucesso!');
      fetchTransactions(true); // Recarregar dados
    }
    
    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
  };

  const handleSyncExtrato = async () => {
    // Validar se as datas foram selecionadas
    if (!syncDateRange.from || !syncDateRange.to) {
      toast.error('Selecione as datas', {
        description: 'Por favor, selecione a data inicial e final para sincronização'
      });
      return;
    }

    setSyncing(true);
    setShowSyncDatePicker(false);
    
    try {
      // Formatar datas para YYYY-MM-DD
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDate = formatDate(syncDateRange.from);
      const endDate = formatDate(syncDateRange.to);

      // Chamar API de sincronização do BrasilCash
      const result = await BrasilCashRealtimeService.syncTransactions(
        startDate,
        endDate,
        TCR_ACCOUNT_ID
      );
      
      if (result.success) {
        toast.success('Extrato sincronizado!', {
          description: `Período: ${startDate} a ${endDate} • Total: ${result.total}, Criados: ${result.created}, Atualizados: ${result.updated}`
        });
        
        // Recarregar dados após sync
        await fetchTransactions(true);
        await fetchMetrics();
      } else {
        throw new Error(result.errors?.length ? result.errors[0].toString() : 'Erro ao sincronizar');
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar extrato', {
        description: err.message || 'Não foi possível sincronizar os dados'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.offset > 0) {
      const newOffset = Math.max(0, pagination.offset - recordsPerPage);
      fetchTransactionsWithOffset(newOffset);
    }
  };

  const handleNextPage = () => {
    if (pagination.has_more) {
      const newOffset = pagination.offset + recordsPerPage;
      fetchTransactionsWithOffset(newOffset);
    }
  };

  const handleRecordsPerPageChange = (value: string) => {
    const limit = parseInt(value, 10);
    if (Number.isNaN(limit)) {
      return;
    }

    setRecordsPerPage(limit);
    setPagination(prev => ({
      ...prev,
      limit,
      offset: 0,
      current_page: 1
    }));
    fetchTransactions(true, limit);
  };

  const fetchTransactionsWithOffset = async (offset: number, overrideLimit?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const limit = overrideLimit ?? recordsPerPage;
      
      // Converter filtros de status
      // Nota: Quando PENDING, não filtramos na API (busca pending e processing) e filtramos localmente
      let statusFilterApi: 'pending' | 'processing' | 'paid' | 'refused' | undefined;
      if (statusFilter === 'COMPLETE') statusFilterApi = 'paid';
      else if (statusFilter === 'FAILED') statusFilterApi = 'refused';
      // Para PENDING, não filtramos na API (vai buscar todos e filtrar localmente)
      
      // Converter filtros de tipo para method
      let methodFilter: 'cashin' | 'cashout' | undefined;
      if (typeFilter === 'FUNDING') methodFilter = 'cashin';
      else if (typeFilter === 'WITHDRAWAL') methodFilter = 'cashout';
      
      // Converter filtro de tipo de método
      let typeFilterApi: 'manual' | 'dict' | 'staticQrcode' | 'dynamicQrcode' | undefined;
      if (methodTypeFilter !== 'ALL') {
        typeFilterApi = methodTypeFilter;
      }
      
      // Valor específico - backend já espera em reais
      let amountFilter: number | undefined;
      if (specificAmount) {
        amountFilter = parseFloat(specificAmount);
      }
      
      const filters: BrasilCashTransactionFilters = {
        accountId: TCR_ACCOUNT_ID,
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        status: statusFilterApi,
        method: methodFilter,
        type: typeFilterApi,
        endToEndId: endToEndIdFilter.trim() || undefined,
        external_id: externalIdFilter.trim() || undefined,
        amount: amountFilter,
        limit,
        offset,
      };
      
      const response = await BrasilCashRealtimeService.getTransactions(filters);

      // Converter dados do BrasilCash para formato BrasilCashTransactionDB
      const mappedTransactions = (response.data || [])
        .map(BrasilCashRealtimeService.mapBrasilCashToTransactionDB)
        // Filtrar transações com event_type 'tarifa'
        .filter(tx => tx.eventType !== 'tarifa');
      
      // Aplicar filtros locais que não estão na API (min/max amount e status PENDING)
      let filtered = mappedTransactions;
      
      // Filtrar por status PENDING localmente (inclui pending e processing da API)
      if (statusFilter === 'PENDING') {
        filtered = filtered.filter(tx => tx.status === 'PENDING');
      }
      
      // Filtros de valor mínimo e máximo (já que a API só suporta valor exato)
      if (!specificAmount) {
        if (minAmount) {
          const min = parseFloat(minAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
        }
        if (maxAmount) {
          const max = parseFloat(maxAmount);
          filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
        }
      }
      
      setTransactions(filtered);
      
      const total = response.pagination?.total ?? filtered.length;
      const hasMore = response.pagination?.has_more ?? false;
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

      setPagination({
        total,
        limit,
        offset,
        has_more: hasMore,
        current_page: Math.floor(offset / limit) + 1,
        total_pages: totalPages
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar transações');
      toast.error('Erro ao carregar extrato', {
        description: err.message
      });
    } finally {
      setLoading(false);
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
                <SelectItem value="500">500 registros</SelectItem>
                <SelectItem value="1000">1000 registros</SelectItem>
                <SelectItem value="2000">2000 registros</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTransactions(true)}
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
            <div className="flex items-center gap-2">
              <Popover open={showSyncDatePicker} onOpenChange={setShowSyncDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncing}
                    className="h-9"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">
                      {syncDateRange.from && syncDateRange.to
                        ? `${format(syncDateRange.from, "dd/MM", { locale: ptBR })} - ${format(syncDateRange.to, "dd/MM", { locale: ptBR })}`
                        : "Período"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 shadow-lg" align="end">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">De</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-full text-xs justify-start font-normal"
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {syncDateRange.from ? format(syncDateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={syncDateRange.from}
                              onSelect={(date) => {
                                if (date) {
                                  setSyncDateRange({ ...syncDateRange, from: date });
                                }
                              }}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Até</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-full text-xs justify-start font-normal"
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {syncDateRange.to ? format(syncDateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={syncDateRange.to}
                              onSelect={(date) => {
                                if (date) {
                                  setSyncDateRange({ ...syncDateRange, to: date });
                                }
                              }}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSyncExtrato}
                      disabled={syncing || !syncDateRange.from || !syncDateRange.to}
                      className="w-full h-8 text-xs"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1.5" />
                          Sincronizar
                        </>
                      )}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
          {/* Linha 1: Busca, Tipo, Status, Método */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</label>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="FUNDING">Recebimento</SelectItem>
                  <SelectItem value="WITHDRAWAL">Envio</SelectItem>
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
                  <SelectItem value="COMPLETE">Completo (paid)</SelectItem>
                  <SelectItem value="PENDING">Pendente (pending/processing)</SelectItem>
                  <SelectItem value="FAILED">Falhou (refused)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Método</label>
              <Select value={methodTypeFilter} onValueChange={(v: any) => setMethodTypeFilter(v)}>
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(255,140,0,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="dict">DICT</SelectItem>
                  <SelectItem value="staticQrcode">QR Estático</SelectItem>
                  <SelectItem value="dynamicQrcode">QR Dinâmico</SelectItem>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">External ID (Reconciliation)</label>
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

          {/* Linha 3: Checkbox e Limpar Filtros */}
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
              
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando filtros...
                </div>
              )}
            </div>
          
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setMethodTypeFilter('ALL');
                setMinAmount("");
                setMaxAmount("");
                setSpecificAmount("");
                setEndToEndIdFilter("");
                setExternalIdFilter("");
                setShowReversalsOnly(false);
                setDateRange({
                  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  to: new Date()
                });
                setDateFilter({
                  start: BrasilCashRealtimeService.getDateStringDaysAgo(7),
                  end: BrasilCashRealtimeService.getTodayDateString()
                });
              }}
              className="h-10 bg-black border border-orange-500 text-white hover:bg-orange-500 hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
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
            <Button onClick={() => fetchTransactions(true)} variant="outline">
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
                    <th className="w-24 p-3"></th>
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
                            {tx.type === 'FUNDING' ? 'Recebimento' : 'Envio'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium">
                          {tx.type === 'FUNDING' 
                            ? (tx.payerName || 'N/A')
                            : (tx.payeeName || 'N/A')
                          }
                        </div>
                        {tx.isReversal && (
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
                        <Badge {...BrasilCashRealtimeService.getStatusBadge(tx.status)} className="text-xs">
                          {BrasilCashRealtimeService.getStatusBadge(tx.status).label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.endToEndId ? `${tx.endToEndId.substring(0, 20)}...` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.reconciliationId ? `${tx.reconciliationId.substring(0, 20)}...` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
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
                      </td>
                    </tr>
                    
                    {/* Linha expandida com detalhes */}
                    {expandedRow === tx.id && (
                      <tr className="bg-muted/5 dark:bg-muted/5 border-b border-border/50">
                        <td colSpan={7} className="p-0">
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-orange-700">Detalhes da Transação</h4>
                              <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Coluna 1: IDs e Métodos */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">ID</label>
                                  <p className="text-sm font-mono">{tx.id}</p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Transaction ID (PIX ID)</label>
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
                                
                                {tx.reconciliationId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">External ID (Reconciliation)</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono text-orange-600 font-semibold break-all">{tx.reconciliationId}</p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(tx.reconciliationId);
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
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Método</label>
                                  <p className="text-sm mt-1">{tx.methodName || tx.method}</p>
                                </div>
                                
                                {tx.eventType && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Event Type</label>
                                    <p className="text-sm mt-1">{tx.eventType}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Coluna 2: Pagador */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-orange-600 uppercase mb-2">Pagador</h4>
                                
                                {tx.payerName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{tx.payerName}</p>
                                  </div>
                                )}
                                
                                {tx.payerTaxId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ</label>
                                    <p className="text-sm mt-1 font-mono">{tx.payerTaxId}</p>
                                  </div>
                                )}
                                
                                {tx.payerBankName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco</label>
                                    <p className="text-sm mt-1">🏦 {tx.payerBankName}</p>
                                  </div>
                                )}
                                
                                {tx._original?.payer_ispb && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">ISPB</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.payer_ispb}</p>
                                  </div>
                                )}
                                
                                {tx._original?.payer_account && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Conta</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.payer_account}</p>
                                  </div>
                                )}
                                
                                {tx._original?.payer_branch_code && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Agência</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.payer_branch_code}</p>
                                  </div>
                                )}
                                
                                {tx._original?.payer_account_type && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo de Conta</label>
                                    <p className="text-sm mt-1">{tx._original.payer_account_type}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Coluna 3: Beneficiário */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-green-600 uppercase mb-2">Beneficiário</h4>
                                
                                {tx.payeeName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{tx.payeeName}</p>
                                  </div>
                                )}
                                
                                {tx.payeeTaxId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ</label>
                                    <p className="text-sm mt-1 font-mono">{tx.payeeTaxId}</p>
                                  </div>
                                )}
                                
                                {tx.payeeBankName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco</label>
                                    <p className="text-sm mt-1">🏦 {tx.payeeBankName}</p>
                                  </div>
                                )}
                                
                                {tx._original?.receiver_ispb && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">ISPB</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.receiver_ispb}</p>
                                  </div>
                                )}
                                
                                {tx._original?.receiver_account && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Conta</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.receiver_account}</p>
                                  </div>
                                )}
                                
                                {tx._original?.receiver_branch_code && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Agência</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.receiver_branch_code}</p>
                                  </div>
                                )}
                                
                                {tx._original?.receiver_account_type && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo de Conta</label>
                                    <p className="text-sm mt-1">{tx._original.receiver_account_type}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Coluna 4: Transação e Datas */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-blue-600 uppercase mb-2">Transação</h4>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Valor</label>
                                  <p className="text-sm mt-1 font-bold">{formatCurrency(tx.amount)}</p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Moeda</label>
                                  <p className="text-sm mt-1">{tx.currency}</p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                                  <Badge {...BrasilCashRealtimeService.getStatusBadge(tx.status)} className="text-xs mt-1">
                                    {BrasilCashRealtimeService.getStatusBadge(tx.status).label}
                                  </Badge>
                                </div>
                                
                                {tx.description && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Descrição</label>
                                    <p className="text-sm mt-1 break-words">{tx.description}</p>
                                  </div>
                                )}
                                
                                {tx._original?.source && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Origem</label>
                                    <p className="text-sm mt-1">{tx._original.source}</p>
                                  </div>
                                )}
                                
                                {tx._original?.pix_key && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">PIX Key</label>
                                    <p className="text-sm mt-1 font-mono break-all">{tx._original.pix_key}</p>
                                  </div>
                                )}
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Criado em</label>
                                  <p className="text-sm mt-1">{formatDate(tx.createdAt)}</p>
                                </div>
                                
                                {tx.receivedAt && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Recebido em</label>
                                    <p className="text-sm mt-1">{formatDate(tx.receivedAt)}</p>
                                  </div>
                                )}
                                
                                {tx.updatedAt && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Atualizado em</label>
                                    <p className="text-sm mt-1">{formatDate(tx.updatedAt)}</p>
                                  </div>
                                )}
                                
                                {tx._original?.webhook_processed_at && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Webhook Processado</label>
                                    <p className="text-sm mt-1">{formatDate(tx._original.webhook_processed_at)}</p>
                                  </div>
                                )}
                                
                                {tx._original?.brasilcash_account_id && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">BrasilCash Account ID</label>
                                    <p className="text-sm mt-1 font-mono">{tx._original.brasilcash_account_id}</p>
                                  </div>
                                )}
                                
                                {tx._original?.account_id && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Account ID</label>
                                    <p className="text-sm mt-1 font-mono break-all">{tx._original.account_id}</p>
                                  </div>
                                )}
                                
                                {tx.isReversal && tx.originEndToEndId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">End-to-End Original (Estorno)</label>
                                    <p className="text-sm mt-1 font-mono">{tx.originEndToEndId}</p>
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
                Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
                </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={pagination.offset === 0}
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
                  disabled={!pagination.has_more}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
          </Card>

      {/* Modal de Compensação */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={handleCloseCompensationModal}
        extractRecord={selectedCompensationRecord}
      />
    </div>
  );
}
