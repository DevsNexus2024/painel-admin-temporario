import React, { useState } from 'react';
import { 
  Eye, 
  Edit, 
  DollarSign, 
  UserCheck, 
  UserX, 
  MoreHorizontal,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOTCClients } from '@/hooks/useOTCClients';
import { otcService } from '@/services/otc';
import { OTCClient, OTCFilters } from '@/types/otc';

interface OTCClientTableProps {
  onViewStatement?: (client: OTCClient) => void;
  onEditClient?: (client: OTCClient) => void;
  onCreateOperation?: (client: OTCClient) => void;
  onViewBalance?: (client: OTCClient) => void;
}

/**
 * Componente da tabela de clientes OTC
 */
const OTCClientTable: React.FC<OTCClientTableProps> = ({
  onViewStatement,
  onEditClient,
  onCreateOperation,
  onViewBalance
}) => {
  const [filters, setFilters] = useState<OTCFilters>({
    search: '',
    isActive: null,
    page: 1,
    limit: 20
  });

  const { 
    clients, 
    statistics, 
    isLoading, 
    error,
    toggleStatus,
    isToggling,
    refetch
  } = useOTCClients({
    search: filters.search || undefined,
    is_active: filters.isActive ?? undefined,
    page: filters.page,
    limit: filters.limit
  });

  // Atualizar filtros
  const updateFilters = (newFilters: Partial<OTCFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1 // Reset para página 1 quando mudar outros filtros
    }));
  };

  // Resetar filtros
  const resetFilters = () => {
    setFilters({
      search: '',
      isActive: null,
      page: 1,
      limit: 20
    });
  };

  // Skeleton para tabela
  const TableSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex space-x-4 p-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Clientes OTC
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, documento ou chave PIX..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-10"
            />
          </div>
          
          <Select
            value={filters.isActive === null ? 'all' : filters.isActive.toString()}
            onValueChange={(value) => 
              updateFilters({ 
                isActive: value === 'all' ? null : value === 'true' 
              })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="true">Ativos</SelectItem>
              <SelectItem value="false">Inativos</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={filters.limit.toString()}
            onValueChange={(value) => updateFilters({ limit: parseInt(value) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 por página</SelectItem>
              <SelectItem value="20">20 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
              <SelectItem value="100">100 por página</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={isLoading}
          >
            Limpar
          </Button>
        </div>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.total_clientes}
            </div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {statistics.clientes_ativos}
            </div>
            <div className="text-sm text-green-600">Ativos</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {statistics.clientes_inativos}
            </div>
            <div className="text-sm text-red-600">Inativos</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {otcService.formatCurrency(statistics.total_saldo)}
            </div>
            <div className="text-sm text-yellow-600">Saldo Total</div>
          </div>
        </div>

        {/* Tabela */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">
              Erro ao carregar clientes: {error.message}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Transações</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <TableSkeleton />
                      </TableCell>
                    </TableRow>
                  ) : clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-muted-foreground">
                          Nenhum cliente encontrado com os filtros aplicados
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {client.user?.email || 'N/A'}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="font-mono text-sm">
                            {otcService.formatDocument(client.document)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="font-mono text-sm">
                            {client.pix_key}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {client.pix_key_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className={`font-semibold ${
                            client.current_balance >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {otcService.formatCurrency(client.current_balance)}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <Badge 
                            variant={client.is_active ? "default" : "secondary"}
                            className={client.is_active ? "bg-green-100 text-green-800" : ""}
                          >
                            {client.is_active ? (
                              <>
                                <UserCheck className="w-3 h-3 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3 mr-1" />
                                Inativo
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <div className="font-medium">
                            {client.total_transactions}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                disabled={isToggling}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => onViewStatement?.(client)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Extrato
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => onViewBalance?.(client)}
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Ver Saldo
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => onCreateOperation?.(client)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Nova Operação
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => onEditClient?.(client)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar Cliente
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => toggleStatus({ 
                                  id: client.id, 
                                  isActive: !client.is_active 
                                })}
                                disabled={isToggling}
                              >
                                {client.is_active ? (
                                  <>
                                    <UserX className="mr-2 h-4 w-4" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação simples */}
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {clients.length} de {statistics.total_clientes} clientes
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: filters.page - 1 })}
                  disabled={filters.page <= 1 || isLoading}
                >
                  Anterior
                </Button>
                
                <span className="flex items-center px-3 text-sm">
                  Página {filters.page}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: filters.page + 1 })}
                  disabled={clients.length < filters.limit || isLoading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OTCClientTable; 