import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus, Check, DollarSign, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
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
// ✅ PAGINAÇÃO TRADICIONAL: Páginas numeradas
import { useExtratoPaginado } from "@/hooks/useExtratoPaginado";
import { validarIntervaloData, formatarDataParaAPI, MovimentoExtrato, ExtratoResponse } from "@/services/extrato";
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";
import BulkCreditOTCModal from "@/components/otc/BulkCreditOTCModal";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
// ✅ ADICIONADO: Importar hook para identificar provedor
import { useBankFeatures } from "@/hooks/useBankFeatures";

// Tipo para os filtros
interface FiltrosAtivos {
  cursor?: number;
  de?: string;
  ate?: string;
}

export default function ExtractTable() {
  const [selectedTransaction, setSelectedTransaction] = useState<MovimentoExtrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosAtivos>({});
  
  // 🚨 NOVO: Estado para rastrear registros já creditados
  const [creditedRecords, setCreditedRecords] = useState<Set<string>>(new Set());
  
  // 🚀 PAGINAÇÃO INFINITA - Não precisamos mais dessas variáveis
  // const [currentPage, setCurrentPage] = useState(1); // REMOVIDO
  // const ITEMS_PER_PAGE = 200; // REMOVIDO
  
  // Novos estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDescCliente, setSearchDescCliente] = useState(""); // Filtro para descCliente (BMP-531)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("desc");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("date");

  // Estados para o modal de crédito OTC
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<MovimentoExtrato | null>(null);

  // 🆕 Estados para crédito em lote
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkOTCModalOpen, setBulkOTCModalOpen] = useState(false);

  // Estados para o modal de compensação (BMP-531)
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<MovimentoExtrato | null>(null);

  // ✅ ADICIONADO: Hook para verificar o provedor ativo
  const bankFeatures = useBankFeatures();

  // 🚨 PAGINAÇÃO TRADICIONAL: 200 registros por página
  const {
    data: extratoItems,
    pageInfo,
    isLoading,
    error,
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    refetch,
    provider
  } = useExtratoPaginado({
    filtros: {
      de: filtrosAtivos.de,
      ate: filtrosAtivos.ate,
      provider: bankFeatures.provider as 'bmp' | 'bmp-531' | 'bitso'
    },
    enabled: true,
    pageSize: 1000 // ✅ CORRIGIDO: 1000 registros por página para evitar limitação
  });

  // ✅ USAR DADOS DA PAGINAÇÃO TRADICIONAL
  const transactions = extratoItems || [];

  // 🚨 CRÍTICO: Limpar dados antigos quando há erro para evitar contaminação
  useEffect(() => {
    if (error) {
      // Com paginação infinita, não precisamos resetar página
      console.error('[ExtractTable] Erro no carregamento:', error);
    }
  }, [error]);

  // 🔄 Hook reage automaticamente às mudanças de filtros
  useEffect(() => {
    // useExtratoPaginado já reage automaticamente aos filtros
  }, [filtrosAtivos]);

  // ✅ ADICIONADO: Função para obter badge do provedor
  const getProviderBadge = () => {
    if (bankFeatures.provider === 'bitso') {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs font-medium">
          Bitso
        </Badge>
      );
    } else if (bankFeatures.provider === 'bmp') {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
          BMP
        </Badge>
      );
    } else if (bankFeatures.provider === 'bmp-531') {
      return (
        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs font-medium">
          BMP-531
        </Badge>
      );
    }
    return null;
  };

  // 🚀 FILTROS LOCAIS APENAS (filtros de data agora são server-side)
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // ✅ Filtros de busca local (texto) - mantidos para UX instantânea
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase().trim();
      filtered = filtered.filter(transaction => 
        transaction.client?.toLowerCase().includes(searchTerm) ||
        transaction.document?.toLowerCase().includes(searchTerm)
      );
    }

    if (searchValue.trim()) {
      const searchAmount = parseFloat(searchValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(searchAmount)) {
        filtered = filtered.filter(transaction => 
          Math.abs(transaction.value - searchAmount) < 0.01
        );
      }
    }

    if (searchDescCliente.trim()) {
      const searchTerm = searchDescCliente.toLowerCase().trim();
      filtered = filtered.filter(transaction => 
        transaction.descCliente?.toLowerCase().includes(searchTerm)
      );
    }

    // ✅ Ordenação local (dados já vêm ordenados do servidor por data)
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered.sort((a, b) => {
        let valueA: any, valueB: any;
        
        if (sortBy === "value") {
          valueA = a.value;
          valueB = b.value;
        } else if (sortBy === "date") {
          valueA = new Date(a.dateTime).getTime();
          valueB = new Date(b.dateTime).getTime();
        }
        
        if (sortOrder === "asc") {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });
    }

    return filtered;
  }, [transactions, searchName, searchValue, searchDescCliente, sortBy, sortOrder]);

  // 🚀 PAGINAÇÃO INFINITA - Usar todas as transações carregadas
  const displayTransactions = filteredAndSortedTransactions;

  const handleRowClick = (transaction: MovimentoExtrato) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCopyCode = (code: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleAplicarFiltros = async () => {
    if (dateFrom && dateTo) {
      if (!validarIntervaloData(formatarDataParaAPI(dateFrom), formatarDataParaAPI(dateTo))) {
        toast.error("Intervalo de datas inválido", {
          description: "Verifique se a data inicial é menor que a final e o intervalo não passa de 31 dias",
          duration: 4000
        });
        return;
      }
    }

    // 🚀 FILTROS AGORA SÃO APLICADOS NO SERVIDOR - MUITO MAIS EFICIENTE
    const novosFiltros: FiltrosAtivos = {
      ...(dateFrom && dateTo && {
        de: formatarDataParaAPI(dateFrom),
        ate: formatarDataParaAPI(dateTo)
      })
    };

    setFiltrosAtivos(novosFiltros);
    
    // 🔄 O hook useExtratoSeguroPaginado vai detectar a mudança e fazer nova query automaticamente
    toast.success("🚀 Filtros aplicados no servidor!", {
      description: `Buscando ${bankFeatures.provider?.toUpperCase()} com filtros de data`,
      duration: 3000
    });
  };

  const handleLimparFiltros = async () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setSortBy("none");
    setSortOrder("none");
    setFiltrosAtivos({});
    
    // 🔄 O hook useExtratoSeguroPaginado vai detectar a mudança e recarregar automaticamente
    toast.success("🧹 Filtros limpos!", {
      description: "Recarregando dados mais recentes",
      duration: 3000
    });
  };

  // 🚨 FUNÇÃO PARA VERIFICAR SE REGISTRO JÁ FOI CREDITADO
  const isRecordCredited = (transaction: MovimentoExtrato): boolean => {
    const recordKey = `${bankFeatures.provider}-${transaction.id}`;
    return creditedRecords.has(recordKey);
  };

  // Função para abrir modal de crédito OTC
  const handleCreditToOTC = async (transaction: MovimentoExtrato, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que abra o modal de detalhes
    
    // 🚨 VERIFICAR SE JÁ FOI CREDITADO ANTES DE ABRIR MODAL
    if (isRecordCredited(transaction)) {
      toast.error('Registro já creditado', {
        description: 'Este registro do extrato já foi creditado para um cliente OTC'
      });
      return;
    }
    
    setSelectedExtractRecord(transaction);
    setCreditOTCModalOpen(true);
  };

  // Função para fechar modal de crédito OTC
  const handleCloseCreditOTCModal = (wasSuccessful?: boolean) => {
    // 🚨 SE OPERAÇÃO FOI REALIZADA COM SUCESSO, MARCAR COMO CREDITADO
    if (wasSuccessful && selectedExtractRecord) {
      const recordKey = `${bankFeatures.provider}-${selectedExtractRecord.id}`;
      setCreditedRecords(prev => new Set(prev).add(recordKey));
    }
    
    setCreditOTCModalOpen(false);
    setSelectedExtractRecord(null);
  };

  // 🆕 Funções para modo lote
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
    const creditTransactions = displayTransactions
      .filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t))
      .map(t => t.id);
    
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
    } else {
      toast.info('Modo seleção ativado - clique nas transações para selecioná-las');
    }
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
        successfulIds.forEach(id => newSet.add(`${bankFeatures.provider}-${id}`));
        return newSet;
      });
      
      // Limpar seleção
      clearSelection();
    }
    
    setBulkOTCModalOpen(false);
  };

  // Obter transações selecionadas
  const getSelectedTransactionsData = () => {
    return displayTransactions.filter(t => selectedTransactions.has(t.id));
  };

  // Função para abrir modal de compensação (BMP-531)
  const handleCompensation = (transaction: MovimentoExtrato, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que abra o modal de detalhes
    setSelectedCompensationRecord(transaction);
    setCompensationModalOpen(true);
  };

  // Função para fechar modal de compensação
  const handleCloseCompensationModal = (wasSuccessful?: boolean) => {
    if (wasSuccessful) {
      toast.success('Compensação processada com sucesso!');
    }
    
    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
  };

  const handleRefresh = () => {
    // 🔄 Com paginação infinita, só fazemos refetch
    refetch();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  const formatDate = (dateString: string) => {
    // Se já está no formato brasileiro, retorna como está
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // Se está no formato ISO, converte
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'DÉBITO':
        return {
          className: "bg-tcr-red/20 text-tcr-red border-tcr-red/30",
          color: "text-tcr-red"
        };
      case 'CRÉDITO':
        return {
          className: "bg-tcr-green/20 text-tcr-green border-tcr-green/30",
          color: "text-tcr-green"
        };
      default:
        return {
          className: "bg-muted/20 text-muted-foreground border-border",
          color: "text-muted-foreground"
        };
    }
  };

  const debitCount = displayTransactions.filter(t => t.type === 'DÉBITO').length;
  const creditCount = displayTransactions.filter(t => t.type === 'CRÉDITO').length;

  return (
    <div className="space-y-6">
      {/* Filtro redesenhado com novos campos */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                {/* REMOVIDO: Filter icon */}
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Filtros de Pesquisa
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize sua consulta de extratos
                </p>
              </div>
            </div>
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
                    className={`w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-blue-500 transition-colors bg-input ${!dateFrom ? "text-muted-foreground" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
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
                    className={`w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-blue-500 transition-colors bg-input ${!dateTo ? "text-muted-foreground" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ação</label>
              <Button 
                onClick={handleAplicarFiltros}
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Buscar Transações
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Limpar</label>
              <Button 
                variant="outline"
                onClick={handleLimparFiltros}
                disabled={isLoading}
                className="w-full h-12 rounded-xl border-border hover:border-blue-500 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Segunda linha - Filtros de busca por nome, valor e descCliente */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Buscar por nome</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do cliente ou documento"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border hover:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Buscar por valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  placeholder="Ex: 100,50"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-10 h-12 rounded-xl border-border hover:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Campo de busca para descCliente - apenas BMP-531 */}
            {bankFeatures.provider === 'bmp-531' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">Buscar por descCliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: Id Conc.: caas436344xU31"
                    value={searchDescCliente}
                    onChange={(e) => setSearchDescCliente(e.target.value)}
                    className="pl-10 h-12 rounded-xl border-border hover:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ordenar por</label>
              <Select value={sortBy} onValueChange={(value: "value" | "date" | "none") => setSortBy(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors">
                  <SelectValue placeholder="Selecionar ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem ordenação</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ordem</label>
              <Select 
                value={sortOrder} 
                onValueChange={(value: "asc" | "desc" | "none") => setSortOrder(value)}
                disabled={sortBy === "none"}
              >
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors">
                  <SelectValue placeholder="Selecionar ordem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Padrão</SelectItem>
                  <SelectItem value="asc">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4" />
                      Crescente
                    </div>
                  </SelectItem>
                  <SelectItem value="desc">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4" />
                      Decrescente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado de erro */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <h3 className="font-semibold text-destructive">Erro ao carregar extrato</h3>
                <p className="text-sm text-destructive/80 mt-1">{error.message}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                className="ml-auto"
              >
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela redesenhada - largura completa */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden w-full">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-tcr-orange to-primary shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground flex items-center gap-2">
                  Extrato de Transações
                  {/* ✅ ADICIONADO: Badge do provedor no título da tabela */}
                  {getProviderBadge()}
                  {/* 📄 INDICADOR DE SISTEMA USADO */}
                  {provider === 'bitso' ? (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Bitso: Filtros funcionais ✅
                    </span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Paginação Tradicional 📄
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayTransactions.length} registros na página • {displayTransactions.filter(t => t.type === 'DÉBITO').length} débitos • {displayTransactions.filter(t => t.type === 'CRÉDITO').length} créditos
                  {pageInfo && pageInfo.totalPages > 1 && <span className="text-blue-500"> • {pageInfo.totalPages} páginas total</span>}
                  {(searchName || searchValue || searchDescCliente || sortBy !== "none") && (
                    <span className="text-amber-500"> • Filtros ativos</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* 🆕 Barra de Ações em Lote */}
        <div className={cn(
          "px-6 py-4 border-b border-border transition-all",
          bulkMode ? "bg-blue-50 dark:bg-blue-950/20" : "bg-muted/30"
        )}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={bulkMode ? "default" : "outline"}
                onClick={toggleBulkMode}
                className={bulkMode ? "bg-blue-600 hover:bg-blue-700" : ""}
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
                    disabled={displayTransactions.filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t)).length === 0}
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
          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-muted-foreground">Carregando extrato...</p>
              </div>
            </div>
          ) : displayTransactions.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Tente ajustar os filtros de data
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Versão Desktop - tabela completa */}
              <div className="hidden lg:block">
                <div className="max-h-[75vh] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur-sm z-10">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        {/* 🆕 Coluna de seleção (só aparece no modo lote) */}
                        {bulkMode && (
                          <TableHead className="font-semibold text-card-foreground py-3 w-[50px] text-center">
                            <Checkbox
                              checked={selectedTransactions.size > 0 && selectedTransactions.size === displayTransactions.filter(t => t.type === 'CRÉDITO' && !isRecordCredited(t)).length}
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
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Valor</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Tipo</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 min-w-[200px]">Cliente/Banco</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Documento</TableHead>
                        {/* Coluna descCliente apenas para BMP-531 */}
                        {bankFeatures.provider === 'bmp-531' && (
                          <TableHead className="font-semibold text-card-foreground py-3 w-[200px]">descCliente</TableHead>
                        )}
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Status</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Código</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[120px] text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayTransactions.map((transaction) => {
                        const typeConfig = getTypeConfig(transaction.type);
                        
                        return (
                          <TableRow 
                            key={transaction.id}
                            onClick={(e) => {
                              // Se estiver em modo lote e for transação de crédito, selecionar
                              if (bulkMode && transaction.type === 'CRÉDITO' && !isRecordCredited(transaction)) {
                                e.stopPropagation();
                                toggleTransactionSelection(transaction.id);
                              } else if (!bulkMode) {
                                handleRowClick(transaction);
                              }
                            }}
                            className={cn(
                              "transition-all duration-200 border-b border-border",
                              bulkMode && selectedTransactions.has(transaction.id) 
                                ? "bg-blue-40/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/30"
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
                                    checked={selectedTransactions.has(transaction.id)}
                                    onCheckedChange={() => toggleTransactionSelection(transaction.id)}
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
                              <span className={`font-bold text-sm font-mono ${transaction.type === 'DÉBITO' ? "text-tcr-red" : "text-tcr-green"}`}>
                                {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                              </span>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge className={`${typeConfig.className} rounded-full px-2 py-1 text-xs font-semibold`}>
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground break-words">
                              {/* Cliente/Banco: Para Bitso mostra lógica especial, para BMP mostra informações detalhadas */}
                              {transaction.bitsoData ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-card-foreground">
                                    {transaction.document || "—"}
                                  </div>
                                  {transaction.type === 'CRÉDITO' && transaction.bitsoData.pagador && (
                                    <div className="text-xs text-blue-600">
                                      De: {transaction.bitsoData.pagador.banco || transaction.bitsoData.pagador.chave || 'N/A'}
                                      {transaction.bitsoData.pagador.conta && (
                                        <div className="text-xs text-muted-foreground">
                                          Conta: {transaction.bitsoData.pagador.conta}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {transaction.type === 'DÉBITO' && transaction.bitsoData.destinatario && (
                                    <div className="text-xs text-orange-600">
                                      Para: {transaction.bitsoData.destinatario.banco || transaction.bitsoData.destinatario.chave || 'N/A'}
                                      {transaction.bitsoData.destinatario.conta && (
                                        <div className="text-xs text-muted-foreground">
                                          Conta: {transaction.bitsoData.destinatario.conta}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // ✅ EXIBIÇÃO BMP SIMPLIFICADA - Cliente e Banco
                                <div className="space-y-1">
                                  <div className="font-medium text-card-foreground">
                                    {transaction.client || "Cliente não identificado"}
                                  </div>
                                  {transaction.document && (
                                    <div className="text-xs text-blue-600">
                                      Doc: {transaction.document}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    BMP - Banco Master Pagamentos
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                              {/* Documento: Para Bitso mostra documento, para BMP mostra documento */}
                              {transaction.bitsoData ? (
                                transaction.client || "—"
                              ) : (
                                transaction.document || "—"
                              )}
                            </TableCell>
                            {/* Célula descCliente apenas para BMP-531 */}
                            {bankFeatures.provider === 'bmp-531' && (
                              <TableCell className="py-3 text-xs text-muted-foreground break-words max-w-[200px]">
                                {transaction.descCliente ? (
                                  <span title={transaction.descCliente}>
                                    {transaction.descCliente}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="py-3">
                              <div className="space-y-1">
                                {transaction.identified ? (
                                  <Badge className="bg-tcr-green/20 text-tcr-green border-tcr-green/30 rounded-full px-2 py-1 text-xs font-semibold">
                                    ✓
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-full px-2 py-1 text-xs font-semibold">
                                    ?
                                  </Badge>
                                )}
                                {/* Badge para indicar se é Bitso */}
                                {transaction.bitsoData && (
                                  <Badge className="bg-orange-50 text-orange-700 border-orange-200 rounded-full px-2 py-1 text-xs font-semibold">
                                    Bitso
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground truncate max-w-[100px]">
                                  {transaction.code}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleCopyCode(transaction.code, e)}
                                  className="h-6 w-6 p-0 flex-shrink-0 rounded-lg hover:bg-muted hover:text-card-foreground transition-all duration-200"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center justify-center gap-1">
                              {!bulkMode && transaction.type === 'CRÉDITO' && (
                                /* ✅ Botão OTC - todos os provedores (oculto no modo lote) */
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleCreditToOTC(transaction, e)}
                                  disabled={isRecordCredited(transaction)}
                                  className={cn(
                                    "h-7 px-2 text-xs transition-all",
                                    isRecordCredited(transaction)
                                      ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                      : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                                  )}
                                  title={isRecordCredited(transaction) ? "Já creditado para cliente OTC" : "Creditar para cliente OTC"}
                                >
                                  {isRecordCredited(transaction) ? (
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
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 📄 PAGINAÇÃO TRADICIONAL */}
                {pageInfo && (pageInfo.totalPages > 1) && (
                  <div className="mt-6 p-4 border-t border-border bg-muted/10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      
                      {/* Info da página atual */}
                      <div className="text-sm text-muted-foreground">
                        Mostrando {pageInfo?.startItem || 1} a {pageInfo?.endItem || displayTransactions.length} de {pageInfo?.totalItems || displayTransactions.length} registros
                        <span className="text-primary"> • Página {pageInfo?.currentPage || currentPage} de {pageInfo?.totalPages || '?'}</span>
                      </div>
                      
                      {/* Controles de navegação */}
                      <div className="flex items-center gap-2">
                        
                        {/* Primeira página */}
                        <Button
                          onClick={firstPage}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                        >
                          ⏮️
                        </Button>
                        
                        {/* Página anterior */}
                        <Button
                          onClick={prevPage}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                        >
                          ← Anterior
                        </Button>
                        
                        {/* Números das páginas (máximo 5) */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, pageInfo?.totalPages || 5) }, (_, i) => {
                            let pageNum;
                            const totalPages = pageInfo?.totalPages || 5;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={pageNum}
                                onClick={() => goToPage(pageNum)}
                                variant={pageNum === currentPage ? "default" : "outline"}
                                size="sm"
                                className="h-9 w-9 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        
                        {/* Próxima página */}
                        <Button
                          onClick={nextPage}
                          disabled={currentPage === (pageInfo?.totalPages || 1)}
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                        >
                          Próxima →
                        </Button>
                        
                        {/* Última página */}
                        <Button
                          onClick={lastPage}
                          disabled={currentPage === (pageInfo?.totalPages || 1)}
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                        >
                          ⏭️
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 📊 INFORMAÇÕES DE PAGINAÇÃO */}
                {pageInfo && (
                  <div className="text-center text-xs text-muted-foreground mt-4 p-4 bg-muted/20 rounded-lg">
                    <div className="flex flex-wrap justify-center gap-4">
                      <span>📄 Página {pageInfo?.currentPage || currentPage} de {pageInfo?.totalPages || '?'}</span>
                      <span>📊 Total: {pageInfo?.totalItems || displayTransactions.length} registros</span>
                      <span>📋 Mostrando: {pageInfo?.pageSize || 1000} por página</span>
                      <span className="text-blue-600">💾 {provider?.toUpperCase()} Provider</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Versão Mobile/Tablet - Cards em lista */}
              <div className="lg:hidden space-y-3 p-4">
                {displayTransactions.map((transaction) => {
                  const typeConfig = getTypeConfig(transaction.type);
                  
                  return (
                    <Card 
                      key={transaction.id}
                      className="bg-muted/10 border border-border cursor-pointer hover:bg-muted/20 transition-all duration-200"
                      onClick={() => handleRowClick(transaction)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{formatDate(transaction.dateTime)}</span>
                          <div className="flex gap-2">
                            <Badge className={`${typeConfig.className} rounded-full px-2 py-1 text-xs font-semibold`}>
                              {transaction.type}
                            </Badge>
                            {transaction.bitsoData && (
                              <Badge className="bg-orange-50 text-orange-700 border-orange-200 rounded-full px-2 py-1 text-xs font-semibold">
                                Bitso
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className={`font-bold text-xl font-mono ${transaction.type === 'DÉBITO' ? "text-tcr-red" : "text-tcr-green"}`}>
                              {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                            </span>
                            {/* Cliente/Documento: Melhorado para BMP vs Bitso */}
                            {transaction.bitsoData ? (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">Cliente: {transaction.document || "—"}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">Cliente: {transaction.client || "Cliente não identificado"}</p>
                            )}
                            
                            {/* Informações específicas da Bitso no mobile */}
                            {transaction.bitsoData && (
                              <div className="mt-2 space-y-1">
                                {transaction.document && (
                                  <p className="text-sm font-medium text-card-foreground">
                                    {transaction.document}
                                  </p>
                                )}
                                 {transaction.type === 'CRÉDITO' && transaction.bitsoData.pagador && (
                                   <div className="text-xs text-blue-600">
                                     <p>De: {transaction.bitsoData.pagador.banco || transaction.bitsoData.pagador.chave || 'N/A'}</p>
                                     {transaction.bitsoData.pagador.conta && (
                                       <p className="text-xs text-muted-foreground">
                                         Conta: {transaction.bitsoData.pagador.conta}
                                       </p>
                                     )}
                                   </div>
                                 )}
                                 {transaction.type === 'DÉBITO' && transaction.bitsoData.destinatario && (
                                   <div className="text-xs text-orange-600">
                                     <p>Para: {transaction.bitsoData.destinatario.banco || transaction.bitsoData.destinatario.chave || 'N/A'}</p>
                                     {transaction.bitsoData.destinatario.conta && (
                                       <p className="text-xs text-muted-foreground">
                                         Conta: {transaction.bitsoData.destinatario.conta}
                                       </p>
                                     )}
                                   </div>
                                 )}
                              </div>
                            )}
                            
                            {/* ✅ EXIBIÇÃO BMP NO MOBILE SIMPLIFICADA - Cliente e Banco */}
                            {!transaction.bitsoData && (
                              <div className="mt-2 space-y-1">
                                {transaction.document && (
                                  <p className="text-sm font-medium text-card-foreground">
                                    Doc: {transaction.document}
                                  </p>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  BMP - Banco Master Pagamentos
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {transaction.type === 'CRÉDITO' && (
                              /* ✅ Botão OTC - todos os provedores (Mobile) */
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleCreditToOTC(transaction, e)}
                                disabled={isRecordCredited(transaction)}
                                className={cn(
                                  "h-8 px-2 text-xs transition-all",
                                  isRecordCredited(transaction)
                                    ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                                    : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                )}
                                title={isRecordCredited(transaction) ? "Já creditado para cliente OTC" : "Creditar para cliente OTC"}
                              >
                                {isRecordCredited(transaction) ? (
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleCopyCode(transaction.code, e)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-muted flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1">{transaction.client || "—"}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {transaction.identified ? (
                              <span className="text-tcr-green">✓ Identificado</span>
                            ) : (
                              <span className="text-amber-400">? Flutuante</span>
                            )}
                            <span className="font-mono text-muted-foreground">{transaction.code.slice(-8)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* 📄 PAGINAÇÃO TRADICIONAL MOBILE */}
                {pageInfo && pageInfo.totalPages > 1 && (
                  <div className="mt-6 p-4 border-t border-border bg-muted/10">
                    
                    {/* Info da página atual */}
                    <div className="text-center text-sm text-muted-foreground mb-4">
                      Mostrando {pageInfo.startItem} a {pageInfo.endItem} de {pageInfo.totalItems} registros
                      <br />
                      <span className="text-primary">Página {pageInfo.currentPage} de {pageInfo.totalPages}</span>
                    </div>
                    
                    {/* Controles de navegação mobile */}
                    <div className="flex flex-col gap-3">
                      
                      {/* Linha 1: Primeira, Anterior, Próxima, Última */}
                      <div className="flex justify-center gap-2">
                        <Button
                          onClick={firstPage}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          ⏮️ Primeira
                        </Button>
                        <Button
                          onClick={prevPage}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          ← Anterior
                        </Button>
                        <Button
                          onClick={nextPage}
                          disabled={currentPage === pageInfo.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Próxima →
                        </Button>
                        <Button
                          onClick={lastPage}
                          disabled={currentPage === pageInfo.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Última ⏭️
                        </Button>
                      </div>
                      
                      {/* Linha 2: Números das páginas (máximo 3 em mobile) */}
                      <div className="flex justify-center gap-1">
                        {Array.from({ length: Math.min(3, pageInfo.totalPages) }, (_, i) => {
                          let pageNum;
                          if (pageInfo.totalPages <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage <= 2) {
                            pageNum = i + 1;
                          } else if (currentPage >= pageInfo.totalPages - 1) {
                            pageNum = pageInfo.totalPages - 2 + i;
                          } else {
                            pageNum = currentPage - 1 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              className="h-9 w-12 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 📊 INFORMAÇÕES DE PAGINAÇÃO MOBILE */}
                {pageInfo && (
                  <div className="text-center text-xs text-muted-foreground mt-4 p-4 bg-muted/20 rounded-lg">
                    <div className="space-y-2">
                      <div>📄 Página {pageInfo.currentPage} de {pageInfo.totalPages}</div>
                      <div>📊 Total: {pageInfo.totalItems} registros • 📋 {pageInfo.pageSize} por página</div>
                      <div className="text-blue-600">💾 {provider?.toUpperCase()} Provider</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🚀 PAGINAÇÃO INFINITA JÁ IMPLEMENTADA ACIMA */}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal melhorado e responsivo */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-0">
          <DialogHeader className="relative p-4 sm:p-6 border-b border-border">
            <DialogTitle className="text-lg sm:text-xl font-bold text-card-foreground flex items-center gap-2 pr-8">
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Detalhes da Transação</span>
            </DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogClose>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Card principal com valor destacado - Mobile First */}
              <Card className="bg-gradient-to-r from-muted/20 to-muted/10 border border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="text-center space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Badge className={`${getTypeConfig(selectedTransaction.type).className} px-3 py-1 text-sm font-semibold`}>
                        {selectedTransaction.type}
                      </Badge>
                      {selectedTransaction.identified ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-3 py-1 text-sm">
                          ✓ Identificado
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-3 py-1 text-sm">
                          ? Flutuante
                        </Badge>
                      )}
                    </div>
                    <div className={`text-3xl sm:text-4xl font-bold font-mono ${selectedTransaction.type === 'DÉBITO' ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      {selectedTransaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(selectedTransaction.value)}
                    </div>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {formatDate(selectedTransaction.dateTime)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Informações em layout responsivo */}
              <div className="space-y-4">
                {/* Informações Básicas */}
                <Card className="bg-muted/10 border border-border">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      Informações Básicas
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                        <span className="text-sm text-muted-foreground font-medium">ID da Transação:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-card-foreground font-mono break-all">{selectedTransaction.id}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleCopyCode(selectedTransaction.id, {} as React.MouseEvent)}
                            className="h-6 w-6 p-0 rounded flex-shrink-0 hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                        <span className="text-sm text-muted-foreground font-medium">Código de Referência:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-card-foreground font-mono">{selectedTransaction.code}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleCopyCode(selectedTransaction.code, {} as React.MouseEvent)}
                            className="h-6 w-6 p-0 rounded flex-shrink-0 hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                        <span className="text-sm text-muted-foreground font-medium">Data e Hora:</span>
                        <span className="text-sm text-card-foreground font-mono">{selectedTransaction.dateTime}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detalhes da Transação */}
                <Card className="bg-muted/10 border border-border">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Detalhes da Transação
                      {selectedTransaction.bitsoData && (
                        <Badge className="bg-orange-50 text-orange-700 border-orange-200 ml-2">
                          Bitso PIX
                        </Badge>
                      )}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground font-medium">Documento:</span>
                        <span className="text-sm text-card-foreground bg-muted/30 rounded-lg p-2 break-words">
                          {selectedTransaction.bitsoData ? selectedTransaction.client : selectedTransaction.document}
                        </span>
                      </div>
                      
                      {((selectedTransaction.bitsoData && selectedTransaction.document) || (!selectedTransaction.bitsoData && selectedTransaction.client)) && (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground font-medium">Cliente:</span>
                          <span className="text-sm text-card-foreground bg-muted/30 rounded-lg p-2 break-words">
                            {selectedTransaction.bitsoData ? selectedTransaction.document : selectedTransaction.client}
                          </span>
                        </div>
                      )}

                      {/* *** INFORMAÇÕES ESPECÍFICAS DA BITSO *** */}
                      {selectedTransaction.bitsoData && (
                        <>
                          {/* Dados do Pagador */}
                          {selectedTransaction.bitsoData.pagador && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-muted-foreground font-medium">
                                Pagador {selectedTransaction.type === 'CRÉDITO' ? '(Quem enviou)' : '(Nossa conta)'}:
                              </span>
                              <div className="text-sm text-card-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
                                {selectedTransaction.bitsoData.pagador.nome && (
                                  <div><strong>Nome:</strong> {selectedTransaction.bitsoData.pagador.nome}</div>
                                )}
                                {selectedTransaction.bitsoData.pagador.documento && (
                                  <div><strong>Documento:</strong> {selectedTransaction.bitsoData.pagador.documento}</div>
                                )}
                                {selectedTransaction.bitsoData.pagador.chave && (
                                  <div>
                                    <strong>Chave PIX:</strong> {selectedTransaction.bitsoData.pagador.chave}
                                    {selectedTransaction.bitsoData.pagador.tipo_chave && (
                                      <span className="ml-2 text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                        {selectedTransaction.bitsoData.pagador.tipo_chave}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {selectedTransaction.bitsoData.pagador.banco && (
                                  <div><strong>Banco:</strong> {selectedTransaction.bitsoData.pagador.banco}</div>
                                )}
                                {selectedTransaction.bitsoData.pagador.agencia && selectedTransaction.bitsoData.pagador.conta && (
                                  <div>
                                    <strong>Conta:</strong> Ag: {selectedTransaction.bitsoData.pagador.agencia} | Conta: {selectedTransaction.bitsoData.pagador.conta}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Dados do Destinatário */}
                          {selectedTransaction.bitsoData.destinatario && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-muted-foreground font-medium">
                                Destinatário {selectedTransaction.type === 'DÉBITO' ? '(Quem recebeu)' : '(Nossa conta)'}:
                              </span>
                              <div className="text-sm text-card-foreground bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 space-y-1">
                                {selectedTransaction.bitsoData.destinatario.nome && (
                                  <div><strong>Nome:</strong> {selectedTransaction.bitsoData.destinatario.nome}</div>
                                )}
                                {selectedTransaction.bitsoData.destinatario.documento && (
                                  <div><strong>Documento:</strong> {selectedTransaction.bitsoData.destinatario.documento}</div>
                                )}
                                {selectedTransaction.bitsoData.destinatario.chave && (
                                  <div>
                                    <strong>Chave PIX:</strong> {selectedTransaction.bitsoData.destinatario.chave}
                                    {selectedTransaction.bitsoData.destinatario.tipo_chave && (
                                      <span className="ml-2 text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                                        {selectedTransaction.bitsoData.destinatario.tipo_chave}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {selectedTransaction.bitsoData.destinatario.banco && (
                                  <div><strong>Banco:</strong> {selectedTransaction.bitsoData.destinatario.banco}</div>
                                )}
                                {selectedTransaction.bitsoData.destinatario.agencia && selectedTransaction.bitsoData.destinatario.conta && (
                                  <div>
                                    <strong>Conta:</strong> Ag: {selectedTransaction.bitsoData.destinatario.agencia} | Conta: {selectedTransaction.bitsoData.destinatario.conta}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Metadados da Transação */}
                          {selectedTransaction.bitsoData.metadados && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-muted-foreground font-medium">Informações Técnicas:</span>
                              <div className="text-sm text-card-foreground bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                                {selectedTransaction.bitsoData.metadados.end_to_end_id && (
                                  <div>
                                    <strong>End-to-End ID:</strong> 
                                    <span className="ml-2 font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                                      {selectedTransaction.bitsoData.metadados.end_to_end_id}
                                    </span>
                                  </div>
                                )}
                                {selectedTransaction.bitsoData.metadados.protocolo && (
                                  <div><strong>Protocolo:</strong> {selectedTransaction.bitsoData.metadados.protocolo}</div>
                                )}
                                {selectedTransaction.bitsoData.metadados.integration && (
                                  <div><strong>Integração:</strong> {selectedTransaction.bitsoData.metadados.integration}</div>
                                )}
                                {selectedTransaction.bitsoData.metadados.origin_id && (
                                  <div>
                                    <strong>Origin ID:</strong> 
                                    <span className="ml-2 font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                                      {selectedTransaction.bitsoData.metadados.origin_id}
                                    </span>
                                  </div>
                                )}
                                {selectedTransaction.bitsoData.metadados.referencia && (
                                  <div><strong>Referência:</strong> {selectedTransaction.bitsoData.metadados.referencia}</div>
                                )}
                                {selectedTransaction.bitsoData.metadados.taxa !== undefined && selectedTransaction.bitsoData.metadados.taxa > 0 && (
                                  <div><strong>Taxa:</strong> R$ {selectedTransaction.bitsoData.metadados.taxa.toFixed(2)}</div>
                                )}
                                {selectedTransaction.bitsoData.metadados.observacoes && (
                                  <div><strong>Observações:</strong> {selectedTransaction.bitsoData.metadados.observacoes}</div>
                                )}
                                {selectedTransaction.bitsoData.metadados.motivo_falha && (
                                  <div className="text-red-600 dark:text-red-400">
                                    <strong>Motivo da Falha:</strong> {selectedTransaction.bitsoData.metadados.motivo_falha}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Dados JSON - Colapsar em mobile */}
                <Card className="bg-muted/10 border border-border">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Dados Completos (JSON)
                    </h3>
                    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 sm:p-4 border border-border overflow-hidden">
                      <pre className="text-xs sm:text-sm overflow-auto text-green-400 leading-relaxed max-h-32 sm:max-h-60 whitespace-pre-wrap break-words">
                        {JSON.stringify(selectedTransaction, null, 2)}
                      </pre>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleCopyCode(JSON.stringify(selectedTransaction, null, 2), {} as React.MouseEvent)}
                        className="text-xs"
                      >
                        <Copy className="h-3 w-3" />
                        Copiar JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Ações do Modal - Mobile */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => handleCopyCode(selectedTransaction.code, {} as React.MouseEvent)}
                  className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <Copy className="h-3 w-3" />
                  Copiar Código
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Crédito OTC (individual) */}
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

      {/* Modal de Compensação Inteligente - BMP-531 */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={handleCloseCompensationModal}
        extractRecord={selectedCompensationRecord}
      />
    </div>
  );
}