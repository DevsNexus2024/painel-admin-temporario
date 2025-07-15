import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Minus, 
  Lock, 
  Unlock, 
  FileText, 
  AlertTriangle,
  User,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useOTCOperations } from '@/hooks/useOTCOperations';
import { otcService } from '@/services/otc';
import { OTCClient, OperationType, CreateOTCOperationRequest } from '@/types/otc';

interface OTCOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: OTCClient;
}

/**
 * Modal para operações manuais OTC
 */
const OTCOperationModal: React.FC<OTCOperationModalProps> = ({
  isOpen,
  onClose,
  client
}) => {
  const { createOperation, isCreating } = useOTCOperations();

  // Estado do formulário
  const [formData, setFormData] = useState({
    operation_type: 'credit' as OperationType,
    amount: '',
    description: ''
  });

  // Estados de validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setFormData({
        operation_type: 'credit',
        amount: '',
        description: ''
      });
      setErrors({});
      setShowConfirmation(false);
    }
  }, [isOpen]);

  // Atualizar campo do formulário
  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro do campo quando o usuário começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Informações sobre tipos de operação
  const getOperationInfo = (type: OperationType) => {
    switch (type) {
      case 'credit':
        return {
          icon: <Plus className="w-4 h-4" />,
          label: 'Crédito',
          description: 'Adicionar valor ao saldo do cliente',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          requiresAmount: true
        };
      case 'debit':
        return {
          icon: <Minus className="w-4 h-4" />,
          label: 'Débito',
          description: 'Remover valor do saldo do cliente',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          requiresAmount: true
        };
      case 'lock':
        return {
          icon: <Lock className="w-4 h-4" />,
          label: 'Bloqueio',
          description: 'Bloquear conta do cliente',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          requiresAmount: false
        };
      case 'unlock':
        return {
          icon: <Unlock className="w-4 h-4" />,
          label: 'Desbloqueio',
          description: 'Desbloquear conta do cliente',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          requiresAmount: false
        };
      case 'note':
        return {
          icon: <FileText className="w-4 h-4" />,
          label: 'Anotação',
          description: 'Adicionar anotação ao histórico',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          requiresAmount: false
        };
      default:
        return {
          icon: <CreditCard className="w-4 h-4" />,
          label: 'Operação',
          description: 'Operação manual',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          requiresAmount: false
        };
    }
  };

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const operationInfo = getOperationInfo(formData.operation_type);

    // Validar descrição (sempre obrigatória)
    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    } else if (formData.description.length < 5) {
      newErrors.description = 'Descrição deve ter pelo menos 5 caracteres';
    }

    // Validar valor (apenas para crédito e débito)
    if (operationInfo.requiresAmount) {
      if (!formData.amount.trim()) {
        newErrors.amount = 'Valor é obrigatório';
      } else {
        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
          newErrors.amount = 'Valor deve ser um número positivo';
        } else if (amount > 1000000) {
          newErrors.amount = 'Valor máximo é R$ 1.000.000,00';
        }
      }
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
    if (!client) {
      toast.error('Cliente não selecionado');
      return;
    }

    try {
      const operationData: CreateOTCOperationRequest = {
        otc_client_id: client.id,
        operation_type: formData.operation_type,
        description: formData.description.trim()
      };

      // Adicionar valor apenas se necessário
      const operationInfo = getOperationInfo(formData.operation_type);
      if (operationInfo.requiresAmount) {
        operationData.amount = parseFloat(formData.amount);
      }

      await createOperation(operationData);
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

  if (!client) {
    return null;
  }

  const currentOperationInfo = getOperationInfo(formData.operation_type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Nova Operação Manual
          </DialogTitle>
          <DialogDescription>
            Realizar operação manual para o cliente {client.name}
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          // Formulário principal
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações do Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Nome
                    </Label>
                    <p className="text-sm font-medium">{client.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Documento
                    </Label>
                    <p className="text-sm font-mono">
                      {otcService.formatDocument(client.document)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Saldo Atual
                    </Label>
                    <p className={`text-sm font-semibold ${
                      client.current_balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {otcService.formatCurrency(client.current_balance)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Status
                    </Label>
                    <Badge 
                      variant={client.is_active ? "default" : "secondary"}
                      className={client.is_active ? "bg-green-100 text-green-800" : ""}
                    >
                      {client.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tipo de Operação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tipo de Operação</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.operation_type}
                  onValueChange={(value) => updateField('operation_type', value)}
                  className="space-y-3"
                >
                  {(['credit', 'debit', 'lock', 'unlock', 'note'] as OperationType[]).map((type) => {
                    const info = getOperationInfo(type);
                    return (
                      <div key={type} className="flex items-center space-x-2">
                        <RadioGroupItem value={type} id={type} />
                        <Label 
                          htmlFor={type} 
                          className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                            formData.operation_type === type 
                              ? `${info.bgColor} ${info.borderColor} ${info.color}`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${info.bgColor} ${info.color}`}>
                              {info.icon}
                            </div>
                            <div>
                              <div className="font-medium">{info.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {info.description}
                              </div>
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Valor (apenas para crédito e débito) */}
            {currentOperationInfo.requiresAmount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Valor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="amount">
                      Valor da Operação (R$) *
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1000000"
                      value={formData.amount}
                      onChange={(e) => updateField('amount', e.target.value)}
                      placeholder="0,00"
                      className={errors.amount ? 'border-red-500' : ''}
                    />
                    {errors.amount && (
                      <p className="text-sm text-red-500">{errors.amount}</p>
                    )}
                    {formData.amount && !errors.amount && (
                      <p className="text-sm text-green-600">
                        ✓ {otcService.formatCurrency(parseFloat(formData.amount) || 0)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Descrição */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Descrição
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Descrição da Operação *
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Descreva o motivo da operação..."
                    rows={3}
                    className={errors.description ? 'border-red-500' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {formData.description.length}/500 caracteres
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
                disabled={isCreating}
                className={`${currentOperationInfo.color} bg-opacity-10 hover:bg-opacity-20`}
              >
                {currentOperationInfo.icon}
                <span className="ml-2">Continuar</span>
              </Button>
            </div>
          </form>
        ) : (
          // Confirmação
          <div className="space-y-6">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Confirmação Necessária</strong>
                <br />
                Você está prestes a executar uma operação manual que afetará o saldo do cliente.
                Esta ação não pode ser desfeita.
              </AlertDescription>
            </Alert>

            {/* Resumo da Operação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo da Operação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Cliente
                    </Label>
                    <p className="text-sm font-medium">{client.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Tipo de Operação
                    </Label>
                    <div className="flex items-center gap-2">
                      {currentOperationInfo.icon}
                      <span className="text-sm font-medium">
                        {currentOperationInfo.label}
                      </span>
                    </div>
                  </div>
                  {currentOperationInfo.requiresAmount && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Valor
                        </Label>
                        <p className={`text-sm font-semibold ${currentOperationInfo.color}`}>
                          {otcService.formatCurrency(parseFloat(formData.amount))}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Novo Saldo
                        </Label>
                        <p className={`text-sm font-semibold ${
                          formData.operation_type === 'credit' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {otcService.formatCurrency(
                            client.current_balance + 
                            (formData.operation_type === 'credit' ? 1 : -1) * 
                            parseFloat(formData.amount)
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                <Separator />
                
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Descrição
                  </Label>
                  <p className="text-sm">{formData.description}</p>
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

export default OTCOperationModal; 