import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertCircle, CheckCircle, DollarSign, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import BotaoAcao from "@/components/BotaoAcao";
import { API_CONFIG, createAdminApiRequest } from "@/config/api";

// Tipos baseados no guia de implementação
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

interface DiagnosticoDepositoProps {
  idDeposito: number;
  onRefresh?: () => void;
}

export default function DiagnosticoDeposito({ idDeposito, onRefresh }: DiagnosticoDepositoProps) {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const executarDiagnostico = async () => {
    setLoading(true);
    try {
      const response = await createAdminApiRequest(API_CONFIG.ENDPOINTS.DIAGNOSTICO.DIAGNOSTICAR_DEPOSITO, {
        method: 'POST',
        body: JSON.stringify({ id_deposito: idDeposito })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Log para debug - ver estrutura real da resposta


      
      setDiagnostico(data.response);
      
      toast.success("Diagnóstico realizado com sucesso", {
        description: `Situação detectada: ${data.response?.situacao_geral || 'Situação detectada'}`
      });
      
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast.error("Erro ao executar diagnóstico", {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
    setLoading(false);
  };

  const getSituacaoStyle = (situacao: string) => {
    const styles = {
      'PROCESSADO_OK': { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
      'DINHEIRO_NA_BMP531': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle },
      'DINHEIRO_NO_ADMIN': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCw },
      'DUPLICIDADE_BMP531': { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertCircle },
      'DINHEIRO_NAO_CHEGOU_BMP': { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
      'DINHEIRO_SUMIU': { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle }
    };
    return styles[situacao as keyof typeof styles] || { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Botão de Diagnóstico */}
      <div className="flex justify-center">
        <Button 
          onClick={executarDiagnostico} 
          disabled={loading}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Diagnosticando...' : '🔍 Diagnosticar Depósito'}
        </Button>
      </div>
      
      {/* Resultado do Diagnóstico */}
      {diagnostico && (
        <div className="space-y-4">
          
          {/* Informações do Depósito */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Informações do Depósito #{diagnostico.deposito.id}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Usuário</p>
                  <p className="font-semibold">{diagnostico.usuario.nome}</p>
                  <p className="text-xs text-muted-foreground">ID: {diagnostico.deposito.id_usuario}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-semibold text-green-600">{formatCurrency(diagnostico.deposito.quantia)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold">{diagnostico.deposito.status_deposito}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Etapa</p>
                  <p className="font-semibold">{diagnostico.deposito.step}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Situação Geral */}
          <Alert className={getSituacaoStyle(diagnostico.situacao_geral).color}>
            {React.createElement(getSituacaoStyle(diagnostico.situacao_geral).icon, { className: "h-4 w-4" })}
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <strong>📍 Situação:</strong>
                  <Badge variant="outline" className="font-mono">
                    {diagnostico.situacao_geral}
                  </Badge>
                </div>
                <div>
                  <strong>💰 Localização:</strong> {diagnostico.onde_esta_dinheiro}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Detalhes BMP 531 */}
          {diagnostico.bmp_531 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📊 Análise BMP 531</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={diagnostico.bmp_531?.diagnostico_bmp531 === 'PARADO_BMP531' ? 'destructive' : 'default'}>
                      {diagnostico.bmp_531?.diagnostico_bmp531 || 'Status não disponível'}
                    </Badge>
                  </div>
                  
                  {diagnostico.bmp_531?.detalhes_bmp531 ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="font-semibold text-lg">
                          {diagnostico.bmp_531.detalhes_bmp531.recebimentos ?? 'N/A'}
                        </p>
                        <p className="text-muted-foreground">Recebimentos</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="font-semibold text-lg">
                          {diagnostico.bmp_531.detalhes_bmp531.envios ?? 'N/A'}
                        </p>
                        <p className="text-muted-foreground">Envios</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="font-semibold text-lg">
                          {diagnostico.bmp_531.detalhes_bmp531.duplicidade_detectada ? '⚠️' : '✅'}
                        </p>
                        <p className="text-muted-foreground">Duplicidade</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-muted rounded">
                      <p className="text-muted-foreground">Detalhes não disponíveis</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💡 Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {diagnostico.recomendacoes?.map((recomendacao, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span className="text-sm">{recomendacao}</span>
                  </li>
                )) || (
                  <li className="text-sm text-muted-foreground">Nenhuma recomendação disponível</li>
                )}
              </ul>
            </CardContent>
          </Card>
          
          {/* Ações Disponíveis */}
          {diagnostico.acoes_disponiveis && diagnostico.acoes_disponiveis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔧 Ações Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {diagnostico.acoes_disponiveis.map(acao => (
                    <BotaoAcao 
                      key={acao} 
                      acao={acao} 
                      diagnostico={diagnostico} 
                      onSuccess={() => {
                        toast.success("Ação executada com sucesso!");
                        if (onRefresh) onRefresh();
                        // Executar novo diagnóstico automaticamente
                        setTimeout(() => executarDiagnostico(), 2000);
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
