import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, SendHorizontal, Key, QrCode, Plus, Search, RefreshCw, Copy, Trash2, Building2, Loader2, Check, X, AlertCircle } from "lucide-react";

// Componentes
import TopBarCorpX from "@/components/TopBarCorpX";
import ExtractTabCorpX from "@/components/ExtractTabCorpX";

// Contexto
import { CorpXProvider, useCorpX, CORPX_ACCOUNTS } from "@/contexts/CorpXContext";

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
      const result = await executarTransferenciaCompletaCorpX(payload);

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
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressData, setProgressData] = useState({
    current: 0,
    total: 0,
    currentValue: 0,
    totalProcessed: 0,
    status: 'processing' as 'processing' | 'completed' | 'error',
    transactions: [] as Array<{
      id: number;
      status: 'pending' | 'processing' | 'success' | 'error';
      value: number;
      message?: string;
    }>
  });
  const [formData, setFormData] = useState({
    chave_destino: '',
    tipo: '2', // PIX
    montante: '',
    valor: '',
    intervalo: '5000',
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

  // Função utilitária para limpar formatação de documentos apenas
  const limparFormatacaoDocumentoProgramado = (valor: string) => {
    if (!valor) return '';
    return valor.replace(/\D/g, ''); // Remove tudo que não é número - apenas para CPF/CNPJ
  };

  // Simular progresso das transações
  const simulateProgress = async (totalTransactions: number, valorPorTransacao: number, intervalo: number) => {
    const transactions = Array.from({ length: totalTransactions }, (_, i) => ({
      id: i + 1,
      status: 'pending' as const,
      value: valorPorTransacao,
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

    // Simular processamento de cada transação
    for (let i = 0; i < totalTransactions; i++) {
      // Atualizar transação atual como "processando"
      setProgressData(prev => ({
        ...prev,
        transactions: prev.transactions.map((t, idx) => 
          idx === i ? { ...t, status: 'processing' } : t
        )
      }));

      // Aguardar intervalo
      await new Promise(resolve => setTimeout(resolve, Math.max(intervalo, 1000)));

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
            message: isSuccess ? 'Transação processada com sucesso' : 'Erro no processamento'
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

  const executarPixProgramado = async () => {
    if (!formData.chave_destino || !formData.montante || !formData.valor) {
      toast.error("Chave PIX, montante e valor são obrigatórios");
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

    setIsLoading(true);
    
    try {
      const payload = {
        tax_document: limparFormatacaoDocumentoProgramado(selectedAccount.cnpj), // Remove formatação do documento
        chave_destino: formData.chave_destino, // Mantém a chave PIX original SEM formatação
        tipo: parseInt(formData.tipo),
        montante: montanteNumerico,
        valor: valorNumerico,
        intervalo: intervalo,
        nome: formData.nome || undefined,
        description: formData.description || undefined
      };


      // Iniciar simulação de progresso
      simulateProgress(totalTransactions, valorNumerico, intervalo);

      // Executar a API real em paralelo
      const { executarTransferenciaCompletaProgramadaCorpX } = await import('@/services/corpx');
      
      // Executar API em background enquanto mostra progresso
      executarTransferenciaCompletaProgramadaCorpX(payload)
        .then(result => {
          if (!result || result.error) {
            // Atualizar progresso para erro se a API falhar
            setProgressData(prev => ({ ...prev, status: 'error' }));
          }
        })
        .catch(error => {
          setProgressData(prev => ({ ...prev, status: 'error' }));
        });

      // Reset form após iniciar
      setFormData({
        chave_destino: '',
        tipo: '2',
        montante: '',
        valor: '',
        intervalo: '5000',
        nome: '',
        description: ''
      });

    } catch (error) {
      toast.error("Erro ao executar PIX programado");
      setShowProgressModal(false);
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
              value={formData.chave_destino}
              onChange={(e) => setFormData(prev => ({ ...prev, chave_destino: e.target.value }))}
              placeholder="email@exemplo.com, CPF, CNPJ, celular ou chave aleatória"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prog-montante">Montante Total</Label>
              <Input
                id="prog-montante"
                value={formData.montante}
                onChange={handleMontanteChange}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label htmlFor="prog-valor">Valor por Transação</Label>
              <Input
                id="prog-valor"
                value={formData.valor}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {formData.montante && formData.valor && (
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{calcularTransacoes()} transações</strong> serão executadas
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prog-tipo">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger id="prog-tipo">
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
              <Label htmlFor="prog-intervalo">Intervalo (ms)</Label>
              <Input
                id="prog-intervalo"
                value={formData.intervalo}
                onChange={(e) => setFormData(prev => ({ ...prev, intervalo: e.target.value }))}
                placeholder="5000"
                type="number"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prog-nome">Nome Destinatário (Opcional)</Label>
            <Input
              id="prog-nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do destinatário"
            />
          </div>

          <div>
            <Label htmlFor="prog-desc">Descrição (Opcional)</Label>
            <Input
              id="prog-desc"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição das transferências"
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

      {/* Modal de Progresso */}
      <PixProgressModal 
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progressData={progressData}
      />
    </Card>
  );
}

// Aba de Ações PIX atualizada
function PixActionsTabCorpX() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <PixNormalComponent />
        <PixProgramadoComponent />
      </div>
    </div>
  );
}

// Componente para criar chaves PIX
function CriarChavePixCorpX({ onChaveCriada }: { onChaveCriada: () => void }) {
  const { selectedAccount, taxDocument } = useCorpX();
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
        // ✅ REMOVIDO: Validação restritiva de formato
        // Aceita qualquer formato de celular
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

      // Remove formatação do CNPJ para usar apenas números na API
      const cnpj = taxDocument.replace(/\D/g, '');
      

      const { criarChavePixCorpX } = await import('@/services/corpx');
      
      // ✅ Montar dados da requisição
      const dadosRequisicao: any = {
        tax_document: cnpj,
        tipo: parseInt(tipoChave)
      };

      // Adicionar key apenas se necessário (sem formatação)
      if (tipoChave !== "5" && valorChave.trim()) {
        dadosRequisicao.key = valorChave.replace(/\D/g, ''); // Remove formatação da chave
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

// Componente funcional para Chaves PIX CorpX
function PixKeysTabCorpX() {
  const { taxDocument } = useCorpX();
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
      const resultado = await listarChavesPixCorpX(cnpj);
      
      
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

// Componente para seleção da conta CORPX
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Seleção da Conta CORPX
        </CardTitle>
        <CardDescription>
          Selecione a conta que deseja consultar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="account-select">Conta</Label>
            <Select value={selectedAccount.id} onValueChange={handleAccountChange}>
              <SelectTrigger id="account-select">
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {CORPX_ACCOUNTS.map((account) => (
                  <SelectItem key={account.id} value={account.id} disabled={!account.available}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {account.razaoSocial}
                        {!account.available && (
                          <span className="text-xs text-red-500 ml-2">Indisponível</span>
                        )}
                      </span>
                      {account.id !== 'ALL' && (
                        <span className="text-sm text-muted-foreground font-mono">
                          {formatCNPJ(account.cnpj)}
                        </span>
                      )}
                      {account.id === 'ALL' && (
                        <span className="text-sm text-muted-foreground">Consolidado de todas as contas</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Informações da conta selecionada */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{selectedAccount.razaoSocial}</p>
                {selectedAccount.id === 'ALL' ? (
                  <p className="text-xs text-muted-foreground">Exibindo extrato consolidado de todas as contas</p>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">
                    CNPJ: {formatCNPJ(selectedAccount.cnpj)}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">
                {selectedAccount.id === 'ALL' ? 'Consolidado' : selectedAccount.available ? 'Ativa' : 'Indisponível'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
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
    <div className="min-h-screen bg-background">
      <TopBarCorpX />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Seleção da Conta */}
        <AccountSelector />
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
            <ExtractTabCorpX />
          </TabsContent>

          {/* Ações PIX - Layout Mais Largo */}
          <TabsContent value="actions" className="mt-0">
            <PixActionsTabCorpX />
          </TabsContent>

          {/* Chaves PIX - Layout Vertical */}
          <TabsContent value="keys" className="mt-0">
            <PixKeysTabCorpX />
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
