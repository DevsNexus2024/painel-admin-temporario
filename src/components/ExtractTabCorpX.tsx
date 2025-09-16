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
import CreditExtractToOTCModal from "@/components/otc/CreditExtractToOTCModal";

// Componente completo para o Extrato CorpX (baseado no BMP 531)
export default function ExtractTabCorpX() {
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("desc");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("date");
  
  // Estados para paginação server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const ITEMS_PER_PAGE = 100; // 🚀 100 registros por página (limite da API CorpX)
  
  // Estados para modal
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Estados para funcionalidade OTC
  const [creditOTCModalOpen, setCreditOTCModalOpen] = useState(false);
  const [selectedExtractRecord, setSelectedExtractRecord] = useState<any>(null);
  const [creditedRecords, setCreditedRecords] = useState<Set<string>>(new Set());

  // ✅ Conversão de dados já processados do serviço CorpX
  const convertCorpXToStandardFormat = (transaction: any) => {
    //console.log('[CORPX-CONVERSAO] 🔄 Convertendo transação processada:', transaction);
    
    // Agora os dados já vêm processados do backend com estrutura:
    // { id, date, description, amount, type: "credit"|"debit", balance }

    // Extrair cliente da descrição (ex: "TRANSF ENVIADA PIX - Felipe Bernardo Costa")
    const descricao = transaction.description || '';
    const cliente = descricao.includes(' - ') 
      ? descricao.split(' - ')[1] || 'Cliente não identificado'
      : 'Cliente não identificado';

    const resultado = {
      id: transaction.id || Date.now().toString(),
      dateTime: transaction.date || new Date().toISOString(),
      value: transaction.amount || 0,
      type: transaction.type === 'credit' ? 'CRÉDITO' : 'DÉBITO',
      client: cliente,
      document: '', // CorpX não retorna documento separado
      code: transaction.id || '',
      descCliente: descricao,
      identified: true, // CorpX sempre identifica transações
      descricaoOperacao: descricao,
      // Campos originais para debug
      _original: transaction
    };
    
    //console.log('[CORPX-CONVERSAO] ✅ Resultado da conversão:', resultado);
    return resultado;
  };

  // ✅ Aplicar filtros (igual ao BMP 531)
  const filteredAndSortedTransactions = useMemo(() => {
    //console.log('[CORPX-FILTROS] 🔄 Processando', allTransactions.length, 'transações...');
    
    let filtered = allTransactions.map(convertCorpXToStandardFormat);
      
    //console.log('[CORPX-FILTROS] ✅ Após conversão:', filtered.length, 'transações válidas');

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

      // ✅ Filtro de data no frontend (refino adicional após filtro da API)
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
          //console.warn('[CORPX-FILTROS] Erro ao filtrar data:', transaction.dateTime, error);
          matchesDate = true; // Em caso de erro, incluir a transação
        }
      }

      return matchesName && matchesValue && matchesDescCliente && matchesType && matchesDate;
    });
    
    //console.log('[CORPX-FILTROS] 🎯 Após filtros de busca:', filtered.length, 'transações');

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
    
    //console.log('[CORPX-FILTROS] 🎉 RESULTADO FINAL:', filtered.length, 'transações para exibir');

    return filtered;
  }, [allTransactions, searchName, searchValue, searchDescCliente, transactionTypeFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // ✅ Paginação server-side (sem slice local)
  const displayTransactions = filteredAndSortedTransactions; // Exibir todos os dados da página atual
  
  //console.log('[CORPX-PAGINACAO] 📄 Página', currentPage, 'de', totalPages, '-', displayTransactions.length, 'transações na tela');

  // ✅ Totalizadores
  const debitCount = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').length;
  const creditCount = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').length;
  const totalDebito = filteredAndSortedTransactions.filter(t => t.type === 'DÉBITO').reduce((sum, t) => sum + t.value, 0);
  const totalCredito = filteredAndSortedTransactions.filter(t => t.type === 'CRÉDITO').reduce((sum, t) => sum + t.value, 0);
  


  // ✅ Carregar transações (com filtros de período)
  const loadCorpXTransactions = async (customDateFrom?: Date, customDateTo?: Date, page: number = 1) => {
    try {
      setIsLoading(true);
      setError("");
      
      const cnpj = "14283885000198"; // CNPJ fixo para teste
      
      // ✅ Usar datas customizadas (dos filtros) ou datas selecionadas ou período padrão de 3 dias
      let dataInicio, dataFim;
      
      if (customDateFrom && customDateTo) {
        // Usar datas customizadas
        dataInicio = customDateFrom.toISOString().split('T')[0];
        dataFim = customDateTo.toISOString().split('T')[0];
      } else if (dateFrom && dateTo) {
        // Usar datas selecionadas
        dataInicio = dateFrom.toISOString().split('T')[0];
        dataFim = dateTo.toISOString().split('T')[0];
      } else {
        // Usar período padrão de 3 dias
        const hoje = new Date();
        const doisDiasAtras = new Date();
        doisDiasAtras.setDate(hoje.getDate() - 2);
        
        dataInicio = doisDiasAtras.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
      }
      
      const params = {
        cnpj,
        dataInicio,
        dataFim,
        page: page // 🚀 Paginação server-side
      };
      
      
      const { consultarExtratoCorpX } = await import('@/services/corpx');
      const resultado = await consultarExtratoCorpX(params);
      
      //console.log('[CORPX-EXTRATO-UI] Resultado:', resultado);
      
      // ✅ PAGINAÇÃO SERVER-SIDE: Substituir ou acumular dados
      if (resultado && !resultado.erro && resultado.transactions) {
        const transacoes = resultado.transactions;
        
        console.log(`[CORPX-EXTRATO-UI] ✅ Página ${page}: ${transacoes.length} transações recebidas`);
        
        // 🚀 SUBSTITUIR dados para cada página (não acumular)
        setAllTransactions(transacoes);
        
        // 🚀 Calcular próximas páginas baseado no retorno
        const hasFullPage = transacoes.length >= ITEMS_PER_PAGE;
        setHasMorePages(hasFullPage);
        setTotalPages(page + (hasFullPage ? 1 : 0)); // Estimar páginas
        
        
        toast.success(`Página ${page}: ${transacoes.length} transações`, {
          description: "Extrato CORPX carregado",
          duration: 1500
        });
      } else {
        setAllTransactions([]);
        toast.info("Nenhuma transação encontrada", {
          description: "Tente ajustar os filtros de data",
          duration: 3000
        });
      }
      
    } catch (err: any) {
      console.error('[CORPX-EXTRATO-UI] ❌ Erro:', err);
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

  // 🚀 Navegação de página server-side
  const handlePageChange = async (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      await loadCorpXTransactions(dateFrom, dateTo, newPage);
    }
  };

  // ✅ Aplicar filtros (com período específico para API)
  const handleAplicarFiltros = () => {
    setCurrentPage(1);
    
    // ✅ IMPORTANTE: Validar se as datas foram selecionadas
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        toast.error("Data inicial não pode ser maior que data final", {
          description: "Verifique as datas selecionadas",
          duration: 3000
        });
        return;
      }
      
      
      // Passar as datas para a API (sempre página 1 para novos filtros)
      loadCorpXTransactions(dateFrom, dateTo, 1);
    } else if (dateFrom || dateTo) {
      toast.error("Selecione ambas as datas", {
        description: "Data inicial e final são obrigatórias para filtro por período",
        duration: 3000
      });
    } else {
      // Sem filtros de data, usar padrão (sempre página 1)
      loadCorpXTransactions(undefined, undefined, 1);
    }
  };

  // ✅ Limpar filtros - voltar ao período padrão de 3 dias
  const handleLimparFiltros = () => {
    const defaultDates = getDefaultDates();
    setDateFrom(defaultDates.dateFrom);
    setDateTo(defaultDates.dateTo);
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setTransactionTypeFilter("todos");
    setSortBy("date");
    setSortOrder("desc");
    setCurrentPage(1);
    loadCorpXTransactions(undefined, undefined, 1);
    toast.success("Filtros limpos!", {
      description: "Retornado ao período padrão de 3 dias",
      duration: 2000
    });
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
        'CORPX'
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

      toast.success(`CSV exportado com sucesso!`, {
        description: `${filteredAndSortedTransactions.length} registros exportados para ${nomeArquivo}`,
        duration: 3000
      });

    } catch (error) {
      console.error('[CORPX-CSV] Erro ao exportar CSV:', error);
      toast.error("Erro ao exportar CSV", {
        description: "Não foi possível gerar o arquivo de exportação",
        duration: 4000
      });
    }
  };

  // ✅ Funções para OTC
  const isRecordCredited = (transaction: any): boolean => {
    const recordKey = `corpx-${transaction.id}`;
    return creditedRecords.has(recordKey);
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

  // ✅ Carregar dados ao montar o componente com período padrão de 3 dias
  useEffect(() => {
    // Usar as datas padrão já definidas no estado
    loadCorpXTransactions(dateFrom, dateTo, 1);
  }, []); // Manter [] para executar apenas na montagem

  return (
    <div className="space-y-6">
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
                    className={`w-full h-12 justify-start text-left font-normal rounded-xl border-border hover:border-purple-500 transition-colors bg-input ${!dateTo ? "text-muted-foreground" : ""}`}
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
              <label className="text-sm font-semibold text-card-foreground">Buscar por nome</label>
              <Input
                placeholder="Nome do cliente ou documento..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Buscar por valor</label>
              <Input
                placeholder="Ex: 100,50"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-purple-500 transition-colors bg-input"
              />
            </div>
          </div>

          {/* Segunda linha - Filtros específicos */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
          <div className="flex flex-wrap gap-3">
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
              onClick={() => loadCorpXTransactions(dateFrom, dateTo, currentPage)} 
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
            <Button 
              onClick={exportToCSV} 
              variant="outline" 
              disabled={isLoading || filteredAndSortedTransactions.length === 0}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-green-500 hover:text-green-600 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
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
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
              {filteredAndSortedTransactions.length} registros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando transações CORPX...</span>
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Erro ao carregar extrato</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => loadCorpXTransactions(dateFrom, dateTo, 1)} variant="outline">
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
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Data/Hora</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Valor</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Tipo</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 min-w-[200px]">Cliente</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[160px]">Documento</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[200px]">Descrição</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px]">Status</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[140px]">Código</TableHead>
                        <TableHead className="font-semibold text-card-foreground py-3 w-[100px] text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayTransactions.map((transaction) => (
                        <TableRow 
                          key={transaction.id}
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setIsModalOpen(true);
                          }}
                          className="cursor-pointer hover:bg-muted/20 transition-all duration-200 border-b border-border"
                        >
                          <TableCell className="font-medium text-card-foreground py-3 text-xs">
                            {formatDate(transaction.dateTime)}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={`font-bold text-sm font-mono ${transaction.type === 'DÉBITO' ? "text-red-600" : "text-green-600"}`}>
                              {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge className={`${transaction.type === 'DÉBITO' ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"} rounded-full px-2 py-1 text-xs font-semibold`}>
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground break-words">
                            <div className="space-y-1">
                              <div className="font-medium text-card-foreground">
                                {transaction.client}
                              </div>
                              {transaction.document && (
                                <div className="text-xs text-purple-600">
                                  Doc: {transaction.document}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                CORPX
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                            {transaction.document || "—"}
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
                            <div className="space-y-1">
                              <Badge className="bg-green-100 text-green-800 border-green-200 rounded-full px-2 py-1 text-xs font-semibold">
                                ✓
                              </Badge>
                              <Badge className="bg-purple-50 text-purple-700 border-purple-200 rounded-full px-2 py-1 text-xs font-semibold">
                                CORPX
                              </Badge>
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
                            </div>
                          </TableCell>
                          
                          {/* ✅ Coluna de Ações - Botão +OTC */}
                          <TableCell className="py-3">
                            <div className="flex items-center justify-center">
                              {transaction.type === 'CRÉDITO' && (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Versão Mobile - cards simplificados */}
              <div className="lg:hidden space-y-4 p-4">
                {displayTransactions.map((transaction) => (
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
                        <Badge className={`${transaction.type === 'DÉBITO' ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"} rounded-full px-2 py-1 text-xs font-semibold`}>
                          {transaction.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(transaction.dateTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className={`font-bold text-lg font-mono ${transaction.type === 'DÉBITO' ? "text-red-600" : "text-green-600"}`}>
                          {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                        </span>
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 rounded-full px-2 py-1 text-xs font-semibold">
                          CORPX
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="font-medium text-card-foreground">
                          {transaction.client}
                        </div>
                        {transaction.document && (
                          <div className="text-xs text-muted-foreground">
                            Doc: {transaction.document}
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
                          {transaction.code}
                        </span>
                        
                        {/* ✅ Botão +OTC Mobile */}
                        {transaction.type === 'CRÉDITO' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleCreditToOTC(transaction, e)}
                            disabled={isRecordCredited(transaction)}
                            className={cn(
                              "h-7 px-2 text-xs transition-all",
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Paginação */}
              {(totalPages > 1 || hasMorePages) && (
                <div className="border-t border-border bg-muted/20">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage}: {filteredAndSortedTransactions.length} transações{hasMorePages ? ' (+ páginas disponíveis)' : ''}
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
                        Página {currentPage} de {totalPages}{hasMorePages && '+'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasMorePages || isLoading}
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
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Transação CORPX
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

      {/* ✅ Modal OTC */}
      <CreditExtractToOTCModal
        isOpen={creditOTCModalOpen}
        onClose={handleCloseCreditOTCModal}
        extractRecord={selectedExtractRecord}
      />
    </div>
  );
}
