import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, SendHorizontal, Key, QrCode, Plus, Search, RefreshCw, Copy, Trash2, Building2, Loader2, Check, X, AlertCircle } from "lucide-react";

// Componentes
import TopBarTTF from "@/components/TopBarTTF";
import ExtractTabTTF from "@/components/ExtractTabTTF";

// Componentes UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ✅ CNPJ FIXO: TTF SERVICOS DIGITAIS LTDA
const TTF_CNPJ = "14283885000198";

// Modal de Progresso PIX Programado com QR
function PixQRProgressModal({ isOpen, onClose, progressData }: {
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
      status: 'pending' | 'qr_generating' | 'qr_generated' | 'paying' | 'success' | 'error';
      value: number;
      custom_id?: string;
      message?: string;
    }>;
  };
}) {
  const progressPercentage = Math.round((progressData.current / progressData.total) * 100);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-3 h-3 rounded-full bg-gray-300" />;
      case 'qr_generating':
        return <QrCode className="w-3 h-3 text-blue-500 animate-pulse" />;
      case 'qr_generated':
        return <QrCode className="w-3 h-3 text-green-500" />;
      case 'paying':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'success':
        return <Check className="w-3 h-3 text-green-500" />;
      case 'error':
        return <X className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-300" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'qr_generating':
        return 'Gerando QR...';
      case 'qr_generated':
        return 'QR Gerado';
      case 'paying':
        return 'Pagando...';
      case 'success':
        return 'Pago';
      case 'error':
        return 'Erro';
      default:
        return 'Pendente';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className={`h-5 w-5 ${progressData.status === 'processing' ? 'animate-pulse text-blue-500' : 'text-green-500'}`} />
            PIX Programado com QR Codes
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
              <div className="text-sm text-green-800">Total Pago</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{progressData.total - progressData.current}</div>
              <div className="text-sm text-orange-800">Restantes</div>
            </div>
          </div>

          {/* Lista de Transações */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Transações QR:</h4>
            {progressData.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(transaction.status)}
                  <div className="flex flex-col">
                    <span className="text-sm">QR #{transaction.id}</span>
                    {transaction.custom_id && (
                      <span className="text-xs text-muted-foreground">ID: {transaction.custom_id}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-sm font-mono">
                      {transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {getStatusText(transaction.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Atual */}
          {progressData.status === 'processing' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-blue-700">
                Processando QR {progressData.current + 1} de {progressData.total}...
              </span>
            </div>
          )}

          {progressData.status === 'completed' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-lg">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-700">
                Todos os QR codes foram processados e pagos!
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

// Componente PIX Programado com QR Codes para TTF
function PixProgramadoQRComponent() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showProgressModal, setShowProgressModal] = React.useState(false);
  const [progressData, setProgressData] = React.useState({
    current: 0,
    total: 0,
    currentValue: 0,
    totalProcessed: 0,
    status: 'processing' as 'processing' | 'completed' | 'error',
    transactions: [] as Array<{
      id: number;
      status: 'pending' | 'qr_generating' | 'qr_generated' | 'paying' | 'success' | 'error';
      value: number;
      custom_id?: string;
      message?: string;
    }>
  });
  const [formData, setFormData] = React.useState({
    custom_id: '',
    montante: '',
    valor: '',
    intervalo: '5000'
  });

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleMontanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = formatCurrency(value);
    setFormData(prev => ({ ...prev, montante: formattedValue }));
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formattedValue = formatCurrency(value);
    setFormData(prev => ({ ...prev, valor: formattedValue }));
  };

  const calcularTransacoes = () => {
    const montanteNum = parseFloat(formData.montante.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const valorNum = parseFloat(formData.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    if (valorNum === 0) return 0;
    return Math.ceil(montanteNum / valorNum);
  };

  // Simular progresso das transações QR
  const simulateQRProgress = async (totalTransactions: number, valorPorTransacao: number, intervalo: number, customId: string) => {
    const transactions = Array.from({ length: totalTransactions }, (_, i) => ({
      id: i + 1,
      status: 'pending' as const,
      value: valorPorTransacao,
      custom_id: customId ? `${customId}-${i + 1}` : `QR-${i + 1}`,
      message: ''
    }));

    setProgressData({
      current: 0,
      total: totalTransactions,
      currentValue: valorPorTransacao,
      totalProcessed: 0,
      status: 'processing',
      transactions
    });

    setShowProgressModal(true);

    // Simular processamento de cada QR
    for (let i = 0; i < totalTransactions; i++) {
      // Fase 1: Gerar QR Code
      setProgressData(prev => ({
        ...prev,
        transactions: prev.transactions.map((t, idx) => 
          idx === i ? { ...t, status: 'qr_generating' } : t
        )
      }));

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fase 2: QR Code gerado
      setProgressData(prev => ({
        ...prev,
        transactions: prev.transactions.map((t, idx) => 
          idx === i ? { ...t, status: 'qr_generated' } : t
        )
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Fase 3: Pagar QR Code
      setProgressData(prev => ({
        ...prev,
        transactions: prev.transactions.map((t, idx) => 
          idx === i ? { ...t, status: 'paying' } : t
        )
      }));

      await new Promise(resolve => setTimeout(resolve, Math.max(intervalo - 1500, 1000)));

      // Simular sucesso (95% de chance) ou erro (5% de chance)
      const isSuccess = Math.random() > 0.05;
      
      setProgressData(prev => ({
        ...prev,
        current: i + 1,
        totalProcessed: prev.totalProcessed + (isSuccess ? valorPorTransacao : 0),
        transactions: prev.transactions.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: isSuccess ? 'success' : 'error',
            message: isSuccess ? 'QR pago com sucesso' : 'Erro no pagamento do QR'
          } : t
        )
      }));
    }

    // Finalizar
    setProgressData(prev => ({
      ...prev,
      status: 'completed'
    }));
  };

  const executarPixQR = async () => {
    if (!formData.montante || !formData.valor) {
      toast.error("Montante e valor são obrigatórios");
      return;
    }

    const montanteNumerico = parseFloat(formData.montante.replace(/[^\d,]/g, '').replace(',', '.'));
    const valorNumerico = parseFloat(formData.valor.replace(/[^\d,]/g, '').replace(',', '.'));

    if (valorNumerico > montanteNumerico) {
      toast.error("Valor por transação não pode ser maior que o montante total");
      return;
    }

    const totalTransactions = Math.ceil(montanteNumerico / valorNumerico);
    const intervalo = parseInt(formData.intervalo);
    const customId = formData.custom_id.trim();

    setIsLoading(true);
    
    try {
      const payload = {
        tax_document: TTF_CNPJ, // ✅ CNPJ fixo da TTF
        custom_id: customId || undefined,
        montante: montanteNumerico,
        valor: valorNumerico,
        intervalo: intervalo
      };

      // Iniciar simulação de progresso
      simulateQRProgress(totalTransactions, valorNumerico, intervalo, customId);

      // TODO: Executar a API real em paralelo (aguardando implementação CorpX)
      // const { executarPixProgramadoComQRCorpX } = await import('@/services/corpx');
      // executarPixProgramadoComQRCorpX(payload).then(...).catch(...);

      // Reset form após iniciar
      setFormData({
        custom_id: '',
        montante: '',
        valor: '',
        intervalo: '5000'
      });

    } catch (error) {
      toast.error("Erro ao executar PIX programado com QR");
      setShowProgressModal(false);
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
            <QrCode className="h-5 w-5 text-blue-600" />
          </div>
          PIX Programado com QR
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
            TTF
          </Badge>
        </CardTitle>
        <CardDescription>
          Gera QR codes automaticamente e os paga em sequência
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Feedback Visual da Conta */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">TTF SERVICOS DIGITAIS LTDA</p>
              <p className="text-xs text-muted-foreground font-mono">
                CNPJ: 14.283.885/0001-98
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="qr-custom-id">ID Personalizado (Opcional)</Label>
            <Input
              id="qr-custom-id"
              value={formData.custom_id}
              onChange={(e) => setFormData(prev => ({ ...prev, custom_id: e.target.value }))}
              placeholder="ID personalizado para os QR codes"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Será usado como prefixo: {formData.custom_id || 'QR'}-1, {formData.custom_id || 'QR'}-2, etc.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qr-montante">Montante Total</Label>
              <Input
                id="qr-montante"
                value={formData.montante}
                onChange={handleMontanteChange}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label htmlFor="qr-valor">Valor por QR</Label>
              <Input
                id="qr-valor"
                value={formData.valor}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {formData.montante && formData.valor && (
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{calcularTransacoes()} QR codes</strong> serão gerados e pagos automaticamente
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="qr-intervalo">Intervalo entre QRs (ms)</Label>
            <Input
              id="qr-intervalo"
              value={formData.intervalo}
              onChange={(e) => setFormData(prev => ({ ...prev, intervalo: e.target.value }))}
              placeholder="5000"
              type="number"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tempo entre gerar e pagar cada QR code
            </p>
          </div>
        </div>

        <Button 
          onClick={executarPixQR}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Iniciando PIX com QR...
            </>
          ) : (
            'Executar PIX Programado com QR'
          )}
        </Button>
      </CardContent>

      {/* Modal de Progresso */}
      <PixQRProgressModal 
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progressData={progressData}
      />
    </Card>
  );
}

// Componente temporário para Ações PIX (replicando layout TCR)
function PixActionsTabTTF() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {/* Enviar por Chave */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <SendHorizontal className="h-5 w-5 text-blue-600" />
              </div>
              Enviar PIX
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                TTF
              </Badge>
            </CardTitle>
            <CardDescription>
              Transferência por chave PIX
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aguardando integração completa
                </p>
              </div>
              <Button className="w-full" disabled>
                Configurar PIX
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pagar QR Code */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <QrCode className="h-5 w-5 text-blue-600" />
              </div>
              Pagar QR Code
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                TTF
              </Badge>
            </CardTitle>
            <CardDescription>
              Pagamento via código QR
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aguardando integração completa
                </p>
              </div>
              <Button className="w-full" disabled>
                Escanear QR Code
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PIX Programado com QR Codes */}
        <PixProgramadoQRComponent />
      </div>
    </div>
  );
}

// Componente para criar chaves PIX
function CriarChavePixTTF({ onChaveCriada }: { onChaveCriada: () => void }) {
  const [tipoChave, setTipoChave] = React.useState<string>("");
  const [valorChave, setValorChave] = React.useState<string>("");
  const [isCreating, setIsCreating] = React.useState(false);

  // ✅ Resetar formulário
  const resetarFormulario = () => {
    setTipoChave("");
    setValorChave("");
  };

  // ✅ Validar entrada baseada no tipo
  const validarChave = (tipo: string, valor: string): string | null => {
    if (tipo === "5") return null; // Chave aleatória não precisa validação

    if (!valor.trim()) {
      return "Valor da chave é obrigatório";
    }

    switch (tipo) {
      case "1": // CPF
        if (!/^\d{11}$/.test(valor.replace(/\D/g, ''))) {
          return "CPF deve ter 11 dígitos";
        }
        break;
      case "2": // CNPJ
        if (!/^\d{14}$/.test(valor.replace(/\D/g, ''))) {
          return "CNPJ deve ter 14 dígitos";
        }
        break;
      case "3": // Celular
        break;
      case "4": // Email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
          return "Email inválido";
        }
        break;
    }
    return null;
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

      const { criarChavePixCorpX } = await import('@/services/corpx');
      
      // ✅ Montar dados da requisição
      const dadosRequisicao: any = {
        tax_document: TTF_CNPJ,
        tipo: parseInt(tipoChave)
      };

      // Adicionar key apenas se necessário
      if (tipoChave !== "5" && valorChave.trim()) {
        dadosRequisicao.key = valorChave.trim();
      }

      const resultado = await criarChavePixCorpX(dadosRequisicao);

      if (resultado && !resultado.erro) {
        toast.success("Chave PIX criada com sucesso!", {
          description: resultado.message || "Nova chave registrada na conta",
          duration: 3000
        });
        
        resetarFormulario();
        onChaveCriada(); // Recarregar lista de chaves
      } else {
        toast.error("Erro ao criar chave PIX", {
          description: resultado?.message || "Tente novamente",
          duration: 4000
        });
      }

    } catch (err: any) {
      toast.error("Erro ao criar chave PIX", {
        description: err.message || "Verifique os dados e tente novamente",
        duration: 4000
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

  // ✅ Obter placeholder baseado no tipo
  const getPlaceholder = (tipo: string) => {
    const placeholders = {
      "1": "000.000.000-00",
      "2": "00.000.000/0000-00",
      "3": "+554399991234",
      "4": "seuemail@exemplo.com",
      "5": "Será gerada automaticamente"
    };
    return placeholders[tipo as keyof typeof placeholders];
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
      <CardHeader className="relative pb-4">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Plus className="h-5 w-5 text-blue-600" />
          </div>
          Criar Chave PIX
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
            TTF
          </Badge>
        </CardTitle>
        <CardDescription>
          Registrar nova chave PIX na conta
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {/* Seletor de tipo */}
        <div className="space-y-2">
          <Label htmlFor="tipo-chave">Tipo da Chave PIX</Label>
          <Select value={tipoChave} onValueChange={setTipoChave}>
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

        {/* Campo de valor (se necessário) */}
        {tipoChave && tipoChave !== "5" && (
          <div className="space-y-2">
            <Label htmlFor="valor-chave">
              Valor da Chave {getLabelTipoChave(tipoChave)}
            </Label>
            <Input
              id="valor-chave"
              type="text"
              value={valorChave}
              onChange={(e) => setValorChave(e.target.value)}
              placeholder={getPlaceholder(tipoChave)}
              disabled={isCreating}
            />
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

// Componente funcional para Chaves PIX TTF
function PixKeysTabTTF() {
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
      '5': 'RANDOM'
    };
    return tipos[tipoStr] || 'RANDOM';
  };

  // ✅ Carregar chaves PIX ao montar o componente
  const carregarChaves = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const { listarChavesPixCorpX } = await import('@/services/corpx');
      const resultado = await listarChavesPixCorpX(TTF_CNPJ);
      
      if (resultado && !resultado.erro && resultado.chaves) {
        const chavesMapeadas = resultado.chaves.map((chave: any, index: number) => {
          return {
            ...chave,
            type: mapearTipoChave(chave.type),
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
    
    const keyStr = String(key);
    
    if (type === 'PHONE') {
      return keyStr.replace(/(\+55)(\d{2})(\d{4,5})(\d{4})/, '$1 ($2) $3-****');
    } else if (type === 'EMAIL') {
      const [local, domain] = keyStr.split('@');
      return `${local[0]}***@${domain}`;
    } else if (type === 'CNPJ') {
      return keyStr.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-**');
    } else if (type === 'RANDOM') {
      if (keyStr.length === 36 && keyStr.includes('-')) {
        return keyStr;
      }
      return keyStr;
    }
    return keyStr;
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Criar Chave */}
        <CriarChavePixTTF onChaveCriada={carregarChaves} />

        {/* Listar Chaves */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5"></div>
          <CardHeader className="relative pb-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Key className="h-5 w-5 text-blue-600" />
              </div>
              Minhas Chaves PIX
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                TTF
              </Badge>
            </CardTitle>
            <CardDescription>
              Chaves registradas na conta
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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

export default function CorpXTTFPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBarTTF />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Layout Principal - Tabs no Topo */}
        <Tabs defaultValue="extract" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid grid-cols-3 w-fit bg-muted/30 p-1 h-auto">
              <TabsTrigger 
                value="extract" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm">Extrato</span>
              </TabsTrigger>
              <TabsTrigger 
                value="actions" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="text-sm">Ações PIX</span>
              </TabsTrigger>
              <TabsTrigger 
                value="keys" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-3 px-6 font-medium transition-all duration-200 flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                <span className="text-sm">Chaves PIX</span>
                <Badge variant="secondary" className="ml-2 text-xs px-2 py-0">0</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Extrato - Largura Total */}
          <TabsContent value="extract" className="mt-0">
            <ExtractTabTTF />
          </TabsContent>

          {/* Ações PIX - Layout Mais Largo */}
          <TabsContent value="actions" className="mt-0">
            <PixActionsTabTTF />
          </TabsContent>

          {/* Chaves PIX - Layout Vertical */}
          <TabsContent value="keys" className="mt-0">
            <PixKeysTabTTF />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
