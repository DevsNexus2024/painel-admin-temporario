import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Download, ArrowUpCircle, ArrowDownCircle, Loader2, FileText, Check, Plus, RefreshCcw, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Calendar as CalendarIcon, CheckCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";
import type { MovimentoExtrato } from "@/services/extrato";
import { useFilteredBitsoWebSocket } from "@/hooks/useFilteredBitsoWebSocket";
import { useBrasilCashOtc } from "@/contexts/BrasilCashOtcContext";
import { BrasilCashRealtimeService } from "@/services/brasilcash-realtime";
import type { BrasilCashTransactionDB } from "@/services/brasilcash-realtime";

const API_BASE_URL = 'https://api-bank-v2.gruponexus.com.br';

// Interface para resposta da API (novo formato)
interface BrasilCashTransactionAPI {
  id: string;
  pix_id: string;
  end_to_end_id: string | null;
  status: string; // "CONFIRMED", "PENDING", etc.
  amount: number; // já em reais
  type: string; // "Pix Recebimento", "Tarifa", etc.
  method: 'cashin' | 'cashout';
  external_id: string | null;
  event_type: string; // "pix_receber", "tarifa", etc.
  payer_name?: string | null;
  payer_document?: string | null;
  payer_ispb?: string | null;
  payer_account?: string | null;
  payer_agency?: string | null;
  payer_branch_code?: string | null;
  payer_account_type?: string | null;
  payer_bank_code?: string | null;
  payer_bank_name?: string | null;
  receiver_name?: string | null;
  receiver_document?: string | null;
  receiver_ispb?: string | null;
  receiver_account?: string | null;
  receiver_branch_code?: string | null;
  receiver_account_type?: string | null;
  receiver_bank_code?: string | null;
  receiver_bank_name?: string | null;
  description?: string | null;
  source?: string;
  webhook_processed_at?: string;
  created_at: string;
  updated_at: string;
}

// Função para mapear transação da API para formato interno
function mapBrasilCashTransactionToDB(tx: BrasilCashTransactionAPI): BrasilCashTransactionDB {
  // Converter status
  let status: 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED' = 'COMPLETE';
  const statusUpper = tx.status.toUpperCase();
  if (statusUpper === 'CONFIRMED' || statusUpper === 'PAID') {
    status = 'COMPLETE';
  } else if (statusUpper === 'PENDING' || statusUpper === 'PROCESSING') {
    status = 'PENDING';
  } else if (statusUpper === 'REFUSED' || statusUpper === 'FAILED') {
    status = 'FAILED';
  } else if (statusUpper === 'CANCELLED') {
    status = 'CANCELLED';
  }

  // Converter tipo
  const type: 'FUNDING' | 'WITHDRAWAL' = tx.method === 'cashin' ? 'FUNDING' : 'WITHDRAWAL';

  // Valor já vem em reais
  const amountInReais = tx.amount.toString();

  // Determinar método baseado no type da API
  const getMethodName = (typeStr: string): string => {
    const typeLower = typeStr.toLowerCase();
    if (typeLower.includes('recebimento') || typeLower.includes('receber')) {
      return 'PIX Recebimento';
    }
    if (typeLower.includes('envio') || typeLower.includes('pagamento')) {
      return 'PIX Envio';
    }
    if (typeLower.includes('tarifa')) {
      return 'Tarifa';
    }
    if (typeLower.includes('qr') && typeLower.includes('estático')) {
      return 'QR Code Estático';
    }
    if (typeLower.includes('qr') && typeLower.includes('dinâmico')) {
      return 'QR Code Dinâmico';
    }
    if (typeLower.includes('dict')) {
      return 'DICT';
    }
    return typeStr || 'PIX';
  };

  const payerName = tx.payer_name || '';
  const payeeName = tx.receiver_name || '';
  const payerTaxId = tx.payer_document || '';
  const payeeTaxId = tx.receiver_document || '';
  const payerBankName = tx.payer_bank_name || (tx.payer_ispb ? `ISPB: ${tx.payer_ispb}` : '');
  const payeeBankName = tx.receiver_bank_name || (tx.receiver_ispb ? `ISPB: ${tx.receiver_ispb}` : '');

  return {
    id: parseInt(tx.id) || 0,
    type,
    transactionId: tx.pix_id || tx.id,
    endToEndId: tx.end_to_end_id || '',
    reconciliationId: tx.external_id || '',
    status,
    amount: amountInReais,
    fee: '0',
    currency: 'BRL',
    method: tx.type || 'pix',
    methodName: getMethodName(tx.type),
    payerName,
    payerTaxId,
    payerBankName,
    payeeName,
    payeeTaxId,
    payeeBankName,
    description: tx.description || undefined,
    createdAt: tx.created_at,
    receivedAt: tx.created_at,
    updatedAt: tx.updated_at,
    isReversal: false,
    originEndToEndId: null,
    eventType: tx.event_type,
    _original: tx as any,
  };
}

export default function ExtractTabBrasilCashOtc() {
  const { selectedAccount, getRequestHeaders } = useBrasilCashOtc();
  
  // WebSocket filtrado para OTC
  const { isConnected } = useFilteredBitsoWebSocket({
    context: 'otc',
    otcId: selectedAccount.otcId,
  });

  // Estados de transações
  const [transactions, setTransactions] = useState<BrasilCashTransactionDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(2000);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 2000,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1
  });

  // Estados de filtros
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null
  });
  const [searchTerm, setSearchTerm] = useState("");
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

  // Estados para funcionalidade OTC (Creditar Extrato para Cliente OTC)
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<MovimentoExtrato | null>(null);
  const [creditedRecords, setCreditedRecords] = useState<Set<string>>(new Set());

  // Estado para controlar linha expandida
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  // Função para verificar se registro já foi creditado para OTC
  const isRecordCredited = (tx: BrasilCashTransactionDB): boolean => {
    return creditedRecords.has(`brasilcash-otc-${tx.id}`);
  };

  // Função para lidar com crédito OTC (botão +OTC)
  const handleCreditToOTC = (tx: BrasilCashTransactionDB, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecordCredited(tx)) {
      toast.error('Registro já creditado', {
        description: 'Este registro já foi creditado para um cliente OTC'
      });
      return;
    }
    // Converter BrasilCashTransactionDB para MovimentoExtrato
    setSelectedExtractRecord({
      id: tx.transactionId || tx.id.toString(),
      dateTime: tx.createdAt,
      value: parseFloat(tx.amount),
      type: tx.type === 'FUNDING' ? 'CRÉDITO' : 'DÉBITO',
      document: tx.type === 'FUNDING' ? (tx.payerTaxId || '') : (tx.payeeTaxId || ''),
      client: tx.type === 'FUNDING' ? (tx.payerName || 'N/A') : (tx.payeeName || 'N/A'),
      identified: true,
      code: tx.endToEndId || tx.transactionId || tx.id.toString(),
      descCliente: `BrasilCash OTC - ${tx.type === 'FUNDING' ? (tx.payerName || 'N/A') : (tx.payeeName || 'N/A')}`,
      _original: tx
    });
    setCreditOTCModalOpen(true);
  };

  const handleCloseCreditOTCModal = (wasSuccessful?: boolean) => {
    if (wasSuccessful && selectedExtractRecord?._original) {
      const tx = selectedExtractRecord._original as BrasilCashTransactionDB;
      setCreditedRecords(prev => new Set(prev).add(`brasilcash-otc-${tx.id}`));
    }
    setCreditOTCModalOpen(false);
    setSelectedExtractRecord(null);
  };

  // Estado para métricas
  const [metrics, setMetrics] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    loading: false
  });

  // Carregar transações
  const fetchTransactions = async (customDateFrom?: Date | null, customDateTo?: Date | null, page: number = 1, applyFilters: boolean = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const limit = recordsPerPage;
      const offset = (page - 1) * limit;
      
      let dataInicio: string | undefined = undefined;
      let dataFim: string | undefined = undefined;
      
      if (customDateFrom && customDateTo) {
        dataInicio = customDateFrom.toISOString().split('T')[0];
        dataFim = customDateTo.toISOString().split('T')[0];
      } else if (dateFrom && dateTo) {
        dataInicio = dateFrom.toISOString().split('T')[0];
        dataFim = dateTo.toISOString().split('T')[0];
      }
      
      // Preparar query params
      const params = new URLSearchParams();
      if (dataInicio) params.append('startDate', dataInicio);
      if (dataFim) params.append('endDate', dataFim);
      if (limit) params.append('limit', Math.min(limit, 2000).toString());
      if (offset !== undefined) params.append('offset', offset.toString());
      
      // Aplicar filtros na API se applyFilters for true
      if (applyFilters) {
        // API aceita: CONFIRMED, PENDING, REFUSED, etc.
        if (statusFilter === 'COMPLETE') params.append('status', 'CONFIRMED');
        else if (statusFilter === 'FAILED') params.append('status', 'REFUSED');
        else if (statusFilter === 'PENDING') params.append('status', 'PENDING');
        
        if (typeFilter === 'FUNDING') params.append('method', 'cashin');
        else if (typeFilter === 'WITHDRAWAL') params.append('method', 'cashout');
        
        // Não filtrar por type na API (a API retorna "Pix Recebimento", "Tarifa", etc.)
        // O filtro será aplicado localmente
        
        if (endToEndIdFilter.trim()) {
          params.append('endToEndId', endToEndIdFilter.trim());
        }
        
        if (externalIdFilter.trim()) {
          params.append('external_id', externalIdFilter.trim());
        }
        
        if (specificAmount) {
          // Valor já vem em reais da API, então enviar em reais também
          const amountValue = parseFloat(specificAmount.replace(',', '.'));
          params.append('amount', amountValue.toString());
        }
      }
      
      // Fazer requisição com headers do contexto (inclui x-otc-id)
      const headers = getRequestHeaders();
      const url = `${API_BASE_URL}/api/brasilcash/transactions?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Converter dados do BrasilCash para formato BrasilCashTransactionDB
      // Usar função de mapeamento específica para tratar novos formatos da API
      const mappedTransactions = (result.data || [])
        .map(mapBrasilCashTransactionToDB)
        .filter(tx => tx.eventType !== 'tarifa');
      
      setTransactions(mappedTransactions);
      
      // Atualizar paginação
      const paginationData = result.pagination || {};
      const total = paginationData.total || mappedTransactions.length;
      const hasMore = paginationData.has_more || false;
      const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
      const currentPage = paginationData.current_page || page;

      setPagination({
        total,
        limit,
        offset,
        has_more: hasMore,
        current_page: currentPage,
        total_pages: totalPages
      });
      
      toast.success(`Página ${currentPage}: ${mappedTransactions.length} transações`, {
        description: `Extrato BrasilCash OTC ${selectedAccount.otcId} carregado`,
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

  // Aplicar filtros
  const handleAplicarFiltros = () => {
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        toast.error("Data inicial não pode ser maior que data final", {
          description: "Ajuste as datas e tente novamente"
        });
        return;
      }
    }
    
    fetchTransactions(dateFrom, dateTo, 1, true);
  };

  // Limpar filtros
  const handleLimparFiltros = () => {
    setDateFrom(null);
    setDateTo(null);
    setDateRange({ from: null, to: null });
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
    fetchTransactions(null, null, 1, false);
  };

  // Sincronizar extrato (com período customizado)
  const handleSyncExtract = async () => {
    setSyncing(true);
    try {
      const headers = getRequestHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/brasilcash/transactions/sync`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            startDate: format(syncDateRange.from, 'yyyy-MM-dd'),
            endDate: format(syncDateRange.to, 'yyyy-MM-dd'),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      toast.success("Extrato sincronizado!", {
        description: `${result.synced || 0} transações sincronizadas`,
        duration: 3000
      });
      
      // Recarregar transações após sincronização
      setTimeout(() => {
        fetchTransactions(dateFrom, dateTo, pagination.current_page, true);
      }, 1000);
    } catch (err: any) {
      toast.error('Erro ao sincronizar extrato', {
        description: err.message
      });
    } finally {
      setSyncing(false);
    }
  };

  // Atualizar extrato (apenas recarrega as transações, sem sincronizar)
  const handleRefresh = async () => {
    try {
      setLoading(true);
      await fetchTransactions(dateFrom, dateTo, pagination.current_page, true);
    } catch (err: any) {
      toast.error('Erro ao atualizar extrato', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Carregar transações quando a conta mudar
  useEffect(() => {
    fetchTransactions(null, null, 1, false);
  }, [selectedAccount.id]);

  // Filtrar transações localmente (para busca, filtros de valor, etc.)
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtro de busca (endToEndId, externalId, etc.)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.endToEndId?.toLowerCase().includes(searchLower) ||
        tx.reconciliationId?.toLowerCase().includes(searchLower) ||
        tx.transactionId?.toLowerCase().includes(searchLower) ||
        tx.payerName?.toLowerCase().includes(searchLower) ||
        tx.payeeName?.toLowerCase().includes(searchLower)
      );
    }

    // Filtros de tipo (se não aplicados na API)
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    // Filtros de status (se não aplicados na API)
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(tx => tx.status === statusFilter);
    }

    // Filtros de método (se não aplicados na API)
    if (methodTypeFilter !== 'ALL') {
      filtered = filtered.filter(tx => tx.method === methodTypeFilter);
    }

    // Filtros de valor (min/max)
    if (minAmount) {
      const min = parseFloat(minAmount.replace(',', '.'));
      if (!isNaN(min)) {
        filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
      }
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount.replace(',', '.'));
      if (!isNaN(max)) {
        filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
      }
    }

    // Filtro de reversões
    if (showReversalsOnly) {
      filtered = filtered.filter(tx => tx.isReversal);
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, statusFilter, methodTypeFilter, minAmount, maxAmount, showReversalsOnly]);

  // Calcular métricas
  useEffect(() => {
    setMetrics({
      totalDeposits: filteredTransactions.filter(tx => tx.type === 'FUNDING').length,
      totalWithdrawals: filteredTransactions.filter(tx => tx.type === 'WITHDRAWAL').length,
      depositAmount: filteredTransactions
        .filter(tx => tx.type === 'FUNDING')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      withdrawalAmount: filteredTransactions
        .filter(tx => tx.type === 'WITHDRAWAL')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      loading: false
    });
  }, [filteredTransactions]);

  // Função para copiar endToEndId
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`, {
      description: text,
      duration: 2000
    });
  };

  // Função para formatar valor
  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  // Função para formatar data
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  // Função para obter cor do badge de status
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'FAILED':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'CANCELLED':
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Card de Filtros */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-4">
          {/* Linha 1: Período e Busca */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data Inicial */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom || undefined}
                    onSelect={(date) => setDateFrom(date || null)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Final */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo || undefined}
                    onSelect={(date) => setDateTo(date || null)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Busca */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="EndToEndId, External ID, Nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Filtros de Tipo, Status e Método */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="FUNDING">Entrada</SelectItem>
                  <SelectItem value="WITHDRAWAL">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="COMPLETE">Concluído</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Método</label>
              <Select value={methodTypeFilter} onValueChange={(value: any) => setMethodTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="dict">DICT</SelectItem>
                  <SelectItem value="staticQrcode">QR Estático</SelectItem>
                  <SelectItem value="dynamicQrcode">QR Dinâmico</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Filtros Avançados */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Mínimo (R$)</label>
              <Input
                type="text"
                placeholder="0,00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Máximo (R$)</label>
              <Input
                type="text"
                placeholder="0,00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Valor Específico (R$)</label>
              <Input
                type="text"
                placeholder="0,00"
                value={specificAmount}
                onChange={(e) => setSpecificAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">EndToEndId</label>
              <Input
                type="text"
                placeholder="E305075412022052105081166763110P"
                value={endToEndIdFilter}
                onChange={(e) => setEndToEndIdFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Linha 4: External ID e Opções */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">External ID</label>
              <Input
                type="text"
                placeholder="caas436344xU1928"
                value={externalIdFilter}
                onChange={(e) => setExternalIdFilter(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reversals"
                  checked={showReversalsOnly}
                  onCheckedChange={(checked) => setShowReversalsOnly(checked === true)}
                />
                <label htmlFor="reversals" className="text-sm font-medium cursor-pointer">
                  Apenas Reversões
                </label>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAplicarFiltros} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <Filter className="mr-2 h-4 w-4" />
                  Aplicar Filtros
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleLimparFiltros} disabled={loading}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            
            {/* Sincronizar Extrato */}
            <Popover open={showSyncDatePicker} onOpenChange={setShowSyncDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={syncing}>
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Sincronizar Extrato
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Período de Sincronização</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">De</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                              {format(syncDateRange.from, "dd/MM/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={syncDateRange.from}
                              onSelect={(date) => date && setSyncDateRange({ ...syncDateRange, from: date })}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Até</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                              {format(syncDateRange.to, "dd/MM/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={syncDateRange.to}
                              onSelect={(date) => date && setSyncDateRange({ ...syncDateRange, to: date })}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSyncExtract} disabled={syncing} className="w-full">
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Sincronizar
                      </>
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-2xl font-bold">{metrics.totalDeposits}</p>
              <p className="text-sm text-green-600">{formatCurrency(metrics.depositAmount)}</p>
            </div>
            <ArrowDownCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Saídas</p>
              <p className="text-2xl font-bold">{metrics.totalWithdrawals}</p>
              <p className="text-sm text-red-600">{formatCurrency(metrics.withdrawalAmount)}</p>
            </div>
            <ArrowUpCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Líquido</p>
              <p className={`text-2xl font-bold ${metrics.depositAmount - metrics.withdrawalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.depositAmount - metrics.withdrawalAmount)}
              </p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Registros</p>
              <p className="text-2xl font-bold">{filteredTransactions.length}</p>
              <p className="text-sm text-muted-foreground">de {pagination.total}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Tabela de Transações */}
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
                    <th className="w-48 p-3 text-center text-xs font-medium text-muted-foreground">Ações</th>
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
                            onClick={(e) => handleCreditToOTC(tx, e)}
                            disabled={isRecordCredited(tx)}
                            className={cn(
                              "h-7 px-2 text-xs transition-all",
                              isRecordCredited(tx)
                                ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                            )}
                            title={isRecordCredited(tx) ? "Já creditado para cliente OTC" : "Creditar para cliente OTC"}
                          >
                            {isRecordCredited(tx) ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Creditado
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                OTC
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Linha expandida com detalhes */}
                    {expandedRow === tx.id && (
                      <tr className="bg-muted/5 dark:bg-muted/5 border-b border-border/50">
                        <td colSpan={8} className="p-0">
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-orange-700">Detalhes da Transação</h4>
                              <div className="flex items-center gap-2">
                                {tx.type === 'FUNDING' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => handleCreditToOTC(tx, e)}
                                    disabled={isRecordCredited(tx)}
                                    className={cn(
                                      "h-7 px-2 text-xs transition-all",
                                      isRecordCredited(tx)
                                        ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                        : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                    )}
                                    title={isRecordCredited(tx) ? "Já creditado para cliente OTC" : "Creditar para cliente OTC"}
                                  >
                                    {isRecordCredited(tx) ? (
                                      <>
                                        <Check className="h-3 w-3 mr-1" />
                                        Creditado
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3 w-3 mr-1" />
                                        OTC
                                      </>
                                    )}
                                  </Button>
                                )}
                                <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                              </div>
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
                              
                              {/* Coluna 4: Transação */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-blue-600 uppercase mb-2">Transação</h4>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Valor</label>
                                  <p className={cn(
                                    "text-sm mt-1 font-bold",
                                    tx.type === 'FUNDING' ? "text-green-600" : "text-red-600"
                                  )}>
                                    {tx.type === 'FUNDING' ? '+' : '-'} {formatCurrency(tx.amount)}
                                  </p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Moeda</label>
                                  <p className="text-sm mt-1">{tx.currency}</p>
                                </div>
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                                  <div className="mt-1">
                                    <Badge {...BrasilCashRealtimeService.getStatusBadge(tx.status)} className="text-xs">
                                      {BrasilCashRealtimeService.getStatusBadge(tx.status).label}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {tx.description && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Descrição</label>
                                    <p className="text-sm mt-1">{tx.description}</p>
                                  </div>
                                )}
                                
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground uppercase">Criado em</label>
                                  <p className="text-sm mt-1">{formatDate(tx.createdAt)}</p>
                                </div>
                                
                                {tx.updatedAt && tx.updatedAt !== tx.createdAt && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Atualizado em</label>
                                    <p className="text-sm mt-1">{formatDate(tx.updatedAt)}</p>
                                  </div>
                                )}
                                
                                {tx._original?.source && (
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Origem</label>
                                    <p className="text-sm mt-1">{tx._original.source}</p>
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
          </>
        )}

        {/* Paginação */}
        {!loading && !error && filteredTransactions.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Página {pagination.current_page} de {pagination.total_pages} • {pagination.total} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTransactions(dateFrom, dateTo, pagination.current_page - 1, true)}
                disabled={pagination.current_page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTransactions(dateFrom, dateTo, pagination.current_page + 1, true)}
                disabled={!pagination.has_more || loading}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal Creditar Extrato para Cliente OTC (+OTC) */}
      <CreditExtractToOTCModal
        isOpen={creditOTCModalOpen}
        onClose={handleCloseCreditOTCModal}
        extractRecord={selectedExtractRecord}
      />
    </div>
  );
}
