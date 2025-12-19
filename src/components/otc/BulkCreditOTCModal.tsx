import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  User,
  DollarSign,
  FileText,
  AlertTriangle,
  Search,
  Check,
  X,
  Loader2,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useOTCClients } from '@/hooks/useOTCClients';
import { OTCClient } from '@/types/otc';
import { cn } from '@/lib/utils';
import { otcService } from '@/services/otc';

interface BulkCreditOTCModalProps {
  isOpen: boolean;
  onClose: (wasSuccessful?: boolean, successfulIds?: string[]) => void;
  transactions: any[]; // Array de transações selecionadas
}

interface BulkResult {
  success: number;
  failed: number;
  duplicates: number;
  details: Array<{
    transaction_id: string;
    status: 'success' | 'error' | 'duplicate';
    message: string;
    operation_id?: number;
  }>;
}

/**
 * Modal para creditar múltiplas transações OTC em lote
 */
const BulkCreditOTCModal: React.FC<BulkCreditOTCModalProps> = ({
  isOpen,
  onClose,
  transactions
}) => {
  const { clients, isLoading: loadingClients } = useOTCClients();

  // Estados do formulário
  const [selectedClient, setSelectedClient] = useState<OTCClient | null>(null);
  const [openClientSelect, setOpenClientSelect] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Estados de processamento
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BulkResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSelectClient = (client: OTCClient) => {
    setSelectedClient(client);
    setOpenClientSelect(false);
    setClientSearchValue('');
    setErrors((prev) => ({ ...prev, client: '' }));
  };

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setSelectedClient(null);
      setClientSearchValue('');
      setErrors({});
      setShowConfirmation(false);
      setResults(null);
      setProcessing(false);
    }
  }, [isOpen]);

  // Calcular totais
  const totalAmount = transactions.reduce((sum, t) => sum + (t.value || t.amount || 0), 0);
  const totalTransactions = transactions.length;

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Formatação de data
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
  };

  // Filtrar clientes (defensivo: produção pode trazer itens inválidos)
  const safeClients = Array.isArray(clients) ? clients : [];
  const search = (clientSearchValue || '').toLowerCase().trim();
  const filteredClients = safeClients.filter((client) => {
    if (!client) return false;
    const name = (client.name || '').toLowerCase();
    const doc = (client.document || '').toLowerCase();
    return name.includes(search) || doc.includes(search);
  });

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedClient) {
      newErrors.client = 'Selecione um cliente OTC';
    }

    if (transactions.length === 0) {
      newErrors.transactions = 'Nenhuma transação selecionada';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setShowConfirmation(true);
  };

  // Confirmar operação em lote
  const handleConfirmBulkOperation = async () => {
    if (!selectedClient) {
      toast.error('Cliente não selecionado');
      return;
    }

    setProcessing(true);
    
    try {
      // Preparar payload para o backend
      const payload = {
        otc_client_id: selectedClient.id,
        transactions: transactions.map(t => {
          // Para Bitso, garantir que reference_code seja sempre o endToEndId
          const endToEndId = t._original?.endToEndId || t.code;
          const transactionId = t._original?.transactionId || t._original?.id || t.id;
          
          return {
            provider: 'bitso',
            transaction_id: transactionId,
            amount: t.value || t.amount || 0,
            // Para Bitso, reference_code deve ser sempre o endToEndId, não o transactionId
            reference_code: endToEndId,
            reference_date: t.dateTime || t.date,
            // Garantir que dados_extrato tenha endToEndId correto
            dados_extrato: t._original ? {
              ...t._original,
              endToEndId: t._original.endToEndId || endToEndId,
              id: transactionId
            } : {
              endToEndId: endToEndId,
              id: transactionId,
              dateTime: t.dateTime || t.date
            }
          };
        })
      };

      console.log('🚀 [BULK-OTC] Enviando lote:', payload);

      // Chamar o serviço real (quando backend estiver pronto)
      const response = await otcService.bulkCreditOperations(payload);
      setResults(response);

      // Mostrar resultado
      if (response.failed === 0 && response.duplicates === 0) {
        toast.success(`🎉 ${response.success} transações creditadas com sucesso!`, {
          description: `Total creditado: ${formatCurrency(totalAmount)}`
        });
        
        // Retornar IDs das transações bem-sucedidas
        const successfulIds = response.details
          .filter(d => d.status === 'success')
          .map(d => d.transaction_id);
        
        onClose(true, successfulIds);
      } else {
        toast.warning(`Processamento concluído com ressalvas`, {
          description: `${response.success} sucesso • ${response.failed} falhas • ${response.duplicates} duplicadas`
        });
      }

    } catch (error) {
      console.error('[BULK-OTC] Erro ao processar lote:', error);
      toast.error('Erro ao processar lote', {
        description: 'Não foi possível processar as transações'
      });
    } finally {
      setProcessing(false);
    }
  };

  // Cancelar confirmação
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  // Fechar modal
  const handleClose = () => {
    if (results && results.success > 0) {
      const successfulIds = results.details
        .filter(d => d.status === 'success')
        .map(d => d.transaction_id);
      onClose(true, successfulIds);
    } else {
      onClose(false);
    }
  };

  if (transactions.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Creditar em Lote para Cliente OTC
          </DialogTitle>
          <DialogDescription>
            {totalTransactions} transações selecionadas • Total: <strong>{formatCurrency(totalAmount)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Resumo das Transações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transações Selecionadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {transactions.map((t, idx) => (
                    <div key={t.id || idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm truncate">
                          {t.description || t.client || t.document || `Transação ${idx + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.dateTime || t.date)} • ID: {t.id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(t.value || t.amount || 0)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Bitso
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-900">Total Geral:</span>
                  <span className="font-bold text-xl text-blue-900">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Cliente OTC */}
          {!showConfirmation && !results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Cliente OTC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Selecionar Cliente *</Label>
                  <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openClientSelect}
                        className={cn(
                          "w-full justify-between",
                          !selectedClient && "text-muted-foreground",
                          errors.client && "border-red-500"
                        )}
                      >
                        {selectedClient ? (
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {selectedClient.name} ({selectedClient.document})
                          </span>
                        ) : (
                          "Selecione um cliente..."
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-2" align="start">
                      {/* NOTE(P0): removido cmdk/Command aqui porque em produção estava causando "undefined is not iterable" */}
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar cliente..."
                          value={clientSearchValue}
                          onChange={(e) => setClientSearchValue(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
                        {loadingClients ? (
                          <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
                        ) : filteredClients.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                        ) : (
                          filteredClients
                            .filter((c) => c && c.id && c.name)
                            .map((client) => {
                              const isSelected = selectedClient?.id === client.id;
                              return (
                                <button
                                  key={client.id}
                                  type="button"
                                  style={{
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 1
                                  }}
                                  className={cn(
                                    "w-full px-3 py-2 text-left flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors",
                                    isSelected && "bg-accent/50"
                                  )}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
                                    console.log('[BULK-CLIENT-SELECT] Mouse enter:', client.name);
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                  }}
                                  onClick={(e) => {
                                    console.log('[BULK-CLIENT-SELECT] onClick:', client.name);
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelectClient(client);
                                  }}
                                  onMouseDown={(e) => {
                                    console.log('[BULK-CLIENT-SELECT] onMouseDown:', client.name);
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelectClient(client);
                                  }}
                                >
                                  <User className="h-4 w-4" />
                                  <div className="flex-1" style={{ pointerEvents: 'none' }}>
                                    <p className="font-medium">{client.name}</p>
                                    <p className="text-sm text-muted-foreground">{client.document}</p>
                                  </div>
                                  <Check className={cn("ml-auto h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                </button>
                              );
                            })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {errors.client && (
                    <p className="text-sm text-red-500">{errors.client}</p>
                  )}
                </div>

                {selectedClient && (
                  <Alert>
                    <User className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Cliente selecionado:</strong> {selectedClient.name}<br />
                      <strong>Documento:</strong> {selectedClient.document}<br />
                      <strong>Será creditado:</strong> {formatCurrency(totalAmount)}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Confirmação */}
          {showConfirmation && !results && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Confirmar Operação em Lote
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-orange-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-orange-800">
                    <strong>Atenção:</strong> Esta operação irá creditar <strong>{totalTransactions} transações</strong> 
                    no valor total de <strong>{formatCurrency(totalAmount)}</strong> para o cliente <strong>{selectedClient?.name}</strong>.
                    <br /><br />
                    Esta ação não pode ser desfeita automaticamente.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-white rounded border">
                    <p className="text-2xl font-bold text-blue-600">{totalTransactions}</p>
                    <p className="text-sm text-muted-foreground">Transações</p>
                  </div>
                  <div className="p-3 bg-white rounded border">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                  </div>
                  <div className="p-3 bg-white rounded border">
                    <p className="text-lg font-bold text-orange-600">Bitso</p>
                    <p className="text-sm text-muted-foreground">Provider</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Resultado do Processamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-3xl font-bold text-green-600">{results.success}</p>
                    <p className="text-sm text-green-800">Sucesso</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-3xl font-bold text-red-600">{results.failed}</p>
                    <p className="text-sm text-red-800">Falhas</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-3xl font-bold text-yellow-600">{results.duplicates}</p>
                    <p className="text-sm text-yellow-800">Duplicadas</p>
                  </div>
                </div>
                
                {/* Detalhes individuais */}
                <div className="space-y-2">
                  <h4 className="font-medium">Detalhes por Transação:</h4>
                  <ScrollArea className="h-40">
                    <div className="space-y-1">
                      {results.details.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 text-sm rounded border">
                          {detail.status === 'success' && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                          {detail.status === 'error' && <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
                          {detail.status === 'duplicate' && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                          <span className="font-mono text-xs text-muted-foreground">{detail.transaction_id}</span>
                          <span className="flex-1">{detail.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!showConfirmation && !results && (
            <>
              <Button variant="outline" onClick={() => onClose(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedClient || totalTransactions === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            </>
          )}

          {showConfirmation && !results && (
            <>
              <Button variant="outline" onClick={handleCancelConfirmation}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirmBulkOperation}
                disabled={processing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar Crédito em Lote
                  </>
                )}
              </Button>
            </>
          )}

          {results && (
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
              <Check className="h-4 w-4 mr-2" />
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkCreditOTCModal;
