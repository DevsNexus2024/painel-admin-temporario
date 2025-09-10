import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, User, FileText, Calendar, CheckCircle, AlertCircle, Search, Brain, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MovimentoExtrato } from "@/services/extrato";
import { CompensationData, useCompensation, CompensationService } from "@/services/compensation";
import DiagnosticoDepositoSimplificado from "./DiagnosticoDepositoSimplificado";
import DiagnosticoDeposito from "./DiagnosticoDeposito";
import DuplicataManagerModal from "./DuplicataManagerModal";

interface CompensationModalInteligenteProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  extractRecord: MovimentoExtrato | null;
}

export default function CompensationModalInteligente({ isOpen, onClose, extractRecord }: CompensationModalInteligenteProps) {
  const [formData, setFormData] = useState<Partial<CompensationData>>({});
  const [quantiaInput, setQuantiaInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("diagnostico");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDepositId, setManualDepositId] = useState<string>('');
  const [useManualId, setUseManualId] = useState(false);
  const [versaoSimplificada, setVersaoSimplificada] = useState(true); // ✨ Nova versão como padrão
  const { createCompensation } = useCompensation();
  
  // Estados para funcionalidade de duplicatas
  const [duplicataModalOpen, setDuplicataModalOpen] = useState(false);
  const [selectedDuplicataRecord, setSelectedDuplicataRecord] = useState<MovimentoExtrato | null>(null);

  // Inicializar dados do formulário quando o modal abrir
  useEffect(() => {
    if (isOpen && extractRecord) {
      const defaultValues = CompensationService.getDefaultValues();
      
      setFormData({
        ...defaultValues,
        quantia: extractRecord.value,
        documento_depositante: extractRecord.document !== '—' ? extractRecord.document : '',
        nome_depositante: extractRecord.client || '',
        data_movimentacao: new Date(extractRecord.dateTime).getTime()
      });
      
      setQuantiaInput(extractRecord.value.toString());
      
          // Resetar states
      setActiveTab("diagnostico");
      setShowManualForm(false);
      setManualDepositId('');
      setUseManualId(false);
      setVersaoSimplificada(true); // ✨ Padrão para nova versão
      setDuplicataModalOpen(false);
      setSelectedDuplicataRecord(null);
    }
  }, [isOpen, extractRecord]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantia = parseFloat(quantiaInput);
    
    if (!formData.id_usuario || !quantia || quantia <= 0) {
      toast.error('Dados incompletos', {
        description: 'Preencha todos os campos obrigatórios e verifique se a quantia é válida'
      });
      return;
    }

    setIsLoading(true);
    
    const finalData: CompensationData = {
      ...formData as CompensationData,
      quantia: quantia
    };
    
    const success = await createCompensation(finalData);
    
    setIsLoading(false);
    
    if (success) {
      toast.success("Compensação manual realizada", {
        description: `Valor: ${formatCurrency(quantia)} creditado para usuário ${formData.id_usuario}`
      });
      onClose(true);
    }
  };

  const handleClose = () => {
    setFormData({});
    setQuantiaInput('');
    setActiveTab("diagnostico");
    setShowManualForm(false);
    setManualDepositId('');
    setUseManualId(false);
    setVersaoSimplificada(true);
    setDuplicataModalOpen(false);
    setSelectedDuplicataRecord(null);
    onClose(false);
  };

  const handleDiagnosticoSuccess = () => {
    // Recarregar o extrato se necessário
    toast.success("Operação concluída", {
      description: "O extrato será atualizado automaticamente"
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  // Verificar se temos um ID de depósito válido para diagnóstico
  const getDepositId = () => {
    if (!extractRecord) return null;
    
    // 1. Tentar extrair do código do registro
    if (extractRecord.code) {
      const match = extractRecord.code.match(/\d+/);
      if (match) return parseInt(match[0]);
    }
    
    // 2. Tentar extrair da descrição da operação (padrão caas436344xU{id_usuario})
    if (extractRecord.descricaoOperacao) {
      const match = extractRecord.descricaoOperacao.match(/U(\d+)/);
      if (match) return parseInt(match[1]);
    }
    
    // 3. Tentar extrair da descrição do cliente (BMP 531)
    if (extractRecord.descCliente) {
      const match = extractRecord.descCliente.match(/U(\d+)/);
      if (match) return parseInt(match[1]);
    }
    
    // 4. Tentar extrair da descrição geral
    const allText = [
      extractRecord.client,
      extractRecord.descCliente
    ].filter(Boolean).join(' ');
    
    if (allText) {
      const match = allText.match(/(?:dep[óo]sito|deposit).*?(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    
      // Se não encontrar, retornar null (mostrar opção manual)
    return null;
  };
  
  // Função para extrair ID do usuário do campo descCliente
  const extrairIdUsuario = (descCliente: string): number => {
    // Padrão: caas436344xU1122; ou similar - extrair número após "xU"
    const match = descCliente?.match(/xU(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  };
  
  // Função para abrir modal de duplicatas
  const handleGerenciarDuplicatas = () => {
    if (!extractRecord) return;
    
    setSelectedDuplicataRecord(extractRecord);
    setDuplicataModalOpen(true);
  };
  
  // Função para fechar modal de duplicatas
  const handleDuplicataExcluida = () => {
    toast.success("Duplicata excluída com sucesso!");
    // Opcional: recarregar dados ou notificar componente pai
  };

  const automaticDepositId = getDepositId();
  const depositId = useManualId && manualDepositId ? parseInt(manualDepositId) : automaticDepositId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Sistema Inteligente de Compensação - BMP-531
            {versaoSimplificada && <Badge variant="outline" className="bg-green-50 text-green-700">✨ Nova Versão</Badge>}
          </DialogTitle>
          <DialogDescription>
            {versaoSimplificada 
              ? "Diagnóstico simplificado + Transparência total + Controle manual"
              : "Diagnóstico automático + Ações inteligentes + Compensação manual (se necessário)"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Informações do Registro */}
        {extractRecord && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor do Registro</Label>
                  <p className="font-semibold text-green-600">{formatCurrency(extractRecord.value)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data/Hora</Label>
                  <p className="font-mono text-xs">{extractRecord.dateTime}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="truncate">{extractRecord.client || 'Não informado'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Documento</Label>
                  <p className="font-mono text-xs">{extractRecord.document || 'Não informado'}</p>
                </div>
                {extractRecord.descricaoOperacao && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Descrição da Operação</Label>
                    <p className="text-xs">{extractRecord.descricaoOperacao}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-2">
              <TabsList className="grid grid-cols-2 flex-1 mr-4">
                <TabsTrigger value="diagnostico" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  1. Gerenciar Duplicatas
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  2. Compensação Manual
                </TabsTrigger>
              </TabsList>
              
              {/* ✨ Seletor de Versão */}
              <div className="flex items-center gap-2">
                <Label htmlFor="versao-select" className="text-xs text-muted-foreground whitespace-nowrap">
                  Versão:
                </Label>
                <Select value={versaoSimplificada ? "nova" : "compativel"} onValueChange={(value) => setVersaoSimplificada(value === "nova")}>
                  <SelectTrigger id="versao-select" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">✨ Nova</SelectItem>
                    <SelectItem value="compativel">🔄 Compatível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Tab Gerenciar Duplicatas */}
            <TabsContent value="diagnostico" className="space-y-4">
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>🔍 Gerenciar Duplicatas:</strong> Busque e exclua movimentações duplicadas com base no valor da transação selecionada. O sistema buscará automaticamente por duplicatas do mesmo valor para o usuário identificado.
                </AlertDescription>
              </Alert>
              
              {extractRecord ? (
                <div className="space-y-4">
                  {/* Informações para busca de duplicatas */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor para busca</Label>
                          <p className="font-semibold text-blue-600">{formatCurrency(extractRecord.value)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">ID do Usuário</Label>
                          <p className="font-mono text-xs">
                            {extractRecord.descCliente 
                              ? extrairIdUsuario(extractRecord.descCliente) || 'Não identificado' 
                              : 'Não informado'
                            }
                          </p>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">Descrição do Cliente</Label>
                          <p className="text-xs">{extractRecord.descCliente || 'Não informado'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Botão para abrir modal de duplicatas */}
                  <div className="text-center">
                    <Button 
                      onClick={handleGerenciarDuplicatas}
                      className="bg-red-500 hover:bg-red-600 text-white"
                      disabled={!extractRecord.descCliente || extrairIdUsuario(extractRecord.descCliente || '') === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Buscar e Gerenciar Duplicatas
                    </Button>
                    {(!extractRecord.descCliente || extrairIdUsuario(extractRecord.descCliente || '') === 0) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ID do usuário não identificado na descrição do cliente
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("manual")}
                      className="w-full"
                    >
                      Prosseguir para compensação manual →
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Dados do registro não disponíveis.</strong>
                    <br />
                    Não é possível gerenciar duplicatas sem os dados da transação selecionada.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            {/* Tab Compensação Manual */}
            <TabsContent value="manual" className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>⚠️ COMPENSAÇÃO MANUAL - ÚLTIMO RECURSO</strong>
                  <br />
                  Esta ação credita saldo diretamente sem rastreamento do dinheiro real. Use apenas quando:
                  <ul className="mt-2 ml-4 list-disc">
                    <li>O diagnóstico inteligente não funcionou</li>
                    <li>Todas as ações automáticas falharam</li>
                    <li>Foi confirmado que o dinheiro realmente chegou mas não foi processado</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* ID do Usuário */}
                  <div className="space-y-2">
                    <Label htmlFor="id_usuario" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      ID do Usuário *
                    </Label>
                    <Input
                      id="id_usuario"
                      type="number"
                      placeholder="Ex: 106"
                      value={formData.id_usuario || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, id_usuario: parseInt(e.target.value) || 0 }))}
                      required
                    />
                  </div>

                  {/* Quantia */}
                  <div className="space-y-2">
                    <Label htmlFor="quantia" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Quantia *
                    </Label>
                    <Input
                      id="quantia"
                      type="text"
                      placeholder="Ex: 0.02"
                      value={quantiaInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^\d*\.?\d*$/.test(value)) {
                          setQuantiaInput(value);
                        }
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Tipo de Movimentação */}
                  <div className="space-y-2">
                    <Label>Tipo Movimentação *</Label>
                    <Select 
                      value={formData.id_tipo_movimentacao?.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, id_tipo_movimentacao: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Depósito (1)</SelectItem>
                        <SelectItem value="2">Saque (2)</SelectItem>
                        <SelectItem value="3">Transferência (3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select 
                      value={formData.id_status?.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, id_status: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Processado (1)</SelectItem>
                        <SelectItem value="2">Pendente (2)</SelectItem>
                        <SelectItem value="3">Cancelado (3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Moeda */}
                  <div className="space-y-2">
                    <Label>Moeda *</Label>
                    <Select 
                      value={formData.id_moeda?.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, id_moeda: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">BRL (2)</SelectItem>
                        <SelectItem value="1">USD (1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Documento Depositante */}
                  <div className="space-y-2">
                    <Label htmlFor="documento_depositante">Documento Depositante</Label>
                    <Input
                      id="documento_depositante"
                      placeholder="CPF ou CNPJ"
                      value={formData.documento_depositante || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, documento_depositante: e.target.value }))}
                    />
                  </div>

                  {/* Nome Depositante */}
                  <div className="space-y-2">
                    <Label htmlFor="nome_depositante">Nome Depositante</Label>
                    <Input
                      id="nome_depositante"
                      placeholder="Nome completo"
                      value={formData.nome_depositante || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome_depositante: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Data da Movimentação */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data da Movimentação
                  </Label>
                  <Input
                    type="datetime-local"
                    value={formData.data_movimentacao ? 
                      new Date(formData.data_movimentacao).toISOString().slice(0, 16) : ''
                    }
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      data_movimentacao: new Date(e.target.value).getTime() 
                    }))}
                  />
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Fechar
          </Button>
          
          {activeTab === "manual" && (
            <Button 
              onClick={handleManualSubmit} 
              disabled={isLoading || !formData.id_usuario || !quantiaInput || parseFloat(quantiaInput) <= 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Processando...' : 'Executar Compensação Manual'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Modal de Duplicatas */}
      {selectedDuplicataRecord && (
        <DuplicataManagerModal
          isOpen={duplicataModalOpen}
          onClose={() => setDuplicataModalOpen(false)}
          transacao={{
            id: selectedDuplicataRecord.id,
            value: selectedDuplicataRecord.value,
            client: selectedDuplicataRecord.client,
            dateTime: selectedDuplicataRecord.dateTime,
            type: selectedDuplicataRecord.type
          }}
          idUsuario={extrairIdUsuario(selectedDuplicataRecord.descCliente || '')}
          onDuplicataExcluida={handleDuplicataExcluida}
        />
      )}
    </Dialog>
  );
}
