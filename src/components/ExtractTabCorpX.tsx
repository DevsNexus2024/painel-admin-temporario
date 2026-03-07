import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus, Check, DollarSign, Trash2, Building2, CheckSquare } from "lucide-react";
import jsPDF from 'jspdf';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarWrapper } from "@/components/ui/calendar-wrapper";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";
import BulkCreditOTCModal from "@/components/otc/BulkCreditOTCModal";
import MoneyRainEffect from "@/components/MoneyRainEffect";
import { useCorpX, CORPX_ACCOUNTS } from "@/contexts/CorpXContext";
import CorpXService, { consultarTransacaoPorEndToEnd } from "@/services/corpx";
import { useCorpxRealtime, CorpXTransactionPayload } from "@/hooks/useCorpxRealtime";

// Componente completo para o Extrato CorpX (baseado no BMP 531)
export default function ExtractTabCorpX() {
  const { selectedAccount } = useCorpX();
  const abortRef = React.useRef<AbortController | null>(null);

  const accountNameByDocument = useMemo(() => {
    const map: Record<string, string> = {};
    CORPX_ACCOUNTS.forEach((account) => {
      if (account.id === 'ALL') return;
      const sanitized = account.cnpj.replace(/\D/g, '');
      map[sanitized] = account.razaoSocial;
    });
    return map;
  }, []);

  // 🚀 OTIMIZADO: Memoizar para evitar recriação a cada render
  const formatDocument = React.useCallback((document: string | undefined | null) => {
    if (!document) return '';
    const digits = document.replace(/\D/g, '');

    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    return document;
  }, []);

  // 🚀 OTIMIZADO: Memoizar para evitar recriação a cada render
  const shouldHideTransaction = React.useCallback((transaction: any) => {
    if (!transaction) return false;

    const isDebit = transaction.type === 'DÉBITO' || transaction._original?.transactionType === 'D';
    if (!isDebit) return false;

    const amount = typeof transaction.value === 'number' ? transaction.value : Number(transaction.value) || 0;
    if (Math.abs(amount) !== 0.5) return false;
    
    const beneficiaryDoc = (transaction.beneficiaryDocument || transaction.document || '').replace(/\D/g, '');
    return beneficiaryDoc === '36741675000139';
  }, []);
  
  // Estados para controle de dados (inicial true para exibir loading no primeiro render)
  const [isLoading, setIsLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  
  // ✅ Estado para controlar se filtros foram aplicados na API
  const [filtersAppliedToAPI, setFiltersAppliedToAPI] = useState(false);
  
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

  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStartDate, setSyncStartDate] = useState<Date | null>(null);
  const [syncEndDate, setSyncEndDate] = useState<Date | null>(null);
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDescCliente, setSearchDescCliente] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // Busca geral (pode ser endToEnd ou texto)
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [specificAmount, setSpecificAmount] = useState<string>(""); // Valor exato
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"todos" | "debito" | "credito">("todos");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("desc");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("date");
  const [isExporting, setIsExporting] = useState(false);
  
  // Estados para paginação da nova API
  const [recordsPerPage, setRecordsPerPage] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 500,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1,
  });

  const handleRecordsPerPageChange = (value: string) => {
    const newLimit = parseInt(value, 10);
    setRecordsPerPage(newLimit);
    setCurrentPage(1);
    // ✅ Manter estado de filtros ao mudar registros por página
    loadCorpXTransactions(undefined, undefined, 1, newLimit, filtersAppliedToAPI);
  };
  
  // Estados para modal
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Estados para funcionalidade OTC
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<any>(null);
  const [creditedRecords, setCreditedRecords] = useState<Set<string>>(new Set());
  const [isVerifyingTransaction, setIsVerifyingTransaction] = useState<string | null>(null); // ID da transação sendo verificada

  // 🆕 Estados para modo seleção em lote
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkOTCModalOpen, setBulkOTCModalOpen] = useState(false);

  // 🆕 Estado para busca de depósito por EndToEnd
  const [buscarEndToEnd, setBuscarEndToEnd] = useState("");
  const [isBuscandoDeposito, setIsBuscandoDeposito] = useState(false);
  const [depositoModalOpen, setDepositoModalOpen] = useState(false);
  const [depositoData, setDepositoData] = useState<any>(null);

  // ✅ Conversão de dados já processados do serviço CorpX (memoizado)
  const convertCorpXToStandardFormat = React.useCallback((transaction: any) => {
    if (!transaction) {
      return null;
    }

    const amountRaw = transaction.amount ?? transaction.valor ?? 0;
    const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : Number(amountRaw) || 0;
    const transactionType = transaction.transactionType || transaction.type;
    const type = transactionType === 'C' || transactionType === 'credit' ? 'CRÉDITO' : 'DÉBITO';
    const description = transaction.description || transaction.transactionDescription || transaction.pixDescription || transaction.label || transaction.descricao || '';

    const payerName = transaction.payerName || transaction.debtorName || '';
    const beneficiaryName = transaction.beneficiaryName || transaction.creditorName || transaction.destinatario || '';
    const counterpartyName = type === 'CRÉDITO' ? payerName : beneficiaryName;
    const fallbackClient = counterpartyName || beneficiaryName || payerName || transaction.client || 'Cliente não identificado';

    const payerDocument = transaction.payerDocument || transaction.debtorDocument || '';
    const beneficiaryDocument = transaction.beneficiaryDocument || transaction.creditorDocument || transaction.documentoBeneficiario || '';
    const document = beneficiaryDocument || payerDocument || '';

    const transactionDateTime =
      transaction.transactionDatetime ||
      transaction.transactionDatetimeUtc ||
      transaction.transactionDate ||
      transaction.date ||
      new Date().toISOString();

    const endToEnd =
      transaction.endToEnd ||
      transaction.end_to_end ||
      transaction.endToEndId ||
      transaction.idEndToEnd ||
      transaction.nrMovimento ||
      transaction.id ||
      '';

    const rawExtrato = transaction.rawExtrato
      || transaction.rawextrato
      || transaction.raw_statement
      || transaction.rawWebhook?.rawExtrato
      || null;

    // ✅ Extrair status da transação (prioridade: pixStatus > rawWebhook.status)
    const status = transaction.pixStatus 
      || transaction.rawWebhook?.status 
      || transaction.status 
      || 'UNKNOWN';

    return {
      id: (transaction.id ?? transaction.nrMovimento ?? transaction.idEndToEnd ?? Date.now()).toString(),
      dateTime: transactionDateTime,
      value: amount,
      type,
      client: fallbackClient,
      document,
      beneficiaryDocument,
      payerDocument,
      code: endToEnd || '',
      descCliente: description,
      identified: Boolean(fallbackClient),
      descricaoOperacao: description,
      rawExtrato,
      status, // ✅ Adicionar status ao objeto retornado
      _original: transaction,
    };
  }, []);

  // 🚀 OTIMIZADO: Combina map + 3 filters em uma única passada para melhor performance
  const normalizeTransactions = React.useCallback(
    (transactions: any[], isAllAccountsParam: boolean, sanitizedCnpjParam: string) => {
      const TCR_DOCUMENT = '53781325000115'; // Documento da TCR sem formatação
      const result: NonNullable<ReturnType<typeof convertCorpXToStandardFormat>>[] = [];
      
      for (let i = 0; i < transactions.length; i++) {
        const tx = convertCorpXToStandardFormat(transactions[i]);
        
        // Filtro 1: tx válido e não deve ser escondido
        if (!tx || shouldHideTransaction(tx)) continue;
          
        // Filtro 2: Não é depósito da TCR
        if (tx.beneficiaryDocument) {
          const beneficiaryDocNormalized = tx.beneficiaryDocument.replace(/\D/g, '');
          if (beneficiaryDocNormalized === TCR_DOCUMENT) continue;
          }
          
        // Filtro 3: Matches selected account
        if (!isAllAccountsParam && sanitizedCnpjParam) {
          const docNorm = tx.document?.replace(/\D/g, '') || '';
          const beneficiaryNorm = tx.beneficiaryDocument?.replace(/\D/g, '') || '';
          const payerNorm = tx.payerDocument?.replace(/\D/g, '') || '';
          
          if (docNorm !== sanitizedCnpjParam && 
              beneficiaryNorm !== sanitizedCnpjParam && 
              payerNorm !== sanitizedCnpjParam) {
            continue;
          }
        }
        
        result.push(tx);
      }
      
      return result;
    },
    [convertCorpXToStandardFormat, shouldHideTransaction]
  );

  // 🚀 OTIMIZADO: Pré-calcular valores de filtro fora do loop para melhor performance
  // ✅ LÓGICA HÍBRIDA: Sempre aplica filtros no frontend (como TCR)
  // Quando "Aplicar Filtros" é clicado, também envia filtros para API
  const applyFiltersAndSorting = React.useCallback(
    (transactions: any[]) => {
      // ✅ SEMPRE aplicar filtros no frontend (mesmo quando API também filtra)
      // Isso garante feedback imediato e refinamento adicional

      // 🚀 Pré-calcular todos os valores de filtro ANTES do loop
      const searchNameLower = searchName?.toLowerCase() || '';
      const searchDescClienteLower = searchDescCliente?.toLowerCase() || '';
      const searchTermLower = searchTerm?.toLowerCase() || '';
      
      const hasSearchName = !!searchName;
      const hasSearchValue = !!searchValue;
      const hasSearchDescCliente = !!searchDescCliente;
      const hasSearchTerm = !!searchTerm;
      const hasTypeFilter = transactionTypeFilter !== "todos";
      
      // Pré-calcular datas como timestamps
      let fromTimestamp = 0;
      let toTimestamp = 0;
      const hasDateFilter = !!dateFrom && !!dateTo;
      if (hasDateFilter) {
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
        fromTimestamp = fromDate.getTime();
        toTimestamp = toDate.getTime();
        }

      // Pré-calcular valores numéricos
      const minValue = minAmount?.trim() ? parseFloat(minAmount) : NaN;
      const maxValue = maxAmount?.trim() ? parseFloat(maxAmount) : NaN;
      const specificValue = specificAmount?.trim() ? parseFloat(specificAmount) : NaN;
      const hasMinAmount = !isNaN(minValue);
      const hasMaxAmount = !isNaN(maxValue);
      const hasSpecificAmount = !isNaN(specificValue) && specificValue !== 0;

      // Filtrar em uma única passada com early returns
      const filtered: any[] = [];
      const len = transactions.length;
      
      for (let i = 0; i < len; i++) {
        const tx = transactions[i];

        // Filtro tipo (mais rápido, verificar primeiro)
        if (hasTypeFilter) {
          if (transactionTypeFilter === "debito" && tx.type !== "DÉBITO") continue;
          if (transactionTypeFilter === "credito" && tx.type !== "CRÉDITO") continue;
        }
        
        // Filtro data (usar timestamps pré-calculados)
        if (hasDateFilter) {
          const txTime = new Date(tx.dateTime).getTime();
          if (txTime < fromTimestamp || txTime > toTimestamp) continue;
        }
        
        // Filtros de valor (mais rápidos que string)
        if (hasMinAmount && tx.value < minValue) continue;
        if (hasMaxAmount && tx.value > maxValue) continue;
        if (hasSpecificAmount) {
          const originalAmount = tx._original?.amount;
          const txValue = originalAmount !== undefined && originalAmount !== null
            ? (typeof originalAmount === 'string' ? parseFloat(originalAmount) : Number(originalAmount) || 0)
            : tx.value;
          if (Math.abs(txValue - specificValue) >= 0.01) continue;
        }
        
        // Filtros de string (mais lentos, verificar por último)
        if (hasSearchName) {
          const clientLower = tx.client?.toLowerCase() || '';
          const docLower = tx.document?.toLowerCase() || '';
          if (!clientLower.includes(searchNameLower) && !docLower.includes(searchNameLower)) continue;
        }
        
        if (hasSearchValue) {
          if (!Math.abs(tx.value).toString().includes(searchValue)) continue;
          }
          
        if (hasSearchDescCliente) {
          const descLower = tx.descCliente?.toLowerCase() || '';
          const clientLower = tx.client?.toLowerCase() || '';
          const origDescLower = tx._original?.description?.toLowerCase() || '';
          if (!descLower.includes(searchDescClienteLower) && 
              !clientLower.includes(searchDescClienteLower) &&
              !origDescLower.includes(searchDescClienteLower)) continue;
        }
        
        if (hasSearchTerm) {
          const clientLower = tx.client?.toLowerCase() || '';
          const docLower = tx.document?.toLowerCase() || '';
          const codeLower = tx.code?.toLowerCase() || '';
          const descLower = tx.descCliente?.toLowerCase() || '';
          const valueStr = Math.abs(tx.value).toString();
          if (!clientLower.includes(searchTermLower) &&
              !docLower.includes(searchTermLower) &&
              !codeLower.includes(searchTermLower) &&
              !descLower.includes(searchTermLower) &&
              !valueStr.includes(searchTerm)) continue;
        }
        
        filtered.push(tx);
      }
    
      // Aplicar ordenação
      if (sortOrder !== "none") {
        if (sortBy === "date") {
        filtered.sort((a, b) => {
            const diff = new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
            return sortOrder === "asc" ? diff : -diff;
        });
        } else if (sortBy === "value") {
          filtered.sort((a, b) => sortOrder === "asc" ? a.value - b.value : b.value - a.value);
        }
      }

      return filtered;
    },
    [searchName, searchValue, searchDescCliente, transactionTypeFilter, dateFrom, dateTo, 
     sortBy, sortOrder, searchTerm, minAmount, maxAmount, specificAmount]
  );

  const filteredAndSortedTransactions = useMemo(
    () => applyFiltersAndSorting(allTransactions),
    [allTransactions, applyFiltersAndSorting]
  );

  // ✅ Paginação server-side (sem slice local)
  const displayTransactions = filteredAndSortedTransactions; // Exibir todos os dados da página atual
  
  // 🚀 OTIMIZADO: Totalizadores calculados em uma única passada junto com filteredAndSortedTransactions
  const { debitCount, creditCount, totalDebito, totalCredito } = useMemo(() => {
    let dCount = 0, cCount = 0, dTotal = 0, cTotal = 0;
    const len = filteredAndSortedTransactions.length;
    for (let i = 0; i < len; i++) {
      const t = filteredAndSortedTransactions[i];
      if (t.type === 'DÉBITO') {
        dCount++;
        dTotal += t.value;
      } else {
        cCount++;
        cTotal += t.value;
      }
    }
    return { debitCount: dCount, creditCount: cCount, totalDebito: dTotal, totalCredito: cTotal };
  }, [filteredAndSortedTransactions]);
  
const totalPagesAvailable = pagination.total_pages || 1;
const showingFrom = pagination.total === 0 ? 0 : pagination.offset + 1;
const showingTo = pagination.offset + filteredAndSortedTransactions.length;
const totalRecords = pagination.total ?? filteredAndSortedTransactions.length;


  // ✅ Carregar transações (com filtros de período)
  // ✅ NOVO: Parâmetro applyFilters indica se deve aplicar filtros na API
  const loadCorpXTransactions = async (
    customDateFrom?: Date,
    customDateTo?: Date,
    page: number = 1,
    limitOverride?: number,
    applyFilters: boolean = false,
    incrementalUpdate: boolean = false // ✅ Novo parâmetro para atualização incremental
  ) => {
    try {
      // ✅ Cancelar requisição anterior (troca rápida de conta/filtros)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError("");
      
      const accountIdParam = selectedAccount.id || 'ALL';
      const isAllAccounts = accountIdParam === 'ALL';
      const sanitizedCnpj = !isAllAccounts && selectedAccount.cnpj ? selectedAccount.cnpj.replace(/\D/g, '') : '';
      
      // ✅ Se for atualização incremental, buscar apenas transações mais recentes que as já em cache
      let dataInicio: string | undefined;
      let dataFim: string | undefined;
      
      if (incrementalUpdate && allTransactions.length > 0) {
        // Encontrar a transação mais recente no cache
        const mostRecentTx = allTransactions.reduce((latest, current) => {
          const latestDate = new Date(latest.dateTime).getTime();
          const currentDate = new Date(current.dateTime).getTime();
          return currentDate > latestDate ? current : latest;
        });
        
        // Buscar apenas transações mais recentes que a mais recente do cache
        // Usar data/hora completa para garantir precisão
        const mostRecentDate = new Date(mostRecentTx.dateTime);
        mostRecentDate.setMilliseconds(mostRecentDate.getMilliseconds() + 1); // Adicionar 1ms para evitar duplicatas
        dataInicio = mostRecentDate.toISOString().split('T')[0];
        // Não definir dataFim para buscar até o momento atual
        
        console.log('[CORPX-UPDATE] Atualização incremental: buscando transações após', mostRecentDate.toISOString());
      } else {
        // ✅ Se applyFilters é true, usar filtros selecionados; caso contrário, usar datas customizadas ou nenhuma
        if (applyFilters) {
          // Aplicar filtros: usar datas dos filtros se existirem
          if (dateFrom && dateTo) {
            dataInicio = dateFrom.toISOString().split('T')[0];
            dataFim = dateTo.toISOString().split('T')[0];
          }
        } else {
          // Não aplicar filtros: usar datas customizadas ou nenhuma
          if (customDateFrom && customDateTo) {
            dataInicio = customDateFrom.toISOString().split('T')[0];
            dataFim = customDateTo.toISOString().split('T')[0];
          }
        }
      }

      // ✅ Limite máximo conforme especificação: 2000 registros por requisição
      const requestedLimit = limitOverride ?? recordsPerPage;
      const limit = Math.min(requestedLimit, 2000); // Máximo da API conforme GUIA-FRONTEND-TRANSACOES.md
      const offset = (page - 1) * limit;

      // ✅ Aplicar filtros na API apenas se applyFilters for true
      const baseFilters = applyFilters ? buildQueryFilters() : {};

      // ✅ CORRIGIDO: Sempre usar accountId (como na tela TCR)
      // Não usar beneficiaryDocument pois pode trazer dados inconsistentes
      const baseQueryParams: Record<string, any> = {
        limit,
        offset,
        ...baseFilters,
      };

      // ✅ Adicionar accountId: 'ALL' para todas as contas, ou apiAccountId numérico para conta específica
      if (isAllAccounts) {
        baseQueryParams.accountId = 'ALL';
      } else if (selectedAccount.apiAccountId) {
        // ✅ Usar apiAccountId (corresponde ao campo `id` da tabela corpx_accounts)
        baseQueryParams.accountId = selectedAccount.apiAccountId;
      } else {
        // ✅ Se não tiver apiAccountId, lançar erro (não usar fallback para beneficiaryDocument)
        console.error('[CORPX-EXTRATO] Conta sem apiAccountId:', selectedAccount);
        toast.error('Erro de configuração', {
          description: `Conta ${selectedAccount.razaoSocial} não possui apiAccountId configurado. Verifique a configuração.`,
          duration: 5000
        });
        setError('Conta sem apiAccountId configurado');
        setIsLoading(false);
        return;
      }

      if (dataInicio) {
        baseQueryParams.startDate = dataInicio;
      }
      if (dataFim) {
        baseQueryParams.endDate = dataFim;
      }

      const response = await CorpXService.listarTransacoes(baseQueryParams, { signal: controller.signal });

      if (response?.success) {
        const transactions = Array.isArray(response.data) ? response.data : [];

        const paginationData = response.pagination ?? {};
        const limitFromApi = paginationData.limit && paginationData.limit > 0 ? paginationData.limit : limit;

        // 🚀 OTIMIZADO: Usar array mutável para evitar criação de novos arrays a cada iteração
        let normalizedTransactions = normalizeTransactions(transactions, isAllAccounts, sanitizedCnpj);

        // 🚀 Definir hasMoreFromApi fora do bloco para uso posterior
        let hasMoreFromApi = paginationData.has_more ?? paginationData.hasMore ?? false;

        // 🚀 OTIMIZAÇÃO: Só fazer requisições extras se realmente necessário E se filtros foram aplicados na API
        // Quando filtros estão na API, pode ser necessário buscar mais páginas para preencher o limite
        // Nota: Frontend também filtra, então isso é apenas para otimizar a quantidade de dados da API
        const shouldFetchMore = applyFilters && normalizedTransactions.length < limit;
        
        if (shouldFetchMore) {
          let nextOffset = offset + limitFromApi;
          let guard = 0;
          const maxExtraRequests = 10; // 🚀 Reduzido de 50 para 10 para evitar muitas requisições

          while (normalizedTransactions.length < limit && hasMoreFromApi && guard < maxExtraRequests) {
            const extraResponse = await CorpXService.listarTransacoes(
              {
                ...baseQueryParams,
                offset: nextOffset,
              },
              { signal: controller.signal }
            );

            if (!extraResponse?.success || !Array.isArray(extraResponse.data) || extraResponse.data.length === 0) {
              break;
            }

            const extraNormalized = normalizeTransactions(extraResponse.data, isAllAccounts, sanitizedCnpj);
            if (extraNormalized.length === 0) break;

            // 🚀 Push em vez de spread operator (evita criar novo array)
            const previousLength = normalizedTransactions.length;
            for (let i = 0; i < extraNormalized.length; i++) {
              normalizedTransactions.push(extraNormalized[i]);
            }

            const extraPagination = extraResponse.pagination ?? {};
            hasMoreFromApi = extraPagination.has_more ?? extraPagination.hasMore ?? false;
            const extraLimit = extraPagination.limit && extraPagination.limit > 0 ? extraPagination.limit : limit;
            nextOffset = (extraPagination.offset ?? nextOffset) + extraLimit;
            
            if (normalizedTransactions.length === previousLength) break;
            guard++;
          }
        }

        // 🚀 Limitar ao número solicitado (evita processar mais do que necessário)
        const finalTransactions = normalizedTransactions.length > limit 
          ? normalizedTransactions.slice(0, limit) 
          : normalizedTransactions;

        // ✅ Se for atualização incremental, fazer merge com transações existentes
        if (incrementalUpdate && allTransactions.length > 0) {
          // Criar um Set de IDs existentes para evitar duplicatas
          // Usar código end-to-end ou ID como identificador único
          const existingIds = new Set(allTransactions.map(tx => tx.code || tx.id || String(tx.dateTime) + String(tx.value)));
          
          // Filtrar apenas transações novas (que não existem no cache)
          const newTransactions = finalTransactions.filter(tx => {
            const txId = tx.code || tx.id || String(tx.dateTime) + String(tx.value);
            return !existingIds.has(txId);
          });
          
          if (newTransactions.length > 0) {
            // Fazer merge: novas transações no início (mais recentes) + transações existentes
            const mergedTransactions = [...newTransactions, ...allTransactions];
            
            // Ordenar por data (mais recentes primeiro)
            mergedTransactions.sort((a, b) => {
              const dateA = new Date(a.dateTime).getTime();
              const dateB = new Date(b.dateTime).getTime();
              return dateB - dateA; // Descendente (mais recente primeiro)
            });
            
            setAllTransactions(mergedTransactions);
            
            toast.success(`${newTransactions.length} nova(s) transação(ões) adicionada(s)`, {
              description: `Total: ${mergedTransactions.length} transações em cache`,
              duration: 2000,
            });
          } else {
            toast.info("Nenhuma transação nova encontrada", {
              description: "Todas as transações já estão em cache",
              duration: 2000,
            });
          }
        } else {
          // Modo normal: substituir completamente
          setAllTransactions(finalTransactions);
        }

        const total = paginationData.total ?? (hasMoreFromApi || normalizedTransactions.length > finalTransactions.length ? offset + normalizedTransactions.length : finalTransactions.length);
        const limitUsed = limitFromApi && limitFromApi > 0 ? limitFromApi : limit;
        const offsetUsed = paginationData.offset ?? offset;
        const totalPagesCalculated =
          paginationData.total_pages ?? (limitUsed > 0 ? Math.max(1, Math.ceil(total / limitUsed)) : 1);
        const currentPageValue =
          paginationData.current_page ?? (limitUsed > 0 ? Math.floor(offsetUsed / limitUsed) + 1 : 1);
        const hasMore = (paginationData.has_more ?? paginationData.hasMore ?? offsetUsed + limitUsed < total) || (normalizedTransactions.length > finalTransactions.length);

        setPagination({
          total,
          limit: limitUsed,
          offset: offsetUsed,
          has_more: hasMore,
          current_page: currentPageValue,
          total_pages: totalPagesCalculated,
        });
        setCurrentPage(currentPageValue);
        
        // ✅ Atualizar estado de filtros aplicados na API
        // Nota: Frontend sempre filtra também (lógica híbrida como TCR)
        setFiltersAppliedToAPI(applyFilters);

        toast.success(`Página ${currentPageValue}: ${finalTransactions.length} transações`, {
          description: applyFilters 
            ? (isAllAccounts ? "Extrato consolidado CORPX carregado com filtros" : "Extrato CORPX carregado com filtros")
            : (isAllAccounts ? "Extrato consolidado CORPX carregado" : "Extrato CORPX carregado"),
          duration: 1500,
        });
      } else {
        setAllTransactions([]);
        setPagination({
          total: 0,
          limit,
          offset: 0,
          has_more: false,
          current_page: 1,
          total_pages: 1,
        });
        toast.info("Nenhuma transação encontrada", {
          description: "Tente ajustar os filtros",
          duration: 3000,
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('[CORPX-EXTRATO-UI] ❌ Erro:', err);
      setError(err.message || 'Erro ao carregar extrato');
      setAllTransactions([]);
      toast.error("Erro ao carregar extrato", {
        description: err.message || "Tente novamente em alguns instantes",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const handleSyncDialogChange = (open: boolean) => {
    setIsSyncDialogOpen(open);
    if (open) {
      const fallback = getDefaultDates();
      setSyncStartDate(dateFrom ?? fallback.dateFrom);
      setSyncEndDate(dateTo ?? fallback.dateTo);
    }
  };

  // ✅ Refatorado conforme especificação do backend (GUIA-FRONTEND-TRANSACOES.md)
  const buildQueryFilters = React.useCallback(() => {
    const filters: Record<string, any> = {};

    // 1. Tipo de transação
    if (transactionTypeFilter === 'debito') {
      filters.transactionType = 'D';
    } else if (transactionTypeFilter === 'credito') {
      filters.transactionType = 'C';
    }

    // 2. Ordenação
    if (sortBy === 'date') {
      filters.order = sortOrder === 'asc' ? 'asc' : 'desc';
    } else if (sortBy === 'value') {
      filters.order = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      filters.order = 'desc'; // Padrão
    }

    // 3. ✅ FILTROS DE VALOR (conforme especificação)
    // Prioridade: exactAmount ignora minAmount e maxAmount
    // Aceita valores negativos em todos os filtros de valor
    
    if (specificAmount && specificAmount.trim() !== '') {
      // Remover espaços e garantir que o valor seja válido
      const cleanedValue = specificAmount.trim().replace(/\s/g, '');
      const specificValue = parseFloat(cleanedValue);
      
      // ✅ Aceita valores negativos e positivos (útil para buscar débitos específicos)
      // Verificar se é um número válido (não NaN) e diferente de zero
      if (!isNaN(specificValue) && specificValue !== 0) {
        filters.exactAmount = specificValue;
      }
    } else {
      // Só adicionar minAmount e maxAmount se exactAmount não foi informado
      if (minAmount && minAmount.trim() !== '') {
        const minValue = parseFloat(minAmount);
        // ✅ Aceita valores negativos
        if (!isNaN(minValue)) {
          filters.minAmount = minValue;
        }
      }
      
      if (maxAmount && maxAmount.trim() !== '') {
        const maxValue = parseFloat(maxAmount);
        // ✅ Aceita valores negativos
        if (!isNaN(maxValue)) {
          filters.maxAmount = maxValue;
        }
      }
    }

    // 4. ✅ FILTROS DE BUSCA (conforme especificação)
    // Prioridade: endToEnd ignora search
    
    const searchTermTrimmed = searchTerm?.trim() || '';
    
    // Detectar se é um endToEnd (formato: E seguido de números, mínimo 20 caracteres)
    const isEndToEndPattern = /^E\d{20,}/.test(searchTermTrimmed);
    
    if (isEndToEndPattern && searchTermTrimmed.length >= 20) {
      // ✅ Prioridade: endToEnd ignora search (conforme especificação)
      filters.endToEnd = searchTermTrimmed;
    } else if (searchTermTrimmed) {
      // Busca textual normal (só funciona se endToEnd não estiver informado)
      filters.search = searchTermTrimmed;
    } else {
      // Se não há searchTerm, verificar outros campos de busca
      // Combinar searchName e searchDescCliente em uma única busca textual
      const searchParts: string[] = [];
      
      if (searchName && searchName.trim() !== '') {
        searchParts.push(searchName.trim());
      }
      
      if (searchDescCliente && searchDescCliente.trim() !== '') {
        searchParts.push(searchDescCliente.trim());
      }
      
      if (searchParts.length > 0) {
        filters.search = searchParts.join(' ');
      }
    }

    return filters;
  }, [transactionTypeFilter, sortBy, sortOrder, specificAmount, minAmount, maxAmount, searchTerm, searchName, searchDescCliente]);

  const fetchAllTransactionsMatchingFilters = React.useCallback(async () => {
    const accountIdParam = selectedAccount.id || 'ALL';
    const isAllAccounts = accountIdParam === 'ALL';
    const sanitizedCnpj = !isAllAccounts && selectedAccount.cnpj ? selectedAccount.cnpj.replace(/\D/g, '') : '';

    let dataInicio: string | undefined;
    let dataFim: string | undefined;

    if (dateFrom && dateTo) {
      dataInicio = dateFrom.toISOString().split('T')[0];
      dataFim = dateTo.toISOString().split('T')[0];
    }

    const baseFilters = buildQueryFilters();
    const limitPerRequest = 1000;
    let offset = 0;
    let guard = 0;
    const maxIterations = 200;
    let hasMore = true;
    let aggregated: any[] = [];

    while (hasMore && guard < maxIterations) {
      const params: Record<string, any> = {
        limit: limitPerRequest,
        offset,
        ...baseFilters,
      };

      // ✅ Adicionar accountId: 'ALL' para todas as contas, ou apiAccountId numérico para conta específica
      if (isAllAccounts) {
        params.accountId = 'ALL';
      } else if (selectedAccount.apiAccountId) {
        params.accountId = selectedAccount.apiAccountId;
      }

      if (dataInicio) {
        params.startDate = dataInicio;
      }
      if (dataFim) {
        params.endDate = dataFim;
      }

      const response = await CorpXService.listarTransacoes(params);

      if (!response?.success || !Array.isArray(response.data) || response.data.length === 0) {
        break;
      }

      const normalized = normalizeTransactions(response.data, isAllAccounts, sanitizedCnpj);
      // 🚀 OTIMIZADO: Push em vez de spread (evita criar novo array)
      for (let i = 0; i < normalized.length; i++) {
        aggregated.push(normalized[i]);
      }

      const paginationData = response.pagination ?? {};
      const limitUsed = paginationData.limit && paginationData.limit > 0 ? paginationData.limit : limitPerRequest;
      const nextOffset = (paginationData.offset ?? offset) + limitUsed;
      offset = nextOffset;
      hasMore = paginationData.has_more ?? paginationData.hasMore ?? false;
      guard += 1;
    }

    return applyFiltersAndSorting(aggregated);
  }, [selectedAccount.id, selectedAccount.cnpj, selectedAccount.apiAccountId, dateFrom, dateTo, buildQueryFilters, normalizeTransactions, applyFiltersAndSorting]);

  const handleSyncExtrato = async () => {
    if (selectedAccount.id === 'ALL') {
      toast.error('Selecione uma conta específica para sincronizar.');
      return;
    }

    if (!selectedAccount.available) {
      toast.error('Conta indisponível para sincronização no momento.');
      return;
    }

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

      const taxDocument = selectedAccount.cnpj.replace(/\D/g, '');
      const startDate = syncStartDate.toISOString().split('T')[0];
      const endDate = syncEndDate.toISOString().split('T')[0];

      const response = await CorpXService.sincronizarExtrato({
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
      setFiltersAppliedToAPI(false); // Após sincronizar, não aplicar filtros automaticamente
      await loadCorpXTransactions(syncStartDate || undefined, syncEndDate || undefined, 1, undefined, false);
    } catch (error: any) {
      const description = error?.message || 'Tente novamente em alguns instantes.';
      toast.error('Erro ao sincronizar extrato', { description });
    } finally {
      setIsSyncing(false);
    }
  };

  // 🚀 Navegação de página server-side
  const handlePageChange = async (newPage: number) => {
    const totalPagesAvailable = pagination.total_pages || 1;
    if (newPage < 1 || newPage > totalPagesAvailable) {
      return;
    }

    setCurrentPage(newPage);
    // ✅ Manter o estado de filtros aplicados ao navegar entre páginas
    await loadCorpXTransactions(undefined, undefined, newPage, undefined, filtersAppliedToAPI);
  };

  // ✅ Aplicar filtros - LÓGICA HÍBRIDA (como TCR):
  // 1. Frontend sempre filtra (feedback imediato)
  // 2. Quando clica em "Aplicar Filtros", também envia para API (reduz dados)
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
    
    // ✅ Chamar API com filtros aplicados (applyFilters = true)
    // Frontend continuará filtrando também (lógica híbrida)
    loadCorpXTransactions(undefined, undefined, 1, undefined, true);
    
    toast.success("Filtros aplicados!", {
      description: "Carregando transações com os filtros selecionados",
      duration: 2000
    });
  };

  // ✅ Limpar filtros - voltar ao carregamento sem filtros
  const handleLimparFiltros = () => {
    setDateFrom(null);
    setDateTo(null);
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSpecificAmount("");
    setTransactionTypeFilter("todos");
    setSortBy("date");
    setSortOrder("desc");
    setCurrentPage(1);
    setFiltersAppliedToAPI(false);
    // ✅ Carregar sem filtros (applyFilters = false)
    // Frontend não terá filtros para aplicar também
    loadCorpXTransactions(undefined, undefined, 1, recordsPerPage, false);
    toast.success("Filtros limpos!", {
      description: "Exibindo as últimas transações disponíveis",
      duration: 2000
    });
  };

  // 🆕 Funções para modo seleção em lote
  const toggleBulkMode = () => {
    const newBulkMode = !bulkMode;
    setBulkMode(newBulkMode);
    
    if (!newBulkMode) {
      clearSelection();
    } else {
      toast.info('Modo seleção ativado - clique nas transações para selecioná-las');
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
      .filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t))
      .map(t => t.id.toString());
    
    setSelectedTransactions(new Set(creditTransactions));
    toast.success(`${creditTransactions.length} transações selecionadas`);
  };

  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const handleBulkCredit = () => {
    if (selectedTransactions.size === 0) {
      toast.error('Selecione pelo menos uma transação');
      return;
    }
    
    setBulkOTCModalOpen(true);
  };
    
  const handleCloseBulkOTCModal = (wasSuccessful?: boolean, successfulIds?: string[]) => {
    if (wasSuccessful && successfulIds && successfulIds.length > 0) {
      // Marcar todas as transações creditadas com sucesso
      setCreditedRecords(prev => {
        const newSet = new Set(prev);
        successfulIds.forEach(id => newSet.add(`corpx-${id}`));
        return newSet;
      });
    
      // Limpar seleção
      clearSelection();
    }
    
    setBulkOTCModalOpen(false);
  };

  // Obter transações selecionadas
  const getSelectedTransactionsData = () => {
    return filteredAndSortedTransactions.filter(t => selectedTransactions.has(t.id.toString()));
  };

  // 🚀 OTIMIZADO: Memoizar instância de NumberFormat (caro de criar)
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }), []);
  
  const formatCurrency = React.useCallback((value: number) => {
    return currencyFormatter.format(Math.abs(value));
  }, [currencyFormatter]);

  // 🚀 OTIMIZADO: Mover statusConfig para useMemo (evita recriação a cada render)
  const statusConfig = useMemo(() => ({
    'SUCCESS': { label: 'Sucesso', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' },
    'PENDING': { label: 'Pendente', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'PROCESSING': { label: 'Processando', variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    'FAILED': { label: 'Falhou', variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' },
    'ERROR': { label: 'Erro', variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' },
    'CANCELLED': { label: 'Cancelado', variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' },
    'UNKNOWN': { label: 'Desconhecido', variant: 'outline' as const, className: 'bg-gray-100 text-gray-600 border-gray-200' }
  }), []);

  // ✅ Formatar status da transação com badge colorido
  const formatStatus = React.useCallback((status: string | undefined | null): JSX.Element | null => {
    if (!status) return null;
    
    const statusUpper = String(status).toUpperCase();
    const config = statusConfig[statusUpper as keyof typeof statusConfig] || statusConfig['UNKNOWN'];
    
    return (
      <Badge 
        variant={config.variant}
        className={`text-xs font-medium ${config.className}`}
      >
        {config.label}
      </Badge>
    );
  }, [statusConfig]);

  // 🆕 Função para gerar PDF do depósito encontrado
  const generateDepositoPDF = (depositoInfo: any) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      const request = depositoInfo?.transacao;
      if (!request) {
        toast.error('Dados do depósito não encontrados');
        return;
      }

      // Cabeçalho
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 140, 0); // Laranja
      pdf.text('COMPROVANTE DE DEPÓSITO PIX', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Linha separadora
      pdf.setDrawColor(255, 140, 0);
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
      pdf.text(`ID: ${request.id || '-'}`, margin, yPosition);
      pdf.text(`Status: ${request.status?.toUpperCase() || '-'}`, margin + 90, yPosition);
      yPosition += 6;

      pdf.text(`End-to-End: ${request.endToEndId || '-'}`, margin, yPosition);
      yPosition += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(255, 140, 0); // Laranja
      const valor = (request.amount || 0) / 100; // Converter centavos para reais
      pdf.text(`Valor: ${formatCurrency(valor)}`, margin, yPosition);
      yPosition += 10;

      // Dados do Pagador
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('DADOS DO PAGADOR', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${request.senderName || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`CPF/CNPJ: ${request.senderTaxId || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Banco: ${request.senderBankCode || '-'}`, margin, yPosition);
      pdf.text(`Agência: ${request.senderBranchCode || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Conta: ${request.senderAccountNumber || '-'}`, margin, yPosition);
      pdf.text(`Tipo: ${request.senderAccountType || '-'}`, margin + 60, yPosition);
      yPosition += 10;

      // Dados do Beneficiário
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('DADOS DO BENEFICIÁRIO', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Nome: ${request.receiverName || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`CPF/CNPJ: ${request.receiverTaxId || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Banco: ${request.receiverBankCode || '-'}`, margin, yPosition);
      pdf.text(`Agência: ${request.receiverBranchCode || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Conta: ${request.receiverAccountNumber || '-'}`, margin, yPosition);
      pdf.text(`Tipo: ${request.receiverAccountType || '-'}`, margin + 60, yPosition);
      yPosition += 10;

      // Identificadores
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('IDENTIFICADORES', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`End-to-End: ${request.endToEndId || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Reconciliation ID: ${request.reconciliationId || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Método: ${request.method || '-'}`, margin, yPosition);
      pdf.text(`Prioridade: ${request.priority || '-'}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Fluxo: ${request.flow || '-'}`, margin, yPosition);
      yPosition += 10;

      // Informações Adicionais
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('INFORMAÇÕES ADICIONAIS', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Descrição: ${request.description || '-'}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Taxa: ${formatCurrency((request.fee || 0) / 100)}`, margin, yPosition);
      pdf.text(`Valor em Dinheiro: ${formatCurrency((request.cashAmount || 0) / 100)}`, margin + 60, yPosition);
      yPosition += 6;
      pdf.text(`Criado em: ${request.created ? new Date(request.created).toLocaleString('pt-BR') : '-'}`, margin, yPosition);
      pdf.text(`Atualizado em: ${request.updated ? new Date(request.updated).toLocaleString('pt-BR') : '-'}`, margin + 60, yPosition);

      // Rodapé
      yPosition = pdf.internal.pageSize.getHeight() - 20;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });

      // Salvar PDF
      const fileName = `comprovante-deposito-corpx-${request.endToEndId || Date.now()}.pdf`;
      pdf.save(fileName);

      toast.success('PDF gerado com sucesso!', {
        description: fileName,
        duration: 3000
      });
    } catch (error) {
      console.error('[CORPX-PDF-DEPOSITO] Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF', {
        description: 'Não foi possível gerar o comprovante',
        duration: 4000
      });
    }
  };

  // ✅ Exportar comprovante em PDF (apenas informações relevantes para cliente)
  const exportComprovantePDF = (transaction: any) => {
    if (!transaction) {
      toast.error("Erro: Transação não encontrada");
      return;
    }

    try {
      // Obter dados do rawExtrato para informações completas de Payer e Beneficiary
      const rawExtrato = transaction.rawExtrato || transaction._original?.rawExtrato || null;
      const rawPayer = rawExtrato?.payer || rawExtrato?.pagador;
      const rawBeneficiary = rawExtrato?.beneficiary || rawExtrato?.beneficiario;
      
      // Obter nome da conta beneficiária se disponível
      const beneficiaryDocDigits = (transaction.beneficiaryDocument || transaction.document || '').replace(/\D/g, '');
      const beneficiaryName = accountNameByDocument[beneficiaryDocDigits];
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Configurar fonte
      pdf.setFont('helvetica');

      // === CABEÇALHO ===
      pdf.setFontSize(24);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COMPROVANTE DE TRANSAÇÃO', pageWidth / 2, yPosition + 10, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont('helvetica', 'normal');
      pdf.text('CORPX Banking', pageWidth / 2, yPosition + 18, { align: 'center' });
      
      // Linha divisória
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition + 25, pageWidth - margin, yPosition + 25);
      yPosition += 35;

      // === INFORMAÇÕES DA TRANSAÇÃO ===
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DADOS DA TRANSAÇÃO', margin, yPosition);
      yPosition += 10;

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Configurar fonte para conteúdo
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);

      // Data/Hora
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data/Hora:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDate(transaction.dateTime), margin + 40, yPosition);
      yPosition += 8;

      // Valor
      pdf.setFont('helvetica', 'bold');
      pdf.text('Valor:', margin, yPosition);
      pdf.setFont('helvetica', 'bold');
      // Cor: vermelho para débito (220, 53, 69), verde para crédito (34, 197, 94)
      if (transaction.type === 'DÉBITO') {
        pdf.setTextColor(220, 53, 69);
      } else {
        pdf.setTextColor(34, 197, 94);
      }
      pdf.text(
        `${transaction.type === 'DÉBITO' ? "-" : "+"}${formatCurrency(transaction.value)}`,
        margin + 40,
        yPosition
      );
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;

      // Tipo
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tipo:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(transaction.type, margin + 40, yPosition);
      yPosition += 8;

      // Código End-to-End
      if (transaction.code) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Código End-to-End:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(transaction.code, margin + 50, yPosition);
        pdf.setFontSize(11);
        yPosition += 8;
      }

      yPosition += 8;

      // === INFORMAÇÕES DAS PARTES ENVOLVIDAS ===
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INFORMAÇÕES DAS PARTES', margin, yPosition);
      yPosition += 10;

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');

      // === PAGADOR (Payer) - Sempre mostrar quando disponível ===
      if (rawPayer) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('PAGADOR', margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        // Nome do Pagador
        const payerName = rawPayer.fullName || rawPayer.nome || transaction.client || 'Não informado';
        pdf.setFont('helvetica', 'bold');
        pdf.text('Nome:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(payerName, margin + 30, yPosition);
        yPosition += 8;
        
        // Documento do Pagador
        if (rawPayer.document) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(rawPayer.document), margin + 40, yPosition);
          yPosition += 8;
        } else if (transaction.payerDocument) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(transaction.payerDocument), margin + 40, yPosition);
          yPosition += 8;
        }
        
        // Agência e Conta (se disponível)
        if (rawPayer.agency || rawPayer.account) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Conta:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          const accountInfo = `Ag. ${rawPayer.agency || '—'} • Conta ${rawPayer.account || '—'}`;
          pdf.text(accountInfo, margin + 35, yPosition);
          yPosition += 8;
        }
        
        yPosition += 5;
      }

      // === BENEFICIÁRIO (Beneficiary) - Sempre mostrar quando disponível ===
      if (rawBeneficiary) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('BENEFICIÁRIO', margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        // Nome do Beneficiário
        const beneficiaryFullName = rawBeneficiary.fullName || rawBeneficiary.nome || transaction.client || beneficiaryName || 'Não informado';
        pdf.setFont('helvetica', 'bold');
        pdf.text('Nome:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(beneficiaryFullName, margin + 30, yPosition);
        yPosition += 8;
        
        // Documento do Beneficiário
        if (rawBeneficiary.document) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(rawBeneficiary.document), margin + 40, yPosition);
          yPosition += 8;
        } else if (transaction.beneficiaryDocument) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(transaction.beneficiaryDocument), margin + 40, yPosition);
          yPosition += 8;
        } else if (transaction.document && transaction.type === 'CRÉDITO') {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(transaction.document), margin + 40, yPosition);
          yPosition += 8;
        }
        
        // Nome da conta se disponível (apenas para créditos)
        if (transaction.type === 'CRÉDITO' && beneficiaryName) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Conta: ${beneficiaryName}`, margin, yPosition);
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          yPosition += 6;
        }
        
        yPosition += 5;
      }

      // Se não tiver rawExtrato, usar dados básicos da transação
      if (!rawPayer && !rawBeneficiary) {
        // Determinar qual parte mostrar baseado no tipo de transação
        const sectionTitle = transaction.type === 'CRÉDITO' ? 'BENEFICIÁRIO' : 'PAGADOR';
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text(sectionTitle, margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        // Nome do Cliente
        pdf.setFont('helvetica', 'bold');
        pdf.text('Nome:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        const clientName = transaction.client || 'Não informado';
        pdf.text(clientName, margin + 30, yPosition);
        yPosition += 8;

        // Documento
        if (transaction.document) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Documento:', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(formatDocument(transaction.document), margin + 40, yPosition);
          yPosition += 8;
        }
        
        // Nome da conta beneficiária (apenas para créditos)
        if (transaction.type === 'CRÉDITO' && beneficiaryName) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Conta: ${beneficiaryName}`, margin, yPosition);
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          yPosition += 6;
        }
      }

      // Descrição
      if (transaction.descCliente) {
        yPosition += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Descrição:', margin, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        
        // Quebrar descrição em múltiplas linhas se necessário
        const maxWidth = pageWidth - (margin * 2);
        const descLines = pdf.splitTextToSize(transaction.descCliente, maxWidth);
        pdf.text(descLines, margin, yPosition);
        yPosition += (descLines.length * 5);
        pdf.setFontSize(11);
      }

      // === RODAPÉ ===
      yPosition = pageHeight - 30;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'italic');
      pdf.text(
        'Este é um comprovante gerado automaticamente pelo sistema CORPX Banking.',
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );
      yPosition += 5;
      pdf.text(
        `Documento gerado em: ${new Date().toLocaleString('pt-BR')}`,
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );

      // Nome do arquivo (sanitizar para evitar caracteres inválidos)
      const date = new Date(transaction.dateTime);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const codeStr = (transaction.code || transaction.id || 'sem-codigo').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `comprovante_corpx_${dateStr}_${timeStr}_${codeStr}.pdf`;

      // Salvar PDF
      pdf.save(fileName);

      toast.success("Comprovante exportado com sucesso!", {
        description: `Arquivo: ${fileName}`,
        duration: 3000,
      });
    } catch (error: any) {
      console.error('[CORPX-PDF] Erro ao gerar comprovante:', error);
      toast.error("Erro ao gerar comprovante", {
        description: error.message || "Tente novamente",
        duration: 4000,
      });
    }
  };

  // ✅ Formatar data (dados já processados do backend)
  const formatDate = (dateString: string) => {
    if (!dateString) return "Data inválida";
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        //console.warn('[CORPX-UI] Data inválida:', dateString);
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
      //console.warn('[CORPX-UI] Erro ao formatar data:', dateString, error);
      return dateString;
    }
  };

  // ✅ Função para exportar CSV
  const exportToCSV = async () => {
    try {
      setIsExporting(true);

      const allTransactionsForExport = await fetchAllTransactionsMatchingFilters();

      if (!allTransactionsForExport.length) {
        toast.info('Nenhuma transação para exportar', {
          description: 'Aplique filtros diferentes e tente novamente.',
          duration: 2500,
        });
        return;
      }

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

      const csvData = allTransactionsForExport.map(transaction => [
        formatDate(transaction.dateTime),
        `${transaction.type === 'DÉBITO' ? '-' : '+'}${formatCurrency(transaction.value)}`,
        transaction.type,
        transaction.client || '',
        transaction.document || '',
        transaction.descCliente || '',
        transaction.code || '',
        'CORPX'
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(field => 
            typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))
              ? `"${field.replace(/"/g, '""')}"` 
              : field
          ).join(',')
        )
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `extrato_corpx_${dataAtual}.csv`;
      
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

      toast.success('CSV exportado com sucesso!', {
        description: `${allTransactionsForExport.length} registros exportados para ${nomeArquivo}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('[CORPX-CSV] Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV', {
        description: 'Não foi possível gerar o arquivo de exportação',
        duration: 4000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ✅ Funções para OTC
  const isRecordCredited = (transaction: any): boolean => {
    const recordKey = `corpx-${transaction.id}`;
    return creditedRecords.has(recordKey);
  };

  // ✅ Função para detectar se é transferência interna
  const isTransferenciaInterna = (transaction: any): boolean => {
    const description = (transaction.descCliente || 
                        transaction.description || 
                        transaction._original?.description ||
                        transaction._original?.rawExtrato?.descricao ||
                        '').toUpperCase();
    
    // Verificar se a descrição indica transferência interna
    const isTransferenciaEntreContas = description.includes('TRANSF.ENTRE CTAS') ||
                                       description.includes('TRANSF ENTRE CTAS') ||
                                       description.includes('TRANSFERÊNCIA ENTRE CONTAS') ||
                                       description.includes('TRANSFERENCIA ENTRE CONTAS');
    
    // Verificar se não tem endToEnd válido (transferências internas podem ter endToEnd vazio ou hash interno)
    const endtoend = transaction.code || 
                     transaction._original?.endToEnd || 
                     transaction._original?.idEndToEnd ||
                     transaction._original?.endToEndId ||
                     '';
    
    // Se não tem endToEnd ou endToEnd está vazio, e a descrição indica transferência interna
    if (isTransferenciaEntreContas && (!endtoend || endtoend.length === 0)) {
      return true;
    }
    
    // Também verificar pelo pixType null e rawWebhook null (indicadores de transferência interna)
    const pixType = transaction._original?.pixType;
    const rawWebhook = transaction._original?.rawWebhook;
    
    if (isTransferenciaEntreContas && !pixType && !rawWebhook) {
      return true;
    }
    
    return false;
  };

  const handleCreditToOTC = async (transaction: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que abra o modal de detalhes
    
    // Verificar se já foi creditado antes de abrir modal
    if (isRecordCredited(transaction)) {
      toast.error('Registro já creditado', {
        description: 'Este registro do extrato já foi creditado para um cliente OTC'
      });
      return;
    }

    // ✅ Verificar se é transferência interna - se for, permitir operação sem verificação na API
    const isInterna = isTransferenciaInterna(transaction);
    
    if (isInterna) {
      // Transferência interna: permitir operação diretamente sem verificação na API
      toast.success('Transferência interna detectada', {
        description: 'Operação autorizada para transferências entre contas',
        duration: 2000
      });
      
      setSelectedExtractRecord(transaction);
      setCreditOTCModalOpen(true);
      return;
    }

    // Extrair endtoend da transação (apenas para transações não-internas)
    const endtoend = transaction.code || 
                     transaction._original?.endToEnd || 
                     transaction._original?.idEndToEnd ||
                     transaction._original?.endToEndId ||
                     '';

    if (!endtoend || endtoend.length < 10) {
      toast.error('EndToEnd não encontrado', {
        description: 'Não foi possível identificar o código EndToEnd desta transação'
      });
      return;
    }

    // Obter tax_document da conta selecionada ou do beneficiário da transação
    let taxDocument = selectedAccount.cnpj;

    // ✅ Se "todas contas" estiver selecionada, usar o documento do beneficiário da transação
    if (!taxDocument || taxDocument === 'ALL') {
      // Extrair documento do beneficiário da transação
      taxDocument = transaction.beneficiaryDocument || 
                    transaction._original?.beneficiaryDocument ||
                    transaction._original?.beneficiary_document ||
                    transaction._original?.creditorDocument ||
                    transaction._original?.documentoBeneficiario ||
                    '';
      
      if (!taxDocument) {
        toast.error('Documento não encontrado', {
          description: 'Não foi possível identificar o documento do beneficiário desta transação. Selecione uma conta específica ou verifique os dados da transação.'
        });
        return;
      }
    }

    // ✅ Limpar formatação do tax_document (remover pontos, barras, hífens)
    const taxDocumentLimpo = taxDocument.replace(/\D/g, '');

    if (!taxDocumentLimpo || taxDocumentLimpo.length < 11) {
      toast.error('Documento inválido', {
        description: `Documento "${taxDocument}" é inválido. Deve ter pelo menos 11 dígitos (CPF) ou 14 dígitos (CNPJ).`
      });
      return;
    }

    // Marcar que está verificando esta transação
    setIsVerifyingTransaction(transaction.id);

    try {
      // 🔍 Verificar transação na API antes de permitir operação
      toast.loading('Verificando transação...', { id: 'verify-transaction' });
      
      const resultado = await consultarTransacaoPorEndToEnd(taxDocumentLimpo, endtoend);
      
      toast.dismiss('verify-transaction');

      if (!resultado.sucesso) {
        toast.error('Erro na verificação', {
          description: resultado.mensagem,
          duration: 5000
        });
        return;
      }

      if (!resultado.permiteOperacao) {
        toast.error('Operação não permitida', {
          description: resultado.mensagem,
          duration: 6000
        });
        return;
      }

      // ✅ Transação verificada com sucesso - mostrar feedback positivo
      toast.success('Transação verificada!', {
        description: `Status: ${resultado.status?.toUpperCase()} - Operação autorizada`,
        duration: 3000
      });

      // Abrir modal para creditar
      setSelectedExtractRecord(transaction);
      setCreditOTCModalOpen(true);

    } catch (error: any) {
      toast.dismiss('verify-transaction');
      toast.error('Erro ao verificar transação', {
        description: error.message || 'Tente novamente',
        duration: 5000
      });
    } finally {
      setIsVerifyingTransaction(null);
    }
  };

  // 🆕 Função para buscar depósito por EndToEnd
  const handleBuscarDeposito = async () => {
    if (!buscarEndToEnd || buscarEndToEnd.trim().length < 10) {
      toast.error('EndToEnd inválido', {
        description: 'Digite um código EndToEnd válido (mínimo 10 caracteres)'
      });
      return;
    }

    const endtoend = buscarEndToEnd.trim();
    
    // Obter tax_document da conta selecionada
    let taxDocument = selectedAccount.cnpj;

    // ✅ Se "todas contas" estiver selecionada, mostrar erro pedindo para selecionar uma conta
    if (!taxDocument || taxDocument === 'ALL') {
      toast.error('Selecione uma conta', {
        description: 'Para buscar depósito, é necessário selecionar uma conta específica',
        duration: 5000
      });
      return;
    }

    // ✅ Limpar formatação do tax_document (remover pontos, barras, hífens)
    const taxDocumentLimpo = taxDocument.replace(/\D/g, '');

    if (!taxDocumentLimpo || taxDocumentLimpo.length < 11) {
      toast.error('Documento inválido', {
        description: `Documento "${taxDocument}" é inválido. Deve ter pelo menos 11 dígitos (CPF) ou 14 dígitos (CNPJ).`
      });
      return;
    }

    setIsBuscandoDeposito(true);

    try {
      toast.loading('Buscando depósito...', { id: 'buscar-deposito-corpx' });
      
      const resultado = await consultarTransacaoPorEndToEnd(taxDocumentLimpo, endtoend);
      
      toast.dismiss('buscar-deposito-corpx');

      // ✅ Sempre abrir modal, mesmo em caso de erro
      setDepositoData(resultado);
      setDepositoModalOpen(true);

      // Mostrar toast informativo baseado no resultado
      if (!resultado.sucesso) {
        toast.error('Depósito não encontrado', {
          description: resultado.mensagem || 'Não foi possível encontrar o depósito com este EndToEnd',
          duration: 5000
        });
      } else if (!resultado.permiteOperacao) {
        toast.warning('Depósito encontrado, mas operação não permitida', {
          description: resultado.mensagem,
          duration: 6000
        });
      } else {
        toast.success('Depósito encontrado!', {
          description: 'Você pode realizar ações neste depósito',
          duration: 3000
        });
        // Limpar campo apenas após busca bem-sucedida
        setBuscarEndToEnd("");
      }

    } catch (error: any) {
      toast.dismiss('buscar-deposito-corpx');
      toast.error('Erro ao buscar depósito', {
        description: error.message || 'Tente novamente',
        duration: 5000
      });
    } finally {
      setIsBuscandoDeposito(false);
    }
  };

  // 🆕 Função auxiliar para abrir modal de crédito OTC diretamente (quando já temos dados verificados)
  const abrirModalCreditOTC = (transaction: any) => {
    // Verificar se já foi creditado antes de abrir modal
    if (isRecordCredited(transaction)) {
      toast.error('Registro já creditado', {
        description: 'Este registro do extrato já foi creditado para um cliente OTC'
      });
      return;
    }
    
    // Abrir modal de crédito OTC diretamente
    setSelectedExtractRecord(transaction);
    setCreditOTCModalOpen(true);
  };

  const handleCloseCreditOTCModal = (wasSuccessful?: boolean) => {
    // Se operação foi realizada com sucesso, marcar como creditado
    if (wasSuccessful && selectedExtractRecord) {
      const recordKey = `corpx-${selectedExtractRecord.id}`;
      setCreditedRecords(prev => new Set(prev).add(recordKey));
    }
    
    setCreditOTCModalOpen(false);
    setSelectedExtractRecord(null);
  };

  const matchesSelectedAccount = React.useCallback((data: CorpXTransactionPayload['data']) => {
    // 🚨 FILTRAR DEPÓSITOS DA TCR - Não mostrar transações onde beneficiário é TCR (53.781.325/0001-15)
    // Este modal é referente ao OTC, então depósitos da TCR não devem aparecer
    // O payload de tempo real pode não ter beneficiaryDocument diretamente, então verificamos pelo taxDocument da conta
    // TCR tem conta CorpX com taxDocument = 53781325000115
    const tcrDocumentNormalized = '53781325000115'; // Documento da TCR sem formatação
    
    // Verificar se a transação é para a conta da TCR
    const payloadDocDigits = data.taxDocument?.replace(/\D/g, '') || '';
    if (payloadDocDigits === tcrDocumentNormalized) {
      // Se for depósito (C) para a conta da TCR, rejeitar
      if (data.transactionType === 'C') {
        return false;
      }
    }
    
    // Verificar também se há beneficiaryDocument no payload (pode estar em campos extras)
    const beneficiaryDoc = (data as any).beneficiaryDocument || (data as any).beneficiary_document || '';
    if (beneficiaryDoc) {
      const beneficiaryDocNormalized = beneficiaryDoc.replace(/\D/g, '');
      if (beneficiaryDocNormalized === tcrDocumentNormalized) {
        return false;
      }
    }
    
    const selectedDocDigits = selectedAccount.id === 'ALL' ? null : selectedAccount.cnpj.replace(/\D/g, '');
    const payloadDocDigitsForMatch = data.taxDocument?.replace(/\D/g, '') || null;

    return (
      selectedAccount.id === 'ALL' ||
      (!!selectedDocDigits && payloadDocDigitsForMatch === selectedDocDigits) ||
      (!!data.corpxAccountId && data.corpxAccountId === selectedAccount.id)
    );
  }, [selectedAccount]);

  const {
    isConnected: isRealtimeConnected,
    isReconnecting: isRealtimeReconnecting,
    lastError: realtimeError,
    latestTransaction: realtimeTransaction,
    showMoneyEffect: realtimeMoneyEffect,
    transactionQueue: realtimeQueue,
  } = useCorpxRealtime({
    enabled: true,
    filterTransaction: matchesSelectedAccount,
  });

  // 🔄 Recarregar quando a conta selecionada mudar
  useEffect(() => {
    // ✅ Carregamento inicial: sem filtros (applyFilters = false)
    loadCorpXTransactions(undefined, undefined, 1, recordsPerPage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setFiltersAppliedToAPI(false); // Reset filtros ao mudar conta
    // ✅ Carregar sem filtros ao mudar conta (applyFilters = false)
    loadCorpXTransactions(undefined, undefined, 1, recordsPerPage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount.id]);

  // 🚀 OTIMIZADO: Calcular todas as métricas em uma única passada
  const metrics = useMemo(() => {
    let totalDeposits = 0;
    let depositAmount = 0;
    let totalWithdrawals = 0;
    let withdrawalAmount = 0;
    
    const len = filteredAndSortedTransactions.length;
    for (let i = 0; i < len; i++) {
      const t = filteredAndSortedTransactions[i];
      const absValue = Math.abs(t.value);
      if (t.type === 'CRÉDITO') {
        totalDeposits++;
        depositAmount += absValue;
      } else {
        totalWithdrawals++;
        withdrawalAmount += absValue;
      }
    }
    
    return {
      totalDeposits,
      depositAmount,
      totalWithdrawals,
      withdrawalAmount,
      netAmount: depositAmount - withdrawalAmount,
      totalTransactions: len,
      loading: isLoading
    };
  }, [filteredAndSortedTransactions, isLoading]);

  return (
    <div className="space-y-6">
      {realtimeTransaction && (
        <MoneyRainEffect
          trigger={realtimeMoneyEffect}
          amount={realtimeTransaction.amount}
          type={realtimeTransaction.transactionType === 'C' ? 'funding' : 'withdrawal'}
          queueCount={realtimeQueue.length}
        />
      )}

      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {isRealtimeConnected && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Tempo Real
            </div>
          )}
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
            onClick={() => loadCorpXTransactions(undefined, undefined, currentPage, undefined, filtersAppliedToAPI, true)}
            disabled={isLoading}
            title="Atualizar e manter transações em cache"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Depósitos</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            ) : (
              <>
                <p className="text-2xl font-bold text-purple-500">{metrics.totalDeposits}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.depositAmount)}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Saques</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            ) : (
              <>
                <p className="text-2xl font-bold text-purple-500">{metrics.totalWithdrawals}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.withdrawalAmount)}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo Líquido</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            ) : (
              <>
                <p className={`text-2xl font-bold ${metrics.netAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(metrics.netAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {metrics.netAmount >= 0 ? 'Positivo' : 'Negativo'}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-background border border-[rgba(147,51,234,0.3)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Transações</p>
            {metrics.loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            ) : (
              <>
                <p className="text-2xl font-bold text-purple-500">{metrics.totalTransactions}</p>
                <p className="text-sm text-muted-foreground">
                  Na página atual
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Filtros de Pesquisa - CorpX */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Filtros de Pesquisa - CorpX
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize sua consulta de extratos
                </p>
              </div>
            </div>
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
              CORPX
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Primeira linha - Filtros de data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className={`w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-purple-500 transition-colors bg-input ${!dateFrom ? "text-muted-foreground" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl bg-popover" align="start">
                  <CalendarWrapper
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className={`w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-purple-500 transition-colors bg-input ${!dateTo ? "text-muted-foreground" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl bg-popover" align="start">
                  <CalendarWrapper
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF, EndToEnd (E...)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                EndToEnd (E...) tem prioridade sobre busca textual
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Valor específico</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ou -385.95 (aceita negativos)"
                value={specificAmount}
                onChange={(e) => setSpecificAmount(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
              <p className="text-xs text-muted-foreground">
                Aceita valores negativos para buscar débitos específicos
              </p>
            </div>
          </div>

          {/* Segunda linha - Filtros específicos */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Valor mínimo</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ou -5000 (aceita negativos)"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                disabled={isLoading || (specificAmount && specificAmount.trim() !== '')}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
              {specificAmount && specificAmount.trim() !== '' && (
                <p className="text-xs text-yellow-600">
                  Desabilitado quando valor específico está preenchido
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Valor máximo</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ou -100 (aceita negativos)"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                disabled={isLoading || (specificAmount && specificAmount.trim() !== '')}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
              {specificAmount && specificAmount.trim() !== '' && (
                <p className="text-xs text-yellow-600">
                  Desabilitado quando valor específico está preenchido
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Descrição</label>
              <Input
                placeholder="Descrição da transação..."
                value={searchDescCliente}
                onChange={(e) => setSearchDescCliente(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Tipo de transação</label>
              <Select value={transactionTypeFilter} onValueChange={(value: "todos" | "debito" | "credito") => setTransactionTypeFilter(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="debito">Apenas Débitos</SelectItem>
                  <SelectItem value="credito">Apenas Créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ordenar por</label>
              <Select value={sortBy} onValueChange={(value: "value" | "date" | "none") => setSortBy(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input">
                  <SelectValue placeholder="Sem ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem ordenação</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ordem</label>
              <Select value={sortOrder} onValueChange={(value: "asc" | "desc" | "none") => setSortOrder(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input" disabled={sortBy === "none"}>
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Padrão</SelectItem>
                  <SelectItem value="asc">Crescente</SelectItem>
                  <SelectItem value="desc">Decrescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* 🆕 Buscar Depósito por EndToEnd */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar depósito (EndToEnd)"
                value={buscarEndToEnd}
                onChange={(e) => setBuscarEndToEnd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isBuscandoDeposito) {
                    handleBuscarDeposito();
                  }
                }}
                className="h-12 w-[200px] bg-background border border-yellow-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 font-mono text-xs rounded-xl"
                disabled={isBuscandoDeposito}
              />
              <Button
                onClick={handleBuscarDeposito}
                disabled={isBuscandoDeposito || !buscarEndToEnd.trim()}
                variant="outline"
                size="sm"
                className="h-12 rounded-xl"
              >
                {isBuscandoDeposito ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button 
              onClick={handleAplicarFiltros} 
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button 
              onClick={handleLimparFiltros} 
              variant="outline" 
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-purple-500 transition-colors"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button 
              onClick={() => loadCorpXTransactions(undefined, undefined, currentPage, undefined, filtersAppliedToAPI, true)} 
              variant="outline" 
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-purple-500 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Carregando..." : "Atualizar"}
            </Button>
            <Dialog open={isSyncDialogOpen} onOpenChange={handleSyncDialogChange}>
              <DialogTrigger asChild>
            <Button 
              variant="outline" 
                  disabled={isLoading || isSyncing || selectedAccount.id === 'ALL' || !selectedAccount.available}
                  className="rounded-xl px-6 py-3 font-semibold border-border hover:border-blue-500 hover:text-blue-600 transition-colors"
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
                  <DialogTitle>Sincronizar extrato CORPX</DialogTitle>
                  <DialogDescription>
                    Informe o período que deseja sincronizar. A operação será executada diretamente na API da CORPX.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Data inicial</label>
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!syncStartDate ? "text-muted-foreground" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {syncStartDate ? format(syncStartDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <CalendarWrapper
                          mode="single"
                          selected={syncStartDate || undefined}
                          onSelect={(date) => {
                            if (date) {
                              setSyncStartDate(date);
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Data final</label>
                    <Popover modal>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!syncEndDate ? "text-muted-foreground" : ""}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {syncEndDate ? format(syncEndDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <CalendarWrapper
                          mode="single"
                          selected={syncEndDate || undefined}
                          onSelect={(date) => {
                            if (date) {
                              setSyncEndDate(date);
                            }
                          }}
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
              onClick={() => void exportToCSV()} 
              variant="outline" 
              disabled={isLoading || isExporting}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-green-500 hover:text-green-600 transition-colors"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
                </>
              )}
            </Button>
            <div className="w-[190px]">
              <Select
                value={recordsPerPage.toString()}
                onValueChange={(value) => {
                  const limit = parseInt(value, 10);
                  if (Number.isNaN(limit)) {
                    return;
                  }
                  const safeLimit = Math.min(Math.max(limit, 1), 2000);
                  setRecordsPerPage(safeLimit);
                  setCurrentPage(1);
                  loadCorpXTransactions(undefined, undefined, 1, safeLimit, filtersAppliedToAPI);
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input">
                  <SelectValue placeholder="Registros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 registros</SelectItem>
                  <SelectItem value="200">200 registros</SelectItem>
                  <SelectItem value="500">500 registros</SelectItem>
                  <SelectItem value="1000">1000 registros</SelectItem>
                  <SelectItem value="2000">2000 registros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Transações - CorpX */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Extrato de Transações CORPX
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredAndSortedTransactions.length} registros encontrados • {debitCount} débitos • {creditCount} créditos
                </p>
                
                {(totalDebito > 0 || totalCredito > 0) && (
                  <div className="flex gap-4 mt-2 text-sm">
                    {totalDebito > 0 && (
                      <span className="text-red-600 font-medium">
                        Total Débitos: {formatCurrency(totalDebito)}
                      </span>
                    )}
                    {totalCredito > 0 && (
                      <span className="text-green-600 font-medium">
                        Total Créditos: {formatCurrency(totalCredito)}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      Saldo: {formatCurrency(totalCredito - totalDebito)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
                {filteredAndSortedTransactions.length} registros
              </Badge>
              <Badge
                className={cn(
                  "text-xs font-medium border",
                  isRealtimeConnected
                    ? "bg-green-100 text-green-800 border-green-200"
                    : isRealtimeReconnecting
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                )}
                title={realtimeError || undefined}
              >
                {isRealtimeReconnecting
                  ? "Tempo real: reconectando"
                  : isRealtimeConnected
                    ? "Tempo real: ativo"
                    : "Tempo real: offline"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        {/* 🆕 Barra de Ações em Lote */}
        <div className={cn(
          "px-6 py-4 border-b border-border transition-all",
          bulkMode ? "bg-purple-50 dark:bg-purple-950/20" : "bg-muted/30"
        )}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={bulkMode ? "default" : "outline"}
                onClick={toggleBulkMode}
                className={bulkMode ? "bg-purple-600 hover:bg-purple-700" : ""}
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
                    disabled={filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t)).length === 0}
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
            
            {bulkMode && selectedTransactions.size > 0 && (
              <Button
                onClick={handleBulkCredit}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Creditar {selectedTransactions.size} em Lote
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <span className="text-muted-foreground font-medium">Carregando transações CORPX...</span>
              <p className="text-sm text-muted-foreground">Aguarde enquanto buscamos os dados</p>
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Erro ao carregar extrato</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => loadCorpXTransactions(undefined, undefined, 1, undefined, filtersAppliedToAPI, true)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : displayTransactions.length === 0 ? (
            <div className="text-center p-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Nenhuma transação encontrada</h3>
              <p className="text-muted-foreground">
                Tente ajustar os filtros de data ou busca
              </p>
            </div>
          ) : (
            <>
              {/* Tabela Desktop */}
              <div className="hidden lg:block">
                <div className="max-h-[75vh] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur-sm z-10">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        {/* 🆕 Coluna de seleção (só aparece no modo lote) */}
                        {bulkMode && (
                          <TableHead className="font-semibold text-card-foreground py-3 w-[50px] text-center">
                            <Checkbox
                              checked={selectedTransactions.size > 0 && selectedTransactions.size === filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t)).length}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  selectAllVisibleCredits();
                                } else {
                                  clearSelection();
                                }
                              }}
                              className="h-4 w-4"
                            />
                          </TableHead>
                        )}
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Data/Hora</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Valor</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 min-w-[200px]">Cliente</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[180px]">Reconciliation ID</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[180px]">Documento Beneficiário</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[200px]">Descrição</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Código (End-to-End)</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[120px] text-center">Status</TableHead>
                        {!bulkMode && (
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px] text-center">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayTransactions.map((transaction) => {
                        const beneficiaryDocDigits = (transaction.beneficiaryDocument || transaction.document || '').replace(/\D/g, '');
                        const beneficiaryName = accountNameByDocument[beneficiaryDocDigits];

                        return (
                        <TableRow 
                          key={transaction.id}
                          onClick={(e) => {
                            // Se estiver em modo lote e for transação de crédito, selecionar
                            if (bulkMode && transaction.type === 'CRÉDITO' && !isRecordCredited(transaction)) {
                              e.stopPropagation();
                              toggleTransactionSelection(transaction.id.toString());
                            } else if (!bulkMode) {
                            setSelectedTransaction(transaction);
                            setIsModalOpen(true);
                            }
                          }}
                          className={cn(
                            "transition-all duration-200 border-b border-border",
                            bulkMode && selectedTransactions.has(transaction.id.toString()) 
                              ? "bg-purple-40/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 cursor-pointer hover:bg-purple-100/60 dark:hover:bg-purple-900/30"
                              : bulkMode && transaction.type === 'CRÉDITO' && !isRecordCredited(transaction)
                              ? "cursor-pointer hover:bg-muted/30"
                              : !bulkMode
                              ? "cursor-pointer hover:bg-muted/20"
                              : "cursor-default opacity-60"
                          )}
                        >
                          {/* 🆕 Checkbox (só aparece no modo lote para créditos não creditados) */}
                          {bulkMode && (
                            <TableCell className="py-3 text-center">
                              {transaction.type === 'CRÉDITO' && !isRecordCredited(transaction) ? (
                                <Checkbox
                                  checked={selectedTransactions.has(transaction.id.toString())}
                                  onCheckedChange={() => toggleTransactionSelection(transaction.id.toString())}
                                  className="h-4 w-4"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div className="w-4 h-4" /> // Espaço vazio para manter alinhamento
                              )}
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-card-foreground py-3 text-xs">
                            {formatDate(transaction.dateTime)}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                            <span className={`font-bold text-sm font-mono ${transaction.type === 'DÉBITO' ? "text-red-600" : "text-green-600"}`}>
                              {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                            </span>
                              <span className="text-xs text-muted-foreground">
                                {transaction.type === 'CRÉDITO' ? 'Crédito' : 'Débito'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground break-words">
                            <div className="space-y-1">
                              <div className="font-medium text-card-foreground">
                                {transaction.client}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                CORPX
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[150px]">
                            <span className="font-mono" title={transaction._original?.reconciliationId || transaction._original?.rawWebhook?.data?.reconciliationId || ''}>
                              {transaction._original?.reconciliationId || transaction._original?.rawWebhook?.data?.reconciliationId || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[200px]">
                            {transaction.document ? (
                              <div className="space-y-1">
                                <span className="font-mono" title={transaction.document}>
                                  {formatDocument(transaction.document)}
                                </span>
                                {transaction.type === 'CRÉDITO' && beneficiaryName && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    {beneficiaryName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground break-words max-w-[200px]">
                            {transaction.descCliente ? (
                              <span title={transaction.descCliente}>
                                {transaction.descCliente}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                                {transaction.code || '—'}
                              </span>
                              {transaction.code && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(transaction.code);
                                  toast.success("Código copiado!", {
                                    description: "O código foi copiado para a área de transferência",
                                    duration: 1500
                                  });
                                }}
                                className="h-6 w-6 p-0 flex-shrink-0 rounded-lg hover:bg-muted hover:text-card-foreground transition-all duration-200"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              )}
                            </div>
                          </TableCell>
                          
                          {/* ✅ Coluna de Status */}
                          <TableCell className="py-3 text-center">
                            {formatStatus(transaction.status)}
                          </TableCell>
                          
                          {/* ✅ Coluna de Ações - Botão +OTC (oculto no modo lote) */}
                          {!bulkMode && (
                          <TableCell className="py-3">
                            <div className="flex items-center justify-center">
                              {transaction.type === 'CRÉDITO' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleCreditToOTC(transaction, e)}
                                  disabled={isRecordCredited(transaction) || isVerifyingTransaction === transaction.id}
                                  className={cn(
                                    "h-7 px-2 text-xs transition-all",
                                    isRecordCredited(transaction)
                                      ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                      : isVerifyingTransaction === transaction.id
                                      ? "bg-blue-50 text-blue-600 border-blue-200"
                                      : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                                  )}
                                  title={isRecordCredited(transaction) ? "Já creditado para cliente OTC" : isVerifyingTransaction === transaction.id ? "Verificando transação..." : "Creditar para cliente OTC"}
                                >
                                  {isRecordCredited(transaction) ? (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Creditado
                                    </>
                                  ) : isVerifyingTransaction === transaction.id ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Verificando...
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      OTC
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          )}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Versão Mobile - cards simplificados */}
              <div className="lg:hidden space-y-4 p-4">
                {displayTransactions.map((transaction) => {
                  const beneficiaryDocDigits = (transaction.beneficiaryDocument || transaction.document || '').replace(/\D/g, '');
                  const beneficiaryName = accountNameByDocument[beneficiaryDocDigits];

                  return (
                  <Card 
                    key={transaction.id}
                    onClick={() => {
                      setSelectedTransaction(transaction);
                      setIsModalOpen(true);
                    }}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(transaction.dateTime)}
                        </span>
                        <div className="flex items-center gap-2">
                          {formatStatus(transaction.status)}
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200 rounded-full px-2 py-1 text-xs font-semibold">
                            CORPX
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex flex-col">
                        <span className={`font-bold text-lg font-mono ${transaction.type === 'DÉBITO' ? "text-red-600" : "text-green-600"}`}>
                          {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                        </span>
                          <span className="text-xs text-muted-foreground">
                            {transaction.type === 'CRÉDITO' ? 'Crédito' : 'Débito'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="font-medium text-card-foreground">
                          {transaction.client}
                        </div>
                        {transaction.document && (
                          <div className="text-xs text-muted-foreground">
                            Doc. Beneficiário: {formatDocument(transaction.document)}
                          </div>
                        )}
                        {transaction.type === 'CRÉDITO' && beneficiaryName && (
                          <div className="text-[11px] text-muted-foreground">
                            {beneficiaryName}
                          </div>
                        )}
                        {transaction.descCliente && (
                          <div className="text-xs text-muted-foreground">
                            {transaction.descCliente}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {transaction.code || 'Sem end-to-end'}
                        </span>
                        {/* ✅ Botão +OTC Mobile */}
                        {transaction.type === 'CRÉDITO' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleCreditToOTC(transaction, e)}
                            disabled={isRecordCredited(transaction) || isVerifyingTransaction === transaction.id}
                            className={cn(
                              "h-7 px-2 text-xs transition-all",
                              isRecordCredited(transaction)
                                ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                : isVerifyingTransaction === transaction.id
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            )}
                            title={isRecordCredited(transaction) ? "Já creditado para cliente OTC" : isVerifyingTransaction === transaction.id ? "Verificando transação..." : "Creditar para cliente OTC"}
                          >
                            {isRecordCredited(transaction) ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Creditado
                              </>
                            ) : isVerifyingTransaction === transaction.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Verificando...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                OTC
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              {/* Paginação */}
              {(totalPagesAvailable > 1 || pagination.has_more) && (
                <div className="border-t border-border bg-muted/20">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {showingFrom}-{Math.min(showingTo, totalRecords)} de {totalRecords} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isLoading}
                        className="rounded-lg"
                      >
                        Anterior
                      </Button>
                      <span className="text-sm font-medium px-3">
                        Página {currentPage} de {totalPagesAvailable}{pagination.has_more ? '+' : ''}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={((currentPage >= totalPagesAvailable) && !pagination.has_more) || isLoading}
                        className="rounded-lg"
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes da transação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes da Transação CORPX
              </DialogTitle>
              {selectedTransaction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportComprovantePDF(selectedTransaction)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar Comprovante PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedTransaction && (() => {
            const beneficiaryDocDigits = (selectedTransaction.beneficiaryDocument || selectedTransaction.document || '').replace(/\D/g, '');
            const beneficiaryName = accountNameByDocument[beneficiaryDocDigits];
            const rawExtrato = selectedTransaction.rawExtrato || selectedTransaction._original?.rawExtrato || null;
            const rawPayer = rawExtrato?.payer || rawExtrato?.pagador;
            const rawBeneficiary = rawExtrato?.beneficiary || rawExtrato?.beneficiario;
            return (
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
                  <label className="text-sm font-medium text-muted-foreground">Código (End-to-End)</label>
                  <p className="text-sm font-mono">{selectedTransaction.code || '—'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="text-sm">{selectedTransaction.client}</p>
                </div>
                {selectedTransaction.document && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Documento do Beneficiário</label>
                    <p className="text-sm font-mono">{formatDocument(selectedTransaction.document)}</p>
                    {selectedTransaction.type === 'CRÉDITO' && beneficiaryName && (
                      <p className="text-xs text-muted-foreground mt-1">{beneficiaryName}</p>
                    )}
                  </div>
                )}
                {selectedTransaction.descCliente && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                    <p className="text-sm">{selectedTransaction.descCliente}</p>
                  </div>
                )}
              </div>
              {rawExtrato && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Dados brutos (rawExtrato)</label>
            </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Data</span>
                      <span className="text-sm font-mono">{rawExtrato.data || rawExtrato.date || '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Hora</span>
                      <span className="text-sm font-mono">{rawExtrato.hora || rawExtrato.time || '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</span>
                      <span className="text-sm font-bold">{rawExtrato.tipo || rawExtrato.type || '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Valor</span>
                      <span className="text-sm font-mono">{rawExtrato.valor || rawExtrato.amount || '—'}</span>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Descrição</span>
                      <span className="text-sm">{rawExtrato.descricao || rawExtrato.description || '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">ID End-to-End</span>
                      <span className="text-sm font-mono break-all">{rawExtrato.idEndToEnd || rawExtrato.endtoend || '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Nr. Movimento</span>
                      <span className="text-sm font-mono break-all">{rawExtrato.nrMovimento || rawExtrato.movementId || '—'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg border border-border bg-muted/40">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payer</h4>
                      <p className="text-sm font-medium">{rawPayer?.fullName || rawPayer?.nome || '—'}</p>
                      {rawPayer?.document && (
                        <p className="text-xs font-mono text-muted-foreground">
                          Doc: {formatDocument(rawPayer.document)}
                        </p>
                      )}
                      {(rawPayer?.agency || rawPayer?.account) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Agência {rawPayer?.agency || '—'} • Conta {rawPayer?.account || '—'}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/40">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Beneficiário</h4>
                      <p className="text-sm font-medium">{rawBeneficiary?.fullName || rawBeneficiary?.nome || beneficiaryName || '—'}</p>
                      {rawBeneficiary?.document && (
                        <p className="text-xs font-mono text-muted-foreground">
                          Doc: {formatDocument(rawBeneficiary.document)}
                        </p>
                      )}
                    </div>
                  </div>
                  <details className="rounded-lg border border-border bg-muted/30 p-3">
                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">Ver JSON completo</summary>
                    <pre className="mt-3 max-h-64 overflow-auto text-xs bg-background/60 rounded-lg p-3 border border-border/60 text-muted-foreground">
{JSON.stringify(rawExtrato, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ✅ Modal OTC (individual) */}
      <CreditExtractToOTCModal
        isOpen={creditOTCModalOpen}
        onClose={handleCloseCreditOTCModal}
        extractRecord={selectedExtractRecord}
      />

      {/* 🆕 Modal de Crédito OTC em Lote */}
      <BulkCreditOTCModal
        isOpen={bulkOTCModalOpen}
        onClose={handleCloseBulkOTCModal}
        transactions={getSelectedTransactionsData()}
      />

      {/* 🆕 Modal de Depósito Encontrado */}
      <Dialog open={depositoModalOpen} onOpenChange={setDepositoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-purple-600" />
              {depositoData?.sucesso ? 'Depósito Encontrado' : 'Busca de Depósito'}
            </DialogTitle>
            <DialogDescription>
              {depositoData?.sucesso 
                ? 'Informações detalhadas do depósito consultado'
                : 'Resultado da busca por EndToEnd'}
            </DialogDescription>
          </DialogHeader>
          
          {!depositoData?.transacao ? (
            // ✅ Mostrar mensagem de erro e dados retornados pela API (se houver)
            <div className="space-y-4">
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                        {depositoData?.sucesso === false ? 'Depósito não encontrado' : 'Erro ao buscar depósito'}
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {depositoData?.mensagem || 'Não foi possível encontrar o depósito com este EndToEnd'}
                      </p>
                      {depositoData?.status && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            Status: {depositoData.status}
                          </Badge>
                        </div>
                      )}
                      {buscarEndToEnd && (
                        <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded">
                          <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                            EndToEnd pesquisado: {buscarEndToEnd}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* ✅ Mostrar dados brutos retornados pela API (se houver) */}
              {depositoData && Object.keys(depositoData).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dados retornados pela API</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96 font-mono">
                      {JSON.stringify(depositoData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDepositoModalOpen(false)}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : depositoData?.transacao && (() => {
            const request = depositoData.transacao;
            const valor = (request.amount || 0) / 100;
            const permiteOperacao = depositoData?.permiteOperacao ?? false;
            // ✅ Verificar se é um reversal (estrutura diferente)
            const isReversal = 'returnId' in request && 'reason' in request;
            
            return (
              <div className="space-y-4">
                {/* ✅ Aviso quando transação encontrada mas não permite operação */}
                {!permiteOperacao && depositoData?.sucesso && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        {depositoData.mensagem || 'Esta transação não permite operações de crédito/compensação no momento.'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* ✅ Aviso quando é um reversal */}
                {isReversal && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Esta é uma transação de estorno. Alguns dados podem não estar disponíveis.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* ✅ COMPROVANTE - Estilo comprovante bancário */}
                <Card className="border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
                  <CardContent className="p-6 space-y-6">
                    {/* Cabeçalho do Comprovante */}
                    <div className="text-center border-b border-gray-300 dark:border-gray-700 pb-4">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {isReversal ? 'COMPROVANTE DE ESTORNO' : 'COMPROVANTE DE TRANSFERÊNCIA'}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {request.created ? new Date(request.created).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </p>
                    </div>

                    {/* Valor Principal */}
                    <div className="text-center py-6 border-b-2 border-dashed border-gray-300 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">VALOR</p>
                      <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(valor)}
                      </p>
                      <div className="mt-3">
                        <Badge 
                          variant={request.status === 'success' ? 'default' : 'secondary'} 
                          className="text-xs px-3 py-1"
                        >
                          {request.status === 'success' ? '✓ CONCLUÍDA' : (request.status ? request.status.toUpperCase() : 'PENDENTE')}
                        </Badge>
                      </div>
                    </div>

                    {/* Status - Seção Dedicada */}
                    <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status da Transação:</span>
                        <Badge 
                          variant={request.status === 'success' ? 'default' : 'secondary'} 
                          className="text-xs px-3 py-1"
                        >
                          {request.status === 'success' ? '✓ CONCLUÍDA' : (request.status ? request.status.toUpperCase() : 'PENDENTE')}
                        </Badge>
                      </div>
                    </div>

                    {/* Informações da Transação */}
                    <div className="space-y-4">
                      {/* Dados do Pagador - sempre mostrar se não for reversal */}
                      {!isReversal && (
                        <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                            Dados do Pagador
                          </p>
                          <div className="space-y-1.5">
                            {(request.senderName || request.senderTaxId || request.senderBankCode || request.senderBranchCode || request.senderAccountNumber) ? (
                              <>
                                {request.senderName && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Nome:</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                                      {request.senderName}
                                    </span>
                                  </div>
                                )}
                                {request.senderTaxId && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">CPF/CNPJ:</span>
                                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                      {request.senderTaxId}
                                    </span>
                                  </div>
                                )}
                                {(request.senderBankCode || request.senderBranchCode || request.senderAccountNumber) && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Instituição:</span>
                                    <span className="text-xs text-gray-900 dark:text-gray-100 text-right">
                                      {[request.senderBankCode, request.senderBranchCode, request.senderAccountNumber]
                                        .filter(Boolean)
                                        .join(' / ') || '-'}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Dados não disponíveis</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dados do Beneficiário - sempre mostrar se não for reversal */}
                      {!isReversal && (
                        <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                            Dados do Beneficiário
                          </p>
                          <div className="space-y-1.5">
                            {(request.receiverName || request.receiverTaxId || request.receiverBankCode || request.receiverBranchCode || request.receiverAccountNumber) ? (
                              <>
                                {request.receiverName && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Nome:</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                                      {request.receiverName}
                                    </span>
                                  </div>
                                )}
                                {request.receiverTaxId && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">CPF/CNPJ:</span>
                                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                      {request.receiverTaxId}
                                    </span>
                                  </div>
                                )}
                                {(request.receiverBankCode || request.receiverBranchCode || request.receiverAccountNumber) && (
                                  <div className="flex justify-between">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Instituição:</span>
                                    <span className="text-xs text-gray-900 dark:text-gray-100 text-right">
                                      {[request.receiverBankCode, request.receiverBranchCode, request.receiverAccountNumber]
                                        .filter(Boolean)
                                        .join(' / ') || '-'}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Dados não disponíveis</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Dados do Estorno */}
                      {isReversal && (
                        <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                            Informações do Estorno
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-600 dark:text-gray-400">Motivo:</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">
                                {request.reason || '-'}
                              </span>
                            </div>
                            {request.returnId && (
                              <div className="flex justify-between">
                                <span className="text-xs text-gray-600 dark:text-gray-400">Return ID:</span>
                                <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right">
                                  {request.returnId}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Identificadores */}
                      <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                          Identificadores
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 dark:text-gray-400">End-to-End ID:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right">
                                {request.endToEndId || '-'}
                              </span>
                              {request.endToEndId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(request.endToEndId);
                                    toast.success('EndToEnd copiado!');
                                  }}
                                  className="h-5 w-5 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {!isReversal && request.reconciliationId && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 dark:text-gray-400">Reconciliation ID:</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right">
                                  {request.reconciliationId}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(request.reconciliationId);
                                    toast.success('Reconciliation ID copiado!');
                                  }}
                                  className="h-5 w-5 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">ID da Transação:</span>
                            <span className="text-xs font-mono text-gray-900 dark:text-gray-100">
                              {request.id || '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Informações Adicionais */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Descrição:</span>
                          <span className="text-xs text-gray-900 dark:text-gray-100 text-right max-w-[60%]">
                            {request.description || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Taxa:</span>
                          <span className="text-xs text-gray-900 dark:text-gray-100">
                            {formatCurrency((request.fee || 0) / 100)}
                          </span>
                        </div>
                        {!isReversal && request.cashAmount && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Valor em Dinheiro:</span>
                            <span className="text-xs text-gray-900 dark:text-gray-100">
                              {formatCurrency((request.cashAmount || 0) / 100)}
                            </span>
                          </div>
                        )}
                        {request.flow && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Fluxo:</span>
                            <Badge variant={request.flow === 'in' ? 'default' : 'secondary'} className="text-xs">
                              {request.flow === 'in' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </div>
                        )}
                        {!isReversal && request.method && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Método:</span>
                            <span className="text-xs text-gray-900 dark:text-gray-100">{request.method}</span>
                          </div>
                        )}
                        {request.created && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Criado em:</span>
                            <span className="text-xs text-gray-900 dark:text-gray-100">
                              {new Date(request.created).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {request.updated && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Atualizado em:</span>
                            <span className="text-xs text-gray-900 dark:text-gray-100">
                              {new Date(request.updated).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {request.externalId && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">External ID:</span>
                            <span className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all text-right">
                              {request.externalId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé do Comprovante */}
                    <div className="pt-4 border-t border-gray-300 dark:border-gray-700 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        Este é um comprovante digital gerado automaticamente
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ✅ Dados brutos retornados pela API */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dados completos retornados pela API</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96 font-mono">
                      {JSON.stringify(depositoData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                {/* Ações */}
                <DialogFooter className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => generateDepositoPDF(depositoData)}
                    disabled={!depositoData?.permiteOperacao}
                    title={!depositoData?.permiteOperacao ? 'Operação não permitida para este depósito' : 'Baixar comprovante em PDF'}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Comprovante PDF
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDepositoModalOpen(false)}
                    >
                      Fechar
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        
                        // Converter para formato de transação
                        const transactionData = {
                          id: request.id,
                          dateTime: request.created,
                          value: valor,
                          type: 'CRÉDITO',
                          client: isReversal ? 'Estorno' : (request.senderName || ''),
                          document: isReversal ? '' : (request.senderTaxId || ''),
                          code: request.endToEndId,
                          descCliente: request.description || '',
                          identified: true,
                          status: request.status,
                          reconciliationId: isReversal ? undefined : request.reconciliationId,
                          beneficiaryDocument: isReversal ? undefined : request.receiverTaxId,
                          _original: request
                        };
                        
                        // Fechar modal de depósito primeiro
                        setDepositoModalOpen(false);
                        
                        // Abrir modal de crédito OTC diretamente (já temos dados verificados)
                        setTimeout(() => {
                          abrirModalCreditOTC(transactionData);
                        }, 150);
                      }}
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={!depositoData?.permiteOperacao || isReversal}
                      title={
                        isReversal 
                          ? 'Estornos não podem ser creditados para OTC' 
                          : !depositoData?.permiteOperacao 
                            ? 'Operação não permitida para este depósito' 
                            : 'Creditar para OTC'
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      +OTC
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
