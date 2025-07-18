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
  Clock,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOTCStatement } from '@/hooks/useOTCStatement';
import { otcService } from '@/services/otc';
import { OTCClient, OTCTransaction, OTCBalanceHistory } from '@/types/otc';
import { toast } from 'sonner';

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
    dateTo: '',
    hideReversals: false // Admins podem ver operações de reversão
  });

  // Estados para reversão de operação
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [transactionToReverse, setTransactionToReverse] = useState<OTCTransaction | null>(null);
  const [isReversing, setIsReversing] = useState(false);

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
        dateTo: '',
        hideReversals: false // Admins podem ver operações de reversão
      });
      setActiveTab('transactions');
    }
  }, [isOpen]);

  // Atualizar filtros
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1,
      hideReversals: newFilters.hideReversals !== undefined ? newFilters.hideReversals : prev.hideReversals
    }));
  };

  // Função para reverter operação
  const handleReverseOperation = async () => {
    if (!transactionToReverse) {
      toast.error('Nenhuma transação selecionada');
      return;
    }

    setIsReversing(true);
    try {
      // Usar um motivo padrão automático
      const defaultReason = `Reversão automática da operação ${transactionToReverse.type} realizada em ${otcService.formatDate(transactionToReverse.date)}`;
      
      console.log('[FRONTEND] Enviando reversão:', {
        transactionId: transactionToReverse.id,
        reason: defaultReason
      });
      
      await otcService.reverseOperation(transactionToReverse.id, defaultReason);
      
      toast.success('Operação revertida com sucesso!');
      
      // Fechar modal e limpar dados
      setReversalModalOpen(false);
      setTransactionToReverse(null);
      
      // Recarregar dados
      refetch();
      
    } catch (error) {
      console.error('Erro ao reverter operação:', error);
      toast.error('Erro ao reverter operação. Verifique os logs.');
    } finally {
      setIsReversing(false);
    }
  };

  // Função para abrir modal de confirmação de reversão
  const openReversalModal = (transaction: OTCTransaction) => {
    setTransactionToReverse(transaction);
    setReversalModalOpen(true);
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

  // Função para buscar valor USD da transação no histórico
  const getUsdValueFromHistory = (transactionId: number): number | null => {
    if (!statement?.historico_saldo) return null;
    
    const historyRecord = statement.historico_saldo.find(
      h => h.transaction_id === transactionId && h.usd_amount_change !== 0
    );
    
    return historyRecord?.usd_amount_change || null;
  };

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
            {(() => {
              const usdValue = getUsdValueFromHistory(transaction.id);
              const isUsdOperation = transaction.notes?.toLowerCase().includes('usd');
              
              // Operação USD pura (amount = 0 e tem valor USD no histórico)
              if (isUsdOperation && transaction.amount === 0 && usdValue !== null) {
                return (
                  <div className="text-blue-600">
                    {usdValue >= 0 ? '+' : ''}$ {Math.abs(usdValue).toFixed(4)} USD
                  </div>
                );
              }
              
              // Conversão (tem valor BRL e valor USD)
              if (isUsdOperation && transaction.amount !== 0 && usdValue !== null) {
                return (
                  <div className="space-y-1">
                    <div className={isCredit ? 'text-green-600' : 'text-red-600'}>
                      {isCredit ? '+' : '-'}{otcService.formatCurrency(Math.abs(transaction.amount))} BRL
                    </div>
                    <div className="text-blue-600 text-xs">
                      {usdValue >= 0 ? '+' : ''}$ {Math.abs(usdValue).toFixed(4)} USD
                    </div>
                  </div>
                );
              }
              
              // Operação USD que não foi encontrada no histórico
              if (isUsdOperation && transaction.amount === 0) {
                return (
                  <div className="text-blue-600 text-sm">
                    Operação USD - Ver Histórico
                  </div>
                );
              }
              
              // Operação BRL normal
              return (
                <>
                  {isCredit ? '+' : '-'}
                  {otcService.formatCurrency(Math.abs(transaction.amount))} BRL
                </>
              );
            })()}
          </div>
        </TableCell>
        
        <TableCell className="text-center">
          {getStatusBadge(transaction.status)}
        </TableCell>
        
        <TableCell>
          <div className="text-sm space-y-2">
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
            
            {/* Botão de reversão para operações manuais */}
            {['manual_credit', 'manual_debit', 'manual_adjustment'].includes(transaction.type) && 
             transaction.status === 'processed' && (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => openReversalModal(transaction)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reverter
                </Button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Componente para histórico de saldo
  const BalanceHistoryRow = ({ history }: { history: OTCBalanceHistory }) => {
    // Verificar se tem movimentação USD
    const hasUsdChange = history.usd_amount_change && history.usd_amount_change !== 0;
    const hasBrlChange = history.amount_change && history.amount_change !== 0;
    
    // Determinar se é operação exclusivamente USD (sem mudança BRL)
    const isUsdOnlyOperation = hasUsdChange && !hasBrlChange;
    
    return (
      <TableRow key={history.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <div>
              <div className="font-medium">
                {history.operation_type}
                {isUsdOnlyOperation && <span className="text-blue-600 text-xs ml-2">USD</span>}
              </div>
              <div className="text-sm text-muted-foreground">
                {otcService.formatDate(history.created_at)}
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell className="text-right">
          {isUsdOnlyOperation ? (
            // Para operações USD puras, mostrar apenas USD
            <div className="text-sm text-blue-500">
              $ {history.usd_balance_before?.toFixed(4) || '0.0000'}
            </div>
          ) : (
            // Para operações BRL ou conversões, mostrar ambos
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                BRL: {otcService.formatCurrency(history.balance_before)}
              </div>
              {hasUsdChange && (
                <div className="text-sm text-blue-500">
                  USD: $ {history.usd_balance_before?.toFixed(4) || '0.0000'}
                </div>
              )}
            </div>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          {isUsdOnlyOperation ? (
            // Para operações USD puras, mostrar apenas alteração USD
            <div className={`font-semibold text-sm ${
              history.usd_amount_change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {history.usd_amount_change >= 0 ? '+' : ''}
              $ {Math.abs(history.usd_amount_change).toFixed(4)}
            </div>
          ) : (
            // Para outras operações, mostrar as alterações aplicáveis
            <div className="space-y-1">
              {hasBrlChange && (
                <div className={`font-semibold text-sm ${
                  history.amount_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {history.amount_change >= 0 ? '+' : ''}
                  {otcService.formatCurrency(history.amount_change)} BRL
                </div>
              )}
              {hasUsdChange && (
                <div className={`font-semibold text-sm ${
                  history.usd_amount_change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {history.usd_amount_change >= 0 ? '+' : ''}
                  $ {Math.abs(history.usd_amount_change).toFixed(4)} USD
                </div>
              )}
            </div>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          {isUsdOnlyOperation ? (
            // Para operações USD puras, mostrar apenas saldo USD
            <div className="font-semibold text-sm text-blue-600">
              $ {history.usd_balance_after?.toFixed(4) || '0.0000'}
            </div>
          ) : (
            // Para outras operações, mostrar ambos os saldos
            <div className="space-y-1">
              <div className="font-semibold text-sm">
                BRL: {otcService.formatCurrency(history.balance_after)}
              </div>
              {hasUsdChange && (
                <div className="font-semibold text-sm text-blue-600">
                  USD: $ {history.usd_balance_after?.toFixed(4) || '0.0000'}
                </div>
              )}
            </div>
          )}
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
  };

  if (!client) {
    return null;
  }

  return (
    <>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                    Saldo BRL
                  </Label>
                  <p className={`text-sm font-semibold ${
                    statement.cliente.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {otcService.formatCurrency(statement.cliente.current_balance)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Saldo USD
                  </Label>
                  <p className="text-sm font-semibold text-blue-600">
                    $ {parseFloat((statement.cliente as any).usd_balance || 0).toFixed(4)}
                  </p>
                  {(statement.cliente as any).last_conversion_rate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Taxa: {parseFloat((statement.cliente as any).last_conversion_rate || 0).toFixed(4)}
                    </p>
                  )}
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

    {/* Modal de confirmação de reversão */}
    <AlertDialog open={reversalModalOpen} onOpenChange={setReversalModalOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Confirmar Reversão da Operação
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  ⚠️ Esta ação não pode ser desfeita!
                </p>
                <p className="text-red-700 text-sm mt-1">
                  A operação será revertida e os saldos do cliente serão ajustados automaticamente.
                </p>
              </div>
              
              {transactionToReverse && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Detalhes da Operação:</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Tipo:</strong> {transactionToReverse.type}</p>
                    <p><strong>Valor:</strong> {(() => {
                      const usdValue = getUsdValueFromHistory(transactionToReverse.id);
                      const isUsdOperation = transactionToReverse.notes?.toLowerCase().includes('usd');
                      
                      if (isUsdOperation && transactionToReverse.amount === 0 && usdValue !== null) {
                        return `$ ${Math.abs(usdValue).toFixed(4)} USD`;
                      }
                      
                      if (isUsdOperation && transactionToReverse.amount !== 0 && usdValue !== null) {
                        return `${otcService.formatCurrency(transactionToReverse.amount)} BRL + $ ${Math.abs(usdValue).toFixed(4)} USD`;
                      }
                      
                      return `${otcService.formatCurrency(transactionToReverse.amount)} BRL`;
                    })()}</p>
                    <p><strong>Data:</strong> {otcService.formatDate(transactionToReverse.date)}</p>
                    {transactionToReverse.notes && (
                      <p><strong>Observações:</strong> {transactionToReverse.notes}</p>
                    )}
                  </div>
                </div>
              )}

                             <div className="text-center text-sm text-muted-foreground">
                 A operação será revertida automaticamente com registro no sistema.
               </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReversing}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReverseOperation}
            disabled={isReversing}
            className="bg-red-600 hover:bg-red-700"
          >
            {isReversing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Revertendo...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirmar Reversão
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default OTCStatementModal;