import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  User,
  DollarSign,
  FileText,
  AlertTriangle,
  Search,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useOTCClients } from '@/hooks/useOTCClients';
import { useOTCOperations } from '@/hooks/useOTCOperations';
import { MovimentoExtrato } from '@/services/extrato';
import { OTCClient } from '@/types/otc';
import { cn } from '@/lib/utils';

interface CreditExtractToOTCModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractRecord?: MovimentoExtrato | null;
}

/**
 * Modal para creditar registro do extrato para cliente OTC
 */
const CreditExtractToOTCModal: React.FC<CreditExtractToOTCModalProps> = ({
  isOpen,
  onClose,
  extractRecord
}) => {
  const { clients, isLoading: loadingClients } = useOTCClients();
  const { createOperation, isCreating } = useOTCOperations();

  // Estados do formulário
  const [selectedClient, setSelectedClient] = useState<OTCClient | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [openClientSelect, setOpenClientSelect] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Estados de validação
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen && extractRecord) {
      setSelectedClient(null);
      setCustomDescription(generateDefaultDescription(extractRecord));
      setClientSearchValue('');
      setErrors({});
      setShowConfirmation(false);
    } else if (!isOpen) {
      setSelectedClient(null);
      setCustomDescription('');
      setClientSearchValue('');
      setErrors({});
      setShowConfirmation(false);
    }
  }, [isOpen, extractRecord]);

  // Gerar descrição padrão baseada no registro do extrato
  const generateDefaultDescription = (record: MovimentoExtrato): string => {
    const parts = [];
    
    parts.push('Crédito via extrato BMP');
    
    if (record.client) {
      parts.push(`- Cliente: ${record.client}`);
    }
    
    if (record.document) {
      parts.push(`- Doc: ${record.document}`);
    }
    
    if (record.code) {
      parts.push(`- Código: ${record.code}`);
    }
    
    const date = new Date(record.dateTime).toLocaleDateString('pt-BR');
    parts.push(`- Data: ${date}`);
    
    return parts.join(' ');
  };

  // Filtrar clientes baseado na busca
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchValue.toLowerCase()) ||
    client.document?.toLowerCase().includes(clientSearchValue.toLowerCase()) ||
    client.pix_key?.toLowerCase().includes(clientSearchValue.toLowerCase())
  );

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedClient) {
      newErrors.client = 'Selecione um cliente OTC';
    }

    if (!customDescription.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    } else if (customDescription.length < 10) {
      newErrors.description = 'Descrição deve ter pelo menos 10 caracteres';
    }

    if (!extractRecord || extractRecord.type !== 'CRÉDITO') {
      newErrors.record = 'Apenas registros de crédito podem ser processados';
    }

    if (extractRecord && extractRecord.value <= 0) {
      newErrors.value = 'Valor deve ser positivo';
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

  // Confirmar operação
  const handleConfirmOperation = async () => {
    if (!selectedClient || !extractRecord) {
      toast.error('Dados insuficientes para a operação');
      return;
    }

    try {
      await createOperation({
        otc_client_id: selectedClient.id,
        operation_type: 'credit',
        amount: extractRecord.value,
        description: customDescription.trim()
      });
      
      toast.success('Operação realizada com sucesso!', {
        description: `R$ ${extractRecord.value.toFixed(2)} creditados para ${selectedClient.name}`
      });
      
      onClose();
    } catch (error) {
      console.error('Erro ao criar operação:', error);
      setShowConfirmation(false);
    }
  };

  // Cancelar confirmação
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  if (!extractRecord) {
    return null;
  }

  // Formatação de moeda
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Creditar Extrato para Cliente OTC
          </DialogTitle>
          <DialogDescription>
            Converter registro do extrato BMP em operação de crédito OTC
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          // Formulário principal
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações do Registro do Extrato */}
            <Card className="bg-muted/30 border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Registro do Extrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Valor
                    </Label>
                    <div className="text-2xl font-bold text-green-500">
                      {formatCurrency(extractRecord.value)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Data/Hora
                    </Label>
                    <div className="text-sm font-medium">
                      {new Date(extractRecord.dateTime).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Cliente/Origem
                    </Label>
                    <div className="text-sm font-medium">
                      {extractRecord.client || 'Não identificado'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Documento
                    </Label>
                    <div className="text-sm font-medium font-mono">
                      {extractRecord.document || 'N/A'}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Código da Transação
                  </Label>
                  <div className="text-sm font-mono bg-background p-2 rounded border">
                    {extractRecord.code}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verificação se é crédito */}
            {extractRecord.type !== 'CRÉDITO' && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Aviso:</strong> Apenas registros de CRÉDITO podem ser processados. 
                  Este registro é do tipo: <strong>{extractRecord.type}</strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Seleção de Cliente OTC */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente OTC de Destino
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="client">
                    Selecionar Cliente *
                  </Label>
                  <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openClientSelect}
                        className={cn(
                          "w-full justify-between",
                          errors.client && "border-red-500"
                        )}
                        disabled={loadingClients}
                      >
                        {selectedClient ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{selectedClient.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {selectedClient.document}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {loadingClients ? 'Carregando...' : 'Selecione um cliente...'}
                          </span>
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Buscar cliente..." 
                          value={clientSearchValue}
                          onValueChange={setClientSearchValue}
                        />
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-y-auto">
                          {filteredClients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={`${client.name}-${client.document}`}
                              onSelect={() => {
                                setSelectedClient(client);
                                setOpenClientSelect(false);
                                setClientSearchValue('');
                                if (errors.client) {
                                  setErrors(prev => ({ ...prev, client: '' }));
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{client.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {client.document} • {client.pix_key}
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {formatCurrency(client.current_balance || 0)}
                                  </Badge>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.client && (
                    <p className="text-sm text-red-500">{errors.client}</p>
                  )}
                  {selectedClient && (
                    <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg">
                      <div className="text-sm text-foreground">
                        <strong>Cliente selecionado:</strong> {selectedClient.name}
                        <br />
                        <strong>Saldo atual:</strong> {formatCurrency(selectedClient.current_balance || 0)}
                        <br />
                        <strong>Novo saldo:</strong> <span className="text-green-500 font-medium">{formatCurrency((selectedClient.current_balance || 0) + extractRecord.value)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Descrição da Operação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Descrição da Operação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Descrição do Crédito *
                  </Label>
                  <Textarea
                    id="description"
                    value={customDescription}
                    onChange={(e) => {
                      setCustomDescription(e.target.value);
                      if (errors.description) {
                        setErrors(prev => ({ ...prev, description: '' }));
                      }
                    }}
                    placeholder="Descreva o motivo do crédito..."
                    rows={4}
                    className={errors.description ? 'border-red-500' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {customDescription.length}/500 caracteres
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCreating || extractRecord.type !== 'CRÉDITO'}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Continuar
              </Button>
            </div>
          </form>
        ) : (
          // Confirmação
          <div className="space-y-6">
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-foreground">
                <strong>Confirmação Necessária</strong>
                <br />
                Você está prestes a creditar um valor do extrato BMP para um cliente OTC.
                Esta ação criará uma operação manual que afetará o saldo do cliente.
              </AlertDescription>
            </Alert>

            {/* Resumo da Operação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo da Operação de Crédito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Cliente OTC
                    </Label>
                    <p className="text-sm font-medium">{selectedClient?.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Valor do Crédito
                    </Label>
                    <p className="text-lg font-bold text-green-500">
                      {formatCurrency(extractRecord.value)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Saldo Atual
                    </Label>
                    <p className="text-sm font-medium">
                      {formatCurrency(selectedClient?.current_balance || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Novo Saldo
                    </Label>
                    <p className="text-sm font-bold text-green-500">
                      {formatCurrency((selectedClient?.current_balance || 0) + extractRecord.value)}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Descrição
                  </Label>
                  <p className="text-sm bg-muted/20 rounded p-2 text-foreground">{customDescription}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Origem (Extrato BMP)
                  </Label>
                  <p className="text-sm font-mono">{extractRecord.code}</p>
                </div>
              </CardContent>
            </Card>

            {/* Ações de Confirmação */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelConfirmation}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmOperation}
                disabled={isCreating}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Executando...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Confirmar Operação
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreditExtractToOTCModal; 