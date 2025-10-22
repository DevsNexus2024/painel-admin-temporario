import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, RefreshCw, Lock, TrendingUp, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { otcService } from '@/services/otc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Operation {
  id: number;
  operation_type: string;
  currency: string;
  amount: number | null;
  description: string;
  is_reversed_or_reversal: boolean;
  reference_code: string | null;
  reference_provider: string | null;
  reference_external_id: string | null;
  reference_date: string | null;
  created_at: string;
  client: {
    id: number;
    name: string;
    document: string;
  };
  admin: {
    id: number;
    name: string;
    email: string;
  };
  reference_transaction: {
    id: number;
    amount: number;
    currency: string;
    date: string;
  } | null;
  conversion: {
    id: number;
    brl_amount: number;
    usd_amount: number;
    conversion_rate: number;
  } | null;
}

interface Metrics {
  total_sacado_geral: number;
  total_brl_vendido: number;
  total_usdt_comprado: number;
  quantidade_travas: number;
  sacado_por_cliente: Array<{
    cliente_id: number;
    cliente_nome: string;
    total_sacado: number;
  }>;
}

interface OperationsResponse {
  metricas: Metrics;
  operacoes: Operation[];
  paginacao: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Página de Travas/Saques Clientes OTC
 */
const OTCOperations: React.FC = () => {
  const { toast } = useToast();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Array<{ id: number; name: string }>>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 500,
    total: 0,
    total_pages: 0,
  });

  // Filtros
  const [filters, setFilters] = useState({
    otc_client_id: '',
    dateFrom: '',
    dateTo: '',
  });

  // Carregar clientes OTC
  const loadClients = async () => {
    try {
      const response = await otcService.getClients({ is_active: true });
      if (response.success && response.data) {
        setClients(response.data.clientes.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  // Carregar operações
  const loadOperations = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.otc_client_id) params.otc_client_id = parseInt(filters.otc_client_id);
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await otcService.getOperations(params);

      if (response.success && response.data) {
        const data = response.data as any as OperationsResponse;
        // Backend já filtra apenas debit e convert por padrão
        setOperations(data.operacoes);
        setPagination(data.paginacao);
        setMetrics(data.metricas);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar operações',
        description: error.response?.data?.message || error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    loadOperations();
  }, []);

  useEffect(() => {
    loadOperations();
  }, [pagination.page]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadOperations();
  };

  const handleClearFilters = () => {
    setFilters({
      otc_client_id: '',
      dateFrom: '',
      dateTo: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
    setTimeout(() => loadOperations(), 100);
  };

  const getOperationTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' }> = {
      credit: { label: 'Crédito', variant: 'success' },
      debit: { label: 'Débito', variant: 'destructive' },
      convert: { label: 'Conversão', variant: 'default' },
      reversal: { label: 'Estorno', variant: 'secondary' },
    };

    const config = types[type] || { label: type, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getOperationIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      credit: <ArrowDownCircle className="h-4 w-4 text-green-600" />,
      debit: <ArrowUpCircle className="h-4 w-4 text-red-600" />,
      convert: <TrendingUp className="h-4 w-4 text-blue-600" />,
      reversal: <RefreshCw className="h-4 w-4 text-gray-600" />,
    };

    return icons[type] || <Lock className="h-4 w-4" />;
  };

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    const currencyCode = currency === 'BRL' ? 'BRL' : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sacado</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.total_sacado_geral, 'BRL')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma de todos os saques
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Travas (Conversões)</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.quantidade_travas}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Quantidade de conversões
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">BRL Vendido</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.total_brl_vendido, 'BRL')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total convertido de BRL
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USDT Comprado</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.total_usdt_comprado, 'USD')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total convertido para USD
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Clientes com Saques */}
      {metrics && metrics.sacado_por_cliente.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saques por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.sacado_por_cliente
                .sort((a, b) => b.total_sacado - a.total_sacado)
                .slice(0, 5)
                .map((cliente) => (
                  <div key={cliente.cliente_id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{cliente.cliente_nome}</div>
                      <div className="text-xs text-muted-foreground">ID: {cliente.cliente_id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">
                        {formatCurrency(cliente.total_sacado, 'BRL')}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadOperations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cliente OTC</label>
              <Select
                value={filters.otc_client_id || 'all'}
                onValueChange={(value) => handleFilterChange('otc_client_id', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Data Inicial</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Data Final</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} disabled={loading} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Operações */}
      <Card>
        <CardHeader>
          <CardTitle>
            Operações ({pagination.total} {pagination.total === 1 ? 'registro' : 'registros'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma operação encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valores</TableHead>
                      <TableHead>Moeda</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((op) => (
                      <TableRow key={op.id} className={op.is_reversed_or_reversal ? 'opacity-60' : ''}>
                        <TableCell className="font-mono text-xs">{op.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getOperationIcon(op.operation_type)}
                            {getOperationTypeBadge(op.operation_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{op.client.name}</div>
                            <div className="text-xs text-muted-foreground">{op.client.document}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {op.operation_type === 'convert' && op.conversion ? (
                            <div className="space-y-1">
                              <div className="text-red-600">
                                -{formatCurrency(op.conversion.brl_amount, 'BRL')}
                              </div>
                              <div className="text-green-600">
                                +{formatCurrency(op.conversion.usd_amount, 'USD')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Taxa: {op.conversion.conversion_rate.toFixed(4)}
                              </div>
                            </div>
                          ) : op.amount ? (
                            <span className="text-red-600">
                              -{formatCurrency(Math.abs(op.amount), op.currency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {op.operation_type === 'convert' ? (
                            <div className="space-y-1">
                              <Badge variant="outline">BRL → USD</Badge>
                            </div>
                          ) : (
                            <Badge variant="outline">{op.currency}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={op.description}>
                          {op.description}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{op.admin.name}</div>
                            <div className="text-muted-foreground">{op.admin.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(op.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.total_pages} ({pagination.total} registros)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1 || loading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.total_pages || loading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OTCOperations;

