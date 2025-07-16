import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { otcService } from '@/services/otc';
import { OTCBalanceHistory, OTCTransaction } from '@/types/otc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, User, FileText, ArrowUpRight, ArrowDownRight, AlertCircle, LogOut, Settings, Shield, Filter, RefreshCw } from 'lucide-react';
import { formatCurrency, formatTimestamp, formatOTCTimestamp } from '@/utils/date';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface ClientStatementData {
  cliente: {
    id: number;
    name: string;
    document: string;
    pix_key: string;
    current_balance: number;
    last_updated: string;
  };
  transacoes: OTCTransaction[];
  historico_saldo: OTCBalanceHistory[];
}

const ClientStatement: React.FC = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ClientStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros de busca
  const [searchName, setSearchName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [sortBy, setSortBy] = useState<"value" | "date" | "none">("none");
  const [checkedItems, setCheckedItems] = useState<{[key: number]: boolean}>({});
  const [updatingCheck, setUpdatingCheck] = useState<number | null>(null);

  // Calcular total de depósitos (todos os depósitos: automáticos + manuais de crédito)
  // Se tem filtro de data, mostra apenas os depósitos daquela data
  const totalDepositado = useMemo(() => {
    if (!data?.transacoes) return 0;
    
    let depositos = data.transacoes.filter(transacao => {
      const operationType = (transacao as any).operation_type || transacao.type;
      return operationType === 'deposit' || operationType === 'manual_credit';
    });

    // Se tem filtro de data, aplicar o filtro
    if (searchDate.trim()) {
      depositos = depositos.filter(transacao => {
        // Usar sort_date para operações manuais, date para outras
        const dataTransacao = (transacao as any).sort_date || transacao.date;
        const operationType = (transacao as any).operation_type;
        
        // Aplicar correção de timezone apenas para operações não manuais
        const dataFormatada = (operationType === 'manual_credit' || operationType === 'manual_debit') 
          ? formatTimestamp(dataTransacao, 'dd/MM/yy')
          : formatOTCTimestamp(dataTransacao, 'dd/MM/yy');
        
        return dataFormatada === searchDate;
      });
    }
    
    return depositos.reduce((total, transacao) => total + transacao.amount, 0);
  }, [data?.transacoes, searchDate]);



  // Filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    if (!data?.transacoes) return [];
    
    let filtered = data.transacoes;
    
    // Filtrar por nome do pagador
    if (searchName.trim()) {
      const searchTerm = searchName.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.payer_name?.toLowerCase().includes(searchTerm) ||
        transaction.payer_document?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filtrar por valor específico
    if (searchValue.trim()) {
      const searchAmount = parseFloat(searchValue.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(searchAmount)) {
        filtered = filtered.filter(transaction => 
          Math.abs(transaction.amount - searchAmount) < 0.01
        );
      }
    }
    
    // Filtrar por data específica
    if (searchDate.trim()) {
      filtered = filtered.filter(transaction => {
        // Usar sort_date para operações manuais, date para outras
        const dataTransacao = (transaction as any).sort_date || transaction.date;
        const operationType = (transaction as any).operation_type;
        
        // Aplicar correção de timezone apenas para operações não manuais
        const dataFormatada = (operationType === 'manual_credit' || operationType === 'manual_debit') 
          ? formatTimestamp(dataTransacao, 'dd/MM/yy')
          : formatOTCTimestamp(dataTransacao, 'dd/MM/yy');
        
        return dataFormatada === searchDate;
      });
    }
    
    // SEMPRE ordenar por data (mais recente primeiro) como padrão
    // Usar sort_date se disponível (operações manuais), senão usar date
    filtered = [...filtered].sort((a, b) => {
      const dateA = (a as any).sort_date || a.date;
      const dateB = (b as any).sort_date || b.date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    // Aplicar ordenação personalizada se solicitada
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "value") {
          comparison = a.amount - b.amount;
        } else if (sortBy === "date") {
          const dateA = (a as any).sort_date || a.date;
          const dateB = (b as any).sort_date || b.date;
          comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }
    
    return filtered;
  }, [data?.transacoes, searchName, searchValue, searchDate, sortBy, sortOrder]);

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearchName("");
    setSearchValue("");
    setSearchDate("");
    setSelectedDate(undefined);
    setSortBy("none");
    setSortOrder("none");
  };

  // Função para lidar com seleção de data no calendário
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const formattedDate = formatTimestamp(date.getTime() / 1000, 'dd/MM/yy');
      setSearchDate(formattedDate);
    } else {
      setSearchDate("");
    }
  };

  // Função para formatar USD no padrão brasileiro
  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Função para lidar com o checkbox de conferência
  const handleCheckToggle = async (historyId: number, checked: boolean) => {
    if (!data?.cliente?.id) {
      toast.error('Erro: cliente não identificado');
      return;
    }

    setUpdatingCheck(historyId);

    try {
      // Fazer a chamada ao backend
      await otcService.updateHistoryCheckStatus(
        data.cliente.id,
        historyId,
        checked
      );

      // Atualizar estado local apenas se o backend foi bem-sucedido
      setCheckedItems(prev => ({
        ...prev,
        [historyId]: checked
      }));

      toast.success(checked ? 'Registro marcado como conferido' : 'Registro desmarcado');

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao salvar. Tente novamente.');
      
      // Reverter o estado do checkbox em caso de erro
      setCheckedItems(prev => ({
        ...prev,
        [historyId]: !checked
      }));
    } finally {
      setUpdatingCheck(null);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchClientStatement();
    }
  }, [user?.id]);

  const fetchClientStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('Usuário não identificado. Faça login novamente.');
      }

      console.log('Buscando cliente OTC para usuário:', user.id, user.email);
      
      // Buscar cliente OTC vinculado ao usuário logado
      const clientsResponse = await otcService.getClients({ 
        limit: 200 // Buscar todos os clientes para encontrar o correto
      });
      
      if (!clientsResponse.data?.clientes || clientsResponse.data.clientes.length === 0) {
        throw new Error('Nenhum cliente OTC encontrado no sistema.');
      }

      // Buscar cliente específico vinculado ao usuário logado
      const client = clientsResponse.data.clientes.find(c => {
        // Verificar se o cliente está vinculado ao usuário logado
        return String(c.user?.id) === String(user.id) || 
               c.user?.email === user.email ||
               c.user?.name === user.name;
      });

      if (!client) {
        console.log('Clientes encontrados:', clientsResponse.data.clientes.map(c => ({
          id: c.id,
          name: c.name,
          user: c.user
        })));
        
        throw new Error(`Você não possui acesso a nenhum cliente OTC. Usuário: ${user.email} (ID: ${user.id})`);
      }

      console.log('Cliente OTC encontrado:', client);

      // Verificar se o usuário tem permissão para acessar este cliente
      if (String(client.user?.id) !== String(user.id)) {
        throw new Error('Acesso negado. Você não tem permissão para visualizar este extrato.');
      }

      // Buscar extrato específico do cliente
      const statementResponse = await otcService.getClientStatement(client.id, {
        limit: 200
      });
      
      if (!statementResponse.success || !statementResponse.data) {
        throw new Error(statementResponse.message || 'Erro ao buscar extrato do cliente');
      }

      // Validação adicional de segurança
      if (statementResponse.data.cliente.id !== client.id) {
        throw new Error('Erro de segurança: dados inconsistentes');
      }

      // Usar o histórico de saldo como base para garantir ordenação correta
      const historicoSaldo = statementResponse.data.historico_saldo || [];
      const transacoes = statementResponse.data.transacoes || [];
      
      const transacoesComSaldo = historicoSaldo.map((historico) => {
        // Encontrar a transação correspondente a este histórico
        const transacao = transacoes.find(t => t.id === historico.transaction_id);
        
        if (transacao) {
          // Usar os dados da transação complementados com o histórico
          return {
            ...transacao,
            saldo_anterior: historico.balance_before,
            saldo_posterior: historico.balance_after,
            operation_type: historico.operation_type,
            operation_description: historico.description,
            // Campos específicos do histórico para conversões
            amount_change: historico.amount_change,
            usd_amount_change: historico.usd_amount_change,
            usd_balance_before: historico.usd_balance_before,
            usd_balance_after: historico.usd_balance_after,
            conversion_rate: historico.conversion_rate,
            checked_by_client: historico.checked_by_client || false,
            history_id: historico.id,
            // Para ordenação, usar created_at do histórico (quando foi efetivamente processada)
            sort_date: historico.created_at
          };
        } else {
          // Caso não encontre a transação (não deveria acontecer normalmente)
          console.warn(`Transação não encontrada para histórico ${historico.id}`);
          return null;
        }
      }).filter(Boolean); // Remove itens null

      setData({
        ...statementResponse.data,
        transacoes: transacoesComSaldo
      });

      // Inicializar checkboxes com dados do servidor
      const initialChecked: {[key: number]: boolean} = {};
      transacoesComSaldo.forEach(transacao => {
        if (transacao.history_id) {
          initialChecked[transacao.history_id] = transacao.checked_by_client || false;
        }
      });
      setCheckedItems(initialChecked);
      
    } catch (err) {
      console.error('Erro ao buscar extrato:', err);
      setError(err instanceof Error ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login-cliente';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Forçar logout mesmo se der erro
      window.location.href = '/login-cliente';
    }
  };

  // Verificar se o usuário está logado
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Sessão Expirada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Sua sessão expirou. Faça login novamente para acessar seu extrato.</p>
            <button
              onClick={() => window.location.href = '/login-cliente'}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Fazer Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Carregando seu extrato...</p>
          <p className="text-muted-foreground text-sm mt-2">Usuário: {user.email}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-lg banking-shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro ao Carregar Extrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-foreground text-sm">{error}</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-muted-foreground text-sm mb-2">Informações do usuário:</p>
              <ul className="text-foreground text-sm space-y-1">
                <li>• Email: {user.email}</li>
                <li>• ID: {user.id}</li>
                <li>• Nome: {user.name}</li>
              </ul>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">Possíveis soluções:</p>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Verifique se seu usuário está vinculado a um cliente OTC</li>
                <li>• Confirme se está logado com o usuário correto</li>
                <li>• Entre em contato com o suporte técnico</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={fetchClientStatement}
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-muted text-foreground py-2 px-4 rounded-md hover:bg-muted/80 transition-colors"
              >
                Fazer Logout
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md banking-shadow-lg">
          <CardHeader>
            <CardTitle className="text-foreground">Nenhum dado encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Não foi possível carregar seu extrato.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-6 max-w-7xl">
        
        {/* Header com Usuário e Logout */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-1">Meu Extrato OTC</h1>
            <p className="text-muted-foreground text-sm">Suas transações e saldo pessoal</p>
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
              <div className="bg-green-500 rounded-full p-1">
                <Shield className="h-3 w-3 text-white" />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-2 rounded-lg transition-colors"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Card de Informações do Cliente - Mais Compacto */}
        <Card className="mb-6 banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-4 w-4" />
              Suas Informações OTC
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
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
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Depositado Hoje</p>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(totalDepositado)}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {searchDate ? `Data: ${searchDate}` : ''}
                </p>
              </div>
              
              {/* Saldo BRL */}
              <div className="text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo Total (BRL)</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(data.cliente.current_balance)}
                </p>
              </div>
              
              {/* Saldo USD - NOVO */}
              <div className="text-center md:text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo USD</p>
                <p className="text-lg font-bold text-blue-500">
                  $ {formatUSD(parseFloat((data.cliente as any).usd_balance || 0))}
                </p>
                {(data.cliente as any).last_conversion_rate && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Taxa: {parseFloat((data.cliente as any).last_conversion_rate || 0).toFixed(4)}
                  </p>
                )}
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
                onClick={fetchClientStatement}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Transações - Layout Otimizado */}
        <Card className="banking-shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/80 text-foreground rounded-t-lg py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Suas Transações 
              {filteredAndSortedTransactions.length !== data.transacoes?.length && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({filteredAndSortedTransactions.length} de {data.transacoes?.length || 0} registros)
                </span>
              )}
              {filteredAndSortedTransactions.length === data.transacoes?.length && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({data.transacoes?.length || 0} registros)
                </span>
              )}
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
                          (item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          {(item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? (
                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {((item as any).operation_type === 'manual_credit' || (item as any).operation_type === 'manual_debit') 
                              ? formatTimestamp(item.date, 'dd/MM/yy')
                              : formatOTCTimestamp(item.date, 'dd/MM/yy')
                            }
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {((item as any).operation_type === 'manual_credit' || (item as any).operation_type === 'manual_debit') 
                              ? formatTimestamp(item.date, 'HH:mm')
                              : formatOTCTimestamp(item.date, 'HH:mm')
                            }
                          </p>
                        </div>
                      </div>

                      {/* Dados do Depositante */}
                      <div className="col-span-4">
                        <p className="text-sm font-medium text-foreground">
                          {(() => {
                            const operationType = (item as any).operation_type;
                            const description = (item as any).operation_description;
                            
                            switch (operationType) {
                              case 'deposit':
                                return 'Depósito recebido';
                              case 'withdrawal':
                                return 'Saque realizado';
                              case 'manual_credit':
                                return description || 'Crédito manual';
                              case 'manual_debit':
                                return description || 'Débito manual';
                              default:
                                return item.type === 'deposit' ? 'Depósito recebido' : 'Saque realizado';
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

                      {/* Valor da Transação */}
                      <div className="col-span-2 text-right">
                        {/* Detectar conversão: manual_debit com amount = 0 */}
                        {(item as any).operation_type === 'manual_debit' && Math.abs(item.amount) < 0.01 ? (
                          // CONVERSÃO BRL → USD
                          <>
                            <p className="text-lg font-bold text-blue-500">
                              ⇄ {formatCurrency(Math.abs((item as any).amount_change || 0))}
                            </p>
                            <p className="text-xs text-blue-400 font-medium">Conversão BRL→USD</p>
                            {(item as any).conversion_rate && (
                              <p className="text-xs text-muted-foreground">
                                Taxa: {parseFloat((item as any).conversion_rate || 0).toFixed(4)}
                              </p>
                            )}
                          </>
                        ) : (
                          // TRANSAÇÃO NORMAL
                          <>
                            <p className={`text-lg font-bold ${
                              (item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {(item as any).operation_type === 'deposit' || (item as any).operation_type === 'manual_credit' ? '+' : '-'}{formatCurrency(item.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.status}</p>
                          </>
                        )}
                      </div>

                      {/* Saldo Anterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">Saldo Anterior</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency((item as any).saldo_anterior || 0)}
                        </p>
                      </div>

                      {/* Saldo Posterior */}
                      <div className="col-span-2 text-center">
                        <p className="text-xs text-muted-foreground">Saldo Posterior</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency((item as any).saldo_posterior || 0)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Checkbox de Conferência - Fora do grid */}
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      <Checkbox
                        checked={checkedItems[(item as any).history_id] || false}
                        onCheckedChange={(checked) => handleCheckToggle((item as any).history_id, !!checked)}
                        disabled={updatingCheck === (item as any).history_id}
                        className="h-4 w-4"
                      />
                      {updatingCheck === (item as any).history_id && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchName || searchValue ? 'Nenhuma transação encontrada com os filtros aplicados' : 'Você ainda não possui transações'}
                </p>
                <p className="text-muted-foreground/70 text-sm mt-2">
                  {searchName || searchValue ? 'Tente ajustar os filtros de busca' : 'Suas transações aparecerão aqui quando disponíveis'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Compacto */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground/70">
            Última atualização: {formatTimestamp(data.cliente.last_updated, 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      </div>
    </div>
  );
  };

export default ClientStatement;