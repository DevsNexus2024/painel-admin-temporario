import { useState } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useExtrato } from "@/hooks/useExtrato";
import { validarIntervaloData, formatarDataParaAPI, MovimentoExtrato, ExtratoResponse } from "@/services/extrato";

export default function ExtractTable() {
  const [selectedTransaction, setSelectedTransaction] = useState<MovimentoExtrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [filtrosAtivos, setFiltrosAtivos] = useState({ cursor: 0 });

  // Usar hook de cache para extrato
  const { 
    data: extratoData, 
    isLoading, 
    error,
    refetch 
  } = useExtrato({ 
    filtros: filtrosAtivos,
    staleTime: 3 * 60 * 1000 // 3 minutos para dados com filtros
  });

  const transactions = (extratoData as ExtratoResponse)?.items || [];
  const hasMore = (extratoData as ExtratoResponse)?.hasMore || false;

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
      cursor: 0,
      ...(dateFrom && dateTo && {
        de: formatarDataParaAPI(dateFrom),
        ate: formatarDataParaAPI(dateTo)
      })
    };

    setFiltrosAtivos(novosFiltros);
    toast.success("Filtros aplicados com sucesso!");
  };

  const handleLimparFiltros = async () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setFiltrosAtivos({ cursor: 0 });
    toast.success("Filtros limpos!");
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

  const debitCount = transactions.filter(t => t.type === 'DÉBITO').length;
  const creditCount = transactions.filter(t => t.type === 'CRÉDITO').length;

  return (
    <div className="space-y-6">
      {/* Filtro redesenhado */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Filter className="h-5 w-5 text-white" />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading}
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-blue-500 transition-colors bg-input",
                      !dateFrom && "text-muted-foreground"
                    )}
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
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-blue-500 transition-colors bg-input",
                      !dateTo && "text-muted-foreground"
                    )}
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
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
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

      {/* Tabela redesenhada - versão responsiva melhorada */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
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
                  {transactions.length} registros • {debitCount} débitos • {creditCount} créditos
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
          ) : transactions.length === 0 ? (
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
              {/* Versão Desktop - tabela compacta */}
              <div className="hidden xl:block">
                <div className="max-h-[65vh] overflow-y-auto scrollbar-thin">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur-sm z-10">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        <TableHead className="font-semibold text-card-foreground py-3 w-[110px]">Data/Hora</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[120px]">Valor</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[80px]">Tipo</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Documento</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Cliente</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[90px]">Status</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Código</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => {
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
                            <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[140px]">
                              {transaction.document}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[100px]">
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
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs text-muted-foreground truncate max-w-[70px]">
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

              {/* Versão Tablet - Cards em lista */}
              <div className="xl:hidden space-y-3 p-4">
                {transactions.map((transaction) => {
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
                        <Copy className="h-3 w-3 mr-2" />
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
                  <Copy className="h-4 w-4 mr-2" />
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