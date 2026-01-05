import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Search, AlertCircle, CheckCircle, DollarSign, RefreshCw, XCircle, ChevronDown, Clock, Target } from "lucide-react";
import { toast } from "sonner";
import BotaoAcaoSimplificado from "@/components/BotaoAcaoSimplificado";
import { API_CONFIG, createAdminApiRequest } from "@/config/api";

// 🚀 Tipos baseados na nova versão simplificada
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
  // ✨ SITUAÇÃO FINAL SIMPLIFICADA
  situacao: string; // 7 estados possíveis
  confiabilidade_geral: "alta" | "media" | "baixa";
  onde_esta_dinheiro: string;
  
  // ✨ AÇÕES MANUAIS DISPONÍVEIS
  acoes_manuais: string[];
  recomendacoes: string[];
  
  // ✨ VERIFICAÇÕES DETALHADAS (v4.3 - CORREÇÕES CRÍTICAS)
  verificacoes: {
    local: {
      encontrado: boolean;
      etapas: {
        deposito_tabela: { encontrado: boolean; dados: any };
        movimentacao_tabela: { 
          encontrado: boolean; 
          quantidade: number; 
          movimentacao_especifica?: {
            id: number;
            quantia: string;
            metodo_identificacao: "pix_movementId" | "pix_operationId" | "proximidade_temporal" | "quantia_usuario";
          };
          confiabilidade_movimentacao: string;
          metodos_tentativa: {
            pix_movementId: { tentado: boolean; sucesso: boolean };
            pix_operationId: { tentado: boolean; sucesso: boolean };
            proximidade_temporal: { tentado: boolean; sucesso: boolean; desabilitado?: boolean };
            fallback_quantia: { tentado: boolean; sucesso: boolean };
          };
          registros: any[];
        };
        transacao_cruzamento: { encontrado: boolean; movimentacao_relacionada: any; transacao: any };
      };
      confiabilidade: string;
    };
    usuario_final: {
      encontrado: boolean;
      usuario_dados: { id_brasil_bitcoin: string; nome: string };
      detalhes: any[];
      filtro_aplicado: {
        tipo: "valor_apenas";
        valor_buscado: number;
        tolerancia: number;
        total_registros_api: number;
        registros_filtrados: number;
      };
      confiabilidade: string;
    };
    bmp_531: {
      situacao: string;
      instrucao_operador: string;
    };
    admin_exclusao: {
      provavelmente_parado_admin: boolean;
      confiabilidade: string;
    };
  };
  
  // ✨ CONFIGURAÇÃO USADA
  configuracao: {
    janela_temporal_horas: number;
    timestamp_diagnostico: string;
  };
}

interface DiagnosticoDepositoSimplificadoProps {
  idDeposito: number;
  onRefresh?: () => void;
}

export default function DiagnosticoDepositoSimplificado({ idDeposito, onRefresh }: DiagnosticoDepositoSimplificadoProps) {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoSimplificadoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [janelaHoras, setJanelaHoras] = useState(1);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const executarDiagnostico = async () => {
    setLoading(true);
    try {
      const response = await createAdminApiRequest(API_CONFIG.ENDPOINTS.DIAGNOSTICO.DIAGNOSTICAR_DEPOSITO_SIMPLIFICADO, {
        method: 'POST',
        body: JSON.stringify({ 
          id_deposito: idDeposito,
          janela_horas: janelaHoras
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Log para debug - ver estrutura nova da resposta
      // console.log("📥 Resposta simplificada do backend:", data);
      // console.log("📊 Estrutura simplificada:", data.response);
      
      setDiagnostico(data.response);
      
      // ✅ Toast removido - resultado do diagnóstico já é visível na interface
      // Apenas mostrar toast se houver problemas críticos
      
    } catch (error) {
      console.error('Erro no diagnóstico simplificado:', error);
      toast.error("Erro ao executar diagnóstico", {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: 5000
      });
    }
    setLoading(false);
  };

  // ✨ Mapeamento de estilos por situação
  const getSituacaoStyle = (situacao: string) => {
    const styles = {
      'OK': { class: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, color: '#28a745' },
      'PROBLEMA_LOCAL': { class: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle, color: '#ffc107' },
      'PARADO_BMP': { class: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCw, color: '#17a2b8' },
      'PARADO_ADMIN': { class: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCw, color: '#17a2b8' },
      'PERDIDO': { class: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, color: '#dc3545' },
      'ERRO_CONSULTA': { class: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, color: '#dc3545' },
      'INDETERMINADO': { class: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle, color: '#6c757d' }
    };
    return styles[situacao as keyof typeof styles] || { class: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle, color: '#6c757d' };
  };

  // ✨ Estilo de confiabilidade
  const getConfiabilidadeStyle = (confiabilidade: string) => {
    const styles = {
      'alta': { class: 'bg-green-500', icon: '🟢', text: 'text-green-800' },
      'media': { class: 'bg-yellow-500', icon: '🟡', text: 'text-yellow-800' },
      'baixa': { class: 'bg-red-500', icon: '🔴', text: 'text-red-800' }
    };
    return styles[confiabilidade as keyof typeof styles] || { class: 'bg-gray-500', icon: '⚪', text: 'text-gray-800' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* ✨ Configurações do Diagnóstico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configurações do Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="janela-horas" title="Configuração de período para APIs externas (Brasil Bitcoin, BMP 531). A verificação local usa busca direta por ID.">
                ⏱️ Janela Temporal (horas)
              </Label>
              <Select value={janelaHoras.toString()} onValueChange={(value) => setJanelaHoras(parseFloat(value))}>
                <SelectTrigger id="janela-horas">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 minutos</SelectItem>
                  <SelectItem value="1">1 hora (padrão)</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ⚠️ <strong>SIMPLIFICADO v4.3:</strong> API Brasil Bitcoin agora usa APENAS filtro por valor<br/>
                🏠 Verificação local: 3 métodos resilientes (pix_movementId, pix_operationId, fallback)<br/>
                🚫 Proximidade temporal desabilitada por bugs críticos detectados
              </p>
            </div>
            
            <Button 
              onClick={executarDiagnostico} 
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Diagnosticando...' : '🔍 Executar Diagnóstico Simplificado'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* ✨ Resultado do Diagnóstico */}
      {diagnostico && (
        <div className="space-y-4">
          
          {/* ✨ Status Principal */}
          <Alert className={`${getSituacaoStyle(diagnostico.situacao).class} border-l-4`}>
            {React.createElement(getSituacaoStyle(diagnostico.situacao).icon, { className: "h-4 w-4" })}
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h5 className="font-semibold text-lg">
                      {getSituacaoStyle(diagnostico.situacao).icon && React.createElement(getSituacaoStyle(diagnostico.situacao).icon, { className: "h-5 w-5 inline mr-2" })}
                      Situação: {diagnostico.situacao}
                    </h5>
                    <p className="font-medium">
                      📍 Localização: {diagnostico.onde_esta_dinheiro}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-medium">
                        {getConfiabilidadeStyle(diagnostico.confiabilidade_geral).icon} Confiabilidade:
                      </span>
                      <Badge variant="outline" className={`${getConfiabilidadeStyle(diagnostico.confiabilidade_geral).text} border-current`}>
                        {diagnostico.confiabilidade_geral.toUpperCase()}
                      </Badge>
                    </p>
                  </div>
                  
                  {/* ✨ Informações do Depósito */}
                  <div className="text-right bg-black/10 dark:bg-white/10 p-3 rounded-lg">
                    <p className="font-semibold">Depósito #{diagnostico.deposito.id}</p>
                    <p className="font-bold text-lg text-green-600">
                      {formatCurrency(diagnostico.deposito.quantia)}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Usuário: {diagnostico.deposito.id_usuario}</p>
                      <p className="text-xs">
                        ID BB: {diagnostico.verificacoes.usuario_final.usuario_dados?.id_brasil_bitcoin || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* ✨ Resumo de Verificações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔍 Resumo das Verificações (v4.3 - Correções Críticas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-3 rounded-lg border-2 ${diagnostico.verificacoes.local.encontrado ? 'border-green-200 bg-green-100 dark:bg-green-900/30' : 'border-red-200 bg-red-100 dark:bg-red-900/30'}`}>
                  <div className="text-center">
                    <div className={`text-2xl ${diagnostico.verificacoes.local.encontrado ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostico.verificacoes.local.encontrado ? '✅' : '❌'}
                    </div>
                    <p className="font-semibold">🏠 Local (Resiliente)</p>
                    
                    {/* Método de Identificação Usado */}
                    {diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.movimentacao_especifica && (
                      <div className="mt-2 mb-2">
                        <Badge 
                          variant={
                            diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'pix_movementId' ? 'default' :
                            diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'pix_operationId' ? 'default' :
                            diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'proximidade_temporal' ? 'destructive' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'pix_movementId' ? '🎯 PIX Movement' :
                           diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'pix_operationId' ? '🎯 PIX Operation' :
                           diagnostico.verificacoes.local.etapas.movimentacao_tabela.movimentacao_especifica.metodo_identificacao === 'proximidade_temporal' ? '⚠️ Temporal' :
                           '🔍 Fallback'
                          }
                        </Badge>
                      </div>
                    )}
                    
                    {/* Métodos de Busca Tentados */}
                    {diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.metodos_tentativa && (
                      <div className="text-xs space-y-1 mt-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Métodos Tentados:</div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="flex items-center justify-between">
                            <span>🎯 Movement:</span>
                            <span>{diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.pix_movementId?.sucesso ? '✅' : 
                                    diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.pix_movementId?.tentado ? '❌' : '⏸️'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>🎯 Operation:</span>
                            <span>{diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.pix_operationId?.sucesso ? '✅' : 
                                    diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.pix_operationId?.tentado ? '❌' : '⏸️'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>⚠️ Temporal:</span>
                            <span>{diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.proximidade_temporal?.desabilitado ? '🚫' : 
                                    diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.proximidade_temporal?.sucesso ? '✅' : 
                                    diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.proximidade_temporal?.tentado ? '❌' : '⏸️'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>🔍 Fallback:</span>
                            <span>{diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.fallback_quantia?.sucesso ? '✅' : 
                                    diagnostico.verificacoes.local.etapas.movimentacao_tabela.metodos_tentativa.fallback_quantia?.tentado ? '❌' : '⏸️'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs space-y-1 mt-2">
                      <div className="flex items-center justify-between">
                        <span>Depósito:</span>
                        <span>{diagnostico.verificacoes.local.etapas?.deposito_tabela?.encontrado ? '✅' : '❌'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Movimentação:</span>
                        <span>{diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.encontrado ? '✅' : '❌'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Transação:</span>
                        <span>{diagnostico.verificacoes.local.etapas?.transacao_cruzamento?.encontrado ? '✅' : '❌'}</span>
                      </div>
                      
                      {/* Confiabilidade da Movimentação */}
                      {diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.confiabilidade_movimentacao && (
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                          <span>Confiança:</span>
                          <Badge 
                            variant={diagnostico.verificacoes.local.etapas.movimentacao_tabela.confiabilidade_movimentacao === 'alta' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {diagnostico.verificacoes.local.etapas.movimentacao_tabela.confiabilidade_movimentacao}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.movimentacao_especifica?.metodo_identificacao === 'pix_movementId' ? 'Hash PIX Movement ID' :
                       diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.movimentacao_especifica?.metodo_identificacao === 'pix_operationId' ? 'Hash PIX Operation ID' :
                       diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.movimentacao_especifica?.metodo_identificacao === 'proximidade_temporal' ? 'Proximidade temporal (±10min)' :
                       'Busca por quantia + usuário'
                      }
                    </p>
                  </div>
                </div>
                
                <div className={`p-3 rounded-lg border-2 ${diagnostico.verificacoes.usuario_final.encontrado ? 'border-green-200 bg-green-100 dark:bg-green-900/30' : 'border-red-200 bg-red-100 dark:bg-red-900/30'}`}>
                  <div className="text-center">
                    <div className={`text-2xl ${diagnostico.verificacoes.usuario_final.encontrado ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostico.verificacoes.usuario_final.encontrado ? '✅' : '❌'}
                    </div>
                    <p className="font-semibold">🌐 Usuário Final</p>
                    
                    {/* Filtro Simplificado - APENAS VALOR */}
                    {diagnostico.verificacoes.usuario_final.filtro_aplicado && (
                      <div className="mt-2 mb-2">
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          💰 Apenas Valor
                        </Badge>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground">
                      {diagnostico.verificacoes.usuario_final.detalhes?.length || 0} registros
                    </p>
                    
                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                      <div>ID BB: {diagnostico.verificacoes.usuario_final.usuario_dados?.id_brasil_bitcoin?.slice(-6)}...</div>
                      
                      {/* Informações do Filtro Aplicado */}
                      {diagnostico.verificacoes.usuario_final.filtro_aplicado && (
                        <div className="pt-1 border-t border-gray-200 dark:border-gray-600">
                          <div>Valor: R$ {diagnostico.verificacoes.usuario_final.filtro_aplicado.valor_buscado}</div>
                          <div>Tolerância: ±{diagnostico.verificacoes.usuario_final.filtro_aplicado.tolerancia}</div>
                          <div>API: {diagnostico.verificacoes.usuario_final.filtro_aplicado.total_registros_api} total</div>
                          <div>Filtrados: {diagnostico.verificacoes.usuario_final.filtro_aplicado.registros_filtrados}</div>
                        </div>
                      )}
                      
                      {/* Múltiplos valores = Baixa confiabilidade */}
                      {diagnostico.verificacoes.usuario_final.detalhes?.length > 1 && (
                        <div className="pt-1 border-t border-red-200 dark:border-red-600">
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            ⚠️ Múltiplos valores
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border-2 border-yellow-200 bg-yellow-100 dark:bg-yellow-900/30">
                  <div className="text-center">
                    <div className="text-2xl text-yellow-600">
                      ⏸️
                    </div>
                    <p className="font-semibold">🏦 BMP 531</p>
                    <p className="text-xs text-muted-foreground">
                      {diagnostico.verificacoes.bmp_531.situacao || 'VERIFICACAO_MANUAL'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verificação manual
                    </p>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border-2 ${diagnostico.verificacoes.admin_exclusao.provavelmente_parado_admin ? 'border-yellow-200 bg-yellow-100 dark:bg-yellow-900/30' : 'border-green-200 bg-green-100 dark:bg-green-900/30'}`}>
                  <div className="text-center">
                    <div className={`text-2xl ${diagnostico.verificacoes.admin_exclusao.provavelmente_parado_admin ? 'text-yellow-600' : 'text-green-600'}`}>
                      {diagnostico.verificacoes.admin_exclusao.provavelmente_parado_admin ? '⚠️' : '✅'}
                    </div>
                    <p className="font-semibold">Admin</p>
                    <p className="text-xs text-muted-foreground">
                      {diagnostico.verificacoes.admin_exclusao.provavelmente_parado_admin ? 'Provável' : 'OK'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* ✨ Alert sobre Correções Críticas v4.3 */}
          {(diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.metodos_tentativa?.proximidade_temporal?.desabilitado ||
            diagnostico.verificacoes.usuario_final.filtro_aplicado?.tipo === 'valor_apenas') && (
            <Alert className="border-blue-200 bg-blue-100 dark:bg-blue-900/30 mb-4">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <h6 className="font-semibold text-blue-800 dark:text-blue-200">
                    🔧 Correções Críticas Aplicadas (v4.3)
                  </h6>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    {diagnostico.verificacoes.local.etapas?.movimentacao_tabela?.metodos_tentativa?.proximidade_temporal?.desabilitado && (
                      <p>• ⚠️ <strong>Proximidade temporal desabilitada</strong> - Bug crítico detectado (valores discrepantes em ±10min)</p>
                    )}
                    {diagnostico.verificacoes.usuario_final.filtro_aplicado?.tipo === 'valor_apenas' && (
                      <p>• 💰 <strong>API Brasil Bitcoin simplificada</strong> - Filtro APENAS por valor (sem data/hora)</p>
                    )}
                    <p>• 🎯 <strong>Hash implementado</strong> - pix_movementId salvo para identificação precisa</p>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Estas correções resolvem problemas identificados nos testes dos depósitos #1122 e #1285.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* ✨ Instrução BMP 531 Manual */}
          {diagnostico.verificacoes.bmp_531.situacao === 'VERIFICACAO_MANUAL' && (
            <Alert className="border-yellow-200 bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <h6 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    ⚠️ Verificação Manual Necessária - BMP 531
                  </h6>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {diagnostico.verificacoes.bmp_531.instrucao_operador || '📋 AÇÃO MANUAL: Consulte o extrato BMP 531 para confirmar se o depósito foi recebido e enviado para a Brasil Bitcoin.'}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Consulte manualmente o extrato BMP 531 para validar o status da transação.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* ✨ Recomendações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💡 Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {diagnostico.recomendacoes?.map((recomendacao, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">{index + 1}</Badge>
                    <span className="text-sm">{recomendacao}</span>
                  </li>
                )) || (
                  <li className="text-sm text-muted-foreground">Nenhuma recomendação disponível</li>
                )}
              </ul>
            </CardContent>
          </Card>
          
          {/* ✨ Ações Manuais Disponíveis */}
          {diagnostico.acoes_manuais && diagnostico.acoes_manuais.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔧 Ações Manuais Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diagnostico.acoes_manuais.map(acao => (
                    <BotaoAcaoSimplificado 
                      key={acao} 
                      acao={acao} 
                      diagnostico={diagnostico} 
                      onSuccess={() => {
                        // ✅ Toast removido - ação já tem feedback visual no botão
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

          {/* ✨ Detalhes Técnicos (Colapsível) */}
          <Collapsible open={mostrarDetalhes} onOpenChange={setMostrarDetalhes}>
            <Card>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      {mostrarDetalhes ? 'Ocultar Detalhes Técnicos' : 'Mostrar Detalhes Técnicos'}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mostrarDetalhes ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h6 className="font-semibold mb-2">📊 Verificação Local:</h6>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(diagnostico.verificacoes.local, null, 2)}
                        </pre>
                      </div>
                      
                      <div>
                        <h6 className="font-semibold mb-2">🌐 Verificação Externa:</h6>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(diagnostico.verificacoes.usuario_final, null, 2)}
                        </pre>
                      </div>
                      
                      <div>
                        <h6 className="font-semibold mb-2">🏦 BMP 531:</h6>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(diagnostico.verificacoes.bmp_531, null, 2)}
                        </pre>
                      </div>
                      
                      <div>
                        <h6 className="font-semibold mb-2">⚙️ Configuração:</h6>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(diagnostico.configuracao, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </CardHeader>
            </Card>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
