import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus, Check, DollarSign, Trash2, ChevronLeft, ChevronRight, RotateCcw, ArrowDownCircle, ArrowUpCircle, CheckSquare, ChevronUp, FileDown } from "lucide-react";
import jsPDF from 'jspdf';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";

// Componente completo para o Extrato TCR (baseado no Bitso)
export default function ExtractTabTCR() {
  // Estados para controle de dados
  const [isLoading, setIsLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  
  // Estados para filtros - sem período padrão (retorna últimos 100 registros)
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDescCliente, setSearchDescCliente] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"todos" | "debito" | "credito">("todos");
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FUNDING' | 'WITHDRAWAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED'>('ALL');
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [specificAmount, setSpecificAmount] = useState<string>("");
  const [showReversalsOnly, setShowReversalsOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("desc");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("date");
  const [recordsPerPage, setRecordsPerPage] = useState(500);
  
  // Estados para paginação server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 500,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1
  });
  const ITEMS_PER_PAGE = 100; // 🚀 API TCR retorna 100 registros por página
  
  // Estados para métricas
  const [metrics, setMetrics] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    loading: false
  });
  
  // Estados para modo lote
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isEditingPage, setIsEditingPage] = useState(false);
  
  // Estados para modal
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Estados para funcionalidade Compensação Inteligente (MODAL COMPLETO)
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);
  
  // ✅ Estados para sincronização de extrato
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStartDate, setSyncStartDate] = useState<Date | null>(null);
  const [syncEndDate, setSyncEndDate] = useState<Date | null>(null);
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);

  // ✅ Conversão de dados da nova API de transações TCR
  const convertTCRToStandardFormat = (transaction: any) => {
    // ✅ Nova API retorna CorpXTransactionItem com estrutura diferente
    const transactionType = transaction.transactionType || transaction.type;
    const type = transactionType === 'C' || transactionType === 'credit' ? 'CRÉDITO' : 'DÉBITO';
    
    // ✅ Extrair valor (pode vir como string ou number)
    const amountRaw = transaction.amount ?? transaction.valor ?? 0;
    const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : Number(amountRaw) || 0;
    
    // ✅ Extrair data/hora (múltiplos campos possíveis)
    const transactionDateTime =
      transaction.transactionDatetime ||
      transaction.transactionDatetimeUtc ||
      transaction.transactionDate ||
      transaction.date ||
      transaction.dateTime ||
      new Date().toISOString();
    
    // ✅ Extrair descrição
    const description = transaction.description || transaction.transactionDescription || transaction.pixDescription || transaction.label || transaction.descricao || '';
    
    // ✅ Extrair cliente (priorizar payerName/beneficiaryName, depois descrição)
    const payerName = transaction.payerName || transaction.debtorName || '';
    const beneficiaryName = transaction.beneficiaryName || transaction.creditorName || transaction.destinatario || '';
    const counterpartyName = type === 'CRÉDITO' ? payerName : beneficiaryName;
    
    // ✅ Fallback: extrair da descrição se não houver nome
    let cliente = counterpartyName;
    if (!cliente && description.includes(' - ')) {
      cliente = description.split(' - ')[1] || 'Cliente não identificado';
    }
    if (!cliente) {
      cliente = beneficiaryName || payerName || 'Cliente não identificado';
    }
    
    // ✅ Extrair documentos
    const payerDocument = transaction.payerDocument || transaction.debtorDocument || '';
    const beneficiaryDocument = transaction.beneficiaryDocument || transaction.creditorDocument || transaction.documentoBeneficiario || '';
    const document = beneficiaryDocument || payerDocument || '';
    
    // ✅ Extrair código end-to-end
    const endToEnd =
      transaction.endToEnd ||
      transaction.end_to_end ||
      transaction.endToEndId ||
      transaction.idEndToEnd ||
      transaction.nrMovimento ||
      transaction.id ||
      '';

    // ✅ Extrair reconciliation_id
    const reconciliationId =
      transaction.reconciliationId ||
      transaction.reconciliation_id ||
      transaction._original?.reconciliationId ||
      transaction._original?.reconciliation_id ||
      transaction.rawWebhook?.reconciliation_id ||
      null;

    // ✅ Extrair status
    const status =
      transaction.pixStatus ||
      transaction.status ||
      transaction._original?.pixStatus ||
      transaction._original?.status ||
      transaction.rawWebhook?.status ||
      'COMPLETE';

    const resultado = {
      id: (transaction.id ?? transaction.nrMovimento ?? transaction.idEndToEnd ?? Date.now()).toString(),
      dateTime: transactionDateTime,
      value: amount,
      type,
      client: cliente,
      document,
      beneficiaryDocument,
      payerDocument,
      code: endToEnd || '',
      descCliente: description,
      identified: Boolean(cliente && cliente !== 'Cliente não identificado'),
      descricaoOperacao: description,
      reconciliationId: reconciliationId || null,
      status: status,
      // ✅ Preservar dados originais completos
      _original: transaction
    };
    
    return resultado;
  };

  // ✅ Função para identificar se é transação de tarifa
  const isTarifaTransaction = (transaction: any): boolean => {
    const descricao = transaction.descCliente?.toLowerCase() || '';
    const cliente = transaction.client?.toLowerCase() || '';
    const valor = Math.abs(transaction.value || 0);
    
    // Padrões de identificação de tarifa:
    // 1. Descrição contendo "TRANSF.ENTRE CTAS" ou similar
    // 2. Valores muito pequenos (R$ 0,50 ou menos) com descrição de transferência entre contas
    // 3. Cliente sendo "TCR FINANCE LTDA" ou similar com valores pequenos
    const isTransferenciaEntreContas = descricao.includes('transf.entre ctas') || 
                                       descricao.includes('transf entre ctas') ||
                                       descricao.includes('transferência entre contas') ||
                                       descricao.includes('transferencia entre contas');
    
    const isValorPequeno = valor <= 0.50; // R$ 0,50 ou menos
    const isTcrFinance = cliente.includes('tcr finance') || cliente.includes('tcrfinance');
    
    // É tarifa se: transferência entre contas OU (valor pequeno E cliente TCR Finance)
    return isTransferenciaEntreContas || (isValorPequeno && isTcrFinance);
  };

  // ✅ Aplicar filtros (igual ao CorpX)
  const filteredAndSortedTransactions = useMemo(() => {
    
    let filtered = allTransactions.map(convertTCRToStandardFormat);
      

    // Filtros de busca
    filtered = filtered.filter((transaction) => {
      // ✅ FILTRO: Esconder transações de tarifa
      if (isTarifaTransaction(transaction)) {
        return false;
      }

      const matchesName = !searchName || 
        transaction.client?.toLowerCase().includes(searchName.toLowerCase()) ||
        transaction.document?.toLowerCase().includes(searchName.toLowerCase());
      
      const matchesValue = !searchValue || 
        Math.abs(transaction.value).toString().includes(searchValue);
      
      const matchesDescCliente = !searchDescCliente || 
        transaction.descCliente?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction.client?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction._original?.description?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction._original?.rawWebhook?.descricaoComplementar?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction._original?.rawExtrato?.descricao?.toLowerCase().includes(searchDescCliente.toLowerCase());

      const matchesType = transactionTypeFilter === "todos" || 
        (transactionTypeFilter === "debito" && transaction.type === "DÉBITO") ||
        (transactionTypeFilter === "credito" && transaction.type === "CRÉDITO");

      // ✅ Filtro de data no frontend (refino adicional após filtro da API)
      // Apenas aplicar se o usuário selecionou datas
      let matchesDate = true;
      if (dateFrom && dateTo) {
        try {
          // Agora data vem processada do backend
          const transactionDate = new Date(transaction.dateTime);
          const fromDate = new Date(dateFrom);
          const toDate = new Date(dateTo);
          
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
          
          matchesDate = transactionDate >= fromDate && transactionDate <= toDate;
        } catch (error) {
          //console.warn('[TCR-FILTROS] Erro ao filtrar data:', transaction.dateTime, error);
          matchesDate = true; // Em caso de erro, incluir a transação
        }
      }
      // Se não houver filtro de data, matchesDate permanece true (mostra todas)

      // Filtro de busca geral
      const matchesSearch = !searchTerm || 
        transaction.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.descCliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Math.abs(transaction.value).toString().includes(searchTerm);

      // ✅ Filtro de valor mínimo (aplicado na API, mas também funciona no frontend como refinamento)
      // Se minAmount foi enviado para a API, ainda aplicamos aqui como refinamento adicional
      const matchesMinAmount = !minAmount || minAmount.trim() === '' || Math.abs(transaction.value) >= parseFloat(minAmount);

      // ✅ Filtro de valor máximo (aplicado na API, mas também funciona no frontend como refinamento)
      // Se maxAmount foi enviado para a API, ainda aplicamos aqui como refinamento adicional
      const matchesMaxAmount = !maxAmount || maxAmount.trim() === '' || Math.abs(transaction.value) <= parseFloat(maxAmount);

      // ✅ Filtro de valor específico - deve buscar tanto 550 quanto -550
      // Compara o valor absoluto da transação com o valor informado (ignorando sinal)
      const matchesSpecificAmount = !specificAmount || specificAmount.trim() === '' || (() => {
        const targetAmount = parseFloat(specificAmount);
        if (isNaN(targetAmount) || targetAmount <= 0) return true; // Se não for número válido ou <= 0, não filtrar
        
        // Tentar pegar o valor original da API primeiro, depois fallback para transaction.value
        const originalAmount = (transaction as any)._original?.amount;
        let txValue: number;
        
        if (originalAmount !== undefined && originalAmount !== null) {
          // Se existe amount original, usar ele (pode ser string "550" ou "-550")
          txValue = typeof originalAmount === 'string' 
            ? parseFloat(originalAmount) 
            : Number(originalAmount) || 0;
        } else {
          // Fallback para transaction.value processado
          txValue = typeof transaction.value === 'string' 
            ? parseFloat(transaction.value) 
            : Number(transaction.value) || 0;
        }
        
        // Comparar valor absoluto (550 ou -550 ambos devem ser encontrados quando busca por 550)
        const txAmountAbs = Math.abs(txValue);
        const targetAbs = Math.abs(targetAmount);
        
        // Tolerância de 1 centavo (0.01) para comparação
        return Math.abs(txAmountAbs - targetAbs) < 0.01;
      })();

      // ✅ Filtro de status (TCR não tem status na API, mas podemos verificar se há campo status no _original)
      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        // Tentar encontrar status no _original
        const originalStatus = (transaction as any)._original?.status || (transaction as any)._original?.situacao || '';
        const statusUpper = originalStatus?.toUpperCase() || '';
        
        if (statusFilter === 'COMPLETE') {
          matchesStatus = statusUpper === 'COMPLETE' || statusUpper === 'COMPLETED' || statusUpper === 'CONCLUÍDO' || statusUpper === 'CONCLUIDO' || !statusUpper;
        } else if (statusFilter === 'PENDING') {
          matchesStatus = statusUpper === 'PENDING' || statusUpper === 'PENDENTE' || statusUpper === 'IN_PROGRESS';
        } else if (statusFilter === 'FAILED') {
          matchesStatus = statusUpper === 'FAILED' || statusUpper === 'FALHOU' || statusUpper === 'ERRO';
        } else if (statusFilter === 'CANCELLED') {
          matchesStatus = statusUpper === 'CANCELLED' || statusUpper === 'CANCELADO' || statusUpper === 'CANCELED';
        }
      }

      // ✅ Filtro de tipo adicional (typeFilter - FUNDING/WITHDRAWAL)
      let matchesTypeFilter = true;
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'FUNDING') {
          matchesTypeFilter = transaction.type === 'CRÉDITO';
        } else if (typeFilter === 'WITHDRAWAL') {
          matchesTypeFilter = transaction.type === 'DÉBITO';
        }
      }

      // ✅ Filtro de estornos
      let matchesReversals = true;
      if (showReversalsOnly) {
        // Verificar se é estorno no _original ou na descrição
        const original = (transaction as any)._original || {};
        const isReversal = original.isReversal || 
                          original.is_reversal || 
                          transaction.descCliente?.toLowerCase().includes('estorno') ||
                          transaction.descCliente?.toLowerCase().includes('reversal') ||
                          transaction.descricaoOperacao?.toLowerCase().includes('estorno') ||
                          transaction.descricaoOperacao?.toLowerCase().includes('reversal');
        matchesReversals = isReversal === true;
      }

      return matchesName && matchesValue && matchesDescCliente && matchesType && matchesDate && matchesSearch && 
             matchesMinAmount && matchesMaxAmount && matchesSpecificAmount && matchesStatus && matchesTypeFilter && matchesReversals;
    });
    

    // ✅ Aplicar ordenação
    if (sortBy === "date" && sortOrder !== "none") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.dateTime);
        const dateB = new Date(b.dateTime);
        return sortOrder === "asc" ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      });
    } else if (sortBy === "value" && sortOrder !== "none") {
      filtered.sort((a, b) => sortOrder === "asc" ? a.value - b.value : b.value - a.value);
    }
    

    return filtered;
  }, [allTransactions, searchName, searchValue, searchDescCliente, transactionTypeFilter, dateFrom, dateTo, sortBy, sortOrder, searchTerm, minAmount, maxAmount, specificAmount, statusFilter, typeFilter, showReversalsOnly]);

  // ✅ Paginação server-side (sem slice local)
  const displayTransactions = filteredAndSortedTransactions; // Exibir todos os dados da página atual
  

  // ✅ Totalizadores
  const debitCount = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').length;
  const creditCount = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').length;
  const totalDebito = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').reduce((sum, t) => sum + t.value, 0);
  const totalCredito = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').reduce((sum, t) => sum + t.value, 0);
  
  // ✅ Calcular métricas
  useEffect(() => {
    const deposits = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO');
    const withdrawals = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO');
    
    setMetrics({
      totalDeposits: deposits.length,
      totalWithdrawals: withdrawals.length,
      depositAmount: totalCredito,
      withdrawalAmount: totalDebito,
      loading: isLoading
    });
  }, [filteredAndSortedTransactions, isLoading, totalCredito, totalDebito]);


  // ✅ Carregar transações (sem filtro de data por padrão - retorna últimos 100 registros)
  const loadTCRTransactions = async (customDateFrom?: Date | null, customDateTo?: Date | null, page: number = 1) => {
    try {
      setIsLoading(true);
      setError("");
      
      // ✅ Usar datas customizadas (dos filtros) ou datas selecionadas, ou null para retornar últimos registros
      let dataInicio: string | undefined = undefined;
      let dataFim: string | undefined = undefined;
      
      if (customDateFrom && customDateTo) {
        // Usar datas customizadas
        dataInicio = customDateFrom.toISOString().split('T')[0];
        dataFim = customDateTo.toISOString().split('T')[0];
      } else if (dateFrom && dateTo) {
        // Usar datas selecionadas
        dataInicio = dateFrom.toISOString().split('T')[0];
        dataFim = dateTo.toISOString().split('T')[0];
      }
      // Se não houver datas, dataInicio e dataFim ficam undefined (API retorna últimos registros)
      
      // ✅ Calcular limit e offset baseado na paginação
      const limit = recordsPerPage || 500;
      const offset = (page - 1) * limit;
      
      const params: any = {
        limit,
        offset,
        order: 'desc'
      };
      
      // ✅ Adicionar datas apenas se foram selecionadas
      if (dataInicio) {
        params.startDate = dataInicio;
      }
      if (dataFim) {
        params.endDate = dataFim;
      }
      
      // ✅ Adicionar filtro de tipo de transação se aplicável
      if (transactionTypeFilter === 'debito') {
        params.transactionType = 'D';
      } else if (transactionTypeFilter === 'credito') {
        params.transactionType = 'C';
      }
      
      // ✅ Prioridade: exactAmount ignora minAmount e maxAmount
      if (specificAmount && specificAmount.trim() !== '') {
        const specificValue = parseFloat(specificAmount);
        if (!isNaN(specificValue) && specificValue > 0) {
          params.exactAmount = specificValue;
        }
      } else {
        // Só adicionar minAmount e maxAmount se exactAmount não foi informado
        if (minAmount && minAmount.trim() !== '') {
          const minValue = parseFloat(minAmount);
          if (!isNaN(minValue) && minValue > 0) {
            params.minAmount = minValue;
          }
        }
        
        if (maxAmount && maxAmount.trim() !== '') {
          const maxValue = parseFloat(maxAmount);
          if (!isNaN(maxValue) && maxValue > 0) {
            params.maxAmount = maxValue;
          }
        }
      }
      
      // ✅ Verificar se searchTerm parece ser um endToEnd (começa com 'E' e tem formato específico)
      // ou se é uma busca textual normal
      const searchTermTrimmed = searchTerm?.trim() || '';
      const isEndToEndPattern = /^E\d{20,}/.test(searchTermTrimmed); // Padrão: E seguido de números
      
      if (isEndToEndPattern && searchTermTrimmed.length >= 20) {
        // ✅ Prioridade: endToEnd ignora search
        params.endToEnd = searchTermTrimmed;
      } else if (searchTermTrimmed) {
        // Busca textual normal
        params.search = searchTermTrimmed;
      }
      
      // ✅ Se não há searchTerm, verificar outros campos de busca
      if (!params.search && !params.endToEnd) {
        // Adicionar filtro de busca por nome/documento (searchName)
        if (searchName && searchName.trim() !== '') {
          params.search = searchName.trim();
        }
        
        // Adicionar filtro de busca por descrição (searchDescCliente)
        if (searchDescCliente && searchDescCliente.trim() !== '') {
          if (params.search) {
            // Combinar com busca existente
            params.search = `${params.search} ${searchDescCliente.trim()}`;
          } else {
            params.search = searchDescCliente.trim();
          }
        }
      }
      
      const { listarTransacoesTCR } = await import('@/services/tcr');
      const response = await listarTransacoesTCR(params);
      
      // ✅ NOVA API: Estrutura de resposta diferente
      if (response?.success && Array.isArray(response.data)) {
        const transactions = response.data;
        
        // 🚀 SUBSTITUIR dados para cada página (não acumular)
        setAllTransactions(transactions);
        
        // 🚀 Usar dados de paginação da API
        const paginationData = response.pagination || {};
        const total = paginationData.total || transactions.length;
        const hasMore = paginationData.has_more || false;
        const totalPagesCalc = paginationData.total_pages || Math.ceil(total / limit);
        const currentPageCalc = paginationData.current_page || page;
        
        // ✅ Atualizar estado de paginação e página atual após receber resposta da API
        setCurrentPage(currentPageCalc);
        setHasMorePages(hasMore);
        setTotalPages(totalPagesCalc);
        setPagination({
          total,
          limit: paginationData.limit || limit,
          offset: paginationData.offset || offset,
          has_more: hasMore,
          current_page: currentPageCalc,
          total_pages: totalPagesCalc
        });
        
        toast.success(`Página ${currentPageCalc}: ${transactions.length} transações`, {
          description: "Extrato TCR carregado",
          duration: 1500
        });
      } else {
        setAllTransactions([]);
        setPagination({
          total: 0,
          limit,
          offset: 0,
          has_more: false,
          current_page: 1,
          total_pages: 1
        });
        toast.info("Nenhuma transação encontrada", {
          description: "Tente ajustar os filtros de data",
          duration: 3000
        });
      }
      
    } catch (err: any) {
      console.error('[TCR-EXTRATO-UI] ❌ Erro:', err);
      setError(err.message || 'Erro ao carregar extrato');
      setAllTransactions([]);
      toast.error("Erro ao carregar extrato", {
        description: err.message || "Tente novamente em alguns instantes",
        duration: 4000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 Navegação de página server-side - permite navegar para qualquer página >= 1
  const handlePageChange = async (newPage: number) => {
    if (newPage >= 1) {
      // Manter o filtro de data atual (pode ser null se não houver filtro)
      // O estado currentPage será atualizado dentro de loadTCRTransactions após receber a resposta
      await loadTCRTransactions(dateFrom, dateTo, newPage);
    } else {
      toast.error("Página inválida", {
        description: "Digite um número maior ou igual a 1",
        duration: 3000
      });
    }
  };

  // ✅ Aplicar filtros (com período específico para API)
  const handleAplicarFiltros = () => {
    setCurrentPage(1);
    
    // ✅ Validar datas se ambas foram selecionadas
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        toast.error("Data inicial não pode ser maior que data final", {
          description: "Verifique as datas selecionadas",
          duration: 3000
        });
        return;
      }
    } else if (dateFrom || dateTo) {
      // Se apenas uma data foi selecionada, não é obrigatório ter ambas
      // A API pode funcionar com apenas uma data
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
    loadTCRTransactions(dateFrom || null, dateTo || null, 1);
    
    toast.success("Filtros aplicados!", {
      description: "Carregando transações com os filtros selecionados",
      duration: 2000
    });
  };

  // ✅ Limpar filtros - retornar aos últimos 100 registros
  const handleLimparFiltros = () => {
    setDateFrom(null);
    setDateTo(null);
    setDateRange({
      from: null,
      to: null
    });
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setSearchTerm("");
    setTransactionTypeFilter("todos");
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setMinAmount("");
    setMaxAmount("");
    setSpecificAmount("");
    setShowReversalsOnly(false);
    setSortBy("date");
    setSortOrder("desc");
    setCurrentPage(1);
    loadTCRTransactions(null, null, 1);
    toast.success("Filtros limpos!", {
      description: "Retornando aos últimos 100 registros",
      duration: 2000
    });
  };

  // ✅ Função para obter período padrão de 3 dias (hoje + 2 dias atrás)
  const getDefaultDates = () => {
    const hoje = new Date();
    const doisDiasAtras = new Date();
    doisDiasAtras.setDate(hoje.getDate() - 2);
    
    return {
      dateFrom: doisDiasAtras,
      dateTo: hoje
    };
  };

  // ✅ Handler para abrir/fechar modal de sincronização
  const handleSyncDialogChange = (open: boolean) => {
    setIsSyncDialogOpen(open);
    if (open) {
      const fallback = getDefaultDates();
      setSyncStartDate(dateFrom ?? fallback.dateFrom);
      setSyncEndDate(dateTo ?? fallback.dateTo);
    }
  };

  // ✅ Handler para sincronizar extrato
  const handleSyncExtrato = async () => {
    if (!syncStartDate || !syncEndDate) {
      toast.error('Informe o período que deseja sincronizar.');
      return;
    }

    if (syncStartDate > syncEndDate) {
      toast.error('Data inicial não pode ser posterior à data final.');
      return;
    }

    try {
      setIsSyncing(true);

      const TCR_CNPJ = "53781325000115"; // CNPJ da TCR
      const taxDocument = TCR_CNPJ.replace(/\D/g, '');
      const startDate = syncStartDate.toISOString().split('T')[0];
      const endDate = syncEndDate.toISOString().split('T')[0];

      const { sincronizarExtratoTCR } = await import('@/services/tcr');
      const response = await sincronizarExtratoTCR({
        taxDocument,
        startDate,
        endDate,
        dryRun: false,
      });

      toast.success('Sincronização iniciada com sucesso!', {
        description: response?.message || `Período ${startDate} a ${endDate}`,
      });

      setIsSyncDialogOpen(false);
      if (syncStartDate) {
        setDateFrom(syncStartDate);
      }
      if (syncEndDate) {
        setDateTo(syncEndDate);
      }
      setCurrentPage(1);
      await loadTCRTransactions(syncStartDate || undefined, syncEndDate || undefined, 1);
    } catch (error: any) {
      const description = error?.message || 'Tente novamente em alguns instantes.';
      toast.error('Erro ao sincronizar extrato', { description });
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  // ✅ Formatar data (dados já processados do backend)
  const formatDate = (dateString: string) => {
    if (!dateString) return "Data inválida";
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        //console.warn('[TCR-UI] Data inválida:', dateString);
        return dateString;
      }
      
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      //console.warn('[TCR-UI] Erro ao formatar data:', dateString, error);
      return dateString;
    }
  };

  // ✅ Função para exportar CSV
  const exportToCSV = () => {
    try {
      // Cabeçalho do CSV
      const headers = [
        'Data/Hora',
        'Valor',
        'Tipo',
        'Cliente',
        'Documento',
        'Descrição',
        'Código',
        'Provedor'
      ];

      // Converter dados para CSV
      const csvData = filteredAndSortedTransactions.map(transaction => [
        formatDate(transaction.dateTime),
        `${transaction.type === 'DÉBITO' ? '-' : '+'}${formatCurrency(transaction.value)}`,
        transaction.type,
        transaction.client || '',
        transaction.document || '',
        transaction.descCliente || '',
        transaction.code || '',
        'TCR'
      ]);

      // Criar conteúdo CSV
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(field => 
            // Escapar campos que contêm vírgula, aspas ou quebra de linha
            typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))
              ? `"${field.replace(/"/g, '""')}"` 
              : field
          ).join(',')
        )
      ].join('\n');

      // Criar arquivo e fazer download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      // Gerar nome do arquivo com data atual
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `extrato_tcr_${dataAtual}.csv`;
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', nomeArquivo);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast.success(`CSV exportado com sucesso!`, {
        description: `${filteredAndSortedTransactions.length} registros exportados para ${nomeArquivo}`,
        duration: 3000
      });

    } catch (error) {
      console.error('[TCR-CSV] Erro ao exportar CSV:', error);
      toast.error("Erro ao exportar CSV", {
        description: "Não foi possível gerar o arquivo de exportação",
        duration: 4000
      });
    }
  };

  // ✅ Função para gerar PDF do comprovante
  const generateReceiptPDF = async (transaction: any) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Dados da transação
      const original = transaction._original || {};
      const rawWebhook = original.rawWebhook || {};
      const corpxAccount = original.corpxAccount || {};

      // Cabeçalho
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(34, 197, 94); // Verde
      pdf.text('COMPROVANTE DE TRANSAÇÃO PIX', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Linha separadora
      pdf.setDrawColor(34, 197, 94);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Informações principais
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('INFORMAÇÕES DA TRANSAÇÃO', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`ID: ${transaction.id || original.id || '-'}`, margin, yPosition);
      pdf.text(`Data/Hora: ${formatDate(transaction.dateTime)}`, margin + 90, yPosition);
      yPosition += 6;

      pdf.text(`Tipo: ${transaction.type || original.transactionType || '-'}`, margin, yPosition);
      pdf.text(`Status: ${transaction.status || original.pixStatus || rawWebhook.status || 'SUCCESS'}`, margin + 90, yPosition);
      yPosition += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(transaction.type === 'CRÉDITO' ? 34 : 239, 68, 68);
      pdf.text(`Valor: ${transaction.type === 'CRÉDITO' ? '+' : '-'}${formatCurrency(transaction.value)}`, margin, yPosition);
      yPosition += 10;

      // Dados do Pagador
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('DADOS DO PAGADOR', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${transaction.client || original.payerName || rawWebhook.nome_debito || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Documento: ${transaction.document || original.payerDocument || rawWebhook.cpf_debito || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Banco: ${original.payerBank || rawWebhook.banco_origem || '-'}`, margin, yPosition);
      pdf.text(`Agência: ${original.payerAgency || rawWebhook.agencia_origem || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Conta: ${original.payerAccount || rawWebhook.conta_origem || '-'}`, margin, yPosition);
      yPosition += 10;

      // Dados do Beneficiário
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('DADOS DO BENEFICIÁRIO', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${original.beneficiaryName || rawWebhook.nome_destino || corpxAccount.fullName || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Documento: ${original.beneficiaryDocument || rawWebhook.cpf_destino || rawWebhook.tax_document || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Banco: ${original.beneficiaryBank || rawWebhook.banco_destino || '-'}`, margin, yPosition);
      pdf.text(`Agência: ${original.beneficiaryAgency || rawWebhook.agencia_destino || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Conta: ${original.beneficiaryAccount || rawWebhook.conta_destino || corpxAccount.accountNumber || '-'}`, margin, yPosition);
      yPosition += 10;

      // Códigos e Identificadores
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('IDENTIFICADORES', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`End-to-End: ${transaction.code || original.endToEnd || rawWebhook.endtoend || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`TXID: ${original.txid || rawWebhook.txid || '-'}`, margin, yPosition);
      yPosition += 6;
      if (transaction.reconciliationId || original.reconciliationId || rawWebhook.reconciliation_id) {
        pdf.text(`Reconciliation ID: ${transaction.reconciliationId || original.reconciliationId || rawWebhook.reconciliation_id}`, margin, yPosition);
        yPosition += 6;
      }
      pdf.text(`Chave PIX: ${original.pixKey || rawWebhook.chave_pix || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Nr. Movimento: ${original.nrMovimento || rawWebhook.nrMovimento || '-'}`, margin, yPosition);
      yPosition += 10;

      // Informações Adicionais
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('INFORMAÇÕES ADICIONAIS', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Descrição: ${transaction.descCliente || original.description || rawWebhook.descricaoComplementar || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Fonte: ${original.source || '-'}`, margin, yPosition);
      pdf.text(`Tipo PIX: ${original.pixType || rawWebhook.pix_type || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Evento: ${original.eventType || rawWebhook.event_type || '-'}`, margin, yPosition);

      // Rodapé
      yPosition = pdf.internal.pageSize.getHeight() - 20;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });

      // Salvar PDF
      const fileName = `comprovante-tcr-${transaction.id || original.id || Date.now()}.pdf`;
      pdf.save(fileName);

      toast.success('PDF gerado com sucesso!', {
        description: fileName,
        duration: 3000
      });
    } catch (error) {
      console.error('[TCR-PDF] Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF', {
        description: 'Não foi possível gerar o comprovante',
        duration: 4000
      });
    }
  };

  // ✅ Funções para Duplicatas e Verificação
  const extrairIdUsuario = (descCliente: string): string => {
    // Padrão: Usuario 1234; ou similar - extrair número após "Usuario"
    const match = descCliente?.match(/Usuario\s+(\d+)/i);
    return match ? match[1] : '';
  };

  const extrairEndToEnd = (transaction: any): string => {
    // Buscar endtoend nos dados da transação TCR
    // ✅ CORRIGIDO: Usar idEndToEnd (campo correto da API TCR)
    return transaction._original?.idEndToEnd || transaction._original?.endToEndId || transaction._original?.e2eId || transaction.code || '';
  };

  const handleGerenciarDuplicatas = (transaction: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // ✅ Converter para formato MovimentoExtrato esperado pelo modal
    const extractRecord = {
      id: transaction.id,
      dateTime: transaction.dateTime,
      value: transaction.value,
      type: transaction.type,
      client: transaction.client,
      document: transaction.document || '',
      code: transaction.code,
      descCliente: transaction.descCliente,
      identified: transaction.identified || true,
      descricaoOperacao: transaction.descricaoOperacao || transaction.descCliente
    };
    
    setSelectedCompensationRecord(extractRecord);
    setCompensationModalOpen(true);
  };

  const handleCompensationSuccess = () => {
    // Recarregar dados após operação
    loadTCRTransactions(dateFrom, dateTo, 1);
    toast.success("Operação realizada com sucesso!");
  };

  const handleVerificarTransacao = async (transaction: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // ✅ Converter para formato MovimentoExtrato esperado pelo modal
    let extractRecord = {
      id: transaction.id,
      dateTime: transaction.dateTime,
      value: transaction.value,
      type: transaction.type,
      client: transaction.client,
      document: transaction.document || '',
      code: transaction.code,
      descCliente: transaction.descCliente,
      identified: transaction.identified || true,
      descricaoOperacao: transaction.descricaoOperacao || transaction.descCliente
    };
    
    // ✅ Buscar id_usuario automaticamente via endtoend (silencioso - sem toast de loading)
    try {
      const resultado = await TCRVerificacaoService.verificarTransacaoTCR(transaction);
      
      if (resultado.encontrou && resultado.id_usuario) {
        // ✅ ENCONTROU! Modificar descCliente para incluir o ID do usuário
        extractRecord.descCliente = `Usuario ${resultado.id_usuario}; ${extractRecord.descCliente}`;
        // ✅ Toast silencioso apenas se encontrou (feedback positivo mínimo)
        toast.success(`Usuário ID ${resultado.id_usuario} identificado`, {
          duration: 3000
        });
      }
      // ✅ Não encontrou: não mostrar toast - o modal já indica que pode informar manualmente
    } catch (error) {
      console.error('[TCR-VERIFICACAO] Erro:', error);
      // ✅ Apenas mostrar erro se for crítico - o modal permite entrada manual
      // toast removido - erro não crítico, modal permite correção manual
    }
    
    // ✅ SEMPRE abrir o modal (com ou sem id_usuario encontrado)
    setSelectedCompensationRecord(extractRecord);
    setCompensationModalOpen(true);
  };

  // ✅ Carregar dados ao montar o componente - últimos 100 registros (sem filtro de data)
  useEffect(() => {
    // Sem datas, retorna últimos registros
    loadTCRTransactions(null, null, 1);
  }, []); // Manter [] para executar apenas na montagem

  // ✅ Removido: Aplicação automática de filtros de data
  // Agora os filtros são aplicados apenas quando o usuário clicar em "Aplicar Filtros"
  // Isso dá mais controle ao usuário e evita requisições desnecessárias

  // Funções para modo lote
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      setSelectedTransactions(new Set());
    }
  };

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const selectAllVisibleCredits = () => {
    const creditTransactions = filteredAndSortedTransactions
      .filter(t => t.type === 'CRÉDITO')
      .map(t => t.id.toString());
    setSelectedTransactions(new Set(creditTransactions));
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const handleRecordsPerPageChange = (value: string) => {
    const limit = parseInt(value, 10);
    setRecordsPerPage(limit);
    setCurrentPage(1);
    loadTCRTransactions(dateFrom, dateTo, 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMorePages) {
      handlePageChange(currentPage + 1);
    }
  };

  const handleGoToPage = (page: number) => {
    if (page >= 1) {
      handlePageChange(page);
      setIsEditingPage(false);
    } else {
      toast.error("Página inválida", {
        description: "Digite um número maior ou igual a 1",
        duration: 3000
      });
      setIsEditingPage(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {pagination.total || filteredAndSortedTransactions.length} transações
          </span>
              </div>
        
        <div className="flex gap-2">
          <Select
            value={recordsPerPage.toString()}
            onValueChange={handleRecordsPerPageChange}
            disabled={isLoading}
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
            onClick={() => loadTCRTransactions(dateFrom, dateTo, currentPage)}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredAndSortedTransactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="p-4 bg-background border border-[rgba(34,197,94,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Depósitos</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">{metrics.totalDeposits}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.depositAmount)}
                </p>
              </>
            )}
              </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(34,197,94,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Saques</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">{metrics.totalWithdrawals}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.withdrawalAmount)}
                </p>
              </>
            )}
            </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(34,197,94,0.3)]">
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

        <Card className="p-4 bg-background border border-[rgba(34,197,94,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor em Saques</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            ) : (
              <p className="text-2xl font-bold text-orange-500">
                {formatCurrency(metrics.withdrawalAmount)}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Filtros (sempre visíveis) */}
      <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)]">
        <div className="space-y-3 lg:space-y-4">
          {/* Linha 1: Busca, Tipo, Status, Valor específico */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF, EndToEnd (E...)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</label>
              <Select value={transactionTypeFilter === 'todos' ? 'ALL' : (transactionTypeFilter === 'credito' ? 'FUNDING' : 'WITHDRAWAL')} onValueChange={(v: any) => {
                if (v === 'ALL') setTransactionTypeFilter('todos');
                else if (v === 'FUNDING') setTransactionTypeFilter('credito');
                else setTransactionTypeFilter('debito');
              }}>
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]">
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
                <SelectTrigger className="h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="COMPLETE">Completo</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor específico</label>
              <Input
                type="number"
                placeholder="0.00"
                value={specificAmount}
                onChange={(e) => setSpecificAmount(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]"
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
                      dateRange.from && "border-[rgba(34,197,94,0.6)]"
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
                        setDateFrom(date);
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
                      dateRange.to && "border-[rgba(34,197,94,0.6)]"
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
                        setDateTo(date);
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
                className="h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor máximo</label>
              <Input
                type="number"
                placeholder="0.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="h-10 bg-background border-2 focus:border-[rgba(34,197,94,0.6)]"
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

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aplicando filtros...
            </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleAplicarFiltros}
                className="h-10 bg-green-600 hover:bg-green-700 text-white transition-all duration-200 rounded-md px-3 lg:px-4"
                disabled={isLoading}
              >
                <Filter className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Dialog open={isSyncDialogOpen} onOpenChange={handleSyncDialogChange}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={isLoading || isSyncing}
                    className="h-10 bg-black border border-blue-600 text-white hover:bg-blue-600 hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Extrato
                      </>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Sincronizar extrato TCR</DialogTitle>
                    <DialogDescription>
                      Informe o período que deseja sincronizar. A operação será executada diretamente na API da TCR.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">Data inicial</label>
                      <Popover open={startDatePopoverOpen} onOpenChange={setStartDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!syncStartDate ? "text-muted-foreground" : ""}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {syncStartDate ? format(syncStartDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-auto p-0" 
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={syncStartDate || undefined}
                            onSelect={(date) => {
                              if (date) {
                                setSyncStartDate(date);
                                // Fechar popover após seleção
                                setTimeout(() => setStartDatePopoverOpen(false), 100);
                              }
                            }}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">Data final</label>
                      <Popover open={endDatePopoverOpen} onOpenChange={setEndDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!syncEndDate ? "text-muted-foreground" : ""}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {syncEndDate ? format(syncEndDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-auto p-0" 
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={syncEndDate || undefined}
                            onSelect={(date) => {
                              if (date) {
                                setSyncEndDate(date);
                                // Fechar popover após seleção
                                setTimeout(() => setEndDatePopoverOpen(false), 100);
                              }
                            }}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={isSyncing}>
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button onClick={handleSyncExtrato} disabled={isSyncing || !syncStartDate || !syncEndDate}>
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Confirmar sincronização
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                onClick={handleLimparFiltros}
                className="h-10 bg-black border border-green-600 text-white hover:bg-green-600 hover:text-white transition-all duration-200 rounded-md px-3 lg:px-4"
                disabled={isLoading}
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
      {/* 🆕 Barra de Ações em Lote */}
        <div className={cn(
          "px-6 py-4 border-b border-border transition-all",
          "bg-muted/30"
      )}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant={bulkMode ? "default" : "outline"}
              onClick={toggleBulkMode}
                className={bulkMode ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {bulkMode ? "Sair do Modo Lote" : "Modo Seleção em Lote"}
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
                    disabled={filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').length === 0}
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
              </>
            )}
                  </div>
              </div>
            </div>

          {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-500 mb-4">Erro ao carregar extrato</p>
              <Button onClick={() => loadTCRTransactions(dateFrom, dateTo, 1)} variant="outline">
              Tentar Novamente
              </Button>
            </div>
          ) : displayTransactions.length === 0 ? (
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
                    {bulkMode && <th className="w-12 p-3"></th>}
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Reconciliation ID</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">End-to-End</th>
                    {!bulkMode && <th className="w-24 p-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {displayTransactions.map((tx, index) => (
                    <>
                    <tr
                      key={tx.id}
            className={cn(
                        "border-b hover:bg-muted/30 transition-colors cursor-pointer",
                        index % 2 === 0 ? "bg-[#181818]" : "bg-[#1E1E1E]",
                        bulkMode && selectedTransactions.has(tx.id.toString()) && "bg-muted/20 dark:bg-muted/10",
                        expandedRow === tx.id && "bg-muted/10 dark:bg-muted/5"
            )}
                          onClick={() => {
                        if (bulkMode && tx.type === 'CRÉDITO') {
                          toggleTransactionSelection(tx.id.toString());
                        } else if (!bulkMode) {
                          setExpandedRow(expandedRow === tx.id ? null : tx.id);
                        }
                      }}
                    >
                      {bulkMode && (
                        <td className="p-3">
                          {tx.type === 'CRÉDITO' && (
                <Checkbox
                              checked={selectedTransactions.has(tx.id.toString())}
                              onCheckedChange={() => toggleTransactionSelection(tx.id.toString())}
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
                            <div className="text-sm">{formatDate(tx.dateTime).split(' ')[0]}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(tx.dateTime).split(' ')[1]}</div>
                              </div>
                            </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {tx.type === 'CRÉDITO' ? (
                              <ArrowDownCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">
                              {tx.type === 'CRÉDITO' ? 'Recebimento' : 'Envio'}
                            </span>
                          </div>
                          <div className="mt-1">
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                              {tx.status || 'Completo'}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium">
                          {tx.client || 'N/A'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className={cn(
                          "text-sm font-bold",
                          tx.type === 'CRÉDITO' ? "text-green-600" : "text-red-600"
                        )}>
                          {tx.type === 'CRÉDITO' ? '+' : '-'} {formatCurrency(tx.value)}
                        </div>
                      </td>
                      <td className="p-3">
                        {tx.reconciliationId ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                              {tx.reconciliationId}
                            </span>
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
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {tx.code ? `${tx.code.substring(0, 20)}...` : '-'}
                            </div>
                      </td>
                      {!bulkMode && (
                        <td className="p-3">
                          {tx.type === 'DÉBITO' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                              onClick={(e) => handleGerenciarDuplicatas(tx, e)}
                      className={cn(
                                "h-7 px-2 text-xs transition-all",
                                "bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300"
                      )}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Duplicatas
                                </Button>
                              )}
                          {tx.type === 'CRÉDITO' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                              onClick={(e) => handleVerificarTransacao(tx, e)}
                      className={cn(
                                "h-7 px-2 text-xs transition-all",
                                "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300"
                      )}
                                >
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Verificar
                                </Button>
                              )}
                        </td>
                      )}
                    </tr>
                    
                    {/* Linha expandida com detalhes */}
                    {expandedRow === tx.id && !bulkMode && (() => {
                      const original = tx._original || {};
                      const rawWebhook = original.rawWebhook || {};
                      const corpxAccount = original.corpxAccount || {};
                      
                      return (
                        <tr className="bg-muted/5 dark:bg-muted/5 border-b border-border/50">
                          <td colSpan={bulkMode ? 9 : 8} className="p-0">
                            <div className="p-6 space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-green-600">Detalhes da Transação</h4>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateReceiptPDF(tx);
                                    }}
                                    className="h-8 px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  >
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Gerar PDF
                                  </Button>
                                  <Badge variant="outline" className="text-xs">ID: {tx.id}</Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Coluna 1: Informações Básicas */}
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">ID da Transação</label>
                                    <p className="text-sm mt-1 font-mono">{tx.id || original.id || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Código (End-to-End)</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono">{tx.code || original.endToEnd || rawWebhook.endtoend || '-'}</p>
                                      {tx.code && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(tx.code);
                                            toast.success('Código copiado!');
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">TXID</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono text-xs">{original.txid || rawWebhook.txid || '-'}</p>
                                      {original.txid && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(original.txid);
                                            toast.success('TXID copiado!');
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nr. Movimento</label>
                                    <p className="text-sm mt-1 font-mono">{original.nrMovimento || rawWebhook.nrMovimento || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Data/Hora</label>
                                    <p className="text-sm mt-1">{formatDate(tx.dateTime)}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo</label>
                                    <div className="mt-1 space-y-1">
                                      <p className="text-sm">{tx.type}</p>
                                      {tx.status && (
                                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                          {tx.status}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Valor</label>
                                    <p className={cn("text-sm mt-1 font-bold text-lg", tx.type === 'CRÉDITO' ? "text-green-600" : "text-red-600")}>
                                      {tx.type === 'CRÉDITO' ? '+' : '-'} {formatCurrency(tx.value)}
                                    </p>
                                  </div>
                                </div>

                                {/* Coluna 2: Dados do Pagador */}
                                <div className="space-y-3">
                                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Pagador</h5>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{tx.client || original.payerName || rawWebhook.nome_debito || 'N/A'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Documento</label>
                                    <p className="text-sm mt-1 font-mono">{tx.document || original.payerDocument || rawWebhook.cpf_debito || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco</label>
                                    <p className="text-sm mt-1">{original.payerBank || rawWebhook.banco_origem || original.payerBankCode || rawWebhook.banco_origem || '-'}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Agência</label>
                                      <p className="text-sm mt-1">{original.payerAgency || rawWebhook.agencia_origem || '-'}</p>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Conta</label>
                                      <p className="text-sm mt-1 font-mono">{original.payerAccount || rawWebhook.conta_origem || '-'}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo de Conta</label>
                                    <p className="text-sm mt-1">{rawWebhook.tipo_conta_origem || '-'}</p>
                                  </div>
                                </div>

                                {/* Coluna 3: Dados do Beneficiário */}
                                <div className="space-y-3">
                                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Beneficiário</h5>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{original.beneficiaryName || rawWebhook.nome_destino || corpxAccount.fullName || 'TCR FINANCE LTDA'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Documento</label>
                                    <p className="text-sm mt-1 font-mono">{original.beneficiaryDocument || rawWebhook.cpf_destino || rawWebhook.tax_document || corpxAccount.taxDocument || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Banco</label>
                                    <p className="text-sm mt-1">{original.beneficiaryBank || rawWebhook.banco_destino || original.beneficiaryBankCode || '-'}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Agência</label>
                                      <p className="text-sm mt-1">{original.beneficiaryAgency || rawWebhook.agencia_destino || '-'}</p>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Conta</label>
                                      <p className="text-sm mt-1 font-mono">{original.beneficiaryAccount || rawWebhook.conta_destino || corpxAccount.accountNumber || '-'}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo de Conta</label>
                                    <p className="text-sm mt-1">{rawWebhook.tipo_conta_destino || '-'}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Segunda Linha: Informações Adicionais */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                                <div className="space-y-3">
                                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Identificadores</h5>
                                  
                                  {tx.reconciliationId && (
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground uppercase">Reconciliation ID</label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-sm font-mono">{tx.reconciliationId}</p>
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
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Chave PIX</label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-sm font-mono text-xs">{original.pixKey || rawWebhook.chave_pix || '-'}</p>
                                      {original.pixKey && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(original.pixKey);
                                            toast.success('Chave PIX copiada!');
                                          }}
                                          className="h-6 w-6 p-0"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">CorpX Account ID</label>
                                    <p className="text-sm mt-1 font-mono">{original.corpx_account_id || corpxAccount.id || '-'}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Transação</h5>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Descrição</label>
                                    <p className="text-sm mt-1">{tx.descCliente || original.description || rawWebhook.descricaoComplementar || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Fonte</label>
                                    <p className="text-sm mt-1">{original.source || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Tipo PIX</label>
                                    <p className="text-sm mt-1">{original.pixType || rawWebhook.pix_type || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Evento</label>
                                    <p className="text-sm mt-1">{original.eventType || rawWebhook.event_type || '-'}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Conta CorpX</h5>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                                    <p className="text-sm mt-1">{corpxAccount.status || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Número da Conta</label>
                                    <p className="text-sm mt-1 font-mono">{corpxAccount.accountNumber || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Documento</label>
                                    <p className="text-sm mt-1 font-mono">{corpxAccount.taxDocument || '-'}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Nome</label>
                                    <p className="text-sm mt-1">{corpxAccount.fullName || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                    </>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Paginação */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                    <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * recordsPerPage) + 1} - {Math.min(currentPage * recordsPerPage, pagination.total || 0)} de {pagination.total || 0}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                  onClick={handlePreviousPage}
                        disabled={currentPage === 1 || isLoading}
                  className="h-9"
                      >
                  <ChevronLeft className="h-4 w-4" />
                      </Button>
                
                {isEditingPage ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      defaultValue={currentPage}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const page = parseInt((e.target as HTMLInputElement).value, 10);
                          if (!isNaN(page) && page >= 1) {
                            handleGoToPage(page);
                          } else {
                            setIsEditingPage(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsEditingPage(false);
                        }
                      }}
                      onBlur={(e) => {
                        const page = parseInt(e.target.value, 10);
                        if (!isNaN(page) && page >= 1) {
                          handleGoToPage(page);
                        } else {
                          setIsEditingPage(false);
                        }
                      }}
                      className="w-20 h-9 text-center text-sm"
                      disabled={isLoading}
                      placeholder={currentPage.toString()}
                    />
                    {totalPages > 0 && (
                      <span className="text-sm text-muted-foreground">/ {totalPages}+</span>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingPage(true)}
                    disabled={isLoading}
                    className="h-9 min-w-[80px]"
                  >
                    <span className="text-sm">
                      {currentPage} {totalPages > 0 ? `/ ${totalPages}+` : ''}
                      </span>
                  </Button>
                )}
                
                      <Button
                        variant="outline"
                        size="sm"
                  onClick={handleNextPage}
                        disabled={!hasMorePages || isLoading}
                  className="h-9"
                      >
                  <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
            </>
          )}
      </Card>

      {/* Modal de detalhes da transação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Transação TCR
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                  <p className="text-sm font-semibold">{formatDate(selectedTransaction.dateTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valor</label>
                  <p className={`text-sm font-bold ${selectedTransaction.type === 'DÉBITO' ? "text-red-600" : "text-green-600"}`}>
                    {selectedTransaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(selectedTransaction.value)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                  <p className="text-sm">{selectedTransaction.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Código</label>
                  <p className="text-sm font-mono">{selectedTransaction.code}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="text-sm">{selectedTransaction.client}</p>
                </div>
                {selectedTransaction.document && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Documento</label>
                    <p className="text-sm">{selectedTransaction.document}</p>
                  </div>
                )}
                {selectedTransaction.descCliente && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                    <p className="text-sm">{selectedTransaction.descCliente}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Modal Compensação Inteligente */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={() => setCompensationModalOpen(false)}
        extractRecord={selectedCompensationRecord}
      />
    </div>
  );
}