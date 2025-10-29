import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Download, Filter, ArrowUpCircle, ArrowDownCircle, Loader2, FileText, DollarSign, CheckSquare, Check, X, RefreshCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { useBitsoWebSocket } from "@/hooks/useBitsoWebSocket";
import { BitsoRealtimeService } from "@/services/bitso-realtime";
import type { BitsoTransactionDB, BitsoTransactionFilters } from "@/services/bitso-realtime";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";

export default function ExtractTabBitsoTcr() {
  // WebSocket
  const { isConnected, newTransaction, transactionTimestamp } = useBitsoWebSocket();

  // Estados de transações
  const [transactions, setTransactions] = useState<BitsoTransactionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 500,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1
  });

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: BitsoRealtimeService.getDateStringDaysAgo(7),
    end: BitsoRealtimeService.getTodayDateString()
  });
  
  // Estado para o Date Range Picker
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FUNDING' | 'WITHDRAWAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED'>('ALL');
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [showReversalsOnly, setShowReversalsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Estados para funcionalidade de Compensação
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);
  const [compensatedRecords, setCompensatedRecords] = useState<Set<string>>(new Set());

  // Estados para compensação em lote
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  // Estado para controlar linha expandida
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Buscar transações
  const fetchTransactions = async (resetOffset: boolean = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: BitsoTransactionFilters = {
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        limit: pagination.limit,
        offset: resetOffset ? 0 : pagination.offset,
        onlyTcr: true, // 🎯 IMPORTANTE: Bitso TCR só mostra transações com reconciliationId
      };

      if (typeFilter !== 'ALL') filters.type = typeFilter;
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (minAmount) filters.minAmount = parseFloat(minAmount);
      if (maxAmount) filters.maxAmount = parseFloat(maxAmount);
      // searchTerm é filtrado localmente no frontend
      if (showReversalsOnly) filters.isReversal = true;

      const response = await BitsoRealtimeService.getTransactions(filters);
      
      setTransactions(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar transações');
      toast.error('Erro ao carregar extrato', {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(true);
  }, []);

  // Aplicar filtros automaticamente quando mudarem (exceto data e busca)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(true);
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timer);
  }, [typeFilter, statusFilter, minAmount, maxAmount, showReversalsOnly]);

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
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [dateFilter.start, dateFilter.end]); // Dependências específicas para evitar disparo individual

  useEffect(() => {
    if (newTransaction && transactionTimestamp > 0) {
      console.log('🔄 [ExtractTabBitsoTcr] Nova transação recebida:', newTransaction.id);
      
      // ✅ Bitso TCR: só adiciona se tiver reconciliationId
      if (!newTransaction.reconciliationId) {
        console.log('⚠️ [ExtractTabBitsoTcr] Transação sem reconciliationId, ignorando');
        return;
      }
      
      console.log('✅ [ExtractTabBitsoTcr] Transação TCR válida, adicionando à tabela');
      
      const convertedTransaction: BitsoTransactionDB = {
        id: newTransaction.id,
        type: newTransaction.type === 'funding' ? 'FUNDING' : 'WITHDRAWAL',
        transactionId: newTransaction.transactionId,
        endToEndId: newTransaction.endToEndId,
        reconciliationId: newTransaction.reconciliationId,
        status: newTransaction.status.toUpperCase() as any,
        amount: newTransaction.amount,
        fee: '0.00',
        currency: newTransaction.currency,
        method: 'pixstark',
        methodName: 'Pix',
        payerName: newTransaction.payerName,
        payeeName: newTransaction.payeeName,
        payerTaxId: newTransaction.payerTaxId,
        payerBankName: newTransaction.payerBankName,
        createdAt: newTransaction.createdAt,
        receivedAt: newTransaction.receivedAt,
        updatedAt: newTransaction.updatedAt,
        isReversal: newTransaction.isReversal,
        originEndToEndId: null
      };

      setTransactions(prev => {
        // ✅ Evitar duplicatas usando endToEndId (idempotência)
        if (prev.some(tx => tx.endToEndId === convertedTransaction.endToEndId)) {
          console.log('⚠️ Transação duplicada (endToEndId), ignorando:', convertedTransaction.endToEndId);
          return prev;
        }
        console.log('✅ Transação adicionada ao topo da tabela TCR');
        return [convertedTransaction, ...prev];
      });
      
      setPagination(prev => ({
        ...prev,
        total: prev.total + 1
      }));
    }
  }, [transactionTimestamp]); // ✅ Usar timestamp como dependência

  // Filtro de busca local (frontend)
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;

    const searchLower = searchTerm.toLowerCase().trim();
    return transactions.filter(tx => {
      return (
        tx.payerName?.toLowerCase().includes(searchLower) ||
        tx.payeeName?.toLowerCase().includes(searchLower) ||
        tx.payerTaxId?.toLowerCase().includes(searchLower) ||
        tx.transactionId?.toLowerCase().includes(searchLower) ||
        tx.endToEndId?.toLowerCase().includes(searchLower) ||
        tx.reconciliationId?.toLowerCase().includes(searchLower) ||
        tx.amount?.toString().includes(searchLower)
      );
    });
  }, [transactions, searchTerm]);

  const formatCurrency = (value: string | number) => {
    return BitsoRealtimeService.formatCurrency(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return BitsoRealtimeService.formatUTCToLocalString(dateString);
    } catch {
      return dateString;
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Tipo', 'Status', 'Valor', 'Nome', 'EndToEndId', 'ID'];
    const rows = filteredTransactions.map((t: BitsoTransactionDB) => [
      formatDate(t.createdAt),
      BitsoRealtimeService.getTransactionTypeLabel(t.type),
      t.status,
      t.amount,
      t.payerName || t.payeeName || 'N/A',
      t.endToEndId,
      t.transactionId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato-bitso-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Extrato exportado com sucesso');
  };

  const isRecordCompensated = (transaction: BitsoTransactionDB): boolean => {
    const recordKey = `bitso-tcr-${transaction.id}`;
    return compensatedRecords.has(recordKey);
  };

  const handleCompensation = async (transaction: BitsoTransactionDB, event: React.MouseEvent) => {
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
      client: transaction.payerName || transaction.payeeName || 'N/A',
      document: transaction.payerTaxId || '',
      code: transaction.endToEndId,
      descCliente: `Bitso TCR - ${transaction.payerName || transaction.payeeName || 'N/A'}`,
      identified: true,
      descricaoOperacao: `Bitso TCR - ${transaction.payerName || transaction.payeeName || 'N/A'}`,
      _original: transaction
    };
    
    // ✅ Buscar id_usuario automaticamente via endtoend (IGUAL CorpX TCR)
    try {
      toast.info('Buscando usuário...', {
        description: 'Verificando endtoend da transação via API'
      });
      
      // Criar objeto compatível com TCRVerificacaoService
      const tcTransaction = {
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
      console.error('[BITSO-TCR-VERIFICACAO] Erro:', error);
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
      const recordKey = `bitso-tcr-${selectedCompensationRecord._original.id}`;
      setCompensatedRecords(prev => new Set(prev).add(recordKey));
      toast.success('Compensação realizada com sucesso!');
      fetchTransactions(true); // Recarregar dados
    }
    
    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
  };

  const toggleTransactionSelection = (transactionId: number) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      const key = transactionId.toString();
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllVisibleCredits = () => {
    const creditTransactions = filteredTransactions
      .filter(t => t.type === 'FUNDING' && !isRecordCompensated(t) && t.reconciliationId)
      .map(t => t.id.toString());
    
    setSelectedTransactions(new Set(creditTransactions));
    toast.success(`${creditTransactions.length} transações selecionadas`);
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const toggleBulkMode = () => {
    const newBulkMode = !bulkMode;
    setBulkMode(newBulkMode);
    
    if (!newBulkMode) {
      clearSelection();
    }
    toast.info(newBulkMode ? 'Modo compensação em lote ativado' : 'Modo normal ativado');
  };

  const handlePreviousPage = () => {
    if (pagination.offset > 0) {
      const newOffset = Math.max(0, pagination.offset - pagination.limit);
      setPagination(prev => ({
        ...prev,
        offset: newOffset,
        current_page: prev.current_page - 1
      }));
      // Usar o novo offset diretamente
      fetchTransactionsWithOffset(newOffset);
    }
  };

  const handleNextPage = () => {
    if (pagination.has_more) {
      const newOffset = pagination.offset + pagination.limit;
      setPagination(prev => ({
        ...prev,
        offset: newOffset,
        current_page: prev.current_page + 1
      }));
      // Usar o novo offset diretamente
      fetchTransactionsWithOffset(newOffset);
    }
  };

  const fetchTransactionsWithOffset = async (offset: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: BitsoTransactionFilters = {
        startDate: dateFilter.start,
        endDate: dateFilter.end,
        limit: pagination.limit,
        offset: offset,
        onlyTcr: true, // 🎯 IMPORTANTE: Bitso TCR só mostra transações com reconciliationId
      };

      if (typeFilter !== 'ALL') filters.type = typeFilter;
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (minAmount) filters.minAmount = parseFloat(minAmount);
      if (maxAmount) filters.maxAmount = parseFloat(maxAmount);
      if (showReversalsOnly) filters.isReversal = true;

      const response = await BitsoRealtimeService.getTransactions(filters);
      
      setTransactions(response.data);
      setPagination(response.pagination);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
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
        </div>
      </div>

      {/* Filtros (expansível) */}
      {showFilters && (
        <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/10">
          <div className="space-y-4">
            {/* Linha 1: Busca e Selects */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, CPF, ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-background border-2 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</label>
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger className="h-10 bg-background border-2 focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">📋 Todos</SelectItem>
                    <SelectItem value="FUNDING">📥 Recebimentos</SelectItem>
                    <SelectItem value="WITHDRAWAL">📤 Envios</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="h-10 bg-background border-2 focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">📋 Todos</SelectItem>
                    <SelectItem value="COMPLETE">✅ Completo</SelectItem>
                    <SelectItem value="PENDING">⏳ Pendente</SelectItem>
                    <SelectItem value="FAILED">❌ Falhou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Período e Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-10 w-full justify-start text-left font-normal bg-background border-2",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione o período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                        }
                      }}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Mínimo</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="h-10 bg-background border-2 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Máximo</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="h-10 bg-background border-2 focus:border-primary"
                />
              </div>
            </div>

            {/* Linha 3: Checkboxes e Limpar */}
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
                  setMinAmount("");
                  setMaxAmount("");
                  setShowReversalsOnly(false);
                  setDateFilter({
                    start: BitsoRealtimeService.getDateStringDaysAgo(7),
                    end: BitsoRealtimeService.getTodayDateString()
                  });
                }}
                className="h-10"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
            </Button>
            </div>
        </div>
      </Card>
      )}

      {/* Tabela */}
      <Card className="overflow-hidden">
        {/* 🆕 Barra de Ações para Compensação */}
        <div className={cn(
          "px-6 py-4 border-b border-border transition-all",
          bulkMode ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/30"
        )}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={bulkMode ? "default" : "outline"}
                onClick={toggleBulkMode}
                className={bulkMode ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                {bulkMode ? "Sair do Modo Seleção" : "Modo Seleção Individual"}
              </Button>
              
              {bulkMode && (
                <>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {selectedTransactions.size} selecionada{selectedTransactions.size !== 1 ? 's' : ''}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllVisibleCredits}
                    disabled={filteredTransactions.filter(t => t.type === 'FUNDING' && !isRecordCompensated(t) && t.reconciliationId).length === 0}
                  >
                    Selecionar Todas Visíveis
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedTransactions.size === 0}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpar Seleção
                  </Button>
                  
                  <div className="text-sm text-muted-foreground">
                    💡 Selecione transações para compensar individualmente
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

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
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
              <table className="w-full">
                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                  <tr>
                    {bulkMode && <th className="w-12 p-3"></th>}
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">End-to-End</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Reconciliation ID</th>
                    {!bulkMode && <th className="w-24 p-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <>
                    <tr
                      key={tx.id}
            className={cn(
                        "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                        bulkMode && selectedTransactions.has(tx.id.toString()) && "bg-muted/20 dark:bg-muted/10",
                        expandedRow === tx.id && "bg-muted/10 dark:bg-muted/5"
            )}
            onClick={() => {
                        if (bulkMode && tx.type === 'FUNDING' && !isRecordCompensated(tx) && tx.reconciliationId) {
                          toggleTransactionSelection(tx.id);
                        } else if (!bulkMode) {
                          setExpandedRow(expandedRow === tx.id ? null : tx.id);
                        }
                      }}
                    >
                      {bulkMode && (
                        <td className="p-3">
                          {tx.type === 'FUNDING' && !isRecordCompensated(tx) && tx.reconciliationId && (
                <Checkbox
                              checked={selectedTransactions.has(tx.id.toString())}
                              onCheckedChange={() => toggleTransactionSelection(tx.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
                        </td>
                      )}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {!bulkMode && (
                            expandedRow === tx.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )
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
                        <div className="text-sm font-medium">{tx.payerName || tx.payeeName || 'N/A'}</div>
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
                        <Badge {...BitsoRealtimeService.getStatusBadge(tx.status)} className="text-xs">
                          {BitsoRealtimeService.getStatusBadge(tx.status).label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.endToEndId ? `${tx.endToEndId.substring(0, 20)}...` : '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.reconciliationId || '-'}
                        </div>
                      </td>
                      {!bulkMode && (
                        <td className="p-3">
                          {tx.type === 'FUNDING' && tx.reconciliationId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleCompensation(tx, e)}
                              disabled={isRecordCompensated(tx)}
                              className={cn(
                                "h-7 px-2 text-xs transition-all",
                                isRecordCompensated(tx)
                                  ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                  : "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 hover:border-orange-300"
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
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Verificar
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                    
                    {/* Linha expandida com detalhes */}
                    {expandedRow === tx.id && !bulkMode && (
                      <tr className="bg-muted/5 dark:bg-muted/5 border-b border-border/50">
                        <td colSpan={8} className="p-0">
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-orange-700">Detalhes da Transação</h4>
                              <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Coluna 1 */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Transaction ID</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm font-mono">{tx.transactionId}</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(tx.transactionId);
                                        toast.success('Transaction ID copiado!');
                                      }}
                                      className="h-6 w-6 p-0"
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
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Reconciliation ID</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono text-orange-600 font-semibold">{tx.reconciliationId}</p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(tx.reconciliationId);
                                          toast.success('Reconciliation ID copiado!');
                                        }}
                                        className="h-6 w-6 p-0"
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
                              </div>
                              
                              {/* Coluna 2 */}
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Moeda</label>
                                  <p className="text-sm mt-1">{tx.currency}</p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Taxa</label>
                                  <p className="text-sm mt-1">{formatCurrency(tx.fee)}</p>
                                </div>
                                
                                {tx.payerTaxId && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CPF/CNPJ do Pagador</label>
                                    <p className="text-sm mt-1 font-mono">{tx.payerTaxId}</p>
                                  </div>
                                )}
                                
                                {tx.payerBankName && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco do Pagador</label>
                                    <p className="text-sm mt-1">🏦 {tx.payerBankName}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Coluna 3 */}
                              <div className="space-y-3">
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
