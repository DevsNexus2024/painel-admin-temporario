import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, DollarSign, AlertTriangle, Search, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_CONFIG, createAdminApiRequest } from "@/config/api";

interface DiagnosticoSimplificadoResponse {
  deposito: {
    id: number;
    id_usuario: number;
    quantia: number;
    status: string;
    step: string;
  };
  usuario: {
    id_usuario: number;
    id_brasil_bitcoin: string;
  };
  situacao: string;
  confiabilidade_geral: "alta" | "media" | "baixa";
  onde_esta_dinheiro: string;
  acoes_manuais: string[];
  recomendacoes: string[];
  verificacoes: any;
  configuracao: any;
}

interface BotaoAcaoSimplificadoProps {
  acao: string;
  diagnostico: DiagnosticoSimplificadoResponse;
  onSuccess?: () => void;
}

export default function BotaoAcaoSimplificado({ acao, diagnostico, onSuccess }: BotaoAcaoSimplificadoProps) {
  const [loading, setLoading] = useState(false);
  const [operador, setOperador] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const executarAcao = async () => {
    if (!operador.trim()) {
      toast.error("Nome do operador é obrigatório");
      return;
    }

    if (acao === 'compensar_deposito_direto' && !motivo.trim()) {
      toast.error("Motivo é obrigatório para compensação direta");
      return;
    }
    
    setLoading(true);
    
    try {
      let endpoint, body;
      
      switch (acao) {
        case 'reprocessar_pix_bmp531':
          endpoint = API_CONFIG.ENDPOINTS.DIAGNOSTICO.REPROCESSAR_PIX_BMP531;
          body = { id_deposito: diagnostico.deposito.id, operador };
          break;
          
        case 'reprocessar_transferencia_admin':
          endpoint = API_CONFIG.ENDPOINTS.DIAGNOSTICO.REPROCESSAR_TRANSFERENCIA_ADMIN;
          body = { id_deposito: diagnostico.deposito.id, operador };
          break;
          
        case 'compensar_deposito_direto':
          endpoint = API_CONFIG.ENDPOINTS.DIAGNOSTICO.COMPENSAR_DEPOSITO_DIRETO;
          body = { id_deposito: diagnostico.deposito.id, operador, motivo };
          break;

        case 'tentar_novamente':
          // Reexecutar diagnóstico
          toast.success("Recarregando diagnóstico...");
          setTimeout(() => window.location.reload(), 500);
          setLoading(false);
          setDialogOpen(false);
          return;

        case 'verificar_inconsistencia':
          toast.warning("📋 Verificação Manual Necessária", {
            description: "Consulte o guia de verificação de inconsistências locais"
          });
          alert(`🔍 VERIFICAÇÃO MANUAL NECESSÁRIA:

✅ PASSOS RECOMENDADOS:

1. 📊 Verificar registros nas tabelas locais
   - Tabela 'movimentacoes' 
   - Conferir período de ${diagnostico.configuracao?.janela_temporal_horas}h

2. 🔄 Verificar se houve processamento parcial
   - Status atual: ${diagnostico.deposito.status}
   - Step atual: ${diagnostico.deposito.step}

3. 📋 Conferir logs do sistema
   - Logs de processamento de PIX
   - Logs de webhooks da BMP 531

4. ✅ Validar integridade dos dados
   - Valor: R$ ${diagnostico.deposito.quantia}
   - Usuário: ${diagnostico.deposito.id_usuario}

💡 AÇÃO RECOMENDADA:
Após verificação, use "Compensação Direta" se necessário.`);
          setLoading(false);
          setDialogOpen(false);
          return;

        case 'investigar_manual':
          toast.warning("🔍 Investigação Manual Necessária", {
            description: "Consulte o guia de investigação detalhada"
          });
          alert(`🔍 INVESTIGAÇÃO MANUAL NECESSÁRIA:

📋 CHECKLIST COMPLETO:

1. 🔍 Verificar logs detalhados
   - Logs de processamento completo
   - Historico de status do depósito

2. 🌐 Conferir APIs externas manualmente
   - API Brasil Bitcoin
   - Status da conta admin
   - Verificar saldo e movimentações

3. 📊 Consultar histórico de transações
   - BMP 531: webhooks recebidos
   - PIX enviados e recebidos
   - Transferências internas

4. ✅ Validar dados do depósito
   - Integridade dos identificadores
   - Consistência temporal
   - Valor e destinatário

⚠️ SITUAÇÃO: ${diagnostico.situacao}
🎯 CONFIABILIDADE: ${diagnostico.confiabilidade_geral}

💰 VALOR EM JOGO: R$ ${diagnostico.deposito.quantia}`);
          setLoading(false);
          setDialogOpen(false);
          return;
          
        default:
          throw new Error(`Ação não reconhecida: ${acao}`);
      }
      
      const response = await createAdminApiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`✅ ${data.mensagem}`, {
          description: `Ação executada por: ${operador}`
        });
        
        // Limpar campos
        setOperador('');
        setMotivo('');
        setDialogOpen(false);
        
        // Chamar callback de sucesso
        if (onSuccess) onSuccess();
        
      } else {
        toast.error(`❌ Erro: ${data.erro}`, {
          description: "Verifique os dados e tente novamente"
        });
      }
      
    } catch (error) {
      console.error('Erro na execução:', error);
      toast.error(`❌ Erro na execução`, {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
    setLoading(false);
  };

  // ✨ Configurações atualizadas para as novas ações
  const getButtonConfig = (acao: string) => {
    const configs = {
      'reprocessar_pix_bmp531': {
        text: '🔄 Reprocessar PIX BMP',
        variant: 'default' as const,
        description: 'Reenvia PIX da conta BMP 531 para Brasil Bitcoin',
        icon: RefreshCw,
        color: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        requiresOperator: true,
        requiresMotivo: false
      },
      'reprocessar_transferencia_admin': {
        text: '🔄 Transferir de Admin',
        variant: 'default' as const,
        description: 'Transfere dinheiro da conta admin para usuário final',
        icon: RefreshCw,
        color: 'bg-blue-500 hover:bg-blue-600 text-white',
        requiresOperator: true,
        requiresMotivo: false
      },
      'compensar_deposito_direto': {
        text: '💰 Compensação Direta',
        variant: 'destructive' as const,
        description: 'Credita saldo diretamente (último recurso)',
        icon: DollarSign,
        color: 'bg-red-500 hover:bg-red-600 text-white',
        requiresOperator: true,
        requiresMotivo: true
      },
      'tentar_novamente': {
        text: '🔄 Tentar Novamente',
        variant: 'outline' as const,
        description: 'Reexecuta o diagnóstico',
        icon: RotateCcw,
        color: 'border-blue-500 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30',
        requiresOperator: false,
        requiresMotivo: false
      },
      'verificar_inconsistencia': {
        text: '⚠️ Verificar Inconsistência',
        variant: 'outline' as const,
        description: 'Orientações para verificação manual',
        icon: Eye,
        color: 'border-yellow-500 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
        requiresOperator: false,
        requiresMotivo: false
      },
      'investigar_manual': {
        text: '🔍 Investigar Manualmente',
        variant: 'outline' as const,
        description: 'Orientações para investigação detalhada',
        icon: Search,
        color: 'border-gray-500 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800/50',
        requiresOperator: false,
        requiresMotivo: false
      }
    };
    return configs[acao as keyof typeof configs] || { 
      text: acao, 
      variant: 'outline' as const, 
      description: 'Ação personalizada',
      icon: AlertTriangle,
      color: 'border-gray-500 text-gray-600',
      requiresOperator: false,
      requiresMotivo: false
    };
  };

  const config = getButtonConfig(acao);
  const Icon = config.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-2">
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button 
            variant={config.variant}
            className={`w-full ${config.color}`}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Icon className="h-4 w-4 mr-2" />
            )}
            {loading ? '⏳ Processando...' : config.text}
          </Button>
        </AlertDialogTrigger>
        
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              Confirmar Ação: {config.text}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                <p className="mb-3">{config.description}</p>
                
                {/* Resumo da operação */}
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="font-medium">Depósito:</span>
                      <Badge variant="outline" className="ml-2">#{diagnostico.deposito.id}</Badge>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Usuário:</span>
                      <span className="ml-2">{diagnostico.deposito.id_usuario}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Valor:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        {formatCurrency(diagnostico.deposito.quantia)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Situação:</span>
                      <span className="ml-2">{diagnostico.situacao}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Confiabilidade:</span>
                      <Badge variant="outline" className="ml-2">
                        {diagnostico.confiabilidade_geral.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium">Localização:</span>
                      <span className="ml-2 text-xs">{diagnostico.onde_esta_dinheiro}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Campo operador */}
              {config.requiresOperator && (
                <div className="space-y-2">
                  <Label htmlFor="operador">Nome do Operador *</Label>
                  <Input
                    id="operador"
                    placeholder="Ex: admin_joao"
                    value={operador}
                    onChange={(e) => setOperador(e.target.value)}
                    required
                  />
                </div>
              )}
              
              {/* Campo motivo (apenas para compensação direta) */}
              {config.requiresMotivo && (
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo da Compensação *</Label>
                  <Textarea
                    id="motivo"
                    placeholder="Ex: Dinheiro não localizado após diagnóstico inteligente"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                    rows={3}
                  />
                </div>
              )}
              
              {acao === 'compensar_deposito_direto' && (
                <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    <strong>ATENÇÃO:</strong> Esta ação credita saldo diretamente sem rastreamento do dinheiro real. Use apenas como último recurso.
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executarAcao}
              disabled={
                loading || 
                (config.requiresOperator && !operador.trim()) || 
                (config.requiresMotivo && !motivo.trim())
              }
              className={config.color}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Icon className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Executando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Descrição da ação */}
      <p className="text-xs text-muted-foreground text-center px-2">
        {config.description}
      </p>
    </div>
  );
}
