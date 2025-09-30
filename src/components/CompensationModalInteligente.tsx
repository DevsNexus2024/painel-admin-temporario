import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, User, FileText, Calendar, CheckCircle, AlertCircle, Search, Brain, Trash2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { MovimentoExtrato } from "@/services/extrato";
import { CompensationData, useCompensation, CompensationService } from "@/services/compensation";
import { useCompensacaoBRBTC, validarElegibilidadeBRBTC } from "@/services/compensacao-brbtc";
import { TcrSaldosService, compararSaldos, type SaldosComparacao, type UsuarioSaldo, type SaldoBrbtc } from "@/services/tcrSaldos";
import { TOKEN_STORAGE } from "@/config/api";
import DiagnosticoDepositoSimplificado from "./DiagnosticoDepositoSimplificado";
import DiagnosticoDeposito from "./DiagnosticoDeposito";
import DuplicataManagerModal from "./DuplicataManagerModal";

interface CompensationModalInteligenteProps {
  isOpen: boolean;
  onClose: (success?: boolean) => void;
  extractRecord: MovimentoExtrato | null;
}

export default function CompensationModalInteligente({ isOpen, onClose, extractRecord }: CompensationModalInteligenteProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<CompensationData>>({});
  const [quantiaInput, setQuantiaInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("diagnostico");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDepositId, setManualDepositId] = useState<string>('');
  const [useManualId, setUseManualId] = useState(false);
  const [versaoSimplificada, setVersaoSimplificada] = useState(true); // ✨ Nova versão como padrão
  const { createCompensation } = useCompensation();
  const { executarCompensacao: executarCompensacaoBRBTC, isLoading: isLoadingBRBTC } = useCompensacaoBRBTC();
  
  // Estados para funcionalidade de duplicatas
  const [duplicataModalOpen, setDuplicataModalOpen] = useState(false);
  const [selectedDuplicataRecord, setSelectedDuplicataRecord] = useState<MovimentoExtrato | null>(null);
  
  // Estados para modal de confirmação personalizado
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  
  // Estados para conferência de saldo individual
  const [isCheckingSaldo, setIsCheckingSaldo] = useState(false);
  const [saldoComparacao, setSaldoComparacao] = useState<SaldosComparacao | null>(null);
  
  // Estados para depósitos internos BRBTC
  const [isLoadingDepositos, setIsLoadingDepositos] = useState(false);
  const [depositosInternos, setDepositosInternos] = useState<any[] | null>(null);
  
  // ✅ Estados para entrada manual de ID
  const [idUsuarioManual, setIdUsuarioManual] = useState<string>('');
  const [usarIdManual, setUsarIdManual] = useState(false);
  

  // Inicializar dados do formulário quando o modal abrir
  useEffect(() => {
    if (isOpen && extractRecord) {
      const defaultValues = CompensationService.getDefaultValues();
      
      const idUsuarioExtraido = extractRecord.descCliente 
        ? extrairIdUsuario(extractRecord.descCliente) 
        : 0;
      
      setFormData({
        ...defaultValues,
        quantia: extractRecord.value,
        documento_depositante: extractRecord.document !== '—' ? extractRecord.document : '',
        nome_depositante: extractRecord.client || '',
        data_movimentacao: new Date(extractRecord.dateTime).getTime(),
        id_usuario: idUsuarioExtraido || undefined
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
      setShowConfirmModal(false);
      setConfirmAction(null);
      setSaldoComparacao(null);
      setIsCheckingSaldo(false);
      setDepositosInternos(null);
      setIsLoadingDepositos(false);
      setIdUsuarioManual('');
      setUsarIdManual(false);
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
      toast.success("Compensação Saldo Visual realizada com sucesso!", {
        description: `Valor: ${formatCurrency(quantia)} creditado para usuário ${formData.id_usuario}. Modal permanece aberto para outras ações.`
      });
      // Não fechar o modal automaticamente, deixar o usuário decidir
    }
  };

  // ✨ NOVA FUNÇÃO: Conferência de Saldo Individual
  const handleConferirSaldo = async () => {
    if (!extractRecord) {
      toast.error('Nenhum registro selecionado');
      return;
    }

    // ✅ Obter ID do usuário (automático ou manual)
    const idUsuarioExtraido = obterIdUsuario();
    if (!idUsuarioExtraido) {
      toast.error('ID do usuário necessário', {
        description: 'Informe o ID do usuário manualmente para usar esta funcionalidade'
      });
      return;
    }

    setIsCheckingSaldo(true);
    setSaldoComparacao(null);

    try {

      // 1. Buscar saldo visual do TCR
      const saldoTcrResponse = await TcrSaldosService.listarUsuariosSaldos({
        id_usuario: idUsuarioExtraido,
        pagina: 1,
        por_pagina: 1
      });

      const usuarioTcr = saldoTcrResponse.response.usuarios[0];
      if (!usuarioTcr) {
        throw new Error(`Usuário ${idUsuarioExtraido} não encontrado no TCR`);
      }


      // 2. Buscar saldo real do Brasil Bitcoin
      if (!usuarioTcr.id_brasil_bitcoin) {
        throw new Error(`Usuário ${idUsuarioExtraido} não possui conta Brasil Bitcoin configurada`);
      }

      const saldoBrbtcResponse = await TcrSaldosService.consultarSaldoBrbtc(usuarioTcr.id_brasil_bitcoin);
      const saldoBrbtc = saldoBrbtcResponse.response.data;

      console.log('[CONFERIR-SALDO] Saldo BRBTC encontrado:', saldoBrbtc);

      // 3. Comparar saldos
      const comparacao = compararSaldos(usuarioTcr, saldoBrbtc);
      setSaldoComparacao(comparacao);

      console.log('[CONFERIR-SALDO] Comparação realizada:', comparacao);

      // 4. Feedback para o usuário
      const brlMsg = comparacao.brl.diferenca === 0 ? 'BRL OK' : `BRL diferença ${comparacao.brl.diferenca}`;
      const usdtMsg = comparacao.usdt.diferenca === 0 ? 'USDT OK' : `USDT diferença ${comparacao.usdt.diferenca}`;
      
      if (comparacao.brl.diferenca === 0 && comparacao.usdt.diferenca === 0) {
        toast.success('Conferência OK!', { 
          description: `Usuário ${idUsuarioExtraido}: Todos os saldos estão corretos` 
        });
      } else {
        toast.warning('Diferenças encontradas', { 
          description: `Usuário ${idUsuarioExtraido}: ${brlMsg} | ${usdtMsg}` 
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[CONFERIR-SALDO] Erro na conferência:', error);
      
      toast.error('Erro na conferência de saldo', {
        description: errorMessage,
        duration: 6000
      });
      
      setSaldoComparacao(null);
    } finally {
      setIsCheckingSaldo(false);
    }
  };

  // ✨ NOVA FUNÇÃO: Buscar Depósitos Internos BRBTC
  const handleBuscarDepositosInternos = async () => {
    if (!extractRecord) {
      toast.error('Nenhum registro selecionado');
      return;
    }

    // ✅ Obter ID do usuário (automático ou manual)
    const idUsuarioExtraido = obterIdUsuario();
    if (!idUsuarioExtraido) {
      toast.error('ID do usuário necessário', {
        description: 'Informe o ID do usuário manualmente para usar esta funcionalidade'
      });
      return;
    }

    setIsLoadingDepositos(true);
    setDepositosInternos(null);

    try {
      console.log('[DEPOSITOS-INTERNOS] Iniciando busca para usuário:', idUsuarioExtraido);

      // Obter token JWT do usuário logado
      const token = TOKEN_STORAGE.get();
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Preparar parâmetros da requisição
      const searchParams = new URLSearchParams();
      searchParams.append('id_usuario', idUsuarioExtraido.toString());
      searchParams.append('limit', '100'); // Padrão
      searchParams.append('order', 'desc'); // Mais recentes primeiro

      const apiUrl = `https://vps80270.cloudpublic.com.br:8081/BRBTC/depositos-internos?${searchParams.toString()}`;

      console.log('[DEPOSITOS-INTERNOS] Fazendo requisição:', {
        url: apiUrl,
        id_usuario: idUsuarioExtraido
      });

      // Fazer requisição para API BRBTC
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000) // 30 segundos de timeout
      });

      let responseData: any;
      let responseText: string = '';
      
      try {
        responseText = await response.text();
        console.log('[DEPOSITOS-INTERNOS] Resposta bruta da API:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[DEPOSITOS-INTERNOS] Erro ao fazer parse da resposta:', parseError);
        responseData = { error: `Resposta inválida da API: ${responseText}` };
      }

      if (!response.ok) {
        // Extrair mensagem de erro específica
        let errorMessage = 'Erro desconhecido na API';
        
        if (responseData) {
          errorMessage = responseData.error || 
                       responseData.message || 
                       responseData.erro || 
                       responseData.mensagem ||
                       `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error('[DEPOSITOS-INTERNOS] Erro detalhado da API:', {
          status: response.status,
          statusText: response.statusText,
          responseData,
          extractedError: errorMessage
        });

        throw new Error(errorMessage);
      }

      // Processar dados da resposta - múltiplas possibilidades de estrutura
      console.log('[DEPOSITOS-INTERNOS] Estrutura completa da resposta:', responseData);
      
      let depositos = [];
      
      // Tentar diferentes estruturas de resposta
      if (responseData.dados && responseData.dados.depositos && Array.isArray(responseData.dados.depositos)) {
        depositos = responseData.dados.depositos;
      } else if (responseData.dados && Array.isArray(responseData.dados)) {
        depositos = responseData.dados;
      } else if (responseData.data && responseData.data.depositos && Array.isArray(responseData.data.depositos)) {
        depositos = responseData.data.depositos;
      } else if (responseData.data && Array.isArray(responseData.data)) {
        depositos = responseData.data;
      } else if (responseData.depositos && Array.isArray(responseData.depositos)) {
        depositos = responseData.depositos;
      } else if (responseData.response && responseData.response.data && Array.isArray(responseData.response.data)) {
        depositos = responseData.response.data;
      } else if (responseData.response && Array.isArray(responseData.response)) {
        depositos = responseData.response;
      } else if (Array.isArray(responseData)) {
        depositos = responseData;
      } else {
        // Se não encontrou array, pode ser que os depósitos estejam em outra propriedade
        console.log('[DEPOSITOS-INTERNOS] Tentando extrair depósitos de outras propriedades...');
        
        // Listar todas as propriedades da resposta para debug
        Object.keys(responseData).forEach(key => {
          console.log(`[DEPOSITOS-INTERNOS] Propriedade "${key}":`, responseData[key]);
          if (Array.isArray(responseData[key])) {
            console.log(`[DEPOSITOS-INTERNOS] Encontrado array na propriedade "${key}" com ${responseData[key].length} itens`);
            if (depositos.length === 0) {
              depositos = responseData[key];
            }
          }
        });
      }

      setDepositosInternos(depositos);
      console.log('[DEPOSITOS-INTERNOS] Depósitos mapeados:', depositos);
      console.log('[DEPOSITOS-INTERNOS] Total de depósitos encontrados:', depositos.length);

      // Feedback para o usuário
      if (Array.isArray(depositos)) {
        if (depositos.length > 0) {
          toast.success(`${depositos.length} depósito(s) interno(s) encontrado(s)`, {
            description: `Usuário ${idUsuarioExtraido}: Dados carregados com sucesso`
          });
        } else {
          toast.info('Nenhum depósito interno encontrado', {
            description: `Usuário ${idUsuarioExtraido}: Sem registros na faixa consultada`
          });
        }
      } else {
        toast.warning('Estrutura de dados inesperada', {
          description: `Usuário ${idUsuarioExtraido}: Dados recebidos mas em formato não reconhecido`
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[DEPOSITOS-INTERNOS] Erro na busca:', error);
      
      // Tratamento de erros específicos
      let errorDetails = '';
      if (errorMessage.includes('não autenticado') || errorMessage.includes('token')) {
        errorDetails = 'Faça login novamente.';
      } else if (errorMessage.includes('usuário não encontrado')) {
        errorDetails = 'Verifique se o ID do usuário está correto.';
      } else if (errorMessage.includes('não autorizado')) {
        errorDetails = 'Você não tem permissão para acessar estes dados.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorDetails = 'Verifique sua conexão com a internet.';
      } else if (errorMessage.includes('timeout')) {
        errorDetails = 'Tente novamente em alguns instantes.';
      }
      
      toast.error('Erro ao buscar depósitos internos', {
        description: `${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`,
        duration: 6000
      });
      
      setDepositosInternos(null);
    } finally {
      setIsLoadingDepositos(false);
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
    setShowConfirmModal(false);
    setConfirmAction(null);
    setSaldoComparacao(null);
    setIsCheckingSaldo(false);
    setDepositosInternos(null);
    setIsLoadingDepositos(false);
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

  // Componentes auxiliares para exibição da conferência de saldo
  const CurrencyValue = ({ amount, currency, className = "" }: { amount: number; currency: 'BRL' | 'USDT'; className?: string }) => {
    const colorClass = currency === 'BRL' 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-blue-600 dark:text-blue-400';
    
    return (
      <span className={`font-mono text-sm ${colorClass} ${className}`}>
        {currency === 'BRL' ? `R$ ${amount.toFixed(2)}` : `${amount.toFixed(8)} USDT`}
      </span>
    );
  };

  const DifferenceIndicator = ({ diferenca, currency }: { diferenca: number; currency: 'BRL' | 'USDT' }) => {
    if (diferenca === 0) {
      return (
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          <span className="text-xs font-medium">OK</span>
        </div>
      );
    }

    const isPositive = diferenca > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive 
      ? 'text-orange-600 dark:text-orange-400' 
      : 'text-red-600 dark:text-red-400';

    return (
      <div className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">
          {isPositive ? '+' : ''}{currency === 'BRL' ? diferenca.toFixed(2) : diferenca.toFixed(8)}
        </span>
      </div>
    );
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
    if (!descCliente) return 0;
    
    // ✅ NOVO: Padrão "Usuario 1122;" (busca automática por endtoend)
    const matchUsuario = descCliente.match(/Usuario\s+(\d+)/i);
    if (matchUsuario) {
      return parseInt(matchUsuario[1], 10);
    }
    
    // ✅ ANTIGO: Padrão "caas436344xU1122;" (formato original)
    const matchXU = descCliente.match(/xU(\d+)/i);
    if (matchXU) {
      return parseInt(matchXU[1], 10);
    }
    
    return 0;
  };
  
  // ✅ Função para obter ID do usuário (automático ou manual)
  const obterIdUsuario = (): number => {
    if (usarIdManual && idUsuarioManual) {
      const idManual = parseInt(idUsuarioManual, 10);
      return isNaN(idManual) ? 0 : idManual;
    }
    
    return extractRecord?.descCliente ? extrairIdUsuario(extractRecord.descCliente) : 0;
  };
  
  // ✅ Função para confirmar ID manual
  const handleConfirmarIdManual = () => {
    const id = parseInt(idUsuarioManual, 10);
    if (isNaN(id) || id <= 0) {
      toast.error('ID inválido', {
        description: 'Informe um número válido maior que zero'
      });
      return;
    }
    
    setUsarIdManual(true);
    toast.success(`ID ${id} confirmado`, {
      description: 'Agora todas as funcionalidades estão disponíveis'
    });
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

  // ✨ NOVA FUNÇÃO: Análise Detalhada do Usuário
  const handleAnalisarUsuario = () => {
    const idUsuario = obterIdUsuario();
    
    if (!idUsuario) {
      toast.error('ID do usuário necessário', {
        description: 'Informe o ID do usuário para acessar a análise detalhada'
      });
      return;
    }

    // ✅ CORREÇÃO: Abrir em nova guia/aba ao invés de navegar na mesma
    const url = `/analise-usuario/${idUsuario}`;
    window.open(url, '_blank');
    
    toast.success('Abrindo análise detalhada...', {
      description: `Redirecionando para análise do usuário ${idUsuario}`
    });
  };

  // ✨ NOVA FUNÇÃO: Compensação BRBTC
  const handleCompensacaoBRBTC = () => {
    if (!extractRecord) {
      toast.error('Nenhum registro selecionado');
      return;
    }

    // ✅ Verificar se temos ID do usuário (automático ou manual)
    const idUsuario = obterIdUsuario();
    if (!idUsuario) {
      toast.error('ID do usuário necessário', {
        description: 'Informe o ID do usuário para realizar a compensação BRBTC'
      });
      return;
    }

    // ✅ Criar um extractRecord modificado com o ID correto para a validação
    const extractRecordComId = {
      ...extractRecord,
      descCliente: `Usuario ${idUsuario}; ${extractRecord.descCliente || ''}`
    };

    // Validar elegibilidade com o registro modificado
    const validacao = validarElegibilidadeBRBTC(extractRecordComId);
    if (!validacao.elegivel) {
      toast.error('Registro não elegível para compensação BRBTC', {
        description: validacao.motivos.join(', ')
      });
      return;
    }

    // Abrir modal de confirmação personalizado
    setConfirmAction(() => async () => {
    // Executar compensação com o registro que contém o ID correto
    const sucesso = await executarCompensacaoBRBTC(extractRecordComId);
    
    if (sucesso) {
        // Não fechar o modal automaticamente, deixar o usuário decidir
        toast.success('Compensação Saldo Real realizada com sucesso!', {
          description: 'Modal permanece aberto para outras ações'
        });
    }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const automaticDepositId = getDepositId();
  const depositId = useManualId && manualDepositId ? parseInt(manualDepositId) : automaticDepositId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Sistema Inteligente de Compensação - BMP-531
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

            </div>
            
            {/* Tab Gerenciar Duplicatas */}
            <TabsContent value="diagnostico" className="space-y-4">

              
              {extractRecord ? (
                <div className="space-y-4">
                  {/* Informações para busca de duplicatas */}
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor para busca</Label>
                          <p className="font-semibold text-green-600">{formatCurrency(extractRecord.value)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">ID do Usuário</Label>
                          <p className="font-mono text-xs">
                            {(() => {
                              const id = obterIdUsuario();
                              if (id > 0) {
                                return (
                                  <span className="text-green-600 font-medium">
                                    {id} {usarIdManual ? '(manual)' : '(automático)'}
                                  </span>
                                );
                              }
                              return 'Não identificado';
                            })()}
                          </p>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <Label className="text-xs text-muted-foreground">Descrição do Cliente</Label>
                          <p className="text-xs">{extractRecord.descCliente || 'Não informado'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Botões de ação */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Botão para abrir modal de duplicatas */}
                    <Button 
                      onClick={handleGerenciarDuplicatas}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={obterIdUsuario() === 0}
                    >
                        <Search className="h-4 w-4 mr-2" />
                      Buscar e Gerenciar Duplicatas
                    </Button>

                      {/* Novo botão para conferir saldo */}
                      <Button 
                        onClick={handleConferirSaldo}
                        variant="outline"
                        className="border-green-200 text-green-700 hover:bg-green-50"
                        disabled={obterIdUsuario() === 0 || isCheckingSaldo}
                      >
                        {isCheckingSaldo ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Verificando...</span>
                          </div>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Conferir Saldo do Usuário
                          </>
                        )}
                      </Button>

                      {/* Novo botão para buscar depósitos internos */}
                      <Button 
                        onClick={handleBuscarDepositosInternos}
                        variant="outline"
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                        disabled={obterIdUsuario() === 0 || isLoadingDepositos}
                      >
                        {isLoadingDepositos ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Buscando...</span>
                          </div>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Depósitos Internos BRBTC
                          </>
                        )}
                      </Button>
                    </div>

                    {/* ✅ Seção para entrada manual quando ID não é identificado */}
                    {obterIdUsuario() === 0 && (
                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">ID do usuário não identificado</span>
                          </div>
                          <p className="text-xs text-amber-700 mb-3">
                            Informe o ID do usuário manualmente para acessar todas as funcionalidades:
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Ex: 1122"
                              value={idUsuarioManual}
                              onChange={(e) => setIdUsuarioManual(e.target.value)}
                              className="flex-1"
                              min="1"
                            />
                            <Button 
                              onClick={handleConfirmarIdManual}
                              disabled={!idUsuarioManual}
                              size="sm"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Confirmar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Exibição do resultado da conferência de saldo */}
                    {saldoComparacao && (
                      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <h4 className="text-sm font-semibold text-green-800">
                              Resultado da Conferência de Saldo
                            </h4>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {/* BRL */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Saldo BRL (TCR):</span>
                                <CurrencyValue amount={saldoComparacao.brl.local} currency="BRL" />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Saldo BRL (BRBTC):</span>
                                <CurrencyValue amount={saldoComparacao.brl.externo} currency="BRL" />
                              </div>
                              <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium text-gray-800">Diferença:</span>
                                <DifferenceIndicator diferenca={saldoComparacao.brl.diferenca} currency="BRL" />
                              </div>
                            </div>

                            {/* USDT */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Saldo USDT (TCR):</span>
                                <CurrencyValue amount={saldoComparacao.usdt.local} currency="USDT" />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Saldo USDT (BRBTC):</span>
                                <CurrencyValue amount={saldoComparacao.usdt.externo} currency="USDT" />
                              </div>
                              <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium text-gray-800">Diferença:</span>
                                <DifferenceIndicator diferenca={saldoComparacao.usdt.diferenca} currency="USDT" />
                              </div>
                            </div>
                  </div>
                  
                          {/* Status geral */}
                          <div className="mt-4 p-3 rounded-lg bg-white border">
                            <div className="flex items-center gap-2">
                              {saldoComparacao.brl.diferenca === 0 && saldoComparacao.usdt.diferenca === 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-green-800 font-medium">✅ Saldos conferem</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  <span className="text-orange-800 font-medium">⚠️ Diferenças encontradas</span>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Exibição dos depósitos internos BRBTC */}
                    {depositosInternos !== null && (
                      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-5 w-5 text-purple-600" />
                            <h4 className="text-sm font-semibold text-purple-800">
                              Depósitos Internos BRBTC ({Array.isArray(depositosInternos) ? depositosInternos.length : 0} encontrados)
                            </h4>
                          </div>

                          {Array.isArray(depositosInternos) && depositosInternos.length > 0 ? (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {depositosInternos.slice(0, 10).map((deposito, index) => {
                                // Log do objeto individual para debug
                                console.log(`[DEPOSITOS-INTERNOS] Depósito ${index}:`, deposito);
                                
                                return (
                                  <div key={index} className="bg-white p-3 rounded-lg border border-purple-100">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                      {/* Valor */}
                                      {deposito.amount && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-600">Valor:</span>
                                          <span className="font-mono text-purple-700 font-medium">
                                            R$ {Number(deposito.amount).toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* Data */}
                                      {deposito.timestamp && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-600">Data:</span>
                                          <span className="text-gray-800 text-xs">
                                            {new Date(deposito.timestamp * 1000).toLocaleString('pt-BR')}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* ID */}
                                      {deposito.id && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-600">ID:</span>
                                          <span className="font-mono text-xs text-gray-600">
                                            {deposito.id}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* Moeda */}
                                      {deposito.coin && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-600">Moeda:</span>
                                          <Badge variant="outline" className="text-xs uppercase">
                                            {deposito.coin}
                                          </Badge>
                                        </div>
                                      )}
                                      
                                      {/* Documento De/Para */}
                                      {(deposito.fromUserDocument || deposito.toUserDocument) && (
                                        <div className="col-span-1 sm:col-span-2">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {deposito.fromUserDocument && (
                                              <div className="flex items-center justify-between">
                                                <span className="text-gray-600 text-xs">De:</span>
                                                <span className="font-mono text-xs text-gray-700">
                                                  {deposito.fromUserDocument}
                                                </span>
                                              </div>
                                            )}
                                            {deposito.toUserDocument && (
                                              <div className="flex items-center justify-between">
                                                <span className="text-gray-600 text-xs">Para:</span>
                                                <span className="font-mono text-xs text-gray-700">
                                                  {deposito.toUserDocument}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Campos extras se existirem */}
                                      {Object.keys(deposito).filter(key => 
                                        !['amount', 'timestamp', 'id', 'coin', 'fromUserDocument', 'toUserDocument'].includes(key)
                                      ).slice(0, 2).map(key => (
                                        <div key={key} className="flex items-center justify-between">
                                          <span className="text-gray-600 capitalize text-xs">{key}:</span>
                                          <span className="text-xs text-gray-700 break-words max-w-32">
                                            {typeof deposito[key] === 'object' ? JSON.stringify(deposito[key]) : String(deposito[key])}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {Array.isArray(depositosInternos) && depositosInternos.length > 10 && (
                                <div className="text-center p-2 bg-white rounded border border-purple-100">
                                  <span className="text-xs text-purple-600">
                                    ... e mais {Array.isArray(depositosInternos) ? depositosInternos.length - 10 : 0} depósito(s). Mostrando os 10 mais recentes.
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center p-4 bg-white rounded border border-purple-100">
                              <AlertTriangle className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                              <p className="text-sm text-purple-600">Nenhum depósito interno encontrado</p>
                              <p className="text-xs text-purple-500 mt-1">
                                Este usuário não possui depósitos internos registrados no período consultado.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  
                  
                  <div className="mt-4">
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


              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Button variant="outline" onClick={handleClose} disabled={isLoading || isLoadingBRBTC}>
            Fechar
          </Button>
          
          {/* ✨ NOVO: Botão Analisar Usuário */}
          {obterIdUsuario() > 0 && (
            <Button 
              onClick={handleAnalisarUsuario} 
              disabled={isLoading || isLoadingBRBTC}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analisar Usuário
            </Button>
          )}
          
          {/* ✨ NOVO: Botão Compensação BRBTC */}
          {activeTab === "manual" && extractRecord && (
            obterIdUsuario() > 0 || validarElegibilidadeBRBTC(extractRecord).elegivel
          ) && (
            <Button 
              onClick={handleCompensacaoBRBTC} 
              disabled={isLoading || isLoadingBRBTC || obterIdUsuario() === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoadingBRBTC ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isLoadingBRBTC ? 'Processando...' : 'Compensação Saldo Real'}
            </Button>
          )}
          
          {activeTab === "manual" && (
            <Button 
              onClick={handleManualSubmit} 
              disabled={isLoading || isLoadingBRBTC || !formData.id_usuario || !quantiaInput || parseFloat(quantiaInput) <= 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Processando...' : 'Compensação Saldo Visual'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Modal de Confirmação Personalizado */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirmar Compensação Saldo Real
            </DialogTitle>
            <DialogDescription>
              Esta ação irá processar o depósito via API BRBTC
            </DialogDescription>
          </DialogHeader>
          
          {extractRecord && (
            <div className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>⚠️ Atenção:</strong> Esta ação creditará automaticamente o saldo do usuário.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Valor:</span>
                  <span className="font-bold text-green-600">
                    R$ {Math.abs(extractRecord.value).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Cliente:</span>
                  <span className="text-gray-800">{extractRecord.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Transação:</span>
                  <span className="font-mono text-xs text-gray-600">{extractRecord.id}</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmModal(false)}
              disabled={isLoadingBRBTC}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => confirmAction && confirmAction()}
              disabled={isLoadingBRBTC}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoadingBRBTC ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Compensação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
          idUsuario={obterIdUsuario()}
          onDuplicataExcluida={handleDuplicataExcluida}
        />
      )}
    </Dialog>
  );
}
