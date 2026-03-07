import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, SendHorizontal, Key, QrCode, Plus, Search, RefreshCw, Copy, Trash2, Building2, Loader2, Check, X, AlertCircle } from "lucide-react";

// Componentes
import TopBarCorpX from "@/components/TopBarCorpX";
import ExtractTabCorpX from "@/components/ExtractTabCorpX";

// Contexto
import { CorpXProvider, useCorpX, CORPX_ACCOUNTS, getCorpxAliasByCnpj } from "@/contexts/CorpXContext";

// Componentes UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";


// Componente PIX Normal
function PixNormalComponent() {
  const { selectedAccount } = useCorpX();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    tipo: '2', // PIX
    valor: '',
    nome: '',
    description: ''
  });

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = formatCurrency(value);
    setFormData(prev => ({ ...prev, valor: formattedValue }));
  };

  // Função utilitária para limpar formatação de documentos apenas
  const limparFormatacaoDocumento = (valor: string) => {
    if (!valor) return '';
    return valor.replace(/\D/g, ''); // Remove tudo que não é número - apenas para CPF/CNPJ
  };

  const executarPix = async () => {
    if (!formData.key || !formData.valor) {
      toast.error("Chave PIX e valor são obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const valorNumerico = parseFloat(formData.valor.replace(/[^\d,]/g, '').replace(',', '.'));
      
      const payload = {
        tax_document: limparFormatacaoDocumento(selectedAccount.cnpj), // Remove formatação do documento
        key: formData.key, // Mantém a chave PIX original SEM formatação
        tipo: parseInt(formData.tipo),
        valor: valorNumerico,
        nome: formData.nome || undefined,
        description: formData.description || undefined
      };


      const { executarTransferenciaCompletaCorpX } = await import('@/services/corpx');
      const alias = selectedAccount.corpxAlias || getCorpxAliasByCnpj(limparFormatacaoDocumento(selectedAccount.cnpj));
      if (!alias) {
        toast.error('Selecione uma conta específica para enviar PIX');
        return;
      }
      const result = await executarTransferenciaCompletaCorpX(alias, payload);

      if (!result || result.error) {
        toast.error(result?.message || "Erro ao executar PIX");
        return;
      }

      toast.success("PIX executado com sucesso!");
      // Reset form
      setFormData({
        key: '',
        tipo: '2',
        valor: '',
        nome: '',
        description: ''
      });
    } catch (error) {
      toast.error("Erro ao executar PIX");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <SendHorizontal className="h-5 w-5 text-blue-600" />
          </div>
          Enviar PIX
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
            CORPX
          </Badge>
        </CardTitle>
        <CardDescription>
          Transferência instantânea por chave PIX
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Feedback Visual da Conta */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedAccount.razaoSocial}</p>
              <p className="text-xs text-muted-foreground font-mono">
                CNPJ: {selectedAccount.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="pix-key">Chave PIX Destinatário</Label>
            <Input
              id="pix-key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="email@exemplo.com, CPF, CNPJ, celular ou chave aleatória"
            />
          </div>

          <div>
            <Label htmlFor="pix-tipo">Tipo de Transferência</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}>
              <SelectTrigger id="pix-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Interna</SelectItem>
                <SelectItem value="2">PIX</SelectItem>
                <SelectItem value="3">Copia e Cola</SelectItem>
                <SelectItem value="5">PIX com Dados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pix-valor">Valor</Label>
            <Input
              id="pix-valor"
              value={formData.valor}
              onChange={handleValueChange}
              placeholder="R$ 0,00"
            />
          </div>

          <div>
            <Label htmlFor="pix-nome">Nome Destinatário (Opcional)</Label>
            <Input
              id="pix-nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do destinatário"
            />
          </div>

          <div>
            <Label htmlFor="pix-desc">Descrição (Opcional)</Label>
            <Input
              id="pix-desc"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição da transferência"
            />
          </div>
        </div>

        <Button 
          onClick={executarPix}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Executando PIX...
            </>
          ) : (
            'Executar PIX'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Modal de Progresso PIX Programado
function PixProgressModal({ isOpen, onClose, progressData }: {
  isOpen: boolean;
  onClose: () => void;
  progressData: {
    current: number;
    total: number;
    currentValue: number;
    totalProcessed: number;
    status: 'processing' | 'completed' | 'error';
    transactions: Array<{
      id: number;
      status: 'pending' | 'processing' | 'success' | 'error';
      value: number;
      message?: string;
    }>;
  };
}) {
  const progressPercentage = Math.round((progressData.current / progressData.total) * 100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${progressData.status === 'processing' ? 'animate-spin text-blue-500' : 'text-green-500'}`} />
            PIX Programado em Execução
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Barra de Progresso Principal */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso Geral</span>
              <span>{progressData.current} de {progressData.total} transações</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="text-center text-lg font-bold text-blue-600">
              {progressPercentage}%
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{progressData.current}</div>
              <div className="text-sm text-blue-800">Processadas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {progressData.totalProcessed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="text-sm text-green-800">Total Enviado</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{progressData.total - progressData.current}</div>
              <div className="text-sm text-orange-800">Restantes</div>
            </div>
          </div>

          {/* Lista de Transações */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Transações:</h4>
            {progressData.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    transaction.status === 'success' ? 'bg-green-500' :
                    transaction.status === 'error' ? 'bg-red-500' :
                    transaction.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-300'
                  }`} />
                  <span className="text-sm">Transação #{transaction.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {transaction.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {transaction.status === 'success' && <Check className="h-3 w-3 text-green-500" />}
                  {transaction.status === 'error' && <X className="h-3 w-3 text-red-500" />}
                </div>
              </div>
            ))}
          </div>

          {/* Status Atual */}
          {progressData.status === 'processing' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-blue-700">
                Processando transação {progressData.current + 1} de {progressData.total}...
              </span>
            </div>
          )}

          {progressData.status === 'completed' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-lg">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-700">
                Todas as transações foram processadas com sucesso!
              </span>
            </div>
          )}

          {progressData.status === 'error' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700">
                Erro durante o processamento. Verifique as transações acima.
              </span>
            </div>
          )}
        </div>

        {progressData.status !== 'processing' && (
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Componente PIX Programado
function PixProgramadoComponent() {
  const { selectedAccount } = useCorpX();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    valor: ''
  });

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = formatCurrency(value);
    setFormData(prev => ({ ...prev, valor: formattedValue }));
  };

  // Função utilitária para limpar formatação de documentos apenas
  const limparFormatacaoDocumentoProgramado = (valor: string) => {
    if (!valor) return '';
    return valor.replace(/\D/g, ''); // Remove tudo que não é número - apenas para CPF/CNPJ
  };


  const executarPixProgramado = async () => {
    if (!formData.key || !formData.valor) {
      toast.error("Chave PIX e valor são obrigatórios");
      return;
    }

    const valorNumerico = parseFloat(formData.valor.replace(/[^\d,]/g, '').replace(',', '.'));

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error("Valor deve ser um número maior que zero");
      return;
    }

    setIsLoading(true);
    
    try {
      const payload = {
        tax_document: limparFormatacaoDocumentoProgramado(selectedAccount.cnpj),
        key: formData.key,
        valor: valorNumerico
      };

      const { executarTransferenciaCompletaProgramadaCorpX } = await import('@/services/corpx');
      
      const result = await executarTransferenciaCompletaProgramadaCorpX(payload);
      
      if (result && !result.error) {
        toast.success("PIX programado executado com sucesso");
      } else {
        toast.error(result?.message || "Erro ao executar PIX programado");
      }

      // Reset form após executar
      setFormData({
        key: '',
        valor: ''
      });

    } catch (error) {
      toast.error("Erro ao executar PIX programado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <RefreshCw className="h-5 w-5 text-purple-600" />
          </div>
          PIX Programado
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
            CORPX
          </Badge>
        </CardTitle>
        <CardDescription>
          Múltiplas transferências automatizadas
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Feedback Visual da Conta */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedAccount.razaoSocial}</p>
              <p className="text-xs text-muted-foreground font-mono">
                CNPJ: {selectedAccount.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="prog-key">Chave PIX Destinatário</Label>
            <Input
              id="prog-key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="email@exemplo.com, CPF, CNPJ, celular ou chave aleatória"
            />
          </div>

          <div>
            <Label htmlFor="prog-valor">Valor</Label>
            <Input
              id="prog-valor"
              value={formData.valor}
              onChange={handleValorChange}
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        <Button 
          onClick={executarPixProgramado}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Executando PIX Programado...
            </>
          ) : (
            'Executar PIX Programado'
          )}
        </Button>
      </CardContent>

    </Card>
  );
}

// BigPIX — PIX > R$ 15k (CorpX v2)
function BigPixComponent() {
  const { selectedAccount } = useCorpX();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    valor: '',
    nome: '',
    description: ''
  });

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = formatCurrency(value);
    setFormData(prev => ({ ...prev, valor: formattedValue }));
  };

  const executarBigPix = async () => {
    if (!formData.key || !formData.valor) {
      toast.error("Chave PIX e valor são obrigatórios");
      return;
    }

    const valorNumerico = parseFloat(formData.valor.replace(/[^\d,]/g, '').replace(',', '.'));

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error("Valor deve ser um número maior que zero");
      return;
    }

    const alias = selectedAccount.corpxAlias || getCorpxAliasByCnpj(selectedAccount.cnpj.replace(/\D/g, ''));
    if (!alias) {
      toast.error('Selecione uma conta específica para enviar BigPIX');
      return;
    }

    setIsLoading(true);
    try {
      const { executarBigPixCorpX } = await import('@/services/corpx');
      const result = await executarBigPixCorpX(alias, {
        key: formData.key,
        valor: valorNumerico,
        nome: formData.nome || undefined,
        description: formData.description || undefined
      });

      if (result && !result.error) {
        toast.success("BigPIX executado com sucesso");
        setFormData({ key: '', valor: '', nome: '', description: '' });
      } else {
        toast.error(result?.message || "Erro ao executar BigPIX");
      }
    } catch (error) {
      toast.error("Erro ao executar BigPIX");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <SendHorizontal className="h-5 w-5 text-purple-600" />
          </div>
          BigPIX
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
            PIX &gt; R$ 15k
          </Badge>
        </CardTitle>
        <CardDescription>
          Transferências acima de R$ 15.000 — o backend cuida da lógica
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedAccount.razaoSocial}</p>
              <p className="text-xs text-muted-foreground font-mono">
                CNPJ: {selectedAccount.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="bigpix-key">Chave PIX Destinatário</Label>
            <Input
              id="bigpix-key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="email@exemplo.com, CPF, CNPJ, celular ou chave aleatória"
            />
          </div>

          <div>
            <Label htmlFor="bigpix-valor">Valor</Label>
            <Input
              id="bigpix-valor"
              value={formData.valor}
              onChange={handleValorChange}
              placeholder="R$ 0,00"
            />
          </div>

          <div>
            <Label htmlFor="bigpix-nome">Nome Destinatário (Opcional)</Label>
            <Input
              id="bigpix-nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do destinatário"
            />
          </div>

          <div>
            <Label htmlFor="bigpix-desc">Descrição (Opcional)</Label>
            <Input
              id="bigpix-desc"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição da transferência"
            />
          </div>
        </div>

        <Button
          onClick={executarBigPix}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Executando BigPIX...
            </>
          ) : (
            'Executar BigPIX'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Aba de Ações PIX atualizada
function PixActionsTabCorpX() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <PixNormalComponent />
        <BigPixComponent />
      </div>
    </div>
  );
}

// Componente para criar chaves PIX
function CriarChavePixCorpX({ onChaveCriada }: { onChaveCriada: () => void }) {
  const { selectedAccount, taxDocument } = useCorpX();
  const [tipoChave, setTipoChave] = React.useState<string>("");
  const [valorChave, setValorChave] = React.useState<string>("");
  const [otp, setOtp] = React.useState<string>(""); // ✅ NOVO: Campo OTP opcional
  const [isCreating, setIsCreating] = React.useState(false);
  const [isSendingOtp, setIsSendingOtp] = React.useState(false); // ✅ NOVO: Estado para envio de OTP
  const [otpSent, setOtpSent] = React.useState(false); // ✅ NOVO: Flag para indicar que OTP foi enviado

  // ✅ Resetar formulário
  const resetarFormulario = () => {
    setTipoChave("");
    setValorChave("");
    setOtp("");
    setOtpSent(false); // ✅ NOVO: Resetar flag de OTP enviado
  };

  // ✅ Validar entrada baseada no tipo (conforme nova documentação)
  const validarChave = (tipo: string, valor: string): string | null => {
    // Tipos 1 e 2 não precisam de campo key (usam tax_document)
    // Tipos 3, 4 e 5 podem ter key opcional
    if (tipo === "1" || tipo === "2") {
      return null; // CPF/CNPJ não precisa de campo key
    }

    // Se não forneceu valor, está ok (opcional para tipos 3, 4, 5)
    if (!valor.trim()) {
      return null; // Campo opcional
    }

    switch (tipo) {
      case "3": // Celular
        // Formato esperado: 55dd9xxxxxxxx (sem +)
        // Remover + se fornecido
        const celularLimpo = valor.replace(/^\+/, '').replace(/\D/g, '');
        if (celularLimpo.length < 10) {
          return "Número de celular inválido";
        }
        break;
      case "4": // Email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
          return "Email inválido";
        }
        break;
      case "5": // Aleatória
        // Pode ter valor opcional ou deixar vazio para API gerar
        break;
    }
    return null;
  };

  // ✅ NOVO: Enviar OTP para tipos 3 e 4
  const enviarOtp = async () => {
    try {
      if (!tipoChave || (tipoChave !== "3" && tipoChave !== "4")) {
        toast.error("OTP é necessário apenas para chaves do tipo Celular ou Email");
        return;
      }

      if (!valorChave.trim()) {
        toast.error("Informe o valor da chave antes de enviar OTP");
        return;
      }

      // Validar entrada
      const erroValidacao = validarChave(tipoChave, valorChave);
      if (erroValidacao) {
        toast.error(erroValidacao);
        return;
      }

      setIsSendingOtp(true);

      const cnpj = taxDocument.replace(/\D/g, '');
      let chaveFormatada = valorChave.trim();
      
      // Para celular: remover + se fornecido
      if (tipoChave === "3") {
        chaveFormatada = chaveFormatada.replace(/^\+/, '');
      }

      const { enviarOtpPixCorpX } = await import('@/services/corpx');
      
      const resultado = await enviarOtpPixCorpX({
        tax_document: cnpj,
        key: chaveFormatada
      });

      if (resultado && !resultado.erro) {
        toast.success("OTP enviado com sucesso!", {
          description: tipoChave === "3" 
            ? "Verifique o código recebido por SMS" 
            : "Verifique o código recebido por email",
          duration: 5000
        });
        setOtpSent(true);
      } else {
        const mensagemErro = resultado?.details || resultado?.message || "Erro ao enviar OTP";
        toast.error("Erro ao enviar OTP", {
          description: mensagemErro,
          duration: 5000
        });
      }

    } catch (err: any) {
      const mensagemErro = err.message || "Erro ao enviar OTP";
      toast.error("Erro ao enviar OTP", {
        description: mensagemErro,
        duration: 5000
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ✅ Criar chave PIX
  const criarChave = async () => {
    try {
      if (!tipoChave) {
        toast.error("Selecione o tipo da chave PIX");
        return;
      }

      // Validar entrada
      const erroValidacao = validarChave(tipoChave, valorChave);
      if (erroValidacao) {
        toast.error(erroValidacao);
        return;
      }

      setIsCreating(true);

      // Remove formatação do CNPJ para usar apenas números na API
      const cnpj = taxDocument.replace(/\D/g, '');
      

      const { criarChavePixCorpX } = await import('@/services/corpx');
      const alias = selectedAccount.corpxAlias || getCorpxAliasByCnpj(cnpj);
      if (!alias) {
        toast.error('Selecione uma conta específica para criar chave PIX');
        return;
      }
      
      // ✅ NOVO: Montar dados da requisição conforme nova documentação
      const dadosRequisicao: any = {
        tax_document: cnpj,
        tipo: tipoChave // ✅ String, não número ("1", "2", "3", "4", "5")
      };

      // ✅ NOVO: Adicionar key apenas para tipos 3, 4, 5 (opcional)
      // Tipos 1 e 2 não precisam de key (usam tax_document automaticamente)
      if ((tipoChave === "3" || tipoChave === "4" || tipoChave === "5") && valorChave.trim()) {
        let chaveFormatada = valorChave.trim();
        
        // Para celular (tipo 3): remover + se fornecido, formato esperado: 55dd9xxxxxxxx
        if (tipoChave === "3") {
          chaveFormatada = chaveFormatada.replace(/^\+/, '');
        }
        
        dadosRequisicao.key = chaveFormatada;
      }

      // ✅ NOVO: Adicionar OTP se fornecido (opcional para todos os tipos)
      if (otp.trim()) {
        dadosRequisicao.otp = otp.trim();
      }

      const resultado = await criarChavePixCorpX(alias, dadosRequisicao);


      // ✅ NOVO: Tratamento de resposta conforme nova documentação
      if (resultado && !resultado.erro) {
        const chaveCriada = resultado.data?.key || 'Chave criada';
        toast.success("Chave PIX criada com sucesso!", {
          description: resultado.message || `Chave: ${chaveCriada}`,
          duration: 4000
        });
        
        resetarFormulario();
        onChaveCriada(); // Recarregar lista de chaves
      } else {
        // ✅ NOVO: Tratamento de erros específicos conforme documentação
        const mensagemErro = resultado?.details || resultado?.message || "Tente novamente";
        const codigoErro = (resultado as any)?.code;
        
        // ✅ NOVO: Tratamento especial para erro starkinfra_internal_server_error
        if (mensagemErro.includes('starkinfra_internal_server_error') || codigoErro === 'SI00001') {
          if (tipoChave === "5") {
            toast.error("Erro temporário da API CorpX", {
              description: "Tente novamente após alguns segundos. Se o problema persistir, verifique se o documento está habilitado para criar chaves PIX.",
              duration: 7000
            });
          } else if (tipoChave === "3" || tipoChave === "4") {
            toast.error("OTP necessário", {
              description: "Para criar chaves do tipo Celular ou Email, é necessário enviar OTP primeiro. Clique em 'Enviar OTP' antes de criar a chave.",
              duration: 7000
            });
          } else {
            toast.error("Erro ao criar chave PIX", {
              description: mensagemErro,
              duration: 5000
            });
          }
        } else {
          toast.error("Erro ao criar chave PIX", {
            description: mensagemErro,
            duration: 5000
          });
        }
      }

    } catch (err: any) {
      // ✅ NOVO: Tratamento de erro melhorado
      const mensagemErro = err.response?.data?.details || 
                          err.response?.data?.message || 
                          err.message || 
                          "Verifique os dados e tente novamente";
      
      toast.error("Erro ao criar chave PIX", {
        description: mensagemErro,
        duration: 5000
      });
    } finally {
      setIsCreating(false);
    }
  };

  // ✅ Obter label do tipo de chave
  const getLabelTipoChave = (tipo: string) => {
    const tipos = {
      "1": "CPF",
      "2": "CNPJ", 
      "3": "Celular",
      "4": "E-mail",
      "5": "Aleatória"
    };
    return tipos[tipo as keyof typeof tipos];
  };

  // ✅ Obter placeholder baseado no tipo (atualizado conforme documentação)
  const getPlaceholder = (tipo: string) => {
    const placeholders = {
      "1": "Não necessário (usa CPF do titular)",
      "2": "Não necessário (usa CNPJ do titular)",
      "3": "5511999887766 (opcional - formato: 55dd9xxxxxxxx)",
      "4": "usuario@exemplo.com.br (opcional)",
      "5": "Opcional - deixe vazio para gerar automaticamente"
    };
    return placeholders[tipo as keyof typeof placeholders];
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Plus className="h-5 w-5 text-purple-600" />
          </div>
          Criar Chave PIX
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
            CORPX
          </Badge>
        </CardTitle>
        <CardDescription>
          Registrar nova chave PIX na conta
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Feedback Visual da Conta */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedAccount.razaoSocial}</p>
              <p className="text-xs text-muted-foreground font-mono">
                CNPJ: {selectedAccount.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de tipo */}
        <div className="space-y-2">
          <Label htmlFor="tipo-chave">Tipo da Chave PIX</Label>
          <Select value={tipoChave} onValueChange={(value) => {
            setTipoChave(value);
            setOtpSent(false); // ✅ Resetar flag quando tipo mudar
            setOtp(""); // ✅ Limpar OTP quando tipo mudar
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">
                <div className="flex items-center gap-2">
                  <span>🆔</span>
                  <span>CPF</span>
                </div>
              </SelectItem>
              <SelectItem value="2">
                <div className="flex items-center gap-2">
                  <span>🏢</span>
                  <span>CNPJ</span>
                </div>
              </SelectItem>
              <SelectItem value="3">
                <div className="flex items-center gap-2">
                  <span>📱</span>
                  <span>Celular</span>
                </div>
              </SelectItem>
              <SelectItem value="4">
                <div className="flex items-center gap-2">
                  <span>📧</span>
                  <span>E-mail</span>
                </div>
              </SelectItem>
              <SelectItem value="5">
                <div className="flex items-center gap-2">
                  <span>🎲</span>
                  <span>Aleatória</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Informação para tipos CPF/CNPJ */}
        {(tipoChave === "1" || tipoChave === "2") && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Chave {getLabelTipoChave(tipoChave)}:</span> Será usada automaticamente o {tipoChave === "1" ? "CPF" : "CNPJ"} do titular da conta ({taxDocument.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}).
            </p>
          </div>
        )}

        {/* Campo de valor (opcional para tipos 3, 4, 5) */}
        {tipoChave && tipoChave !== "1" && tipoChave !== "2" && (
          <div className="space-y-2">
            <Label htmlFor="valor-chave">
              Valor da Chave {getLabelTipoChave(tipoChave)} <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="valor-chave"
                type="text"
                value={valorChave}
                onChange={(e) => {
                  setValorChave(e.target.value);
                  setOtpSent(false); // Resetar flag quando valor mudar
                }}
                placeholder={getPlaceholder(tipoChave)}
                disabled={isCreating || isSendingOtp}
                className="flex-1"
              />
              {/* ✅ NOVO: Botão para enviar OTP (apenas para tipos 3 e 4) */}
              {(tipoChave === "3" || tipoChave === "4") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={enviarOtp}
                  disabled={!valorChave.trim() || isSendingOtp || isCreating}
                  className="whitespace-nowrap"
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : otpSent ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      OTP Enviado
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="h-4 w-4 mr-2" />
                      Enviar OTP
                    </>
                  )}
                </Button>
              )}
            </div>
            {tipoChave === "3" && (
              <p className="text-xs text-muted-foreground">
                Formato: 55dd9xxxxxxxx (sem +). Exemplo: 5511999887766
              </p>
            )}
            {tipoChave === "5" && (
              <p className="text-xs text-muted-foreground">
                Deixe vazio para gerar automaticamente uma chave aleatória (UUID)
              </p>
            )}
            {/* ✅ NOVO: Aviso sobre OTP para tipos 3 e 4 */}
            {(tipoChave === "3" || tipoChave === "4") && !otpSent && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  <strong>Importante:</strong> Para criar chaves do tipo {tipoChave === "3" ? "Celular" : "Email"}, é recomendado enviar OTP primeiro. Clique em "Enviar OTP" após informar o valor da chave.
                </p>
              </div>
            )}
            {otpSent && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700">
                  <Check className="h-3 w-3 inline mr-1" />
                  OTP enviado! Verifique o código recebido por {tipoChave === "3" ? "SMS" : "email"} e informe abaixo antes de criar a chave.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ✅ NOVO: Campo OTP opcional */}
        {(tipoChave === "3" || tipoChave === "4" || tipoChave === "5" || otp.trim()) && (
          <div className="space-y-2">
            <Label htmlFor="otp">
              Código OTP 
              {(tipoChave === "3" || tipoChave === "4") && otpSent && (
                <span className="text-green-600 text-xs ml-1">(obrigatório)</span>
              )}
              {(!otpSent || tipoChave === "5") && (
                <span className="text-muted-foreground text-xs">(opcional)</span>
              )}
            </Label>
            <Input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // ✅ Apenas números
              placeholder={otpSent ? "Digite o código OTP recebido" : "Digite o código OTP se necessário"}
              disabled={isCreating || isSendingOtp}
              maxLength={6}
              className={otpSent && !otp.trim() ? "border-yellow-300 focus:border-yellow-500" : ""}
            />
            <p className="text-xs text-muted-foreground">
              {otpSent 
                ? `Código de validação enviado por ${tipoChave === "3" ? "SMS" : "email"}. Verifique sua ${tipoChave === "3" ? "mensagem" : "caixa de entrada"}.`
                : "Código de validação enviado por SMS ou email (se aplicável)"
              }
            </p>
          </div>
        )}

        {/* Informações */}
        {tipoChave === "5" && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Chave Aleatória:</span> Será gerada automaticamente uma chave única (UUID) para sua conta.
            </p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={criarChave}
            disabled={!tipoChave || isCreating}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Chave
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={resetarFormulario}
            disabled={isCreating}
          >
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente funcional para Chaves PIX CorpX
function PixKeysTabCorpX() {
  const { selectedAccount, taxDocument } = useCorpX();
  const [chaves, setChaves] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  // ✅ Mapear tipo numérico da API para tipo string da interface
  const mapearTipoChave = (tipoNumerico: string | number) => {
    const tipoStr = String(tipoNumerico);
    const tipos: { [key: string]: string } = {
      '1': 'CNPJ',
      '2': 'PHONE', 
      '3': 'EMAIL',
      '4': 'RANDOM',
      '5': 'RANDOM' // Tipo 5 também parece ser aleatória
    };
    return tipos[tipoStr] || 'RANDOM';
  };

  // ✅ Carregar chaves PIX ao montar o componente
  const carregarChaves = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Remove formatação do CNPJ para usar apenas números na API
      const cnpj = taxDocument.replace(/\D/g, '');
      
      
      const { listarChavesPixCorpX } = await import('@/services/corpx');
      const alias = selectedAccount.corpxAlias || getCorpxAliasByCnpj(cnpj);
      if (!alias) {
        setError('Selecione uma conta específica para listar chaves PIX');
        setChaves([]);
        return;
      }
      const resultado = await listarChavesPixCorpX(alias);
      
      
      // ✅ CORREÇÃO: Agora o serviço retorna dados processados corretamente
      if (resultado && !resultado.erro && resultado.chaves) {
        
        // ✅ Aplicar mapeamento final para a interface (tipo string)
        const chavesMapeadas = resultado.chaves.map((chave: any, index: number) => {
          
          return {
            ...chave,
            type: mapearTipoChave(chave.type), // Converter número para string
            _original: chave
          };
        });
        
        setChaves(chavesMapeadas);
      } else {
        setChaves([]);
      }
      
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar chaves PIX');
      setChaves([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Carregar ao montar o componente
  React.useEffect(() => {
    carregarChaves();
  }, []);

  // 🔄 Recarregar chaves PIX automaticamente quando tax_document mudar
  React.useEffect(() => {
    const cnpjNumerico = taxDocument.replace(/\D/g, '');
    if (cnpjNumerico && cnpjNumerico.length === 14) {
      carregarChaves();
      toast.info("Atualizando chaves PIX para nova conta...");
    }
  }, [taxDocument]); // Recarrega quando taxDocument mudar

  // ✅ Formatar tipo de chave para exibição
  const formatarTipoChave = (type: string) => {
    const tipos = {
      'CNPJ': 'CNPJ',
      'PHONE': 'Celular',
      'EMAIL': 'E-mail',
      'RANDOM': 'Aleatória'
    };
    return tipos[type as keyof typeof tipos] || type;
  };

  // ✅ Formatar chave para exibição (mascarar dados sensíveis)
  const formatarChave = (key: string, type: string) => {
    
    if (!key || key === undefined || key === null || key === '') {
      return "Chave inválida";
    }
    
    const keyStr = String(key); // Garantir que é string
    
    if (type === 'PHONE') {
      // Exemplo: +5511999999999 -> +55 (11) 99999-****
      return keyStr.replace(/(\+55)(\d{2})(\d{4,5})(\d{4})/, '$1 ($2) $3-****');
    } else if (type === 'EMAIL') {
      // Exemplo: user@domain.com -> u***@domain.com
      const [local, domain] = keyStr.split('@');
      return `${local[0]}***@${domain}`;
    } else if (type === 'CNPJ') {
      // Exemplo: 12345678000195 -> 12.345.678/0001-**
      return keyStr.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-**');
    } else if (type === 'RANDOM') {
      // Chave aleatória (UUID): mostrar formatada
      if (keyStr.length === 36 && keyStr.includes('-')) {
        // UUID format: 36df47d2-cbbf-42cd-a6ef-a2c09eb0cea4
        return keyStr;
      }
      return keyStr;
    }
    return keyStr; // Fallback: mostrar completa
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Criar Chave */}
        <CriarChavePixCorpX onChaveCriada={carregarChaves} />

        {/* Listar Chaves */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Key className="h-5 w-5 text-amber-600" />
              </div>
              Minhas Chaves PIX
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-medium">
                CORPX
              </Badge>
            </CardTitle>
            <CardDescription>
              Chaves registradas na conta
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-3 text-sm text-muted-foreground">Carregando chaves...</span>
              </div>
            ) : error ? (
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-center">
                <p className="text-sm text-red-600">❌ {error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={carregarChaves}
                  className="mt-3"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : chaves.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg text-center">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma chave PIX registrada
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Crie sua primeira chave PIX usando o painel ao lado
                  </p>
                </div>
                <Badge variant="secondary" className="w-full justify-center">
                  0 chaves registradas
                </Badge>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {chaves.length} chave{chaves.length !== 1 ? 's' : ''} registrada{chaves.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={carregarChaves}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Atualizar
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {chaves.map((chave) => (
                    <div 
                      key={chave.id} 
                      className="p-4 border rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant="outline"
                              className="text-xs"
                            >
                              {formatarTipoChave(chave.type)}
                            </Badge>
                            <Badge 
                              variant={chave.status === 'ACTIVE' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {chave.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <p className="font-mono text-sm font-medium">
                            {formatarChave(chave.key, chave.type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criada em: {new Date(chave.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const chaveParaCopiar = chave.key || chave.keypix || '';
                              
                              if (chaveParaCopiar) {
                                navigator.clipboard.writeText(chaveParaCopiar);
                                toast.success("Chave PIX copiada!", {
                                  description: `Chave: ${chaveParaCopiar.substring(0, 20)}...`,
                                  duration: 3000
                                });
                              } else {
                                toast.error("Erro ao copiar chave!", {
                                  description: "Chave não encontrada ou inválida",
                                  duration: 3000
                                });
                              }
                            }}
                            className="h-8 w-8 p-0"
                            title="Copiar chave PIX"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            disabled
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Componente para seleção da conta CORPX - Layout moderno
function AccountSelector() {
  const { selectedAccount, setSelectedAccount } = useCorpX();

  const handleAccountChange = (accountId: string) => {
    const account = CORPX_ACCOUNTS.find(acc => acc.id === accountId);
    if (!account) {
      return;
    }

    if (!account.available) {
      toast.error('Conta indisponível no momento.', {
        description: 'Selecione outra conta para continuar',
      });
      return;
    }

    setSelectedAccount(account);
    toast.success(account.id === 'ALL' ? 'Exibindo todas as contas' : `Conta alterada para: ${account.razaoSocial}`);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!/\d/.test(cnpj)) {
      return cnpj === 'ALL' ? '—' : cnpj;
    }

    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <Card className="p-4 lg:p-6 bg-background border border-[rgba(255,255,255,0.1)] shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Conta CORPX</h3>
            <p className="text-sm text-muted-foreground">Selecione a conta para consultar</p>
          </div>
        </div>
        
        <div className="w-full lg:w-auto lg:min-w-[400px]">
          <Select value={selectedAccount.id} onValueChange={handleAccountChange}>
            <SelectTrigger className="h-12 bg-background border-2 focus:border-purple-500">
              <div className="flex items-center gap-2 w-full">
                <Building2 className="h-4 w-4 text-purple-600" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{selectedAccount.razaoSocial}</div>
                  {selectedAccount.id !== 'ALL' && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatCNPJ(selectedAccount.cnpj)}
                    </div>
                  )}
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              {CORPX_ACCOUNTS.map((account) => (
                <SelectItem key={account.id} value={account.id} disabled={!account.available}>
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-1.5 rounded-lg ${
                      account.id === 'ALL' 
                        ? 'bg-purple-500/10' 
                        : account.available 
                        ? 'bg-green-500/10' 
                        : 'bg-red-500/10'
                    }`}>
                      <Building2 className={`h-4 w-4 ${
                        account.id === 'ALL' 
                          ? 'text-purple-600' 
                          : account.available 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.razaoSocial}</span>
                        {!account.available && (
                          <Badge variant="destructive" className="text-xs">Indisponível</Badge>
                        )}
                        {account.id === 'ALL' && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">Consolidado</Badge>
                        )}
                      </div>
                      {account.id !== 'ALL' && (
                        <div className="text-sm text-muted-foreground font-mono mt-0.5">
                          {formatCNPJ(account.cnpj)}
                        </div>
                      )}
                      {account.id === 'ALL' && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          Todas as contas CORPX
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

// Componente interno que usa o contexto
function CorpXContent() {
  // CORPX sempre tem suporte completo a PIX
  const bankFeatures = {
    provider: 'corpx',
    displayName: 'CORPX',
    hasPixKeys: true,
    hasQrCodePayment: true,
    hasExtract: true
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Top Bar com Saldos */}
      <TopBarCorpX />
      
      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Seleção da Conta */}
        <AccountSelector />
        
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <SendHorizontal className="h-4 w-4" />
              Ações PIX
            </TabsTrigger>
          </TabsList>

          {/* ABA: Extrato */}
          <TabsContent value="extract">
            <ExtractTabCorpX />
          </TabsContent>

          {/* ABA: Ações PIX */}
          <TabsContent value="pix">
            <div className="space-y-6">
              {/* Ações PIX */}
              <PixActionsTabCorpX />
              
              {/* Chaves PIX */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Chaves PIX
                </h3>
                <PixKeysTabCorpX />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Export default que envolve tudo no CorpXProvider
export default function CorpXPage() {
  return (
    <CorpXProvider>
      <CorpXContent />
    </CorpXProvider>
  );
}
