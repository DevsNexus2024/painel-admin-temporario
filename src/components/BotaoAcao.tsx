import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, DollarSign, AlertTriangle } from "lucide-react";
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
import { API_CONFIG, createAdminApiRequest } from "@/config/api";

interface DiagnosticoResponse {
  deposito: {
    id: number;
    id_usuario: number;
    quantia: number;
    step: string;
    status_deposito: string;
  };
  usuario: {
    nome: string;
    email: string;
    id_brasil_bitcoin: string;
  };
  situacao_geral: string;
  onde_esta_dinheiro: string;
  usuario_final: {
    encontrado: boolean;
    quantidade: number;
  };
  conta_admin: {
    tem_saldo_excedente: boolean;
  };
  bmp_531: {
    diagnostico_bmp531: string;
    detalhes_bmp531: {
      recebimentos: number;
      envios: number;
      duplicidade_detectada: boolean;
    };
  };
  recomendacoes: string[];
  acoes_disponiveis: string[];
}

interface BotaoAcaoProps {
  acao: string;
  diagnostico: DiagnosticoResponse;
  onSuccess?: () => void;
}

export default function BotaoAcao({ acao, diagnostico, onSuccess }: BotaoAcaoProps) {
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

  const getButtonConfig = (acao: string) => {
    const configs = {
      'reprocessar_pix_bmp531': {
        text: '🔄 Reprocessar PIX BMP 531',
        variant: 'default' as const,
        description: 'Reenvia PIX da conta BMP para Brasil Bitcoin',
        icon: RefreshCw,
        color: 'bg-yellow-500 hover:bg-yellow-600'
      },
      'reprocessar_transferencia_admin': {
        text: '🔄 Transferir de Admin',
        variant: 'default' as const,
        description: 'Transfere dinheiro da conta admin para usuário final',
        icon: RefreshCw,
        color: 'bg-blue-500 hover:bg-blue-600'
      },
      'compensar_deposito_direto': {
        text: '💰 Compensação Direta',
        variant: 'destructive' as const,
        description: 'Credita saldo diretamente (último recurso)',
        icon: DollarSign,
        color: 'bg-red-500 hover:bg-red-600'
      }
    };
    return configs[acao as keyof typeof configs] || { 
      text: acao, 
      variant: 'outline' as const, 
      description: 'Ação personalizada',
      icon: AlertTriangle,
      color: 'bg-gray-500 hover:bg-gray-600'
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
            className={`w-full ${config.color} text-white`}
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
        
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              Confirmar Ação
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                <p className="mb-2">{config.description}</p>
                
                {/* Resumo da operação */}
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Depósito:</span>
                    <Badge variant="outline">#{diagnostico.deposito.id}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Usuário:</span>
                    <span className="text-sm">{diagnostico.usuario.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Valor:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(diagnostico.deposito.quantia)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Situação:</span>
                    <span className="text-sm">{diagnostico.situacao_geral}</span>
                  </div>
                </div>
              </div>
              
              {/* Campo operador */}
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
              
              {/* Campo motivo (apenas para compensação direta) */}
              {acao === 'compensar_deposito_direto' && (
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo da Compensação *</Label>
                  <Input
                    id="motivo"
                    placeholder="Ex: Dinheiro não localizado após investigação"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                  />
                </div>
              )}
              
              {acao === 'compensar_deposito_direto' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
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
              disabled={loading || !operador.trim() || (acao === 'compensar_deposito_direto' && !motivo.trim())}
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
