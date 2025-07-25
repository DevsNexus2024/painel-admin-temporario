import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
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
import { useExtratoSeguro } from "@/hooks/useExtratoSeguro";
import { validarIntervaloData, formatarDataParaAPI, MovimentoExtrato, ExtratoResponse } from "@/services/extrato";
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";
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
  
  // *** NOVA PAGINAÇÃO FRONTEND ***
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 200; // Mostrar 50 transações por página
  
  // Novos estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");

  // Estados para o modal de crédito OTC
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<MovimentoExtrato | null>(null);

  // ✅ ADICIONADO: Hook para verificar o provedor ativo
  const bankFeatures = useBankFeatures();

  // 🚨 USAR HOOK ULTRA-SEGURO QUE NÃO PERMITE MISTURA
  const { 
    data: extratoData, 
    isLoading, 
    error,
    refetch 
  } = useExtratoSeguro({ 
    filtros: filtrosAtivos,
    enabled: true
  });

  const transactions = (extratoData as ExtratoResponse)?.items || [];
  const hasMore = (extratoData as ExtratoResponse)?.hasMore || false;
  const currentCursor = (extratoData as ExtratoResponse)?.cursor || 0;

  // 🚨 CRÍTICO: Limpar dados antigos quando há erro para evitar contaminação
  useEffect(() => {
    if (error) {
      console.log('🧹 [ExtractTable] Erro detectado - resetando página para evitar contaminação');
      setCurrentPage(1);
    }
  }, [error]);

  // 🚨 CRÍTICO: Resetar página quando mudar filtros
  useEffect(() => {
    console.log('🧹 [ExtractTable] Mudança detectada - resetando página para nova consulta');
    setCurrentPage(1);
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
    }
    return null;
  };

  // Função para filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtro por nome do cliente
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase().trim();
      filtered = filtered.filter(transaction => 
        transaction.client?.toLowerCase().includes(searchTerm) ||
        transaction.document?.toLowerCase().includes(searchTerm)
      );
    }

    // Filtro por valor
    if (searchValue.trim()) {
      const searchAmount = parseFloat(searchValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(searchAmount)) {
        filtered = filtered.filter(transaction => 
          Math.abs(transaction.value - searchAmount) < 0.01
        );
      }
    }

    // Ordenação
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
  }, [transactions, searchName, searchValue, sortBy, sortOrder]);

  // *** NOVA PAGINAÇÃO FRONTEND ***
  const totalItems = filteredAndSortedTransactions.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  // Usar transações da página atual
  const displayTransactions = currentPageTransactions;

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

    const novosFiltros: FiltrosAtivos = {
      // ✅ REMOVIDO cursor: 0 que causa erro na API Bitso
      ...(dateFrom && dateTo && {
        de: formatarDataParaAPI(dateFrom),
        ate: formatarDataParaAPI(dateTo)
      })
    };

    // Resetar para primeira página
    setCurrentPage(1);
    setFiltrosAtivos(novosFiltros);
    toast.success("Filtros aplicados com sucesso!");
  };

  const handleLimparFiltros = async () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchName("");
    setSearchValue("");
    setSortBy("none");
    setSortOrder("none");
    setCurrentPage(1);
    setFiltrosAtivos({});
    toast.success("Filtros limpos!");
  };

  // *** NOVAS FUNÇÕES DE PAGINAÇÃO ***
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleGoToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Função para abrir modal de crédito OTC
  const handleCreditToOTC = (transaction: MovimentoExtrato, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que abra o modal de detalhes
    setSelectedExtractRecord(transaction);
    setCreditOTCModalOpen(true);
  };

  // Função para fechar modal de crédito OTC
  const handleCloseCreditOTCModal = () => {
    setCreditOTCModalOpen(false);
    setSelectedExtractRecord(null);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
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

          {/* Segunda linha - Filtros de busca por nome e valor */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayTransactions.length} registros filtrados • {displayTransactions.filter(t => t.type === 'DÉBITO').length} débitos • {displayTransactions.filter(t => t.type === 'CRÉDITO').length} créditos
                  {hasMore && <span className="text-blue-500"> • Mais registros disponíveis</span>}
                  {(searchName || searchValue || sortBy !== "none") && (
                    <span className="text-amber-500"> • Filtros ativos</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        
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
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Data/Hora</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Valor</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Tipo</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 min-w-[200px]">Cliente/Banco</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Documento</TableHead>
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
                            onClick={() => handleRowClick(transaction)}
                            className="cursor-pointer hover:bg-muted/20 transition-all duration-200 border-b border-border"
                          >
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
                                {transaction.type === 'CRÉDITO' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => handleCreditToOTC(transaction, e)}
                                    className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                                    title="Creditar para cliente OTC"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    OTC
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleCreditToOTC(transaction, e)}
                                className="h-8 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                title="Creditar para cliente OTC"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                OTC
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
              </div>

              {/* *** NOVA PAGINAÇÃO FRONTEND *** */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-border bg-muted/10">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    
                    {/* Info da página atual */}
                    <div className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, totalItems)} de {totalItems} transações
                      {totalPages > 1 && ` (Página ${currentPage} de ${totalPages})`}
                    </div>
                    
                    {/* Controles de navegação */}
                    <div className="flex items-center gap-2">
                      
                      {/* Botão Anterior */}
                      <Button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                      >
                        ← Anterior
                      </Button>
                      
                      {/* Números das páginas (máximo 5) */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
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
                              onClick={() => handleGoToPage(pageNum)}
                              variant={pageNum === currentPage ? "default" : "outline"}
                              size="sm"
                              className="h-9 w-9 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      {/* Botão Próximo */}
                      <Button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                      >
                        Próximo →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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

      {/* Modal de Crédito OTC */}
      <CreditExtractToOTCModal
        isOpen={creditOTCModalOpen}
        onClose={handleCloseCreditOTCModal}
        extractRecord={selectedExtractRecord}
      />
    </div>
  );
}