import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  Filter, 
  Download, 
  RefreshCw, 
  User, 
  DollarSign,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOTCStatement } from '@/hooks/useOTCStatement';
import { otcService } from '@/services/otc';
import { OTCClient, OTCTransaction, OTCBalanceHistory } from '@/types/otc';

interface OTCStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: OTCClient;
}

/**
 * Modal para visualizar extrato detalhado do cliente
 */
const OTCStatementModal: React.FC<OTCStatementModalProps> = ({
  isOpen,
  onClose,
  client
}) => {
  const [activeTab, setActiveTab] = useState<string>('transactions');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    dateFrom: '',
    dateTo: ''
  });

  const {
    statement,
    isLoading,
    error,
    refetch
  } = useOTCStatement(client?.id || 0, filters);

  // Resetar filtros quando modal abrir
  useEffect(() => {
    if (isOpen) {
      setFilters({
        page: 1,
        limit: 20,
        dateFrom: '',
        dateTo: ''
      });
      setActiveTab('transactions');
    }
  }, [isOpen]);

  // Atualizar filtros
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1
    }));
  };

  // Componente de loading
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex justify-between items-center p-3 border rounded">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  // Componente para transação
  const TransactionRow = ({ transaction }: { transaction: OTCTransaction }) => {
    const getTransactionIcon = (type: string) => {
      switch (type) {
        case 'deposit':
          return <ArrowUpDown className="w-4 h-4 text-green-600 rotate-180" />;
        case 'withdrawal':
          return <ArrowUpDown className="w-4 h-4 text-red-600" />;
        case 'manual_credit':
          return <DollarSign className="w-4 h-4 text-blue-600" />;
        case 'manual_debit':
          return <DollarSign className="w-4 h-4 text-orange-600" />;
        case 'manual_adjustment':
          return <DollarSign className="w-4 h-4 text-purple-600" />;
        default:
          return <FileText className="w-4 h-4 text-gray-600" />;
      }
    };

    const getTransactionLabel = (type: string) => {
      switch (type) {
        case 'deposit':
          return 'Depósito';
        case 'withdrawal':
          return 'Saque';
        case 'manual_credit':
          return 'Crédito Manual';
        case 'manual_debit':
          return 'Débito Manual';
        case 'manual_adjustment':
          return transaction.amount >= 0 ? 'Crédito Manual' : 'Débito Manual';
        default:
          return type;
      }
    };

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'processed':
          return <Badge className="bg-green-100 text-green-800">Processado</Badge>;
        case 'pending':
          return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pendente</Badge>;
        case 'failed':
          return <Badge variant="destructive">Falhou</Badge>;
        case 'cancelled':
          return <Badge variant="secondary">Cancelado</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    };

    // Determinar se é crédito ou débito
    const isCredit = transaction.type === 'deposit' || 
                     transaction.type === 'manual_credit' || 
                     (transaction.type === 'manual_adjustment' && transaction.amount >= 0);

    const isDebit = transaction.type === 'withdrawal' || 
                    transaction.type === 'manual_debit' || 
                    (transaction.type === 'manual_adjustment' && transaction.amount < 0);

    // REMOVER estas linhas desnecessárias:
    // const shouldShowAsCredit = isCredit && !isDebit;
    // const shouldShowAsPositive = isCredit;

    return (
      <TableRow key={transaction.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            {getTransactionIcon(transaction.type)}
            <div>
              <div className="font-medium">
                {getTransactionLabel(transaction.type)}
              </div>
              <div className="text-sm text-muted-foreground">
                {otcService.formatDate(transaction.date)}
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell className="text-right">
          <div className={`font-semibold ${
            isCredit ? 'text-green-600' : 'text-red-600'
          }`}>
            {isCredit ? '+' : '-'}
            {otcService.formatCurrency(Math.abs(transaction.amount))}
          </div>
        </TableCell>
        
        <TableCell className="text-center">
          {getStatusBadge(transaction.status)}
        </TableCell>
        
        <TableCell>
          <div className="text-sm">
            {transaction.payer_name && (
              <div>
                <strong>Pagador:</strong> {transaction.payer_name}
              </div>
            )}
            {transaction.payer_document && (
              <div className="text-muted-foreground">
                {otcService.formatDocument(transaction.payer_document)}
              </div>
            )}
            {transaction.notes && (
              <div className="text-muted-foreground">
                {transaction.notes}
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Componente para histórico de saldo
  const BalanceHistoryRow = ({ history }: { history: OTCBalanceHistory }) => (
    <TableRow key={history.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          <div>
            <div className="font-medium">{history.operation_type}</div>
            <div className="text-sm text-muted-foreground">
              {otcService.formatDate(history.created_at)}
            </div>
          </div>
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="text-sm text-muted-foreground">
          {otcService.formatCurrency(history.balance_before)}
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className={`font-semibold ${
          history.amount_change >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {history.amount_change >= 0 ? '+' : ''}
          {otcService.formatCurrency(history.amount_change)}
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="font-semibold">
          {otcService.formatCurrency(history.balance_after)}
        </div>
      </TableCell>
      
      <TableCell>
        <div className="text-sm">
          <div>{history.description}</div>
          <div className="text-muted-foreground">
            por {history.created_by}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );

  if (!client) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Extrato do Cliente
          </DialogTitle>
          <DialogDescription>
            Histórico completo de transações e saldo de {client.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Nome
                  </Label>
                  <p className="text-sm font-medium">{statement.cliente.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Documento
                  </Label>
                  <p className="text-sm font-mono">
                    {otcService.formatDocument(statement.cliente.document)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Chave PIX
                  </Label>
                  <p className="text-sm font-mono">
                    {statement.cliente.pix_key}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Saldo Atual
                  </Label>
                  <p className={`text-sm font-semibold ${
                    statement.cliente.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {otcService.formatCurrency(statement.cliente.current_balance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Data Inicial</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo">Data Final</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilters({ dateTo: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateFilters({ dateFrom: '', dateTo: '' })}
                    disabled={isLoading}
                  >
                    Limpar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="transactions">Transações</TabsTrigger>
              <TabsTrigger value="balance_history">Histórico de Saldo</TabsTrigger>
            </TabsList>

            {/* Transações */}
            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transações</CardTitle>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="text-center py-8">
                      <p className="text-red-600">Erro ao carregar transações</p>
                    </div>
                  ) : isLoading ? (
                    <LoadingSkeleton />
                  ) : statement.transacoes.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Nenhuma transação encontrada
                      </p>
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Transação</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Detalhes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statement.transacoes.map((transaction) => (
                            <TransactionRow key={transaction.id} transaction={transaction} />
                          ))}
                        </TableBody>
                      </Table>
                      
                      {/* Paginação */}
                      <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-muted-foreground">
                          Página {statement.paginacao.page} de {statement.paginacao.total_pages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: filters.page - 1 })}
                            disabled={filters.page <= 1 || isLoading}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: filters.page + 1 })}
                            disabled={filters.page >= statement.paginacao.total_pages || isLoading}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Histórico de Saldo */}
            <TabsContent value="balance_history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Saldo</CardTitle>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="text-center py-8">
                      <p className="text-red-600">Erro ao carregar histórico</p>
                    </div>
                  ) : isLoading ? (
                    <LoadingSkeleton />
                  ) : statement.historico_saldo.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Nenhum histórico encontrado
                      </p>
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operação</TableHead>
                            <TableHead className="text-right">Saldo Anterior</TableHead>
                            <TableHead className="text-right">Alteração</TableHead>
                            <TableHead className="text-right">Saldo Posterior</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statement.historico_saldo.map((history) => (
                            <BalanceHistoryRow key={history.id} history={history} />
                          ))}
                        </TableBody>
                      </Table>
                      
                      {/* Paginação */}
                      <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-muted-foreground">
                          Página {statement.paginacao.page} de {statement.paginacao.total_pages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: filters.page - 1 })}
                            disabled={filters.page <= 1 || isLoading}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: filters.page + 1 })}
                            disabled={filters.page >= statement.paginacao.total_pages || isLoading}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Fechar
            </Button>
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              disabled={isLoading}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTCStatementModal;