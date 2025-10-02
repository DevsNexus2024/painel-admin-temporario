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
import { otcService } from '@/services/otc';
import { useBankFeatures } from '@/hooks/useBankFeatures';

interface CreditExtractToOTCModalProps {
  isOpen: boolean;
  onClose: (wasSuccessful?: boolean) => void;
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
  const bankFeatures = useBankFeatures();

  // Estados do formulário
  const [selectedClient, setSelectedClient] = useState<OTCClient | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [openClientSelect, setOpenClientSelect] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Estados de validação e duplicação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'checking' | 'success' | 'error' | 'duplicate' | null;
    message: string;
  }>({ status: null, message: '' });

  // Resetar formulário e verificar duplicação quando modal abrir/fechar
  useEffect(() => {
    if (isOpen && extractRecord) {
      setSelectedClient(null);
      setCustomDescription(generateDefaultDescription(extractRecord));
      setClientSearchValue('');
      setErrors({});
      setShowConfirmation(false);
      setDuplicateInfo(null);
      setVerificationResult({ status: null, message: '' });
      
      // 🚨 VERIFICAR DUPLICAÇÃO AUTOMATICAMENTE
      checkForDuplicate();
    } else if (!isOpen) {
      setSelectedClient(null);
      setCustomDescription('');
      setClientSearchValue('');
      setErrors({});
      setShowConfirmation(false);
      setDuplicateInfo(null);
      setVerificationResult({ status: null, message: '' });
    }
  }, [isOpen, extractRecord]);

  // 🆕 FUNÇÃO PARA DETECTAR PROVIDER CORRETAMENTE
  const detectProvider = (): { provider: string; codigo: string } => {
    if (!extractRecord) return { provider: 'bmp274', codigo: '' };

    console.log('🔍 [DETECT-PROVIDER] extractRecord._original:', extractRecord._original);

    // 🔵 Detectar CorpX: tem idEndToEnd no _original
    if (extractRecord._original?.idEndToEnd) {
      console.log('✅ [DETECT-PROVIDER] CorpX detectado por idEndToEnd:', extractRecord._original.idEndToEnd);
      return {
        provider: 'corpx',
        codigo: extractRecord._original.idEndToEnd
      };
    }

    // 🔵 FALLBACK CorpX: verificar se está na rota /corpx
    if (window.location.pathname.includes('/corpx') && extractRecord._original) {
      // Se está na rota CorpX mas não tem idEndToEnd direto, procurar em originalItem
      const idEndToEnd = extractRecord._original.originalItem?.idEndToEnd || extractRecord._original.idEndToEnd;
      if (idEndToEnd) {
        console.log('✅ [DETECT-PROVIDER] CorpX detectado por rota + originalItem:', idEndToEnd);
        return {
          provider: 'corpx',
          codigo: idEndToEnd
        };
      }
    }

    // 🟪 Detectar Bitso: tem bitsoData ou endToEndId no _original
    if (extractRecord.bitsoData || extractRecord._original?.endToEndId) {
      return {
        provider: 'bitso',
        codigo: extractRecord._original?.endToEndId || 
                extractRecord.bitsoData?.metadados?.end_to_end_id || 
                extractRecord.code
      };
    }

    // 🟡 Detectar BMP: verificar qual tipo baseado no context ou estrutura
    const providerCtx = bankFeatures.provider?.toLowerCase();
    
    if (providerCtx === 'bmp-531' || extractRecord._original?.descCliente) {
      // BMP-531: tem campo descCliente normalmente
      return {
        provider: 'bmp531',
        codigo: extractRecord._original?.codigoTransacao || extractRecord.code
      };
    }

    // BMP-274: fallback padrão
    console.log('⚠️ [DETECT-PROVIDER] Usando fallback BMP274 para:', extractRecord._original);
    return {
      provider: 'bmp274',
      codigo: extractRecord._original?.codigoTransacao || extractRecord.code
    };
  };

  // 🚨 FUNÇÃO PARA VERIFICAR DUPLICAÇÃO (ATUALIZADA - V2)
  const checkForDuplicate = async () => {
    if (!extractRecord) return;
    
    setIsDuplicateChecking(true);
    setVerificationResult({ status: 'checking', message: 'Verificando se esta transação já foi processada...' });
    
    try {
      // 🔍 Detectar provider e código automaticamente
      const { provider, codigo } = detectProvider();
      
      console.log('🔍 [OTC-MODAL] Verificando duplicação:', { provider, codigo, _original: extractRecord._original });
      
      // 🆕 USAR NOVO ENDPOINT
      const result = await otcService.checkDuplicate(provider, codigo);
      
      console.log('📝 [OTC-MODAL] Resposta da API:', result);
      
      // ✅ Verificar se resposta é válida
      if (!result) {
        console.warn('⚠️ [OTC-MODAL] Resposta inválida da API');
        setVerificationResult({ 
          status: 'error', 
          message: 'Erro na verificação. Prossiga com cautela.' 
        });
        return;
      }
      
      // 🔧 BACKEND RETORNA DIRETO NA RAIZ (não usa .data para este endpoint)
      const responseData: any = result.data || result;
      
      if (responseData.is_duplicate) {
        // Adaptar resposta do novo formato para o antigo (compatibilidade)
        const detalhes = responseData.details?.detalhes;
        if (detalhes) {
          setDuplicateInfo({
            id: detalhes.transacao_id || detalhes.operacao_id,
            amount: null,
            description: responseData.message,
            created_at: detalhes.data_processamento || detalhes.data_operacao || new Date().toISOString(),
            client: {
              id: 0,
              name: detalhes.cliente_nome || 'Cliente não identificado',
              document: ''
            },
            admin: {
              id: 0,
              name: 'Sistema',
              email: ''
            }
          });
        }
        
        setVerificationResult({ 
          status: 'duplicate', 
          message: '⚠️ Esta transação já foi processada anteriormente!' 
        });
        
        console.log('🚫 [OTC-MODAL] Duplicação encontrada:', responseData.message);
      } else {
        setVerificationResult({ 
          status: 'success', 
          message: '✅ Transação verificada - pode ser creditada com segurança!' 
        });
        
        console.log('✅ [OTC-MODAL] Nenhuma duplicação encontrada');
      }
      
    } catch (error: any) {
      console.error('❌ [OTC-MODAL] Erro ao verificar duplicação:', error);
      console.error('❌ [OTC-MODAL] Detalhes do erro:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      
      setVerificationResult({ 
        status: 'error', 
        message: 'Erro na verificação. Você ainda pode prosseguir, mas verifique manualmente.' 
      });
      
    } finally {
      setIsDuplicateChecking(false);
    }
  };

  // Gerar descrição padrão baseada no registro do extrato
  const generateDefaultDescription = (record: MovimentoExtrato): string => {
    const parts = [];
    
    const providerName = bankFeatures.provider?.toUpperCase() || 'BMP';
    parts.push(`Crédito via extrato ${providerName}`);
    
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
      // 🆕 DETECTAR PROVIDER AUTOMATICAMENTE
      const { provider } = detectProvider();
      
      // 🆕 PREPARAR DADOS COMPLETOS PARA ANTI-DUPLICAÇÃO HÍBRIDA
      let dados_extrato: any;
      
      if (provider === 'corpx') {
        // Para CorpX: usar dados originais ou criar estrutura com idEndToEnd
        const idEndToEnd = extractRecord._original?.idEndToEnd || extractRecord._original?.originalItem?.idEndToEnd;
        const nrMovimento = extractRecord._original?.nrMovimento || extractRecord._original?.id;
        
        dados_extrato = extractRecord._original?.originalItem || extractRecord._original || {
          idEndToEnd: idEndToEnd || extractRecord.code,
          nrMovimento: nrMovimento || extractRecord.id,
          data: new Date(extractRecord.dateTime).toISOString().split('T')[0],
          hora: new Date(extractRecord.dateTime).toTimeString().split(' ')[0]
        };
        
        console.log('🔧 [OTC-MODAL] Dados CorpX para backend:', { provider, dados_extrato });
      } else if (provider === 'bitso') {
        dados_extrato = extractRecord._original || {
          endToEndId: extractRecord.code,
          id: extractRecord.id,
          dateTime: extractRecord.dateTime
        };
      } else if (provider === 'bmp531') {
        dados_extrato = extractRecord._original || {
          codigoTransacao: extractRecord.code,
          codigo: extractRecord.id,
          nsu: null,
          dtMovimento: extractRecord.dateTime
        };
      } else {
        // bmp274
        dados_extrato = extractRecord._original || {
          codigoTransacao: extractRecord.code,
          codigo: extractRecord.id,
          nsu: null,
          dtMovimento: extractRecord.dateTime
        };
      }

      const operationData = {
        otc_client_id: selectedClient.id,
        operation_type: 'credit' as const,
        amount: extractRecord.value,
        description: customDescription.trim(),
        // 🆕 NOVOS CAMPOS HÍBRIDOS (PRIORIDADE)
        dados_extrato,    // Objeto completo do provider
        provider,         // Provider identificado
        // 🔄 CAMPOS LEGADOS (FALLBACK)
        reference_code: extractRecord.code,
        reference_external_id: extractRecord.id,
        reference_provider: provider,
        reference_date: extractRecord.dateTime
      };

      console.log('🚀 [OTC-MODAL] Enviando operação com dados híbridos:', operationData);

      await createOperation(operationData);
      
      toast.success('Operação realizada com sucesso!', {
        description: `R$ ${extractRecord.value.toFixed(2)} creditados para ${selectedClient.name}`
      });
      
      onClose(true); // 🚨 NOTIFICAR SUCESSO
    } catch (error) {
      console.error('[OTC-MODAL] Erro ao criar operação:', error);
      
      // Mostrar erro específico de duplicação
      if (error instanceof Error && error.message.includes('já foi creditado')) {
        toast.error('Registro já creditado', {
          description: error.message
        });
      } else {
        toast.error('Erro ao criar operação', {
          description: 'Não foi possível processar a operação'
        });
      }
      
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
            Converter registro do extrato {bankFeatures.provider?.toUpperCase() || 'BMP'} em operação de crédito OTC
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          // Formulário principal
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 🆕 FEEDBACK VISUAL DA VERIFICAÇÃO */}
            {verificationResult.status === 'checking' && (
              <Alert className="border-blue-200 bg-blue-50">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                  <AlertDescription className="text-blue-800">
                    {verificationResult.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {verificationResult.status === 'success' && (
              <Alert className="border-green-200 bg-green-50">
                <div className="flex items-center">
                  <div className="h-4 w-4 bg-green-500 rounded-full mr-3 flex items-center justify-center">
                    <div className="h-2 w-2 bg-white rounded-full"></div>
                  </div>
                  <AlertDescription className="text-green-800 font-medium">
                    {verificationResult.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {verificationResult.status === 'duplicate' && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="space-y-2">
                    <p className="font-medium">{verificationResult.message}</p>
                    {duplicateInfo && (
                      <div className="text-sm space-y-1">
                        <p><strong>Cliente:</strong> {duplicateInfo.client.name}</p>
                        <p><strong>Valor:</strong> R$ {duplicateInfo.amount?.toFixed(2)}</p>
                        <p><strong>Data:</strong> {new Date(duplicateInfo.created_at).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Por:</strong> {duplicateInfo.admin.name}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-red-600">
                      Para evitar duplicação, este modal será bloqueado.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {verificationResult.status === 'error' && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">⚠️ Aviso sobre verificação</p>
                      <p className="text-sm">{verificationResult.message}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={checkForDuplicate}
                      disabled={isDuplicateChecking}
                      className="text-orange-700 border-orange-300 hover:bg-orange-100"
                    >
                      {isDuplicateChecking ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600 mr-2"></div>
                          Verificando...
                        </>
                      ) : (
                        'Tentar Novamente'
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

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
                onClick={() => onClose()}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isCreating || 
                  extractRecord.type !== 'CRÉDITO' || 
                  verificationResult.status === 'duplicate' || 
                  verificationResult.status === 'checking'
                }
                className={cn(
                  "transition-all",
                  verificationResult.status === 'duplicate' || verificationResult.status === 'checking'
                    ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                    : verificationResult.status === 'success'
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-yellow-600 hover:bg-yellow-700"
                )}
              >
                <Plus className="w-4 h-4 mr-2" />
                {verificationResult.status === 'duplicate' 
                  ? 'Já Creditado' 
                  : verificationResult.status === 'checking'
                  ? 'Verificando...'
                  : 'Continuar'}
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
                    Origem (Extrato {bankFeatures.provider?.toUpperCase() || 'BMP'})
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