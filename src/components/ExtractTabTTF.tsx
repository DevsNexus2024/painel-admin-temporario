import React, { useState, useEffect, useMemo } from "react";
import { Copy, Filter, Download, Eye, Calendar as CalendarIcon, FileText, X, Loader2, AlertCircle, RefreshCw, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown, Plus, Check, DollarSign, Trash2 } from "lucide-react";
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
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import { TCRVerificacaoService } from "@/services/tcrVerificacao";

// ✅ CNPJ FIXO: TTF SERVICOS DIGITAIS LTDA
const TTF_CNPJ = "14283885000198";

// Componente completo para o Extrato TTF (baseado no ExtractTabTCR)
export default function ExtractTabTTF() {
  // Estados para controle de dados
  const [isLoading, setIsLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  
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

  // Estados para filtros - iniciando com período padrão de 3 dias
  const defaultDates = getDefaultDates();
  const [dateFrom, setDateFrom] = useState<Date>(defaultDates.dateFrom);
  const [dateTo, setDateTo] = useState<Date>(defaultDates.dateTo);
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDescCliente, setSearchDescCliente] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"todos" | "debito" | "credito">("todos");
  const [tipoApiFilter, setTipoApiFilter] = useState<"todos" | "C" | "D">("todos"); // Filtro adicional por tipo C/D
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("desc");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("date");
  
  // Estados para paginação server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const ITEMS_PER_PAGE = 100; // 🚀 API CorpX retorna 100 registros por página
  
  // Estados para modal
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Estados para funcionalidade Compensação Inteligente (MODAL COMPLETO)
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<any>(null);

  // ✅ Conversão de dados já processados do serviço CorpX
  const convertCorpXToStandardFormat = (transaction: any) => {
    const descricao = transaction.description || '';
    let cliente = descricao.includes(' - ') 
      ? descricao.split(' - ')[1] || 'Cliente não identificado'
      : 'Cliente não identificado';
    
    // ✅ Se temos dados do pagador no _original, usar o nome completo
    if (transaction._original?.payerName) {
      cliente = transaction._original.payerName;
    }

    const resultado = {
      id: transaction.id || Date.now().toString(),
      dateTime: transaction.date || new Date().toISOString(),
      value: transaction.amount || 0,
      type: transaction.type === 'credit' ? 'CRÉDITO' : 'DÉBITO',
      client: cliente,
      document: transaction._original?.payerDocument || '',
      code: transaction._original?.nrMovimento || transaction.id || '',
      descCliente: descricao,
      identified: true,
      descricaoOperacao: descricao,
      // ✅ Campos originais COMPLETOS para funcionalidades como verificação de endtoend
      _original: transaction._original || transaction
    };
    
    return resultado;
  };

  // ✅ Aplicar filtros
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = allTransactions.map(convertCorpXToStandardFormat);

    // Filtros de busca
    filtered = filtered.filter((transaction) => {
      const matchesName = !searchName || 
        transaction.client?.toLowerCase().includes(searchName.toLowerCase()) ||
        transaction.document?.toLowerCase().includes(searchName.toLowerCase());
      
      const matchesValue = !searchValue || 
        Math.abs(transaction.value).toString().includes(searchValue);
      
      const matchesDescCliente = !searchDescCliente || 
        transaction.descCliente?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction.client?.toLowerCase().includes(searchDescCliente.toLowerCase());

      const matchesType = transactionTypeFilter === "todos" || 
        (transactionTypeFilter === "debito" && transaction.type === "DÉBITO") ||
        (transactionTypeFilter === "credito" && transaction.type === "CRÉDITO");
      
      // ✅ Filtro adicional por tipo da API (C ou D)
      const tipoOriginal = (transaction as any)._original?.tipo || (transaction as any).originalItem?.tipo || '';
      const matchesTipoApi = tipoApiFilter === "todos" ||
        (tipoApiFilter === "C" && tipoOriginal === "C") ||
        (tipoApiFilter === "D" && tipoOriginal === "D");

      // ✅ Filtro de data no frontend
      let matchesDate = true;
      if (dateFrom && dateTo) {
        try {
          const transactionDate = new Date(transaction.dateTime);
          const fromDate = new Date(dateFrom);
          const toDate = new Date(dateTo);
          
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
          
          matchesDate = transactionDate >= fromDate && transactionDate <= toDate;
        } catch (error) {
          matchesDate = true;
        }
      }

      return matchesName && matchesValue && matchesDescCliente && matchesType && matchesTipoApi && matchesDate;
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
  }, [allTransactions, searchName, searchValue, searchDescCliente, transactionTypeFilter, tipoApiFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // ✅ Paginação CLIENT-SIDE das transações JÁ FILTRADAS
  const ITEMS_PER_PAGE_CLIENT = 50; // Mostrar 50 por página no frontend
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE_CLIENT;
  const endIndex = startIndex + ITEMS_PER_PAGE_CLIENT;
  const displayTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);
  
  // Calcular total de páginas client-side
  const totalPagesClient = Math.ceil(filteredAndSortedTransactions.length / ITEMS_PER_PAGE_CLIENT);

  // ✅ Totalizadores
  const debitCount = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').length;
  const creditCount = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').length;
  const totalDebito = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').reduce((sum, t) => sum + t.value, 0);
  const totalCredito = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').reduce((sum, t) => sum + t.value, 0);

  // ✅ Carregar TODAS as transações (todas as páginas) e depois filtrar
  const loadTTFTransactions = async (customDateFrom?: Date, customDateTo?: Date, page: number = 1) => {
    try {
      setIsLoading(true);
      setError("");
      
      // ✅ Usar datas customizadas ou datas selecionadas ou período padrão de 3 dias
      let dataInicio, dataFim;
      
      if (customDateFrom && customDateTo) {
        dataInicio = customDateFrom.toISOString().split('T')[0];
        dataFim = customDateTo.toISOString().split('T')[0];
      } else if (dateFrom && dateTo) {
        dataInicio = dateFrom.toISOString().split('T')[0];
        dataFim = dateTo.toISOString().split('T')[0];
      } else {
        const hoje = new Date();
        const doisDiasAtras = new Date();
        doisDiasAtras.setDate(hoje.getDate() - 2);
        
        dataInicio = doisDiasAtras.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
      }
      
      const { consultarExtratoCorpX } = await import('@/services/corpx');
      
      // 🚀 BUSCAR TODAS AS PÁGINAS
      let todasTransacoes: any[] = [];
      let paginaAtual = 1;
      let continuar = true;
      
      
      while (continuar) {
        const params = {
          cnpj: TTF_CNPJ,
          dataInicio,
          dataFim,
          page: paginaAtual
        };
        
        const resultado = await consultarExtratoCorpX(params);
        
        if (resultado && !resultado.erro && resultado.transactions && resultado.transactions.length > 0) {
          // ✅ Filtrar registro "Saldo Atual" que vem da API
          const transacoesReais = resultado.transactions.filter((t: any) => {
            const original = t.originalItem || t._original || t;
            return original.data !== "Saldo Atual" && original.descricao !== "Saldo Atual";
          });
          
          todasTransacoes = [...todasTransacoes, ...transacoesReais];
          
          // Continuar se tiver página cheia (100 transações reais)
          if (transacoesReais.length >= ITEMS_PER_PAGE) {
            paginaAtual++;
          } else {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }
      
      
      if (todasTransacoes.length > 0) {
        // 🔍 DEBUG: Ver estrutura das transações
        
        // ✅ FILTRO ESPECÍFICO TTF: 
        // - Créditos: apenas pixKey = 94ae2011-b8d5-4621-b4fa-db4042327693
        // - Débitos: apenas pixKey = pix@brasilbitcoin.com.br
        const transacoesFiltradas = todasTransacoes.filter((transaction: any, index: number) => {
          // ✅ Acessar dados originais do CorpX via originalItem
          const original = transaction.originalItem || transaction._original || transaction;
          const tipo = transaction.type; // Já vem processado como 'credit' ou 'debit'
          const beneficiaryPixKey = original.beneficiary?.pixKey;
          
          if (tipo === 'credit') {
            // Crédito: aceitar apenas se pixKey beneficiary = 94ae2011-b8d5-4621-b4fa-db4042327693
            const aceita = beneficiaryPixKey === '94ae2011-b8d5-4621-b4fa-db4042327693';
            if (aceita) {
            }
            return aceita;
          } else if (tipo === 'debit') {
            // Débito: aceitar apenas se pixKey beneficiary = pix@brasilbitcoin.com.br
            const aceita = beneficiaryPixKey === 'pix@brasilbitcoin.com.br';
            if (aceita) {
            }
            return aceita;
          }
          
          return false; // Rejeitar qualquer outro tipo
        });
        
        
        setAllTransactions(transacoesFiltradas);
        setCurrentPage(1); // Resetar para página 1
        
        toast.success(`${transacoesFiltradas.length} transações filtradas`, {
          description: `De ${todasTransacoes.length} transações totais`,
          duration: 2000
        });
      } else {
        setAllTransactions([]);
        toast.info("Nenhuma transação encontrada", {
          description: "Tente ajustar os filtros de data",
          duration: 3000
        });
      }
      
    } catch (err: any) {
      console.error('[TTF-EXTRATO-UI] ❌ Erro:', err);
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

  // 🚀 Navegação de página CLIENT-SIDE (das transações filtradas)
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPagesClient) {
      setCurrentPage(newPage);
    }
  };

  // ✅ Aplicar filtros
  const handleAplicarFiltros = () => {
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        toast.error("Data inicial não pode ser maior que data final", {
          description: "Verifique as datas selecionadas",
          duration: 3000
        });
        return;
      }
      
      setCurrentPage(1); // Voltar para página 1
      loadTTFTransactions(dateFrom, dateTo);
    } else {
      toast.warning("Selecione o período de datas", {
        description: "É necessário informar data inicial e final",
        duration: 3000
      });
    }
  };

  // ✅ Limpar todos os filtros
  const handleLimparFiltros = () => {
    const defaultDates = getDefaultDates();
    setDateFrom(defaultDates.dateFrom);
    setDateTo(defaultDates.dateTo);
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setTransactionTypeFilter("todos");
    setTipoApiFilter("todos");
    setSortBy("date");
    setSortOrder("desc");
    setCurrentPage(1);
    
    toast.info("Filtros limpos - período padrão de 3 dias", {
      description: "Recarregando transações...",
      duration: 2000
    });
    
    loadTTFTransactions(defaultDates.dateFrom, defaultDates.dateTo);
  };

  // ✅ Abrir modal de detalhes
  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  // ✅ Copiar descrição
  const handleCopyDescription = (description: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(description);
    toast.success("Descrição copiada!", {
      duration: 2000
    });
  };

  // ✅ Exportar para CSV
  const handleExportCSV = () => {
    if (filteredAndSortedTransactions.length === 0) {
      toast.warning("Nenhuma transação para exportar");
      return;
    }

    const csvContent = [
      ["Data/Hora", "Descrição", "Valor", "Tipo", "Cliente", "Documento"].join(";"),
      ...filteredAndSortedTransactions.map(t => [
        format(new Date(t.dateTime), "dd/MM/yyyy HH:mm:ss"),
        t.descCliente,
        t.value.toFixed(2).replace('.', ','),
        t.type,
        t.client,
        t.document
      ].join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_ttf_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV exportado com sucesso!");
  };

  // ✅ Handler para Verificar transação (BOTÃO VERIFICAR)
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
    
    // ✅ Buscar id_usuario automaticamente via endtoend
    try {
      toast.info('Buscando usuário...', {
        description: 'Verificando endtoend da transação via API'
      });
      
      const resultado = await TCRVerificacaoService.verificarTransacaoTCR(transaction);
      
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
      console.error('[TTF-VERIFICACAO] Erro:', error);
      toast.error('Erro na verificação automática', {
        description: 'Modal aberto - você pode informar o ID manualmente'
      });
    }
    
    // ✅ SEMPRE abrir o modal (com ou sem id_usuario encontrado)
    setSelectedCompensationRecord(extractRecord);
    setCompensationModalOpen(true);
  };

  // ✅ Carregar dados ao montar o componente com período padrão de 3 dias
  useEffect(() => {
    loadTTFTransactions(dateFrom, dateTo);
  }, []);

  return (
    <div className="space-y-6">
      {/* Filtros de Pesquisa - TTF */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Filtros de Pesquisa - TTF
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize sua consulta de extratos
                </p>
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
              TTF → TCR
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Grid de Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de Data Inicial */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal hover:bg-muted/50 transition-colors",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro de Data Final */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal hover:bg-muted/50 transition-colors",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro de Cliente/Nome */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Cliente/Documento</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-10 hover:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Filtro de Valor */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Valor</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar valor..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-10 hover:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Filtro de Descrição */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Descrição</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar descrição..."
                  value={searchDescCliente}
                  onChange={(e) => setSearchDescCliente(e.target.value)}
                  className="pl-10 hover:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Filtro de Tipo */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Tipo</label>
              <Select value={transactionTypeFilter} onValueChange={(value: any) => setTransactionTypeFilter(value)}>
                <SelectTrigger className="hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Tipo API (C/D) */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Tipo API (C/D)</label>
              <Select value={tipoApiFilter} onValueChange={(value: "todos" | "C" | "D") => setTipoApiFilter(value)}>
                <SelectTrigger className="hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="C">Apenas C (Crédito)</SelectItem>
                  <SelectItem value="D">Apenas D (Débito)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordenação */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Ordenar por</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordem */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Ordem</label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Padrão</SelectItem>
                  <SelectItem value="asc">Crescente</SelectItem>
                  <SelectItem value="desc">Decrescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
            <Button 
              onClick={handleAplicarFiltros}
              className="flex-1 min-w-[200px] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Search className="mr-2 h-4 w-4" />
              Aplicar Filtros
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLimparFiltros}
              className="flex-1 min-w-[200px] hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all duration-200"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              disabled={filteredAndSortedTransactions.length === 0}
              className="flex-1 min-w-[200px] hover:bg-green-50 hover:text-green-700 hover:border-green-500 transition-all duration-200"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Total Débito</p>
                <p className="text-2xl font-bold text-red-700">
                  {totalDebito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-red-600 mt-1">{debitCount} transações</p>
              </div>
              <ArrowDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Crédito</p>
                <p className="text-2xl font-bold text-green-700">
                  {totalCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-green-600 mt-1">{creditCount} transações</p>
              </div>
              <ArrowUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Saldo Líquido</p>
                <p className="text-2xl font-bold text-blue-700">
                  {(totalCredito - totalDebito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-blue-600 mt-1">Período selecionado</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Transações</p>
                <p className="text-2xl font-bold text-purple-700">{filteredAndSortedTransactions.length}</p>
                <p className="text-xs text-purple-600 mt-1">Página {currentPage} de {totalPages}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Transações */}
      <Card className="shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">Extrato de Transações - TTF</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {displayTransactions.length} registros
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadTTFTransactions(dateFrom, dateTo, currentPage)}
                disabled={isLoading}
                className="hover:bg-muted/50"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando transações...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button 
                variant="outline" 
                onClick={() => loadTTFTransactions(dateFrom, dateTo, currentPage)}
              >
                Tentar Novamente
              </Button>
            </div>
          ) : displayTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Data/Hora</TableHead>
                      <TableHead className="font-semibold">Descrição</TableHead>
                      <TableHead className="font-semibold text-right">Valor</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayTransactions.map((transaction, index) => (
                      <TableRow 
                        key={`${transaction.id}-${index}`}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleTransactionClick(transaction)}
                      >
                        <TableCell className="font-mono text-xs">
                          {format(new Date(transaction.dateTime), "dd/MM/yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm">{transaction.descCliente}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleCopyDescription(transaction.descCliente, e)}
                              className="h-6 w-6 p-0 hover:bg-muted"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-right font-semibold">
                          <span className={transaction.type === 'CRÉDITO' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.type === 'CRÉDITO' ? 'default' : 'destructive'} className="text-xs">
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{transaction.client}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            {/* ✅ BOTÃO VERIFICAR */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleVerificarTransacao(transaction, e)}
                              className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-500"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Verificar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4 p-4">
                {displayTransactions.map((transaction, index) => (
                  <Card 
                    key={`${transaction.id}-${index}`}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant={transaction.type === 'CRÉDITO' ? 'default' : 'destructive'}>
                          {transaction.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(transaction.dateTime), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{transaction.client}</p>
                        <p className="text-xs text-muted-foreground truncate">{transaction.descCliente}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className={cn(
                          "text-lg font-bold",
                          transaction.type === 'CRÉDITO' ? 'text-green-600' : 'text-red-600'
                        )}>
                          {transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {/* ✅ BOTÃO VERIFICAR Mobile */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleVerificarTransacao(transaction, e)}
                          className="hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Verificar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPagesClient || 1} • {filteredAndSortedTransactions.length} transações filtradas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPagesClient || isLoading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Transação</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                  <p className="text-sm font-mono">{format(new Date(selectedTransaction.dateTime), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                  <p className="text-sm">
                    <Badge variant={selectedTransaction.type === 'CRÉDITO' ? 'default' : 'destructive'}>
                      {selectedTransaction.type}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valor</label>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedTransaction.type === 'CRÉDITO' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {selectedTransaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="text-sm">{selectedTransaction.client}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm">{selectedTransaction.descCliente}</p>
                </div>
                {selectedTransaction.document && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Documento</label>
                    <p className="text-sm font-mono">{selectedTransaction.document}</p>
                  </div>
                )}
                {selectedTransaction.code && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Código</label>
                    <p className="text-sm font-mono">{selectedTransaction.code}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ Modal Compensação Inteligente - EXATAMENTE o mesmo do TCR */}
      <CompensationModalInteligente
        isOpen={compensationModalOpen}
        onClose={() => setCompensationModalOpen(false)}
        extractRecord={selectedCompensationRecord}
      />
    </div>
  );
}

