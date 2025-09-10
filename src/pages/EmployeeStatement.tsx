import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, User, FileText, AlertTriangle, LogOut, Settings, Shield, Filter, RefreshCw, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatTimestamp, formatOTCTimestamp } from '@/utils/date';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { api } from '@/config/api';


// Interface específica para funcionários (sem saldos)
interface EmployeeStatementData {
  cliente: {
    id: number;
    name: string;
    document: string;
    pix_key: string;
    // Saldo BRL incluído para funcionários
    current_balance: number;
  };
  transacoes: EmployeeTransaction[];
  paginacao: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  acesso_funcionario: {
    limitacoes: string[];
    cliente_acesso: string;
    concedido_em: string;
  };
}

interface EmployeeTransaction {
  id: number | string; // Pode ser number ou string para operações manuais
  transaction_type: string; // Campo real do backend
  amount: number;
  transaction_date: string; // Campo real do backend
  status?: string;
  payer_name?: string;
  payer_document?: string;
  bmp_identifier?: string;
  // Novos campos para operações manuais
  source?: string; // 'transaction' ou 'manual_operation'
  operation_type?: string; // 'credit' ou 'debit' para operações manuais
  description?: string;
  currency?: string;
}

const EmployeeStatement: React.FC = () => {
  const { user, logout, userType } = useAuth();
  const { isOTCEmployee, permissions } = usePermissions();
  const [data, setData] = useState<EmployeeStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  // Estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");
  const [showOnlyToday, setShowOnlyToday] = useState(true);

  // Funções de filtros
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const formattedDate = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      setSearchDate(formattedDate);
    } else {
      setSearchDate('');
    }
  };

  const clearAllFilters = () => {
    setSearchName("");
    setSearchValue("");
    setSearchDate("");
    setSelectedDate(undefined);
    setSortBy("none");
    setSortOrder("none");
    setShowOnlyToday(false);
  };

  // Função para recarregar dados (para botões de atualizar)
  const handleRefresh = () => {
    // Aplicar mesma lógica de filtros do useEffect
    let dateFilters: { dateFrom?: string; dateTo?: string } = {};
    
    if (showOnlyToday && !searchDate.trim()) {
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      
      dateFilters.dateFrom = inicioHoje.toISOString();
      dateFilters.dateTo = fimHoje.toISOString();
    } else if (searchDate.trim()) {
      try {
        const [day, month, year] = searchDate.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const dataEspecifica = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
        const inicioData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
        const fimData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate(), 23, 59, 59);
        
        dateFilters.dateFrom = inicioData.toISOString();
        dateFilters.dateTo = fimData.toISOString();
      } catch (error) {
        dateFilters = {};
      }
    }
    
    fetchEmployeeStatement(dateFilters);
  };

  // Função para formatar o tipo de operação
  const formatOperationType = (transacao: any) => {
    if (transacao.transaction_type === 'deposit') {
      return 'Depósito PIX';
    } else if (transacao.transaction_type === 'withdrawal') {
      return 'Saque BRL';
    } else if (transacao.transaction_type === 'manual_adjustment' && transacao.source === 'manual_operation') {
      if (transacao.operation_type === 'credit') {
        return 'Crédito Manual';
      } else if (transacao.operation_type === 'debit') {
        return 'Débito Manual';
      }
      return 'Operação Manual';
    }
    return 'Desconhecido';
  };

  // Função para obter cor do tipo de operação
  const getOperationTypeColor = (transacao: any) => {
    if (transacao.transaction_type === 'deposit') {
      return 'text-green-600 bg-green-50';
    } else if (transacao.transaction_type === 'withdrawal') {
      return 'text-red-600 bg-red-50';
    } else if (transacao.transaction_type === 'manual_adjustment') {
      if (transacao.operation_type === 'credit') {
        return 'text-blue-600 bg-blue-50';
      } else if (transacao.operation_type === 'debit') {
        return 'text-orange-600 bg-orange-50';
      }
      return 'text-gray-600 bg-gray-50';
    }
    return 'text-gray-600 bg-gray-50';
  };




  // Função para buscar dados do extrato de funcionário
  const fetchEmployeeStatement = async (filters?: { dateFrom?: string; dateTo?: string }) => {
    try {
      setLoading(true);
      setError(null);
      
      // Construir URL com filtros de data se fornecidos
      let url = '/api/otc/employee/statement';
      const params = new URLSearchParams();
      
      if (filters?.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters?.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      
      if ((response.data as any).sucesso) {
        setData((response.data as any).dados);
      } else {
        throw new Error((response.data as any).mensagem || 'Erro ao carregar extrato');
      }
    } catch (error: any) {
      setError(error.response?.data?.mensagem || error.message || 'Erro ao carregar dados');
      toast.error('Erro ao carregar extrato');
    } finally {
      setLoading(false);
    }
  };

  // UseEffect para carregar extrato inicial com filtros de data
  useEffect(() => {
    // Determinar filtros de data baseados no estado atual
    let dateFilters: { dateFrom?: string; dateTo?: string } = {};
    
    if (showOnlyToday && !searchDate.trim()) {
      // Filtro de hoje: do início do dia até o final do dia
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      
      dateFilters.dateFrom = inicioHoje.toISOString();
      dateFilters.dateTo = fimHoje.toISOString();
    } else if (searchDate.trim()) {
      // Filtro de data específica: converter de dd/MM/yy para ISO
      try {
        const [day, month, year] = searchDate.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const dataEspecifica = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
        const inicioData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
        const fimData = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate(), 23, 59, 59);
        
        dateFilters.dateFrom = inicioData.toISOString();
        dateFilters.dateTo = fimData.toISOString();
      } catch (error) {
        // Se houver erro no parse, buscar sem filtro de data
        dateFilters = {};
      }
    }
    // Se não houver filtros de data, buscar todos os registros (sem dateFrom/dateTo)
    
    fetchEmployeeStatement(dateFilters);
  }, [showOnlyToday, searchDate]);

  // Filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    if (!data?.transacoes) return [];

    // Filtrar todas as operações BRL válidas (depósitos PIX, saques BRL e operações manuais BRL)
    let filtered = data.transacoes.filter(t => 
      t.amount > 0 && // Valor deve ser maior que 0
      (
        // Depósitos PIX (devem ter pagador)
        (t.transaction_type === 'deposit' && (t.payer_name || t.payer_document)) ||
        // Saques BRL 
        (t.transaction_type === 'withdrawal') ||
        // Operações manuais (já vêm formatadas do backend)
        (t.transaction_type === 'manual_adjustment' && t.source === 'manual_operation')
      )
    );

    // Aplicar filtros
    if (searchName.trim()) {
      filtered = filtered.filter(t => 
        t.payer_name?.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (searchValue.trim()) {
      const searchNum = parseFloat(searchValue.replace(',', '.'));
      if (!isNaN(searchNum)) {
        filtered = filtered.filter(t => 
          Math.abs(t.amount - searchNum) < 0.01
        );
      }
    }

    if (showOnlyToday && !searchDate.trim()) {
      const hoje = new Date();
      const hojeFormatado = hoje.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      
      filtered = filtered.filter(t => {
        // Verificar se a transação tem data válida
        if (!t.transaction_date) return false;
        
        const dataFormatada = formatOTCTimestamp(t.transaction_date, 'dd/MM/yy');
        return dataFormatada !== 'Data inválida' && dataFormatada === hojeFormatado;
      });
    }

    if (searchDate.trim()) {
      filtered = filtered.filter(t => {
        // Verificar se a transação tem data válida
        if (!t.transaction_date) return false;
        
        const dataFormatada = formatOTCTimestamp(t.transaction_date, 'dd/MM/yy');
        return dataFormatada !== 'Data inválida' && dataFormatada.includes(searchDate.trim());
      });
    }

    // SEMPRE ordenar por data (mais recente primeiro) como padrão - IGUAL AO CLIENTE
    // Considerando diferença de fuso horário entre operações manuais e automáticas
    filtered = [...filtered].sort((a, b) => {
      // Função para obter timestamp considerando tipo de operação
      const getOrderingTimestamp = (transaction: EmployeeTransaction): number => {
        const isManualOperation = transaction.transaction_type === 'manual_adjustment' && transaction.source === 'manual_operation';
        
        // Sempre usar a data original da transação
        const dateToUse = transaction.transaction_date;
        
        if (typeof dateToUse === 'string') {
          const baseDate = new Date(dateToUse);
          
          // Se é operação manual, usar data direta (formatTimestamp)
          if (isManualOperation) {
            return baseDate.getTime();
          } else {
            // Se é operação automática, aplicar correção de fuso (+5h como no formatOTCTimestamp)
            return baseDate.getTime() + (5 * 60 * 60 * 1000); // +5 horas em ms
          }
        } else {
          // Se for timestamp numérico, usar diretamente
          return new Date(dateToUse).getTime();
        }
      };
      
      const timestampA = getOrderingTimestamp(a);
      const timestampB = getOrderingTimestamp(b);
      
      return timestampB - timestampA; // Mais recente primeiro
    });

    // Aplicar ordenação personalizada se solicitada
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "value") {
          comparison = a.amount - b.amount;
        } else if (sortBy === "date") {
          // Usar a mesma lógica de ordenação inteligente
          const getOrderingTimestamp = (transaction: EmployeeTransaction): number => {
            const isManualOperation = transaction.transaction_type === 'manual_adjustment' && transaction.source === 'manual_operation';
            const dateToUse = transaction.transaction_date;
            
            if (typeof dateToUse === 'string') {
              const baseDate = new Date(dateToUse);
              if (isManualOperation) {
                return baseDate.getTime();
              } else {
                return baseDate.getTime() + (5 * 60 * 60 * 1000); // +5 horas em ms
              }
            } else {
              return new Date(dateToUse).getTime();
            }
          };
          
          comparison = getOrderingTimestamp(a) - getOrderingTimestamp(b);
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data?.transacoes, searchName, searchValue, searchDate, showOnlyToday, sortBy, sortOrder]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando extrato...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Erro ao carregar extrato</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchEmployeeStatement()} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum dado encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 max-w-7xl">
        
        {/* Header com Usuário e Logout */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-1">Extrato - Funcionário</h1>
            <p className="text-muted-foreground text-sm">
              {data.cliente.name} • Acesso limitado a depósitos PIX
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-card rounded-lg px-4 py-2 border border-border">
              <div className="bg-primary rounded-full p-2">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={logout}
                className="flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-2 rounded-lg transition-colors"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        
        {/* Card de Informações do Cliente */}
        <Card className="mb-6 banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-4 w-4" />
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Nome</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.name}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Documento</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.document}</p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Chave PIX</p>
                <p className="text-sm font-semibold text-foreground">{data.cliente.pix_key}</p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Total (BRL)</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(data.cliente.current_balance)}
                </p>
              </div>
            </div>
            

          </CardContent>
        </Card>

        {/* Card de Filtros */}
        <Card className="mb-6 banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {/* Toggle para mostrar apenas hoje */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showOnlyToday"
                  checked={showOnlyToday}
                  onCheckedChange={(checked) => setShowOnlyToday(checked as boolean)}
                />
                <Label htmlFor="showOnlyToday" className="text-sm font-medium cursor-pointer">
                  📅 Mostrar apenas transações de hoje
                </Label>
                {showOnlyToday && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({new Date().toLocaleDateString('pt-BR')})
                  </span>
                )}
              </div>
              {showOnlyToday && (
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Para ver outras datas, desmarque esta opção ou use o filtro de data abaixo
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="searchName">Buscar por nome</Label>
                <Input
                  id="searchName"
                  placeholder="Nome ou documento do pagador"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="searchValue">Buscar por valor</Label>
                <Input
                  id="searchValue"
                  placeholder="Ex: 100.50"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="searchDate">Buscar por data</Label>
                <div className="flex gap-2">
                  <Input
                    id="searchDate"
                    placeholder="Ex: 16/07/25"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="px-3">
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label htmlFor="sortBy">Ordenar por</Label>
                <Select value={sortBy} onValueChange={(value: "value" | "date" | "none") => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão</SelectItem>
                    <SelectItem value="value">Valor</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sortOrder">Ordem</Label>
                <Select value={sortOrder} onValueChange={(value: "asc" | "desc" | "none") => setSortOrder(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão</SelectItem>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                disabled={loading}
              >
                Limpar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Operações - Layout idêntico ao Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Operações BRL ({filteredAndSortedTransactions.length} operações)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAndSortedTransactions && filteredAndSortedTransactions.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredAndSortedTransactions.map((item, index) => (
                  <div key={item.id} className="relative px-4 py-3 hover:bg-muted/30 transition-colors banking-transition">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Ícone e Data */}
                      <div className="col-span-2 flex items-center gap-2">
                        <div className={`p-2 rounded-full ${
                          item.transaction_type === 'deposit' || item.operation_type === 'credit' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          {item.transaction_type === 'deposit' || item.operation_type === 'credit' ? (
                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {item.transaction_date ? (
                              (item.transaction_type === 'manual_adjustment' && item.source === 'manual_operation')
                                ? formatTimestamp(item.transaction_date, 'dd/MM/yy')
                                : formatOTCTimestamp(item.transaction_date, 'dd/MM/yy')
                            ) : 'Data inválida'}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {item.transaction_date ? (
                              (item.transaction_type === 'manual_adjustment' && item.source === 'manual_operation')
                                ? formatTimestamp(item.transaction_date, 'HH:mm')
                                : formatOTCTimestamp(item.transaction_date, 'HH:mm')
                            ) : ''}
                          </p>
                        </div>
                      </div>

                      {/* Dados da Operação */}
                      <div className="col-span-4">
                        <p className="text-sm font-medium text-foreground">
                          {(() => {
                            switch (item.transaction_type) {
                              case 'deposit':
                                return 'Depósito recebido';
                              case 'withdrawal':
                                return 'Saque realizado';
                              case 'manual_adjustment':
                                if (item.operation_type === 'credit') {
                                  return item.description || 'Crédito manual';
                                } else if (item.operation_type === 'debit') {
                                  return item.description || 'Débito manual';
                                }
                                return 'Operação manual';
                              default:
                                return 'Operação desconhecida';
                            }
                          })()}
                        </p>
                        {item.payer_name && (
                          <p className="text-xs text-muted-foreground">De: {item.payer_name}</p>
                        )}
                        {item.payer_document && (
                          <p className="text-xs text-muted-foreground/70">Doc: {item.payer_document}</p>
                        )}
                        {item.bmp_identifier && (
                          <p className="text-xs text-muted-foreground/70">ID: {item.bmp_identifier}</p>
                        )}
                      </div>

                      {/* Valor da Operação */}
                      <div className="col-span-2 text-right">
                        <p className={`text-lg font-bold ${
                          item.transaction_type === 'deposit' || item.operation_type === 'credit' 
                            ? 'text-green-500' 
                            : 'text-red-500'
                        }`}>
                          {item.transaction_type === 'withdrawal' || item.operation_type === 'debit' ? '-' : '+'}
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="text-xs text-white font-medium">BRL</p>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <Badge 
                          variant={item.status === 'processed' || !item.status ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {item.status || 'Processado'}
                        </Badge>
                      </div>

                      {/* Tipo de Operação */}
                      <div className="col-span-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOperationTypeColor(item)}`}>
                          {formatOperationType(item)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchName || searchValue ? 'Nenhuma operação encontrada com os filtros aplicados' : 'Nenhuma operação BRL disponível'}
                </p>
                <p className="text-muted-foreground/70 text-sm mt-2">
                  {searchName || searchValue ? 'Tente ajustar os filtros de busca' : 'As operações aparecerão aqui quando disponíveis'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeStatement;