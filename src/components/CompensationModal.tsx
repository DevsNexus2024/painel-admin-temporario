import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, DollarSign, User, FileText, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { MovimentoExtrato } from "@/services/extrato";
import { CompensationData, useCompensation, CompensationService } from "@/services/compensation";

interface CompensationModalProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  extractRecord: MovimentoExtrato | null;
}

export default function CompensationModal({ isOpen, onClose, extractRecord }: CompensationModalProps) {
  const [formData, setFormData] = useState<Partial<CompensationData>>({});
  const [quantiaInput, setQuantiaInput] = useState<string>(''); // Campo separado para quantia
  const [isLoading, setIsLoading] = useState(false);
  const { createCompensation } = useCompensation();

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
      
      // Inicializar campo de quantia como string
      setQuantiaInput(extractRecord.value.toString());
    }
  }, [isOpen, extractRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Converter quantia string para número
    const quantia = parseFloat(quantiaInput);
    
    if (!formData.id_usuario || !quantia || quantia <= 0) {
      toast.error('Dados incompletos', {
        description: 'Preencha todos os campos obrigatórios e verifique se a quantia é válida'
      });
      return;
    }

    setIsLoading(true);
    
    // Criar dados finais com quantia convertida
    const finalData: CompensationData = {
      ...formData as CompensationData,
      quantia: quantia
    };
    
    const success = await createCompensation(finalData);
    
    setIsLoading(false);
    
    if (success) {
      onClose(true);
    }
  };

  const handleClose = () => {
    setFormData({});
    setQuantiaInput('');
    onClose(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Compensação de Depósito - BMP-531
          </DialogTitle>
          <DialogDescription>
            Criar movimentação manual baseada no registro do extrato
          </DialogDescription>
        </DialogHeader>

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

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  // Permitir apenas números e ponto decimal
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !formData.id_usuario || !quantiaInput || parseFloat(quantiaInput) <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Processando...' : 'Compensar Depósito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}