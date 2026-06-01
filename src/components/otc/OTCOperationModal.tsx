import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  Plus,
  Minus,
  ArrowRightLeft,
  FileText,
  AlertTriangle,
  User,
  DollarSign,
  Send,
  Check,
  ChevronsUpDown,
  Search
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { useOTCOperations } from '@/hooks/useOTCOperations';

import { otcService } from '@/services/otc';
import { OTCClient, OperationType, CurrencyType, CreateOTCOperationRequest } from '@/types/otc';

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
  const { createOperation, isCreating, transferBalance, isTransferring } = useOTCOperations();

  // Estado do formulário
  const [formData, setFormData] = useState({
    operation_type: 'credit' as OperationType,
    currency: 'BRL' as CurrencyType,
    amount: '',
    description: '',
    // Campos específicos para conversão
    brl_amount: '',
    usd_amount: '',
    conversion_rate: '',
    // Campos específicos para transferência
    to_otc_client_id: '',
    pin: ''
  });

  // Estado para rastrear quais campos foram preenchidos pelo usuário
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Estado para debounce do cálculo automático
  const [calculationTimeout, setCalculationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Estados de validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Estado para busca de clientes destino (transferência)
  const [destClients, setDestClients] = useState<OTCClient[]>([]);
  const [destClientsLoading, setDestClientsLoading] = useState(false);
  const [destClientOpen, setDestClientOpen] = useState(false);
  const [destSearchQuery, setDestSearchQuery] = useState('');

  const isSubmitting = isCreating || isTransferring;

  // Trava síncrona contra duplo-clique: `isSubmitting` (isLoading do react-query) só
  // vira true de forma assíncrona após o clique, então um duplo-clique rápido dispararia
  // 2 requests antes do botão desabilitar. Este ref bloqueia já no mesmo tick.
  const submitLockRef = useRef(false);
  // Chave de idempotência da transferência: gerada UMA vez por sessão de confirmação e
  // reutilizada em retentativas (mesmo clique lógico = mesma chave), zerada a cada open/sucesso.
  const transferIdempotencyKeyRef = useRef<string | null>(null);

  // Resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setFormData({
        operation_type: 'credit',
        currency: 'BRL',
        amount: '',
        description: '',
        brl_amount: '',
        usd_amount: '',
        conversion_rate: '',
        to_otc_client_id: '',
        pin: ''
      });
      setTouchedFields(new Set());
      setErrors({});
      setShowConfirmation(false);
      setDestClients([]);
      setDestSearchQuery('');
      submitLockRef.current = false;
      transferIdempotencyKeyRef.current = null;
    } else {
      if (calculationTimeout) {
        clearTimeout(calculationTimeout);
        setCalculationTimeout(null);
      }
    }
  }, [isOpen, calculationTimeout]);

  // Buscar clientes destino quando abrir o combobox de transferência
  const fetchDestClients = useCallback(async (search?: string) => {
    if (!client) return;
    setDestClientsLoading(true);
    try {
      const response = await otcService.getClients({ is_active: true, search, limit: 50 });
      const filtered = (response.data?.clientes || []).filter(c => c.id !== client.id);
      setDestClients(filtered);
    } catch {
      setDestClients([]);
    } finally {
      setDestClientsLoading(false);
    }
  }, [client]);

  // Buscar clientes quando abrir o popover
  useEffect(() => {
    if (destClientOpen && formData.operation_type === 'transfer') {
      fetchDestClients(destSearchQuery || undefined);
    }
  }, [destClientOpen, destSearchQuery, formData.operation_type, fetchDestClients]);

  // Função para formatar valor em USD
  const formatUSD = (value: number): string => {
    return `$ ${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    })}`;
  };

  // Função para limpar campos de conversão
  const clearConversionFields = () => {
    setFormData(prev => ({
      ...prev,
      brl_amount: '',
      usd_amount: '',
      conversion_rate: ''
    }));
    setTouchedFields(new Set());
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.brl_amount;
      delete newErrors.usd_amount;
      delete newErrors.conversion_rate;
      return newErrors;
    });
  };

  // Função para calcular valores dinamicamente (nova lógica)
  const calculateDynamicValues = (field: string, value: string, currentData: any) => {
    const newData = { ...currentData, [field]: value };
    
    // Só aplicar cálculo automático para campos de conversão
    if (field === 'brl_amount' || field === 'usd_amount' || field === 'conversion_rate') {
      // Marcar o campo atual como tocado pelo usuário
      const newTouchedFields = new Set(touchedFields);
      newTouchedFields.add(field);
      setTouchedFields(newTouchedFields);
      
      // Valores atuais dos três campos
      const brlValue = parseFloat(newData.brl_amount) || 0;
      const usdValue = parseFloat(newData.usd_amount) || 0; 
      const rateValue = parseFloat(newData.conversion_rate) || 0;
      
      // Identificar quais campos estão preenchidos (valor > 0)
      const hasBrl = brlValue > 0;
      const hasUsd = usdValue > 0;
      const hasRate = rateValue > 0;
      
      // Contar quantos campos estão preenchidos
      const filledCount = (hasBrl ? 1 : 0) + (hasUsd ? 1 : 0) + (hasRate ? 1 : 0);
      
      // Lógica de cálculo automático - preencher apenas o campo vazio
      if (filledCount === 2) {
        // Caso 1: BRL e USD preenchidos → calcular Taxa (prioritário conforme solicitado)
        if (hasBrl && hasUsd && !hasRate) {
          const calculatedRate = brlValue / usdValue;
          newData.conversion_rate = calculatedRate > 0 ? calculatedRate.toFixed(4) : '';
          // console.log(`[CONVERSÃO AUTO] BRL (${brlValue}) ÷ USD (${usdValue}) = Taxa (${calculatedRate.toFixed(4)})`);
        }
        // Caso 2: BRL e Taxa preenchidos → calcular USD
        else if (hasBrl && hasRate && !hasUsd) {
          const calculatedUsd = brlValue / rateValue;
          newData.usd_amount = calculatedUsd > 0 ? calculatedUsd.toFixed(4) : '';
          // console.log(`[CONVERSÃO AUTO] BRL (${brlValue}) ÷ Taxa (${rateValue}) = USD (${calculatedUsd.toFixed(4)})`);
        }
        // Caso 3: USD e Taxa preenchidos → calcular BRL  
        else if (hasUsd && hasRate && !hasBrl) {
          const calculatedBrl = usdValue * rateValue;
          newData.brl_amount = calculatedBrl > 0 ? calculatedBrl.toFixed(2) : '';
          // console.log(`[CONVERSÃO AUTO] USD (${usdValue}) × Taxa (${rateValue}) = BRL (${calculatedBrl.toFixed(2)})`);
        }
      }
    }
    
    return newData;
  };

  // Atualizar campo normalmente (sem cálculo automático)
  const updateField = (field: keyof CreateOTCOperationRequest, value: string) => {
    // Atualizar o valor imediatamente
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Se o valor foi limpo (vazio), remover da lista de campos tocados
    if (!value.trim()) {
      const newTouchedFields = new Set(touchedFields);
      newTouchedFields.delete(field as string);
      setTouchedFields(newTouchedFields);
    }
    
    // Limpar erro do campo quando o usuário começa a digitar
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  };

  // Função para calcular quando campo perde foco
  const handleFieldBlur = (field: string) => {
    if (field === 'brl_amount' || field === 'usd_amount' || field === 'conversion_rate') {
      setFormData(currentFormData => {
        const newFormData = calculateDynamicValues(field, currentFormData[field as keyof typeof currentFormData], currentFormData);
        return newFormData;
      });
    }
  };

  // Informações sobre tipos de operação
  const getOperationInfo = (type: OperationType, currency?: CurrencyType) => {
    switch (type) {
      case 'credit':
        return {
          icon: <Plus className="w-4 h-4" />,
          label: 'Crédito',
          description: `Adicionar valor ao saldo ${currency === 'USD' ? 'em dólares' : 'em reais'} do cliente`,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          requiresAmount: true,
          requiresConversion: false,
          requiresCurrency: true
        };
      case 'debit':
        return {
          icon: <Minus className="w-4 h-4" />,
          label: 'Débito',
          description: `Remover valor do saldo ${currency === 'USD' ? 'em dólares' : 'em reais'} do cliente`,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          requiresAmount: true,
          requiresConversion: false,
          requiresCurrency: true
        };
      case 'convert':
        return {
          icon: <ArrowRightLeft className="w-4 h-4" />,
          label: 'Conversão BRL → USD',
          description: 'Debita valor em reais (BRL) e credita em dólares (USD)',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          requiresAmount: false,
          requiresConversion: true,
          requiresCurrency: false,
          requiresDestination: false,
          requiresPin: false
        };
      case 'transfer':
        return {
          icon: <Send className="w-4 h-4" />,
          label: 'Transferência',
          description: 'Transfere saldo deste cliente para outro cliente OTC (mesma moeda)',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          requiresAmount: true,
          requiresConversion: false,
          requiresCurrency: true,
          requiresDestination: true,
          requiresPin: true
        };
      default:
        return {
          icon: <CreditCard className="w-4 h-4" />,
          label: 'Operação',
          description: 'Operação manual',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          requiresAmount: false,
          requiresConversion: false,
          requiresCurrency: false
        };
    }
  };

  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const operationInfo = getOperationInfo(formData.operation_type, formData.currency);

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
        }
      }
    }

    // Validar campos de conversão (apenas para inserir trava)
    if (operationInfo.requiresConversion) {
      // Validar valor em reais
      if (!formData.brl_amount.trim()) {
        newErrors.brl_amount = 'Valor em reais é obrigatório';
      } else {
        const brlAmount = parseFloat(formData.brl_amount);
        if (isNaN(brlAmount) || brlAmount <= 0) {
          newErrors.brl_amount = 'Valor deve ser um número positivo';
        }
      }

      // Validar valor em dólares
      if (!formData.usd_amount.trim()) {
        newErrors.usd_amount = 'Valor em dólares é obrigatório';
      } else {
        const usdAmount = parseFloat(formData.usd_amount);
        if (isNaN(usdAmount) || usdAmount <= 0) {
          newErrors.usd_amount = 'Valor deve ser um número positivo';
        }
      }

      // Validar taxa de conversão
      if (!formData.conversion_rate.trim()) {
        newErrors.conversion_rate = 'Taxa de conversão é obrigatória';
      } else {
        const rate = parseFloat(formData.conversion_rate);
        if (isNaN(rate) || rate <= 0) {
          newErrors.conversion_rate = 'Taxa deve ser um número positivo';
        } else if (rate < 0.1 || rate > 10) {
          newErrors.conversion_rate = 'Taxa deve estar entre 0.1 e 10.0';
        }
      }

      // Validar cálculo da conversão (se todos os campos estão preenchidos)
      if (formData.brl_amount && formData.usd_amount && formData.conversion_rate) {
        const brlAmount = parseFloat(formData.brl_amount);
        const usdAmount = parseFloat(formData.usd_amount);
        const rate = parseFloat(formData.conversion_rate);

        if (!isNaN(brlAmount) && !isNaN(usdAmount) && !isNaN(rate)) {
          if (!otcService.validateConversionData(brlAmount, usdAmount, rate)) {
            newErrors.conversion_rate = 'Cálculo de conversão incorreto. Verifique os valores.';
          }
        }
      }
    }

    // Validar campos de transferência
    if (formData.operation_type === 'transfer') {
      if (!formData.to_otc_client_id) {
        newErrors.to_otc_client_id = 'Selecione o cliente destino';
      } else if (Number(formData.to_otc_client_id) === client?.id) {
        newErrors.to_otc_client_id = 'Cliente destino não pode ser o mesmo que a origem';
      }
      if (!formData.pin || formData.pin.length !== 6 || !/^\d{6}$/.test(formData.pin)) {
        newErrors.pin = 'PIN deve ter exatamente 6 dígitos numéricos';
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

    // Trava síncrona contra duplo-clique: ignora cliques repetidos enquanto há submissão em voo.
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    try {
      // Branch para transferência
      if (formData.operation_type === 'transfer') {
        // Gera a chave de idempotência UMA vez por sessão de confirmação; reenvios após
        // erro reaproveitam a mesma chave (mesma operação lógica → backend não duplica).
        if (!transferIdempotencyKeyRef.current) {
          transferIdempotencyKeyRef.current =
            (typeof crypto !== 'undefined' && crypto.randomUUID)
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        const destClient = destClients.find(c => c.id === Number(formData.to_otc_client_id));
        await transferBalance({
          from_otc_client_id: client.id,
          to_otc_client_id: Number(formData.to_otc_client_id),
          currency: formData.currency,
          amount: parseFloat(formData.amount),
          description: formData.description.trim(),
          pin: formData.pin,
          idempotency_key: transferIdempotencyKeyRef.current
        });
        transferIdempotencyKeyRef.current = null; // sucesso → próxima transferência usa chave nova
        const symbol = formData.currency === 'USD' ? '$' : 'R$';
        toast.success('Transferência realizada com sucesso', {
          description: `${symbol} ${parseFloat(formData.amount).toFixed(2)} de ${client.name} → ${destClient?.name || 'destino'}`
        });
        onClose();
        return;
      }

      const operationData: CreateOTCOperationRequest = {
        otc_client_id: client.id,
        operation_type: formData.operation_type,
        currency: formData.currency,
        description: formData.description.trim()
      };

      const operationInfo = getOperationInfo(formData.operation_type, formData.currency);

      if (operationInfo.requiresAmount) {
        operationData.amount = parseFloat(formData.amount);
      }

      if (operationInfo.requiresConversion) {
        operationData.brl_amount = parseFloat(formData.brl_amount);
        operationData.usd_amount = parseFloat(formData.usd_amount);
        operationData.conversion_rate = parseFloat(formData.conversion_rate);
      }

      await createOperation(operationData);

      if (operationInfo.requiresConversion) {
        toast.success('Conversão realizada com sucesso!', {
          description: `R$ ${parseFloat(formData.brl_amount).toFixed(2)} convertidos para $ ${parseFloat(formData.usd_amount).toFixed(4)}`
        });
      } else {
        toast.success('Operação realizada com sucesso!');
      }

      onClose();
    } catch (error: any) {
      console.error('Erro ao criar operação:', error);
      // Para transferência, manter modal aberto em caso de erro
      if (formData.operation_type === 'transfer') {
        const apiError = error.response?.data?.error || error.response?.data?.message;
        if (apiError) {
          toast.error(apiError);
        }
        if (error.response?.status === 403) {
          setErrors(prev => ({ ...prev, pin: 'PIN incorreto ou não configurado' }));
        }
      }
      setShowConfirmation(false);
    } finally {
      submitLockRef.current = false;
    }
  };

  // Cancelar confirmação
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  if (!client) {
    return null;
  }



  const currentOperationInfo = getOperationInfo(formData.operation_type, formData.currency);

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
                  {(['credit', 'debit', 'convert', 'transfer'] as OperationType[]).map((type) => {
                    const info = getOperationInfo(type, formData.currency);
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

            {/* Seleção de Moeda (apenas para crédito e débito) */}
            {currentOperationInfo.requiresCurrency && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Moeda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Selecione a moeda da operação
                    </Label>
                    <RadioGroup
                      value={formData.currency}
                      onValueChange={(value) => updateField('currency', value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="BRL" id="brl" />
                        <Label htmlFor="brl" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">BRL</span>
                            <span className="text-sm text-muted-foreground">Real Brasileiro</span>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="USD" id="usd" />
                        <Label htmlFor="usd" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-600">USD</span>
                            <span className="text-sm text-muted-foreground">Dólar Americano</span>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      Valor da Operação ({formData.currency === 'USD' ? '$' : 'R$'}) *
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
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
                        ✓ {formData.currency === 'USD' 
                          ? formatUSD(parseFloat(formData.amount) || 0)
                          : otcService.formatCurrency(parseFloat(formData.amount) || 0)
                        }
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Campos para Conversão (apenas para inserir trava) */}
            {currentOperationInfo.requiresConversion && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    Dados da Conversão
                  </CardTitle>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Preencha qualquer dois campos que o terceiro será calculado automaticamente
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">
                          Esta operação irá <span className="text-red-600">debitar reais (BRL)</span> do saldo e <span className="text-green-600">creditar dólares (USD)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Valor em Reais */}
                    <div className="space-y-2">
                      <Label htmlFor="brl_amount">
                        Valor em Reais (BRL) *
                      </Label>
                      <Input
                        id="brl_amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.brl_amount}
                        onChange={(e) => updateField('brl_amount', e.target.value)}
                        onBlur={() => handleFieldBlur('brl_amount')}
                        placeholder="0,00"
                        className={errors.brl_amount ? 'border-red-500' : ''}
                      />
                      {errors.brl_amount && (
                        <p className="text-sm text-red-500">{errors.brl_amount}</p>
                      )}
                      {formData.brl_amount && !errors.brl_amount && (
                        <p className="text-sm text-blue-600">
                          Débito: {otcService.formatCurrency(parseFloat(formData.brl_amount) || 0)}
                        </p>
                      )}
                    </div>

                    {/* Valor em Dólares */}
                    <div className="space-y-2">
                      <Label htmlFor="usd_amount">
                        Valor em Dólares (USD) *
                      </Label>
                      <Input
                        id="usd_amount"
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={formData.usd_amount}
                        onChange={(e) => updateField('usd_amount', e.target.value)}
                        onBlur={() => handleFieldBlur('usd_amount')}
                        placeholder="0,0000"
                        className={errors.usd_amount ? 'border-red-500' : ''}
                      />
                      {errors.usd_amount && (
                        <p className="text-sm text-red-500">{errors.usd_amount}</p>
                      )}
                      {formData.usd_amount && !errors.usd_amount && (
                        <p className="text-sm text-green-600">
                          Crédito: {formatUSD(parseFloat(formData.usd_amount || '0'))}
                        </p>
                      )}
                    </div>

                    {/* Taxa de Conversão */}
                    <div className="space-y-2">
                      <Label htmlFor="conversion_rate">
                        Taxa de Conversão (BRL/USD) *
                      </Label>
                      <Input
                        id="conversion_rate"
                        type="number"
                        step="0.0001"
                        min="0.1"
                        max="10"
                        value={formData.conversion_rate}
                        onChange={(e) => updateField('conversion_rate', e.target.value)}
                        onBlur={() => handleFieldBlur('conversion_rate')}
                        placeholder="0,0000"
                        className={errors.conversion_rate ? 'border-red-500' : ''}
                      />
                      {errors.conversion_rate && (
                        <p className="text-sm text-red-500">{errors.conversion_rate}</p>
                      )}
                      {formData.conversion_rate && !errors.conversion_rate && (
                        <p className="text-sm text-green-600">
                          ✓ Taxa: {parseFloat(formData.conversion_rate || '0').toFixed(4)} BRL/USD
                        </p>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            )}

            {/* Cliente Destino (apenas para transferência) */}
            {formData.operation_type === 'transfer' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente Destino
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Selecione o cliente que receberá o saldo *</Label>
                    <Popover open={destClientOpen} onOpenChange={setDestClientOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={destClientOpen}
                          className={`w-full justify-between ${errors.to_otc_client_id ? 'border-red-500' : ''}`}
                        >
                          {formData.to_otc_client_id
                            ? destClients.find(c => c.id === Number(formData.to_otc_client_id))?.name || 'Cliente selecionado'
                            : 'Buscar cliente...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Buscar por nome ou documento..."
                            value={destSearchQuery}
                            onValueChange={setDestSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {destClientsLoading ? 'Buscando...' : 'Nenhum cliente encontrado'}
                            </CommandEmpty>
                            <CommandGroup>
                              {destClients.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={String(c.id)}
                                  onSelect={() => {
                                    setFormData(prev => ({ ...prev, to_otc_client_id: String(c.id) }));
                                    setDestClientOpen(false);
                                    if (errors.to_otc_client_id) {
                                      setErrors(prev => ({ ...prev, to_otc_client_id: '' }));
                                    }
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${Number(formData.to_otc_client_id) === c.id ? 'opacity-100' : 'opacity-0'}`} />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{c.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {otcService.formatDocument(c.document)} | BRL: {otcService.formatCurrency(c.current_balance)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.to_otc_client_id && (
                      <p className="text-sm text-red-500">{errors.to_otc_client_id}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PIN (apenas para transferência) */}
            {formData.operation_type === 'transfer' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    PIN de Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="pin">
                      PIN de 6 dígitos do administrador *
                    </Label>
                    <Input
                      id="pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={formData.pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData(prev => ({ ...prev, pin: val }));
                        if (errors.pin) setErrors(prev => ({ ...prev, pin: '' }));
                      }}
                      placeholder="••••••"
                      className={errors.pin ? 'border-red-500' : ''}
                    />
                    {errors.pin && (
                      <p className="text-sm text-red-500">{errors.pin}</p>
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
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
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
                      {formData.operation_type === 'transfer' ? 'Origem' : 'Cliente'}
                    </Label>
                    <p className="text-sm font-medium">{client.name}</p>
                  </div>
                  {formData.operation_type === 'transfer' && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Destino
                      </Label>
                      <p className="text-sm font-medium">
                        {destClients.find(c => c.id === Number(formData.to_otc_client_id))?.name || '—'}
                      </p>
                    </div>
                  )}
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
                  {formData.operation_type === 'transfer' && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Moeda
                      </Label>
                      <p className="text-sm font-medium">{formData.currency}</p>
                    </div>
                  )}
                  {currentOperationInfo.requiresAmount && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Valor
                        </Label>
                        <p className={`text-sm font-semibold ${currentOperationInfo.color}`}>
                          {formData.currency === 'USD'
                            ? `$ ${parseFloat(formData.amount).toFixed(4)}`
                            : otcService.formatCurrency(parseFloat(formData.amount))
                          }
                        </p>
                      </div>
                      {formData.operation_type !== 'transfer' && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">
                            Novo Saldo
                          </Label>
                          <p className={`text-sm font-semibold ${
                            formData.operation_type === 'credit'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {formData.currency === 'USD'
                              ? `$ ${(
                                  (client.usd_balance || 0) +
                                  (formData.operation_type === 'credit' ? 1 : -1) *
                                  (parseFloat(formData.amount) || 0)
                                ).toFixed(4)}`
                              : otcService.formatCurrency(
                                  (client.current_balance || 0) +
                                  (formData.operation_type === 'credit' ? 1 : -1) *
                                  (parseFloat(formData.amount) || 0)
                                )
                            }
                          </p>
                        </div>
                      )}
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
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmOperation}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? (
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