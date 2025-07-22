import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

export default function ExtractTable() {
  const [selectedTransaction, setSelectedTransaction] = useState<MovimentoExtrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [filtrosAtivos, setFiltrosAtivos] = useState({ cursor: 0 });
  const [allTransactions, setAllTransactions] = useState<MovimentoExtrato[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Novos estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");

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

  // Acumular transações quando novos dados chegarem
  useEffect(() => {
    if (transactions.length > 0) {
      if (filtrosAtivos.cursor === 0) {
        // Nova busca - substitui todos os dados
        setAllTransactions(transactions);
      } else {
        // Carregando mais - adiciona aos existentes
        setAllTransactions(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTransactions = transactions.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTransactions];
        });
      }
      setIsLoadingMore(false);
    }
  }, [transactions, filtrosAtivos.cursor]);

  // 🚨 CRÍTICO: Limpar dados antigos quando há erro para evitar contaminação
  useEffect(() => {
    if (error) {
      console.log('🧹 [ExtractTable] Erro detectado - limpando transações antigas para evitar contaminação');
      setAllTransactions([]);
    }
  }, [error]);

  // 🚨 CRÍTICO: Limpar dados quando mudar de conta para evitar mistura de providers
  useEffect(() => {
    console.log('🧹 [ExtractTable] Mudança detectada - limpando transações para nova consulta');
    setAllTransactions([]);
  }, [filtrosAtivos]); // Quando filtros mudam (incluindo mudança de conta)

  // Função para filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Filtro por nome do cliente
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase().trim();
      filtered = filtered.filter(transaction => 
        transaction.client?.toLowerCase().includes(searchTerm) ||
        transaction.document?.toLowerCase().includes(searchTerm)
      );
    }

    // Filtro por valor específico
    if (searchValue.trim()) {
      const searchValueNum = parseFloat(searchValue.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(searchValueNum)) {
        filtered = filtered.filter(transaction => 
          Math.abs(transaction.value - searchValueNum) < 0.01
        );
      }
    }

    // Ordenação
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "value") {
          comparison = a.value - b.value;
        } else if (sortBy === "date") {
          const dateA = new Date(a.dateTime).getTime();
          const dateB = new Date(b.dateTime).getTime();
          comparison = dateA - dateB;
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [allTransactions, searchName, searchValue, sortBy, sortOrder]);

  // Usar transações filtradas em vez de displayTransactions
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

    const novosFiltros = {
      cursor: 0, // Reset cursor para nova busca
      ...(dateFrom && dateTo && {
        de: formatarDataParaAPI(dateFrom),
        ate: formatarDataParaAPI(dateTo)
      })
    };

    // Limpar transações acumuladas para nova busca
    setAllTransactions([]);
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
    setAllTransactions([]);
    setFiltrosAtivos({ cursor: 0 });
    toast.success("Filtros limpos!");
  };

  const handleCarregarMais = () => {
    setIsLoadingMore(true);
    setFiltrosAtivos(prev => ({
      ...prev,
      cursor: currentCursor
    }));
  };

  const handleRefresh = () => {
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
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Extrato de Transações
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
                        <TableHead className="font-semibold text-card-foreground py-3 min-w-[200px]">Documento</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Cliente</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Status</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Código</TableHead>
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
                              {transaction.document}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                              {transaction.client || "—"}
                            </TableCell>
                            <TableCell className="py-3">
                              {transaction.identified ? (
                                <Badge className="bg-tcr-green/20 text-tcr-green border-tcr-green/30 rounded-full px-2 py-1 text-xs font-semibold">
                                  ✓
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-full px-2 py-1 text-xs font-semibold">
                                  ?
                                </Badge>
                              )}
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
                          <Badge className={`${typeConfig.className} rounded-full px-2 py-1 text-xs font-semibold`}>
                            {transaction.type}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className={`font-bold text-xl font-mono ${transaction.type === 'DÉBITO' ? "text-tcr-red" : "text-tcr-green"}`}>
                              {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                            </span>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{transaction.document}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleCopyCode(transaction.code, e)}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-muted flex-shrink-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
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

              {/* Botão Carregar Mais */}
              {hasMore && (
                <div className="p-4 border-t border-border bg-muted/10">
                  <Button
                    onClick={handleCarregarMais}
                    disabled={isLoadingMore}
                    variant="outline"
                    className="w-full h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-background hover:bg-muted/20"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Carregando mais registros...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Carregar mais registros
                      </>
                    )}
                  </Button>
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
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground font-medium">Documento:</span>
                        <span className="text-sm text-card-foreground bg-muted/30 rounded-lg p-2 break-words">
                          {selectedTransaction.document}
                        </span>
                      </div>
                      
                      {selectedTransaction.client && (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground font-medium">Cliente:</span>
                          <span className="text-sm text-card-foreground bg-muted/30 rounded-lg p-2 break-words">
                            {selectedTransaction.client}
                          </span>
                        </div>
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
    </div>
  );
}