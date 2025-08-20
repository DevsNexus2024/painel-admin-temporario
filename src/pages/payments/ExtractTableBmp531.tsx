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
import { validarIntervaloData, formatarDataParaAPI, type MovimentoExtrato, type ExtratoResponse } from "@/services/extrato";
import CompensationModalInteligente from "@/components/CompensationModalInteligente";
import DuplicataManagerModal from "@/components/DuplicataManagerModal";
import { Bmp531Service, type Bmp531ExtratoResponse, type Bmp531Movimento } from "@/services/bmp531";

// Tipo para os filtros
interface FiltrosAtivos {
  de?: string;
  ate?: string;
}

export default function ExtractTableBmp531() {
  const [selectedTransaction, setSelectedTransaction] = useState<MovimentoExtrato | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosAtivos>({});
  
  // Estados para controlar carregamento e dados  
  const [extratoData, setExtratoData] = useState<Bmp531ExtratoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // *** PAGINAÇÃO FRONTEND - IGUAL AO GERENCIADOR ORIGINAL ***
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 200; // Para exibição na tela (paginação visual)
  
  // *** NOVO: Paginação automática do backend para carregar TODOS os registros ***
  const [allTransactions, setAllTransactions] = useState<Bmp531Movimento[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  
  // Filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDescCliente, setSearchDescCliente] = useState(""); // Filtro específico BMP-531
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");
  
  // ✅ NOVO: Filtro de tipo de transação
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<"todos" | "debito" | "credito">("todos");

  // Filtro de débitos duplicados removido

  // Estados para modal de compensação (BMP-531)
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [selectedCompensationRecord, setSelectedCompensationRecord] = useState<MovimentoExtrato | null>(null);

  // ✅ NOVO: Estados para modal de duplicatas
  const [duplicataModalOpen, setDuplicataModalOpen] = useState(false);
  const [selectedDuplicataTransaction, setSelectedDuplicataTransaction] = useState<MovimentoExtrato | null>(null);

  // ✅ Função para converter Bmp531Movimento usando LÓGICA EXATA do gerenciador BMP-531
  const convertBmp531ToMovimentoExtrato = (movimento: Bmp531Movimento): MovimentoExtrato => {
    
    // ✅ Obter valor (sempre positivo para exibição, como no gerenciador)
    const valor = parseFloat(movimento.vlrMovimento?.toString() || movimento.valor?.toString() || '0');
    const valorAbsoluto = Math.abs(valor);
    
    // 🎯 DETERMINAR TIPO - BASEADO NOS DADOS REAIS DA API BMP-531
    let tipo: 'DÉBITO' | 'CRÉDITO' = 'CRÉDITO'; // Default
    
    // 🎯 Acesso aos campos corretos da API BMP-531
    const tipoLancamentoAPI = (movimento as any).tipoLancamento;
    const descricaoOperacaoAPI = (movimento as any).descricaoOperacao;
    const descClienteAPI = (movimento as any).descCliente;
    
    // 🎯 DETERMINAR TIPO baseado nos dados reais da API
    if (tipoLancamentoAPI === 'D') {
      tipo = 'DÉBITO';
    } else if (tipoLancamentoAPI === 'C') {
      tipo = 'CRÉDITO';
    } else if (descricaoOperacaoAPI) {
      const descOp = descricaoOperacaoAPI.toUpperCase();
      if (descOp.includes('ENVIO PIX') || descOp.includes('TRANSFERENCIA') || descOp.includes('PAGAMENTO') || descOp.includes('TARIFA')) {
        tipo = 'DÉBITO';
      } else if (descOp.includes('RECEBIMENTO PIX') || descOp.includes('DEPOSITO') || descOp.includes('CREDITO')) {
        tipo = 'CRÉDITO';
      }
    } else if (movimento.tipoMovimento === 'D') {
      tipo = 'DÉBITO';
    } else if (movimento.tipoMovimento === 'C') {
      tipo = 'CRÉDITO';
    }
    
    // ✅ CLIENTE: Priorizar nome direto, depois extrair do complemento (IGUAL AO EXTRATO.TS)
    let clienteFormatado = '';
    
    if (movimento.nome) {
      clienteFormatado = movimento.nome;
    } else if (movimento.complemento && movimento.complemento.includes(' - ')) {
      const partes = movimento.complemento.split(' - ');
      clienteFormatado = partes.slice(1).join(' - ');
    } else if (movimento.cliente) {
      clienteFormatado = movimento.cliente;
    } else {
      clienteFormatado = 'Cliente não identificado';
    }
    
    // ✅ DOCUMENTO: Priorizar documentoFederal, depois extrair do complemento
    let documentoFormatado = '';
    
    if (movimento.documentoFederal) {
      documentoFormatado = movimento.documentoFederal;
    } else if (movimento.complemento && movimento.complemento.includes('***')) {
      const partes = movimento.complemento.split(' - ');
      if (partes[0]) {
        documentoFormatado = partes[0];
      }
    } else if (movimento.documento) {
      documentoFormatado = movimento.documento;
    } else {
      documentoFormatado = '—';
    }
    
    // ✅ DESCLIENTE: Campo específico BMP-531 - IGUAL AO GERENCIADOR ORIGINAL
    let descClienteFormatado = '';
    if (descClienteAPI && descClienteAPI.trim() !== '') {
      descClienteFormatado = descClienteAPI.trim();
    }
    
    const converted: MovimentoExtrato = {
      id: movimento.codigo || movimento.codigoTransacao || movimento.id || Math.random().toString(36),
      dateTime: (movimento as any).dtMovimento || movimento.dtLancamento || movimento.dataHora || new Date().toLocaleString('pt-BR'),
      value: valorAbsoluto, // ✅ Usar valor absoluto para exibição
      type: tipo,
      document: documentoFormatado,
      client: clienteFormatado,
      identified: !!movimento.nome || !!movimento.documentoFederal,
      code: (movimento as any).identificadorOperacao || movimento.codigoTransacao || movimento.codigo || Math.random().toString(36).substr(2, 9).toUpperCase(),
      descCliente: descClienteFormatado || undefined, // ✅ Campo específico BMP-531
      descricaoOperacao: descricaoOperacaoAPI || movimento.descricao || undefined // Campo específico BMP-531
    };
    
    return converted;
  };

  // *** NOVA FUNÇÃO: Carregar TODAS as páginas automaticamente (sem filtros backend) ***
  const loadAllTransactionsBmp531 = async () => {
    setIsLoading(true);
    setError(null);
    setAllTransactions([]);
    setTotalLoaded(0);
    
    try {

      
      let allTransactionsList: Bmp531Movimento[] = [];
      let currentCursor = 0;
      let hasMorePages = true;
      let pageCount = 1;
      
      // ✅ Carregar todas as páginas automaticamente (sem filtros backend)
      while (hasMorePages) {
        const params = {
          cursor: currentCursor
        };
        
        const data = await Bmp531Service.getExtrato(params);
        const transactions = data?.items || [];
        
        allTransactionsList = [...allTransactionsList, ...transactions];
        
        if (data?.hasMore && data?.cursor && data.cursor > currentCursor) {
          hasMorePages = true;
          currentCursor = data.cursor;
          pageCount++;
        } else {
          hasMorePages = false;
        }
        
        if (pageCount > 50) {
          console.warn('⚠️ [ExtractTableBmp531] Limite de páginas atingido (50)');
          break;
        }
        
        setAllTransactions([...allTransactionsList]);
        setTotalLoaded(allTransactionsList.length);
      }
      

      
      setAllTransactions(allTransactionsList);
      setTotalLoaded(allTransactionsList.length);
      
      // ✅ ORDENAR POR DATA DESC (mais recente primeiro)
      allTransactionsList.sort((a, b) => {
        const dateA = new Date(a.dtLancamento || a.dtMovimento || a.dataHora || '1970-01-01').getTime();
        const dateB = new Date(b.dtLancamento || b.dtMovimento || b.dataHora || '1970-01-01').getTime();
        return dateB - dateA;
      });
      
      // Manter compatibilidade com código existente
      setExtratoData({
        sucesso: true,
        mensagem: 'Extrato carregado com sucesso',
        items: allTransactionsList,
        totalRegistros: allTransactionsList.length,
        hasMore: false,
        cursor: currentCursor
      });
      
    } catch (error: any) {

      setError(error.message || "Erro ao carregar extrato");
      
      toast.error("Erro ao carregar extrato", {
        description: "Falha ao consultar extrato da conta BMP 531",
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // *** FUNÇÃO COMPATIBILIDADE: Carregar mais registros manualmente ***
  const loadMoreTransactions = async () => {
    if (isLoadingMore || !extratoData?.hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const params = {
        cursor: extratoData.cursor
      };
      
      const data = await Bmp531Service.getExtrato(params);
      const newTransactions = data?.items || [];
      
      const updatedTransactions = [...allTransactions, ...newTransactions];
      
      // ✅ ORDENAR POR DATA DESC
      updatedTransactions.sort((a, b) => {
        const dateA = new Date(a.dtLancamento || a.dtMovimento || a.dataHora || '1970-01-01').getTime();
        const dateB = new Date(b.dtLancamento || b.dtMovimento || b.dataHora || '1970-01-01').getTime();
        return dateB - dateA;
      });
      
      setAllTransactions(updatedTransactions);
      setTotalLoaded(updatedTransactions.length);
      
      setExtratoData({
        ...data,
        items: updatedTransactions
      });
      
    } catch (error: any) {
      console.error("❌ [ExtractTableBmp531] Erro ao carregar mais registros:", error);
      toast.error("Erro ao carregar mais registros");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Função para recarregar dados
  const refetch = () => {
    loadAllTransactionsBmp531();
  };

  // Carregar dados inicial
  useEffect(() => {
    loadAllTransactionsBmp531();
  }, []);

  // ✅ REMOVIDO: Não precisamos mais recarregar quando filtros mudam
  // Os filtros são aplicados diretamente no frontend

  // ✅ Usar allTransactions que contém TODOS os registros carregados
  const transactions = allTransactions.length > 0 ? allTransactions : (extratoData?.items || []);
  const hasMore = extratoData?.hasMore || false;
  const currentCursor = extratoData?.cursor || 0;

  // Converter transações BMP 531 para formato padrão
  const convertedTransactions: MovimentoExtrato[] = useMemo(() => {
    return transactions.map(convertBmp531ToMovimentoExtrato);
  }, [transactions]);

  // Lógica de duplicatas removida

  // Lógica de filtros e ordenação (com filtro de tipo e data no frontend)
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = convertedTransactions;

    // Aplicar filtros
    filtered = filtered.filter((transaction) => {
      const matchesName = !searchName || 
        transaction.client?.toLowerCase().includes(searchName.toLowerCase()) ||
        transaction.document?.toLowerCase().includes(searchName.toLowerCase());
      
      const matchesValue = !searchValue || 
        Math.abs(transaction.value).toString().includes(searchValue);
      
      // ✅ FILTRO MELHORADO: Buscar em múltiplos campos relacionados à descrição (igual ao gerenciador)
      const matchesDescCliente = !searchDescCliente || 
        transaction.descCliente?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction.descricaoOperacao?.toLowerCase().includes(searchDescCliente.toLowerCase()) ||
        transaction.client?.toLowerCase().includes(searchDescCliente.toLowerCase());

      // ✅ Filtro de tipo de transação
      const matchesType = transactionTypeFilter === "todos" || 
        (transactionTypeFilter === "debito" && transaction.type === "DÉBITO") ||
        (transactionTypeFilter === "credito" && transaction.type === "CRÉDITO");

      // ✅ NOVO: Filtro de data no frontend
      let matchesDate = true;
      if (dateFrom && dateTo) {
        const transactionDate = new Date(transaction.dateTime);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        // Definir hora para comparação correta (início e fim do dia)
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        
        matchesDate = transactionDate >= fromDate && transactionDate <= toDate;
      }

      return matchesName && matchesValue && matchesDescCliente && matchesType && matchesDate;
    });

    // Aplicar ordenação
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        if (sortBy === "value") {
          aValue = Math.abs(a.value);
          bValue = Math.abs(b.value);
        } else if (sortBy === "date") {
          aValue = new Date(a.dateTime).getTime();
          bValue = new Date(b.dateTime).getTime();
        } else {
          return 0;
        }
        
        if (sortOrder === "asc") {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return filtered;
  }, [convertedTransactions, searchName, searchValue, searchDescCliente, transactionTypeFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Paginação
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);
  const displayTransactions = currentPageTransactions;

  // Handlers
  const handleRowClick = (transaction: MovimentoExtrato) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCopyCode = (code: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success("Código copiado!");
    } else {
      toast.error("Código não disponível");
    }
  };

  // Função para abrir modal de compensação (BMP-531)
  const handleCompensation = (transaction: MovimentoExtrato, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedCompensationRecord(transaction);
    setCompensationModalOpen(true);
  };

  // ✅ NOVO: Função para extrair ID do usuário da descrição
  const extrairIdUsuario = (transaction: MovimentoExtrato): number => {
    const descCliente = transaction.descCliente || '';
    
    // Procurar padrão "Usuario 96" ou "Usuario 1733" etc.
    const match = descCliente.match(/Usuario\s+(\d+)/i);
    
    if (match && match[1]) {
      const userId = parseInt(match[1], 10);
      console.log('[EXTRATO-BMP531] ID do usuário extraído:', {
        descCliente,
        userId
      });
      return userId;
    }
    
    // Fallback caso não encontre o padrão
    console.warn('[EXTRATO-BMP531] Não foi possível extrair ID do usuário:', {
      descCliente,
      transaction: transaction.id
    });
    return 0; // Valor que indicará erro no backend
  };

  // ✅ NOVO: Função para abrir modal de duplicatas
  const handleGerenciarDuplicatas = (transaction: MovimentoExtrato, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const idUsuario = extrairIdUsuario(transaction);
    
    if (idUsuario === 0) {
      toast.error('Não foi possível identificar o ID do usuário nesta transação');
      return;
    }
    
    console.log('[EXTRATO-BMP531] Abrindo modal de duplicatas para:', {
      id: transaction.id,
      value: transaction.value,
      type: transaction.type,
      client: transaction.client,
      descCliente: transaction.descCliente,
      idUsuario
    });
    
    setSelectedDuplicataTransaction({
      ...transaction,
      idUsuario // Adicionar o ID extraído
    } as any);
    setDuplicataModalOpen(true);
  };

  // ✅ NOVO: Callback após exclusão de duplicata
  const handleDuplicataExcluida = (idMovimentacao: number) => {
    console.log('[EXTRATO-BMP531] Duplicata excluída:', idMovimentacao);
    toast.success(`Duplicata ${idMovimentacao} removida do sistema`);
    // Opcional: Recarregar dados do extrato se necessário
    // refetch();
  };

  // Função para fechar modal de compensação
  const handleCloseCompensationModal = (wasSuccessful?: boolean) => {
    if (wasSuccessful) {
      toast.success('Compensação processada com sucesso!');
      refetch(); // Recarregar dados
    }
    
    setCompensationModalOpen(false);
    setSelectedCompensationRecord(null);
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

    // ✅ SIMPLIFICADO: Não enviar filtros para backend, fazer filtro apenas no frontend
    setCurrentPage(1);
    
    toast.success("Filtros aplicados!", {
      description: "Transações filtradas com sucesso",
      duration: 2000
    });
  };

  const handleLimparFiltros = async () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchName("");
    setSearchValue("");
    setSearchDescCliente("");
    setTransactionTypeFilter("todos");
    setSortBy("none");
    setSortOrder("none");
    setCurrentPage(1);
    toast.success("Filtros limpos!");
  };

  // ✅ NOVO: Função para exportar CSV
  const handleExportarCSV = () => {
    if (filteredAndSortedTransactions.length === 0) {
      toast.error("Nenhuma transação para exportar", {
        description: "Aplique filtros ou aguarde o carregamento dos dados",
        duration: 3000
      });
      return;
    }

    // Cabeçalhos do CSV
    const headers = [
      'Data/Hora',
      'Tipo',
      'Valor (R$)', 
      'Cliente/Banco',
      'Documento',
      'Código',
      'Descrição Cliente',
      'Status'
    ];

    // Converter transações para CSV
    const csvData = filteredAndSortedTransactions.map(transaction => {
      return [
        transaction.dateTime,
        transaction.type,
        `R$ ${transaction.value.toFixed(2).replace('.', ',')}`,
        transaction.client || 'N/A',
        transaction.document || 'N/A', 
        transaction.code || 'N/A',
        transaction.descCliente || 'N/A',
        transaction.identified ? 'Identificado' : 'Não Identificado'
      ];
    });

    // Criar conteúdo CSV
    const csvContent = [
      headers.join(';'), // Cabeçalho
      ...csvData.map(row => row.join(';')) // Dados
    ].join('\n');

    // Criar e fazer download do arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Nome do arquivo com data atual
      const dataAtual = new Date().toISOString().split('T')[0];
      const nomeArquivo = `extrato-bmp531-${dataAtual}.csv`;
      link.setAttribute('download', nomeArquivo);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("CSV exportado com sucesso!", {
        description: `${filteredAndSortedTransactions.length} transações exportadas`,
        duration: 3000
      });
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    refetch();
  };

  // Funções de paginação
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
    setCurrentPage(page);
  };

  const handleSort = (column: "value" | "date") => {
    if (sortBy === column) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
        setSortBy("none");
        setSortOrder("none");
      } else {
        setSortOrder("asc");
      }
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Funções de formatação (igual ao original)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));
  };

  const formatDate = (dateString: string) => {
    // Verificar se dateString existe e não é undefined/null
    if (!dateString) {
      return "Data inválida";
    }
    
    // Se já está no formato brasileiro, retorna como está
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // Se está no formato ISO, converte
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString || "Data inválida";
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
  
  // ✅ Totalizadores por tipo (considerando o filtro aplicado)
  const totalDebito = filteredAndSortedTransactions
    .filter(t => t.type === 'DÉBITO')
    .reduce((sum, t) => sum + t.value, 0);
  const totalCredito = filteredAndSortedTransactions
    .filter(t => t.type === 'CRÉDITO')
    .reduce((sum, t) => sum + t.value, 0);

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">Erro ao carregar extrato</h3>
              <p className="text-sm opacity-90">{error || "Erro desconhecido"}</p>
            </div>
          </div>
          <Button 
            onClick={() => refetch()} 
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro redesenhado (igual ao original) */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Filter className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Filtros de Pesquisa - BMP 531
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalize sua consulta de extratos
                </p>
              </div>
            </div>
            {/* Badge BMP 531 */}
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
              BMP 531
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
              <label className="text-sm font-semibold text-card-foreground">Buscar por nome</label>
              <Input
                placeholder="Nome do cliente ou documento..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Buscar por valor</label>
              <Input
                placeholder="Ex: 100,50"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input"
              />
            </div>
          </div>

          {/* Segunda linha - Filtros específicos BMP-531 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Descrição do cliente (BMP-531)</label>
              <Input
                placeholder="Descrição específica..."
                value={searchDescCliente}
                onChange={(e) => setSearchDescCliente(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input"
              />
            </div>

            {/* ✅ NOVO: Filtro de tipo de transação */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Tipo de transação</label>
              <Select value={transactionTypeFilter} onValueChange={(value: "todos" | "debito" | "credito") => setTransactionTypeFilter(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="debito">Apenas Débitos</SelectItem>
                  <SelectItem value="credito">Apenas Créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>

{/* Filtro de duplicados removido */}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">Ordenar por</label>
              <Select value={sortBy} onValueChange={(value: "value" | "date" | "none") => setSortBy(value)}>
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input">
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
                <SelectTrigger className="h-12 rounded-xl border-border hover:border-blue-500 transition-colors bg-input" disabled={sortBy === "none"}>
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
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
            <Button 
              onClick={handleLimparFiltros} 
              variant="outline" 
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-blue-500 transition-colors"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              disabled={isLoading}
              className="rounded-xl px-6 py-3 font-semibold border-border hover:border-blue-500 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Carregando..." : "Atualizar"}
            </Button>
            
            {/* ✅ NOVO: Botão de exportar CSV */}
            <Button 
              onClick={handleExportarCSV} 
              variant="outline" 
              disabled={isLoading || filteredAndSortedTransactions.length === 0}
              className="rounded-xl px-6 py-3 font-semibold border-green-200 hover:border-green-500 text-green-700 hover:text-green-800 transition-colors bg-green-50 hover:bg-green-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV ({filteredAndSortedTransactions.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo de duplicados removido */}
      {false && (
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-100 shadow-md">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-800 mb-2">
                  🔍 Filtro de Débitos Duplicados Ativo
                </h3>
                <div className="space-y-2 text-sm text-red-700">
                  <p className="font-medium">
                    <strong>Como funciona:</strong> Esta é uma conta "bolsão" onde cada PIX que entra (crédito) deveria ter apenas um PIX correspondente que sai (débito).
                  </p>
                  <p>
                    <strong>Duplicados identificados:</strong> Débitos que excedem a quantidade de créditos do mesmo valor.
                  </p>
                  <p>
                    <strong>Exemplo:</strong> Se há 1 crédito de R$ 1.000,00 mas 3 débitos de R$ 1.000,00 → 2 débitos são duplicados (excedentes).
                  </p>
                  <div className="bg-red-100 rounded-lg p-3 mt-3">
                    <p className="font-medium text-red-800">
                      📊 <strong>Resultado atual:</strong> {filteredAndSortedTransactions.length} débitos duplicados encontrados
                    </p>
                    <p className="text-red-600 text-xs mt-1">
                      Estes débitos podem indicar processamento duplicado ou erro no sistema de conciliação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de resultados */}
      <Card className="bg-card border border-border shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/20 to-muted/30 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  Extrato de Transações BMP 531
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  <>
                    {filteredAndSortedTransactions.length} registros encontrados • {debitCount} débitos • {creditCount} créditos
                    {totalLoaded > 0 && totalLoaded !== filteredAndSortedTransactions.length && (
                      <span className="text-blue-600"> • {totalLoaded} total carregados</span>
                    )}
                  </>
                </p>
                
                {/* ✅ NOVO: Totalizadores por tipo */}
                {(totalDebito > 0 || totalCredito > 0) && (
                  <div className="flex gap-4 mt-2 text-sm">
                    {totalDebito > 0 && (
                      <span className="text-red-600 font-medium">
                        Total Débitos: R$ {totalDebito.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    {totalCredito > 0 && (
                      <span className="text-green-600 font-medium">
                        Total Créditos: R$ {totalCredito.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      Saldo: R$ {(totalCredito - totalDebito).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Badge BMP 531 */}
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
              {filteredAndSortedTransactions.length} registros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <div className="text-center">
                <span>Carregando transações BMP 531...</span>
                {totalLoaded > 0 && (
                  <div className="text-sm text-blue-600 mt-1">
                    {totalLoaded} registros carregados
                  </div>
                )}
              </div>
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
              {/* Versão Desktop - tabela completa (igual ao original) */}
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
                        {/* Coluna descCliente para BMP-531 */}
                        <TableHead className="font-semibold text-card-foreground py-3 w-[200px]">descCliente</TableHead>
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
                              {/* Cliente/Banco para BMP-531 */}
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
                                  BMP 531 - Banco Master
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                              {transaction.document || "—"}
                            </TableCell>
                            {/* Célula descCliente para BMP-531 */}
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
                                {transaction.identified ? (
                                  <Badge className="bg-tcr-green/20 text-tcr-green border-tcr-green/30 rounded-full px-2 py-1 text-xs font-semibold">
                                    ✓
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-full px-2 py-1 text-xs font-semibold">
                                    ?
                                  </Badge>
                                )}
                                {/* Badge BMP 531 */}
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 rounded-full px-2 py-1 text-xs font-semibold">
                                  BMP 531
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
                                    onClick={(e) => handleCompensation(transaction, e)}
                                    className="h-7 px-2 text-xs transition-all bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300"
                                    title="Diagnóstico inteligente + Compensação BMP 531"
                                  >
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    🧠 Verificar
                                  </Button>
                                )}
                                
                                {/* ✅ NOVO: Botão de duplicatas para DÉBITOS */}
                                {transaction.type === 'DÉBITO' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => handleGerenciarDuplicatas(transaction, e)}
                                    className="h-7 px-2 text-xs transition-all bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300"
                                    title="Gerenciar duplicatas desta movimentação"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    🔄 Duplicatas
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

              {/* Versão Mobile - cards (simplificada) */}
              <div className="lg:hidden space-y-4 p-4">
                {displayTransactions.map((transaction) => {
                  const typeConfig = getTypeConfig(transaction.type);
                  
                  return (
                    <Card 
                      key={transaction.id}
                      onClick={() => handleRowClick(transaction)}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 border border-border"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`${typeConfig.className} rounded-full px-2 py-1 text-xs font-semibold`}>
                            {transaction.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(transaction.dateTime)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <span className={`font-bold text-lg font-mono ${transaction.type === 'DÉBITO' ? "text-tcr-red" : "text-tcr-green"}`}>
                            {transaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(transaction.value)}
                          </span>
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 rounded-full px-2 py-1 text-xs font-semibold">
                            BMP 531
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="font-medium text-card-foreground">
                            {transaction.client || "Cliente não identificado"}
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
                          <div className="flex gap-2">
                            {transaction.type === 'CRÉDITO' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleCompensation(transaction, e)}
                                className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                title="Diagnóstico inteligente + Compensação BMP 531"
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                🧠 Verificar
                              </Button>
                            )}
                            
                            {/* ✅ NOVO: Botão de duplicatas para DÉBITOS (Mobile) */}
                            {transaction.type === 'DÉBITO' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleGerenciarDuplicatas(transaction, e)}
                                className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                title="Gerenciar duplicatas desta movimentação"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                🔄 Duplicatas
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Paginação e Carregar Mais */}
              <div className="border-t border-border bg-muted/20">
                {/* Paginação Visual */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAndSortedTransactions.length)} de {filteredAndSortedTransactions.length} transações
                      {totalLoaded > filteredAndSortedTransactions.length && (
                        <span className="text-blue-600"> (de {totalLoaded} carregadas)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="rounded-lg"
                      >
                        Anterior
                      </Button>
                      <span className="text-sm font-medium px-3">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="rounded-lg"
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Botão Carregar Mais (se houver mais no backend) */}
                {hasMore && !isLoading && (
                  <div className="flex items-center justify-center px-6 py-4 border-t border-border">
                    <Button
                      onClick={loadMoreTransactions}
                      disabled={isLoadingMore}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Carregar Mais Registros
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes da transação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Transação BMP 531</DialogTitle>
            <DialogClose />
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">Data/Hora:</label>
                  <p>{formatDate(selectedTransaction.dateTime)}</p>
                </div>
                <div>
                  <label className="font-semibold">Valor:</label>
                  <p className={`font-bold ${selectedTransaction.type === 'DÉBITO' ? 'text-tcr-red' : 'text-tcr-green'}`}>
                    {selectedTransaction.type === 'DÉBITO' ? "-" : "+"}{formatCurrency(selectedTransaction.value)}
                  </p>
                </div>
                <div>
                  <label className="font-semibold">Cliente:</label>
                  <p>{selectedTransaction.client || "N/A"}</p>
                </div>
                <div>
                  <label className="font-semibold">Documento:</label>
                  <p>{selectedTransaction.document || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <label className="font-semibold">Descrição do Cliente (BMP-531):</label>
                  <p>{selectedTransaction.descCliente || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <label className="font-semibold">Descrição da Operação:</label>
                  <p>{selectedTransaction.descricaoOperacao || "N/A"}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {selectedTransaction.id && (
                  <div className="bg-muted p-3 rounded-lg">
                    <label className="font-semibold">ID da transação:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-background px-2 py-1 rounded">{selectedTransaction.id}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(selectedTransaction.id, new MouseEvent('click') as any)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {selectedTransaction.code && (
                  <div className="bg-muted p-3 rounded-lg">
                    <label className="font-semibold">Código da transação:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-background px-2 py-1 rounded">{selectedTransaction.code}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(selectedTransaction.code!, new MouseEvent('click') as any)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Badge BMP 531 */}
              <div className="flex justify-center">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-sm font-medium">
                  Transação BMP 531
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de compensação inteligente BMP-531 */}
      {compensationModalOpen && selectedCompensationRecord && (
        <CompensationModalInteligente
          isOpen={compensationModalOpen}
          onClose={() => handleCloseCompensationModal()}
          extractRecord={selectedCompensationRecord}
        />
      )}

      {/* ✅ NOVO: Modal de gerenciamento de duplicatas */}
      {duplicataModalOpen && selectedDuplicataTransaction && (
        <DuplicataManagerModal
          isOpen={duplicataModalOpen}
          onClose={() => setDuplicataModalOpen(false)}
          transacao={{
            id: selectedDuplicataTransaction.id,
            value: selectedDuplicataTransaction.value,
            client: selectedDuplicataTransaction.client,
            dateTime: selectedDuplicataTransaction.dateTime,
            type: selectedDuplicataTransaction.type
          }}
          idUsuario={(selectedDuplicataTransaction as any).idUsuario || 0}
          onDuplicataExcluida={handleDuplicataExcluida}
          todasTransacoes={convertedTransactions.map(t => ({
            id: t.id,
            value: t.value,
            type: t.type,
            dateTime: t.dateTime,
            descCliente: t.descCliente
          }))}
        />
      )}
    </div>
  );
}