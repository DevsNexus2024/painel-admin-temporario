import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, User, FileText, AlertTriangle, LogOut, Settings, Shield, Filter, RefreshCw, Users } from 'lucide-react';
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
    // Saldos omitidos para funcionários
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
  id: number;
  type: string;
  amount: number;
  date: string;
  status: string;
  payer_name?: string;
  payer_document?: string;
  bmp_identifier?: string;
}

const EmployeeStatement: React.FC = () => {
  const { user, logout } = useAuth();
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

  // Calcular total de depósitos (apenas depósitos PIX para funcionários)
  const totalDepositado = useMemo(() => {
    if (!data?.transacoes) return 0;
    
    let depositos = data.transacoes.filter(transacao => 
      transacao.type === 'deposit'
    );

    // Aplicar filtro do dia atual se estiver ativo
    if (showOnlyToday && !searchDate.trim()) {
      const hoje = new Date();
      const hojeFormatado = hoje.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
      
      depositos = depositos.filter(transacao => {
        const dataFormatada = formatOTCTimestamp(transacao.date, 'dd/MM/yy');
        return dataFormatada === hojeFormatado;
      });
    }

    // Se tem filtro de data específica, aplicar o filtro
    if (searchDate.trim()) {
      depositos = depositos.filter(transacao => {
        const dataFormatada = formatOTCTimestamp(transacao.date, 'dd/MM/yy');
        return dataFormatada.includes(searchDate.trim());
      });
    }

    return depositos.reduce((total, transacao) => total + transacao.amount, 0);
  }, [data?.transacoes, showOnlyToday, searchDate]);

  // Função para buscar dados do extrato de funcionário
  const fetchEmployeeStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      

      
      const response = await api.get('/api/otc/employee/statement');
      
      if (response.data.sucesso) {
        setData(response.data.dados);

      } else {
        throw new Error(response.data.mensagem || 'Erro ao carregar extrato');
      }
    } catch (error: any) {

      setError(error.response?.data?.mensagem || error.message || 'Erro ao carregar dados');
      toast.error('Erro ao carregar extrato');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    fetchEmployeeStatement();
  }, []);

  // Filtrar e ordenar transações
  const filteredAndSortedTransactions = useMemo(() => {
    if (!data?.transacoes) return [];

    let filtered = [...data.transacoes];

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
        const dataFormatada = formatOTCTimestamp(t.date, 'dd/MM/yy');
        return dataFormatada === hojeFormatado;
      });
    }

    if (searchDate.trim()) {
      filtered = filtered.filter(t => {
        const dataFormatada = formatOTCTimestamp(t.date, 'dd/MM/yy');
        return dataFormatada.includes(searchDate.trim());
      });
    }

    // Aplicar ordenação
    if (sortBy !== "none" && sortOrder !== "none") {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "value") {
          comparison = a.amount - b.amount;
        } else if (sortBy === "date") {
          // Usar lógica de ordenação inteligente considerando fuso horário
          const getOrderingTimestamp = (transaction: any): number => {
            const isManualOperation = ['manual_credit', 'manual_debit', 'manual_adjustment'].includes(transaction.type);
            
            if (typeof transaction.date === 'string') {
              const baseDate = new Date(transaction.date);
              
              // Se é operação manual, usar data direta (formatTimestamp)
              if (isManualOperation) {
                return baseDate.getTime();
              } else {
                // Se é operação automática, aplicar correção de fuso (+5h como no formatOTCTimestamp)
                return baseDate.getTime() + (5 * 60 * 60 * 1000); // +5 horas em ms
              }
            } else {
              // Se for timestamp numérico, usar diretamente
              return new Date(transaction.date).getTime();
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
          <Button onClick={fetchEmployeeStatement} className="mt-4">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Extrato - Funcionário</h1>
                <p className="text-sm text-gray-500">{data.cliente.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Users className="w-3 h-3 mr-1" />
                Acesso Limitado
              </Badge>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{user?.name}</span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Informações do Cliente */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Documento</Label>
                <p className="text-lg font-mono">{data.cliente.document}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Chave PIX</Label>
                <p className="text-lg font-mono">{data.cliente.pix_key}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Total Depositado (Filtrado)</Label>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(totalDepositado)}
                </p>
              </div>
            </div>
            
            {/* Aviso sobre limitações */}
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Visualização limitada para funcionários
                  </p>
                  <ul className="text-sm text-orange-700 mt-1 space-y-1">
                    {data.acesso_funcionario.limitacoes.map((limitacao, index) => (
                      <li key={index}>• {limitacao}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="searchName">Nome do Pagador</Label>
                <Input
                  id="searchName"
                  placeholder="Buscar por nome..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="searchValue">Valor</Label>
                <Input
                  id="searchValue"
                  placeholder="Ex: 100.50"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="searchDate">Data (DD/MM/AA)</Label>
                <Input
                  id="searchDate"
                  placeholder="Ex: 15/01/25"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
              </div>
              
              <div className="flex items-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchName("");
                    setSearchValue("");
                    setSearchDate("");
                    setSelectedDate(undefined);
                    setSortBy("none");
                    setSortOrder("none");
                  }}
                >
                  Limpar Filtros
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={fetchEmployeeStatement}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showOnlyToday"
                  checked={showOnlyToday}
                  onChange={(e) => setShowOnlyToday(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="showOnlyToday" className="text-sm">
                  Mostrar apenas transações de hoje
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Transações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Depósitos PIX ({filteredAndSortedTransactions.length} transações)</span>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem ordenação</SelectItem>
                    <SelectItem value="value">Valor</SelectItem>
                    <SelectItem value="date">Data</SelectItem>
                  </SelectContent>
                </Select>
                
                {sortBy !== "none" && (
                  <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Ordem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Crescente</SelectItem>
                      <SelectItem value="desc">Decrescente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAndSortedTransactions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma transação encontrada com os filtros aplicados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">Data</th>
                      <th className="text-left p-3 font-semibold">Valor</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Pagador</th>
                      <th className="text-left p-3 font-semibold">Documento</th>
                      <th className="text-left p-3 font-semibold">Identificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedTransactions.map((transacao) => (
                      <tr key={transacao.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">
                          {formatOTCTimestamp(transacao.date, 'dd/MM/yy HH:mm')}
                        </td>
                        <td className="p-3 font-bold text-green-600">
                          {formatCurrency(transacao.amount)}
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={transacao.status === 'processed' ? 'default' : 'destructive'}
                          >
                            {transacao.status}
                          </Badge>
                        </td>
                        <td className="p-3">{transacao.payer_name || '-'}</td>
                        <td className="p-3 font-mono text-sm">
                          {transacao.payer_document || '-'}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-500">
                          {transacao.bmp_identifier || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeStatement;