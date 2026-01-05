import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Search, CheckCircle, XCircle, AlertCircle, 
  Copy, ChevronDown, ChevronUp, Info, FileText, RefreshCw, Filter,
  AlertTriangle, CalendarIcon, RotateCcw, Eye, ChevronLeft, ChevronRight,
  Package, TrendingUp, Activity, Clock, Wallet
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  lotesService,
  type Lote,
  type LoteDetalhes,
  type Movimentacao,
  type Transacao,
  type DetalhesLoteResponse,
  type ListaLotesParams,
  formatCurrency as formatCurrencyLotes,
  formatDate as formatDateLotes,
  getStatusDepositoLabel as getStatusDepositoLabelLotes,
  getStatusProgressoLabel,
  getStatusColor as getStatusColorLotes
} from "@/services/lotes.service";
import {
  depositosNormaisService,
  type DepositoNormal,
  type DepositoNormalDetalhes,
  type MovimentacaoDeposito,
  type TransacaoDeposito,
  type WebhookPayload,
  type DetalhesDepositoNormalResponse,
  type ListaDepositosNormaisParams,
  formatCurrency,
  formatDate,
  getStatusDepositoLabel,
  getSituacaoLabel,
  getStepLabel,
  getStatusColor,
  getSituacaoColor
} from "@/services/depositos-normais.service";

// ===================================
// COMPONENTE: Estatísticas de Lotes
// ===================================
function LotesStats({ 
  total, 
  processando, 
  finalizados, 
  erros,
  pendentes,
  emAndamento,
  completos,
  loading 
}: { 
  total: number; 
  processando: number; 
  finalizados: number;
  erros: number;
  pendentes: number;
  emAndamento: number;
  completos: number;
  loading: boolean;
}) {
  const statCards = [
    {
      label: "Total de Lotes",
      value: total,
      icon: Package,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30"
    },
    {
      label: "Processando",
      value: processando,
      icon: Activity,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30"
    },
    {
      label: "Finalizados",
      value: finalizados,
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30"
    },
    {
      label: "Com Erro",
      value: erros,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30"
    },
    {
      label: "Pendentes",
      value: pendentes,
      icon: Clock,
      color: "text-gray-400",
      bgColor: "bg-gray-500/10",
      borderColor: "border-gray-500/30"
    },
    {
      label: "Em Andamento",
      value: emAndamento,
      icon: TrendingUp,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30"
    },
    {
      label: "Completos",
      value: completos,
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {statCards.map((stat, idx) => (
        <div 
          key={idx}
          className={cn(
            "relative overflow-hidden rounded-xl border p-5 transition-all duration-300",
            "hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5",
            stat.bgColor, stat.borderColor
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p className={cn("text-3xl font-bold mt-2 tabular-nums", stat.color)}>
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-muted/50 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </p>
            </div>
            <div className={cn("p-2.5 rounded-lg", stat.bgColor)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
          </div>
          <div className={cn(
            "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20",
            stat.bgColor.replace('/10', '/40')
          )} />
        </div>
      ))}
    </div>
  );
}

// ===================================
// COMPONENTE: Linha da Lista de Lotes
// ===================================
function LoteListItem({ 
  lote, 
  onViewDetails, 
  onReprocessar,
  isReprocessando
}: { 
  lote: Lote;
  onViewDetails: (id: number) => void;
  onReprocessar: (id: number) => void;
  isReprocessando: boolean;
}) {
  const getStatusBadge = () => {
    return (
      <Badge className={cn("gap-1 text-xs", getStatusColor(lote.status_deposito))}>
        {getStatusDepositoLabel(lote.status_deposito)}
      </Badge>
    );
  };

  const getProgressoBadge = () => {
    return (
      <Badge className={cn("gap-1 text-xs", getStatusColor(lote.status_progresso))}>
        {getStatusProgressoLabel(lote.status_progresso)}
      </Badge>
    );
  };

  return (
    <tr 
      className={cn(
        "group border-b border-border/50 bg-card/30 hover:bg-card/50 transition-colors",
        "cursor-pointer"
      )}
      onClick={() => onViewDetails(lote.id)}
    >
      {/* ID */}
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold">#{lote.id}</span>
          <span className="text-xs text-muted-foreground">
            Batch: {lote.batch_identifier}
          </span>
        </div>
      </td>

      {/* Usuário */}
      <td className="p-4">
        <div className="font-semibold text-foreground">
          #{lote.id_usuario}
        </div>
      </td>

      {/* Progresso */}
      <td className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted/50 rounded-full h-2 overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  lote.progresso_percentual === 100 
                    ? "bg-emerald-500" 
                    : lote.progresso_percentual > 0 
                      ? "bg-blue-500" 
                      : "bg-gray-500"
                )}
                style={{ width: `${lote.progresso_percentual}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums w-12 text-right">
              {lote.progresso_percentual.toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {lote.items_received}/{lote.total_items} itens
          </div>
        </div>
      </td>

      {/* Valores */}
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-foreground">
            {formatCurrencyLotes(lote.total_amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            Confirmado: {formatCurrencyLotes(lote.items_confirmed_amount)}
          </div>
          {lote.diferenca > 0 && (
            <div className="text-xs text-amber-400">
              Pendente: {formatCurrencyLotes(lote.diferenca)}
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="p-4">
        <div className="flex flex-col gap-2">
          {getStatusBadge()}
          {getProgressoBadge()}
        </div>
      </td>

      {/* Step */}
      <td className="p-4">
        <div className="max-w-[200px]">
          <span className="text-sm font-mono text-xs truncate block" title={lote.step}>
            {lote.step}
          </span>
        </div>
      </td>

      {/* Data */}
      <td className="p-4">
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateLotes(lote.criado_em)}
        </div>
      </td>

      {/* Ações */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(lote.id);
            }}
            className="h-8 w-8 p-0"
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {lote.precisa_reprocessar && lote.status_deposito === 'processing' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReprocessar(lote.id);
              }}
              disabled={isReprocessando}
              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700"
              title="Reprocessar lote"
            >
              {isReprocessando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ===================================
// COMPONENTE: Modal de Detalhes
// ===================================
function LoteDetailsModal({
  isOpen,
  onClose,
  loteId,
  onReprocessar,
  isReprocessando
}: {
  isOpen: boolean;
  onClose: () => void;
  loteId: number | null;
  onReprocessar: (id: number) => void;
  isReprocessando: boolean;
}) {
  const [detalhes, setDetalhes] = useState<LoteDetalhes | null>(null);
  const [movimentacao, setMovimentacao] = useState<Movimentacao | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && loteId) {
      fetchDetalhes();
    } else {
      setDetalhes(null);
      setMovimentacao(null);
      setTransacoes([]);
    }
  }, [isOpen, loteId]);

  const fetchDetalhes = async () => {
    if (!loteId) return;
    
    setLoading(true);
    try {
      const response: DetalhesLoteResponse = await lotesService.obterDetalhes(loteId);
      if (response.success) {
        setDetalhes(response.deposito);
        setMovimentacao(response.movimentacao);
        setTransacoes(response.transacoes || []);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (!loteId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              detalhes?.status_deposito === 'finished' 
                ? "bg-emerald-500/10" 
                : detalhes?.status_deposito === 'error'
                  ? "bg-red-500/10"
                  : "bg-amber-500/10"
            )}>
              <Package className={cn(
                "h-5 w-5",
                detalhes?.status_deposito === 'finished' 
                  ? "text-emerald-400" 
                  : detalhes?.status_deposito === 'error'
                    ? "text-red-400"
                    : "text-amber-400"
              )} />
            </div>
            <div>
              <DialogTitle className="text-left">
                Lote #{loteId}
              </DialogTitle>
              <DialogDescription className="text-left">
                {detalhes?.batch_identifier || 'Carregando...'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detalhes ? (
          <div className="space-y-6 py-4">
            {/* Informações Principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor Total</Label>
                <p className="text-lg font-bold">{formatCurrencyLotes(detalhes.total_amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor Confirmado</Label>
                <p className="text-lg font-bold text-emerald-400">{formatCurrencyLotes(detalhes.items_confirmed_amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Progresso</Label>
                <p className="text-lg font-bold">{detalhes.progresso_percentual.toFixed(1)}%</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge className={cn(getStatusColor(detalhes.status_deposito))}>
                  {getStatusDepositoLabel(detalhes.status_deposito)}
                </Badge>
              </div>
            </div>

            {/* Progresso */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Progresso do Lote</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-muted/50 rounded-full h-4 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      detalhes.progresso_percentual === 100 
                        ? "bg-emerald-500" 
                        : detalhes.progresso_percentual > 0 
                          ? "bg-blue-500" 
                          : "bg-gray-500"
                    )}
                    style={{ width: `${detalhes.progresso_percentual}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {detalhes.items_received}/{detalhes.total_items} itens
                </span>
              </div>
              {detalhes.items_pendentes > 0 && (
                <p className="text-xs text-amber-400">
                  {detalhes.items_pendentes} itens pendentes
                  {detalhes.proximo_item && ` • Próximo item: ${detalhes.proximo_item}`}
                </p>
              )}
            </div>

            {/* Informações do Depósito */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Informações do Depósito</Label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ID Usuário: </span>
                  <span className="font-mono">{detalhes.id_usuario}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Batch ID: </span>
                  <span className="font-mono">{detalhes.batch_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Step: </span>
                  <span className="font-mono text-xs">{detalhes.step}</span>
                </div>
                {detalhes.pix_operationId && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-muted-foreground">PIX Operation ID: </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs">{detalhes.pix_operationId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(detalhes.pix_operationId!, 'PIX Operation ID')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Itens */}
            {detalhes.historico_itens && detalhes.historico_itens.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <Label className="text-sm font-semibold">Histórico de Itens Confirmados</Label>
                </div>
                <div className="space-y-2">
                  {detalhes.historico_itens.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            Item #{item.sequenceNumber}
                          </Badge>
                          <span className="font-semibold">{formatCurrencyLotes(item.value)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateLotes(item.confirmedAt)}
                        </span>
                      </div>
                      {item.customId && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Custom ID:</span>
                          <span className="font-mono text-xs">{item.customId}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Movimentação */}
            {movimentacao && (
              <Collapsible
                open={expandedSections.movimentacao}
                onOpenChange={() => toggleSection('movimentacao')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                  {expandedSections.movimentacao ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Movimentação
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">ID: </span>
                        <span className="font-mono">{movimentacao.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantia: </span>
                        <span className="font-semibold">{formatCurrency(movimentacao.quantia)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status: </span>
                        <Badge variant="outline" className="text-xs">{movimentacao.status}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Moeda: </span>
                        <span>{movimentacao.moeda}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Criado em: </span>
                        <span className="text-xs">{formatDateLotes(movimentacao.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Atualizado em: </span>
                        <span className="text-xs">{formatDateLotes(movimentacao.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Transações */}
            {transacoes.length > 0 && (
              <Collapsible
                open={expandedSections.transacoes}
                onOpenChange={() => toggleSection('transacoes')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                  {expandedSections.transacoes ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Transações ({transacoes.length})
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {transacoes.map((transacao, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-muted/50 border space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">ID: </span>
                            <span className="font-mono">{transacao.id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo: </span>
                            <span>{transacao.tipo_transacao_bb}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantia Bruta: </span>
                            <span className="font-semibold">{formatCurrencyLotes(transacao.quantia_bruta)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantia Líquida: </span>
                            <span className="font-semibold">{formatCurrencyLotes(transacao.quantia_liquida)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status: </span>
                            <Badge variant="outline" className="text-xs">{transacao.status}</Badge>
                          </div>
                          {transacao.hash && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-muted-foreground">Hash (EndToEnd): </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-xs">{transacao.hash}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(transacao.hash, 'Hash')}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {detalhes?.precisa_reprocessar && detalhes.status_deposito === 'processing' && (
            <Button 
              onClick={() => onReprocessar(loteId)} 
              disabled={isReprocessando}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isReprocessando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reprocessar Lote
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================
// COMPONENTE: Estatísticas de Depósitos Normais
// ===================================
function DepositosNormaisStats({ 
  total, 
  processando, 
  erros,
  aguardandoQrCode,
  aguardandoWebhook,
  loading 
}: { 
  total: number; 
  processando: number; 
  erros: number;
  aguardandoQrCode: number;
  aguardandoWebhook: number;
  loading: boolean;
}) {
  const statCards = [
    {
      label: "Total",
      value: total,
      icon: Wallet,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30"
    },
    {
      label: "Processando",
      value: processando,
      icon: Activity,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30"
    },
    {
      label: "Com Erro",
      value: erros,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30"
    },
    {
      label: "Aguardando QR Code",
      value: aguardandoQrCode,
      icon: Clock,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30"
    },
    {
      label: "Aguardando Webhook",
      value: aguardandoWebhook,
      icon: AlertCircle,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {statCards.map((stat, idx) => (
        <div 
          key={idx}
          className={cn(
            "relative overflow-hidden rounded-xl border p-5 transition-all duration-300",
            "hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5",
            stat.bgColor, stat.borderColor
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p className={cn("text-3xl font-bold mt-2 tabular-nums", stat.color)}>
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-muted/50 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </p>
            </div>
            <div className={cn("p-2.5 rounded-lg", stat.bgColor)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
          </div>
          <div className={cn(
            "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20",
            stat.bgColor.replace('/10', '/40')
          )} />
        </div>
      ))}
    </div>
  );
}

// ===================================
// COMPONENTE: Linha da Lista de Depósitos Normais
// ===================================
function DepositoNormalListItem({ 
  deposito, 
  onViewDetails, 
  onReprocessar,
  isReprocessando
}: { 
  deposito: DepositoNormal;
  onViewDetails: (id: number) => void;
  onReprocessar: (id: number) => void;
  isReprocessando: boolean;
}) {
  const getStatusBadge = () => {
    return (
      <Badge className={cn("gap-1 text-xs", getStatusColor(deposito.status_deposito))}>
        {getStatusDepositoLabel(deposito.status_deposito)}
      </Badge>
    );
  };

  const getSituacaoBadge = () => {
    return (
      <Badge className={cn("gap-1 text-xs", getSituacaoColor(deposito.situacao))}>
        {getSituacaoLabel(deposito.situacao)}
      </Badge>
    );
  };

  return (
    <tr 
      className={cn(
        "group border-b border-border/50 bg-card/30 hover:bg-card/50 transition-colors",
        "cursor-pointer"
      )}
      onClick={() => onViewDetails(deposito.id)}
    >
      {/* ID */}
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold">#{deposito.id}</span>
          {deposito.pix_operationId && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={deposito.pix_operationId}>
              {deposito.pix_operationId}
            </span>
          )}
        </div>
      </td>

      {/* Usuário */}
      <td className="p-4">
        <div className="font-semibold text-foreground">
          #{deposito.id_usuario}
        </div>
      </td>

      {/* Valor */}
      <td className="p-4">
        <div className="font-semibold text-foreground">
          {formatCurrency(deposito.quantia)}
        </div>
      </td>

      {/* Status e Situação */}
      <td className="p-4">
        <div className="flex flex-col gap-2">
          {getStatusBadge()}
          {getSituacaoBadge()}
        </div>
      </td>

      {/* Step */}
      <td className="p-4">
        <div className="max-w-[200px]">
          <span className="text-sm font-mono text-xs truncate block" title={deposito.step}>
            {getStepLabel(deposito.step)}
          </span>
        </div>
      </td>

      {/* Data */}
      <td className="p-4">
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(deposito.criado_em)}
        </div>
      </td>

      {/* Ações */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(deposito.id);
            }}
            className="h-8 w-8 p-0"
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {deposito.precisa_reprocessar && deposito.status_deposito === 'processing' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReprocessar(deposito.id);
              }}
              disabled={isReprocessando}
              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700"
              title="Reprocessar depósito"
            >
              {isReprocessando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ===================================
// COMPONENTE: Modal de Detalhes de Depósito Normal
// ===================================
function DepositoNormalDetailsModal({
  isOpen,
  onClose,
  depositoId,
  onReprocessar,
  isReprocessando
}: {
  isOpen: boolean;
  onClose: () => void;
  depositoId: number | null;
  onReprocessar: (id: number) => void;
  isReprocessando: boolean;
}) {
  const [detalhes, setDetalhes] = useState<DepositoNormalDetalhes | null>(null);
  const [movimentacao, setMovimentacao] = useState<MovimentacaoDeposito | null>(null);
  const [transacao, setTransacao] = useState<TransacaoDeposito | null>(null);
  const [webhookPayload, setWebhookPayload] = useState<WebhookPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && depositoId) {
      fetchDetalhes();
    } else {
      setDetalhes(null);
      setMovimentacao(null);
      setTransacao(null);
      setWebhookPayload(null);
    }
  }, [isOpen, depositoId]);

  const fetchDetalhes = async () => {
    if (!depositoId) return;
    
    setLoading(true);
    try {
      const response: DetalhesDepositoNormalResponse = await depositosNormaisService.obterDetalhes(depositoId);
      if (response.success) {
        setDetalhes(response.deposito);
        setMovimentacao(response.movimentacao);
        setTransacao(response.transacao);
        setWebhookPayload(response.webhook_payload || null);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (!depositoId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              detalhes?.status_deposito === 'finished' 
                ? "bg-emerald-500/10" 
                : detalhes?.status_deposito === 'error'
                  ? "bg-red-500/10"
                  : "bg-amber-500/10"
            )}>
              <Wallet className={cn(
                "h-5 w-5",
                detalhes?.status_deposito === 'finished' 
                  ? "text-emerald-400" 
                  : detalhes?.status_deposito === 'error'
                    ? "text-red-400"
                    : "text-amber-400"
              )} />
            </div>
            <div>
              <DialogTitle className="text-left">
                Depósito #{depositoId}
              </DialogTitle>
              <DialogDescription className="text-left">
                {detalhes?.pix_operationId || 'Carregando...'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detalhes ? (
          <div className="space-y-6 py-4">
            {/* Informações Principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <p className="text-lg font-bold">{formatCurrency(detalhes.quantia)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge className={cn(getStatusColor(detalhes.status_deposito))}>
                  {getStatusDepositoLabel(detalhes.status_deposito)}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Situação</Label>
                <Badge className={cn(getSituacaoColor(detalhes.situacao))}>
                  {getSituacaoLabel(detalhes.situacao)}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Step</Label>
                <p className="text-sm font-mono">{getStepLabel(detalhes.step)}</p>
              </div>
            </div>

            {/* Informações do Depósito */}
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Informações do Depósito</Label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">ID Usuário: </span>
                  <span className="font-mono">{detalhes.id_usuario}</span>
                </div>
                {detalhes.pix_operationId && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-muted-foreground">PIX Operation ID: </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs">{detalhes.pix_operationId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(detalhes.pix_operationId!, 'PIX Operation ID')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {detalhes.pix_transactionId && (
                  <div>
                    <span className="text-muted-foreground">PIX Transaction ID: </span>
                    <span className="font-mono text-xs">{detalhes.pix_transactionId}</span>
                  </div>
                )}
                {detalhes.pix_payment_endtoend && (
                  <div>
                    <span className="text-muted-foreground">PIX Payment EndToEnd: </span>
                    <span className="font-mono text-xs">{detalhes.pix_payment_endtoend}</span>
                  </div>
                )}
                {detalhes.acao_reprocessamento && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-muted-foreground">Ação de Reprocessamento: </span>
                    <Badge variant="outline" className="ml-2">
                      {detalhes.acao_reprocessamento === 'gerar_qr_code_e_pagar' ? 'Gerar QR Code e Pagar' : 'Verificar Webhook Pendente'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Movimentação */}
            {movimentacao && (
              <Collapsible
                open={expandedSections.movimentacao}
                onOpenChange={() => toggleSection('movimentacao')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                  {expandedSections.movimentacao ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Movimentação
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">ID: </span>
                        <span className="font-mono">{movimentacao.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantia: </span>
                        <span className="font-semibold">{formatCurrency(movimentacao.quantia)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status: </span>
                        <Badge variant="outline" className="text-xs">{movimentacao.status}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Moeda: </span>
                        <span>{movimentacao.moeda}</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Transação */}
            {transacao && (
              <Collapsible
                open={expandedSections.transacao}
                onOpenChange={() => toggleSection('transacao')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                  {expandedSections.transacao ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Transação
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">ID: </span>
                        <span className="font-mono">{transacao.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo: </span>
                        <span>{transacao.tipo_transacao_bb}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantia Bruta: </span>
                        <span className="font-semibold">{formatCurrency(transacao.quantia_bruta)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantia Líquida: </span>
                        <span className="font-semibold">{formatCurrency(transacao.quantia_liquida)}</span>
                      </div>
                      {transacao.hash && (
                        <div className="col-span-2 md:col-span-4">
                          <span className="text-muted-foreground">Hash (EndToEnd): </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs">{transacao.hash}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(transacao.hash, 'Hash')}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Webhook Payload */}
            {webhookPayload && (
              <Collapsible
                open={expandedSections.webhook}
                onOpenChange={() => toggleSection('webhook')}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                  {expandedSections.webhook ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Webhook Payload Original
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50 border">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(webhookPayload, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {detalhes?.precisa_reprocessar && detalhes.status_deposito === 'processing' && (
            <Button 
              onClick={() => onReprocessar(depositoId)} 
              disabled={isReprocessando}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isReprocessando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reprocessar Depósito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================
// COMPONENTE PRINCIPAL
// ===================================
export default function AuditoriaDepositosPage() {
  const [activeTab, setActiveTab] = useState<'lotes' | 'depositos-normais'>('lotes');
  
  // Estados para Lotes
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [errorLotes, setErrorLotes] = useState<string | null>(null);
  const [totalLotes, setTotalLotes] = useState(0);
  const [currentPageLotes, setCurrentPageLotes] = useState(1);
  const [limitLotes] = useState(20);
  
  // Filtros para Lotes
  const [idUsuarioFilterLotes, setIdUsuarioFilterLotes] = useState<string>('');
  const [statusFilterLotes, setStatusFilterLotes] = useState<string>('');
  const [progressoFilterLotes, setProgressoFilterLotes] = useState<string>('');
  const [stepFilterLotes, setStepFilterLotes] = useState<string>('');
  
  // Modais para Lotes
  const [selectedLoteId, setSelectedLoteId] = useState<number | null>(null);
  const [isDetailsModalOpenLotes, setIsDetailsModalOpenLotes] = useState(false);
  const [reprocessandoIdLotes, setReprocessandoIdLotes] = useState<number | null>(null);

  // Estados para Depósitos Normais
  const [depositosNormais, setDepositosNormais] = useState<DepositoNormal[]>([]);
  const [loadingDepositos, setLoadingDepositos] = useState(false);
  const [errorDepositos, setErrorDepositos] = useState<string | null>(null);
  const [totalDepositos, setTotalDepositos] = useState(0);
  const [currentPageDepositos, setCurrentPageDepositos] = useState(1);
  const [limitDepositos] = useState(20);
  
  // Filtros para Depósitos Normais
  const [idUsuarioFilterDepositos, setIdUsuarioFilterDepositos] = useState<string>('');
  const [statusFilterDepositos, setStatusFilterDepositos] = useState<string>('');
  const [stepFilterDepositos, setStepFilterDepositos] = useState<string>('');
  
  // Modais para Depósitos Normais
  const [selectedDepositoId, setSelectedDepositoId] = useState<number | null>(null);
  const [isDetailsModalOpenDepositos, setIsDetailsModalOpenDepositos] = useState(false);
  const [reprocessandoIdDepositos, setReprocessandoIdDepositos] = useState<number | null>(null);

  // Calcular estatísticas de Lotes
  const statsLotes = {
    total: totalLotes,
    processando: lotes.filter(l => l.status_deposito === 'processing').length,
    finalizados: lotes.filter(l => l.status_deposito === 'finished').length,
    erros: lotes.filter(l => l.status_deposito === 'error').length,
    pendentes: lotes.filter(l => l.status_progresso === 'pendente').length,
    emAndamento: lotes.filter(l => l.status_progresso === 'em_andamento').length,
    completos: lotes.filter(l => l.status_progresso === 'completo').length,
  };

  // Calcular estatísticas de Depósitos Normais
  const statsDepositos = {
    total: totalDepositos,
    processando: depositosNormais.filter(d => d.status_deposito === 'processing').length,
    erros: depositosNormais.filter(d => d.status_deposito === 'error').length,
    aguardandoQrCode: depositosNormais.filter(d => d.situacao === 'aguardando_geracao_qr_code').length,
    aguardandoWebhook: depositosNormais.filter(d => d.situacao === 'aguardando_webhook_brasil_bitcoin').length,
  };

  // Buscar lotes
  const fetchLotes = useCallback(async () => {
    setLoadingLotes(true);
    setErrorLotes(null);

    try {
      const params: ListaLotesParams = {
        limit: limitLotes,
        offset: (currentPageLotes - 1) * limitLotes,
      };

      if (idUsuarioFilterLotes.trim()) {
        const id = parseInt(idUsuarioFilterLotes.trim());
        if (!isNaN(id)) {
          params.id_usuario = id;
        }
      }
      if (statusFilterLotes) {
        params.status = statusFilterLotes as 'processing' | 'finished' | 'error';
      }
      if (progressoFilterLotes) {
        params.progresso = progressoFilterLotes as 'pendente' | 'em_andamento' | 'completo';
      }
      if (stepFilterLotes.trim()) {
        params.step = stepFilterLotes.trim();
      }

      const response = await lotesService.listarLotes(params);
      
      if (response.success) {
        setLotes(response.lotes);
        setTotalLotes(response.total);
      } else {
        throw new Error('Erro ao carregar lotes');
      }
    } catch (error: any) {
      console.error('[LOTES] Erro ao buscar lotes:', error);
      setErrorLotes(error.message || 'Erro ao carregar lotes');
      toast.error('Erro ao carregar lotes', {
        description: error.message
      });
    } finally {
      setLoadingLotes(false);
    }
  }, [currentPageLotes, limitLotes, idUsuarioFilterLotes, statusFilterLotes, progressoFilterLotes, stepFilterLotes]);

  // Buscar depósitos normais
  const fetchDepositosNormais = useCallback(async () => {
    setLoadingDepositos(true);
    setErrorDepositos(null);

    try {
      const params: ListaDepositosNormaisParams = {
        limit: limitDepositos,
        offset: (currentPageDepositos - 1) * limitDepositos,
      };

      if (idUsuarioFilterDepositos.trim()) {
        const id = parseInt(idUsuarioFilterDepositos.trim());
        if (!isNaN(id)) {
          params.id_usuario = id;
        }
      }
      if (statusFilterDepositos) {
        params.status = statusFilterDepositos as 'processing' | 'error';
      }
      if (stepFilterDepositos) {
        params.step = stepFilterDepositos as '01newdeposit' | '02internal_transfer_b8cash';
      }

      const response = await depositosNormaisService.listarDepositosNormais(params);
      
      if (response.success) {
        setDepositosNormais(response.depositos);
        setTotalDepositos(response.total);
      } else {
        throw new Error('Erro ao carregar depósitos normais');
      }
    } catch (error: any) {
      console.error('[DEPOSITOS-NORMAIS] Erro ao buscar depósitos:', error);
      setErrorDepositos(error.message || 'Erro ao carregar depósitos normais');
      toast.error('Erro ao carregar depósitos normais', {
        description: error.message
      });
    } finally {
      setLoadingDepositos(false);
    }
  }, [currentPageDepositos, limitDepositos, idUsuarioFilterDepositos, statusFilterDepositos, stepFilterDepositos]);

  // Ver detalhes de lote
  const handleViewDetailsLote = (id: number) => {
    setSelectedLoteId(id);
    setIsDetailsModalOpenLotes(true);
  };

  // Ver detalhes de depósito normal
  const handleViewDetailsDeposito = (id: number) => {
    setSelectedDepositoId(id);
    setIsDetailsModalOpenDepositos(true);
  };

  // Reprocessar lote
  const handleReprocessarLote = async (id: number) => {
    setReprocessandoIdLotes(id);

    try {
      const result = await lotesService.reprocessarLote(id);
      
      if (result.success) {
        if (result.item_processado) {
          toast.success('Item processado com sucesso!', {
            description: `Item ${result.item_processado} processado. ${result.proximo_item ? `Próximo: ${result.proximo_item}` : 'Lote completo!'}`
          });
        } else {
          toast.info(result.mensagem);
        }
        setIsDetailsModalOpenLotes(false);
        fetchLotes();
      } else {
        throw new Error(result.mensagem);
      }
    } catch (error: any) {
      toast.error('Erro ao reprocessar lote', {
        description: error.message
      });
    } finally {
      setReprocessandoIdLotes(null);
    }
  };

  // Reprocessar depósito normal
  const handleReprocessarDeposito = async (id: number) => {
    setReprocessandoIdDepositos(id);

    try {
      const result = await depositosNormaisService.reprocessarDeposito(id);
      
      if (result.success) {
        toast.success('Depósito reprocessado com sucesso!', {
          description: result.mensagem
        });
        setIsDetailsModalOpenDepositos(false);
        fetchDepositosNormais();
      } else {
        throw new Error(result.mensagem);
      }
    } catch (error: any) {
      toast.error('Erro ao reprocessar depósito', {
        description: error.message
      });
    } finally {
      setReprocessandoIdDepositos(null);
    }
  };

  // Efeitos para buscar dados
  useEffect(() => {
    if (activeTab === 'lotes') {
      fetchLotes();
    } else {
      fetchDepositosNormais();
    }
  }, [activeTab, fetchLotes, fetchDepositosNormais]);

  const limparFiltrosLotes = () => {
    setIdUsuarioFilterLotes('');
    setStatusFilterLotes('');
    setProgressoFilterLotes('');
    setStepFilterLotes('');
    setCurrentPageLotes(1);
  };

  const limparFiltrosDepositos = () => {
    setIdUsuarioFilterDepositos('');
    setStatusFilterDepositos('');
    setStepFilterDepositos('');
    setCurrentPageDepositos(1);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/30">
              <Package className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Auditoria de Depósitos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie e monitore depósitos em lote e depósitos normais
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'lotes' | 'depositos-normais')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="lotes" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Lotes
            </TabsTrigger>
            <TabsTrigger value="depositos-normais" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Depósitos Normais
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lotes */}
          <TabsContent value="lotes" className="space-y-6 mt-6">
            {/* Estatísticas de Lotes */}
            <LotesStats 
              total={statsLotes.total} 
              processando={statsLotes.processando} 
              finalizados={statsLotes.finalizados}
              erros={statsLotes.erros}
              pendentes={statsLotes.pendentes}
              emAndamento={statsLotes.emAndamento}
              completos={statsLotes.completos}
              loading={loadingLotes}
            />

            {/* Filtros de Lotes */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  {/* ID Usuário */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">ID Usuário</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1265"
                      value={idUsuarioFilterLotes}
                      onChange={(e) => setIdUsuarioFilterLotes(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select 
                      value={statusFilterLotes || "all"} 
                      onValueChange={(value) => setStatusFilterLotes(value === "all" ? '' : value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="finished">Finalizado</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Progresso */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Progresso</Label>
                    <Select 
                      value={progressoFilterLotes || "all"} 
                      onValueChange={(value) => setProgressoFilterLotes(value === "all" ? '' : value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="completo">Completo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Step</Label>
                    <Input
                      placeholder="Ex: 02batch_processing"
                      value={stepFilterLotes}
                      onChange={(e) => setStepFilterLotes(e.target.value)}
                      className="w-[200px] font-mono text-xs"
                    />
                  </div>

                  {/* Botão Atualizar */}
                  <Button
                    onClick={fetchLotes}
                    disabled={loadingLotes}
                    variant="outline"
                    className="gap-2"
                  >
                    {loadingLotes ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar
                  </Button>

                  {/* Limpar Filtros */}
                  {(idUsuarioFilterLotes || statusFilterLotes || progressoFilterLotes || stepFilterLotes) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparFiltrosLotes}
                      className="text-muted-foreground"
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Lotes */}
            {loadingLotes && lotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Carregando lotes...</p>
              </div>
            ) : errorLotes ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <p className="mt-4 text-sm text-red-400">{errorLotes}</p>
                <Button variant="outline" onClick={fetchLotes} className="mt-4 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            ) : lotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhum lote encontrado com os filtros selecionados
                </p>
              </div>
            ) : (
              <>
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            ID / Batch
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Usuário
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Progresso
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Valores
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Step
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Criado em
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotes.map((lote) => (
                          <LoteListItem
                            key={lote.id}
                            lote={lote}
                            onViewDetails={handleViewDetailsLote}
                            onReprocessar={handleReprocessarLote}
                            isReprocessando={reprocessandoIdLotes === lote.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Paginação */}
                {totalLotes > limitLotes && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPageLotes - 1) * limitLotes) + 1} - {Math.min(currentPageLotes * limitLotes, totalLotes)} de {totalLotes} lotes
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageLotes === 1}
                        onClick={() => setCurrentPageLotes(p => p - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1 px-4">
                        <span className="text-sm text-muted-foreground">
                          Página {currentPageLotes} de {Math.ceil(totalLotes / limitLotes)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageLotes * limitLotes >= totalLotes}
                        onClick={() => setCurrentPageLotes(p => p + 1)}
                        className="gap-1"
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tab: Depósitos Normais */}
          <TabsContent value="depositos-normais" className="space-y-6 mt-6">
            {/* Estatísticas de Depósitos Normais */}
            <DepositosNormaisStats 
              total={statsDepositos.total} 
              processando={statsDepositos.processando} 
              erros={statsDepositos.erros}
              aguardandoQrCode={statsDepositos.aguardandoQrCode}
              aguardandoWebhook={statsDepositos.aguardandoWebhook}
              loading={loadingDepositos}
            />

            {/* Filtros de Depósitos Normais */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  {/* ID Usuário */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">ID Usuário</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1265"
                      value={idUsuarioFilterDepositos}
                      onChange={(e) => setIdUsuarioFilterDepositos(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select 
                      value={statusFilterDepositos || "all"} 
                      onValueChange={(value) => setStatusFilterDepositos(value === "all" ? '' : value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Step</Label>
                    <Select 
                      value={stepFilterDepositos || "all"} 
                      onValueChange={(value) => setStepFilterDepositos(value === "all" ? '' : value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="01newdeposit">Novo Depósito</SelectItem>
                        <SelectItem value="02internal_transfer_b8cash">Transferência Interna B8Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Botão Atualizar */}
                  <Button
                    onClick={fetchDepositosNormais}
                    disabled={loadingDepositos}
                    variant="outline"
                    className="gap-2"
                  >
                    {loadingDepositos ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar
                  </Button>

                  {/* Limpar Filtros */}
                  {(idUsuarioFilterDepositos || statusFilterDepositos || stepFilterDepositos) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={limparFiltrosDepositos}
                      className="text-muted-foreground"
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Depósitos Normais */}
            {loadingDepositos && depositosNormais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Carregando depósitos normais...</p>
              </div>
            ) : errorDepositos ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <p className="mt-4 text-sm text-red-400">{errorDepositos}</p>
                <Button variant="outline" onClick={fetchDepositosNormais} className="mt-4 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            ) : depositosNormais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhum depósito normal encontrado com os filtros selecionados
                </p>
              </div>
            ) : (
              <>
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            ID / EndToEnd
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Usuário
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Valor
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Status / Situação
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Step
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Criado em
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {depositosNormais.map((deposito) => (
                          <DepositoNormalListItem
                            key={deposito.id}
                            deposito={deposito}
                            onViewDetails={handleViewDetailsDeposito}
                            onReprocessar={handleReprocessarDeposito}
                            isReprocessando={reprocessandoIdDepositos === deposito.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Paginação */}
                {totalDepositos > limitDepositos && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPageDepositos - 1) * limitDepositos) + 1} - {Math.min(currentPageDepositos * limitDepositos, totalDepositos)} de {totalDepositos} depósitos
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageDepositos === 1}
                        onClick={() => setCurrentPageDepositos(p => p - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1 px-4">
                        <span className="text-sm text-muted-foreground">
                          Página {currentPageDepositos} de {Math.ceil(totalDepositos / limitDepositos)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageDepositos * limitDepositos >= totalDepositos}
                        onClick={() => setCurrentPageDepositos(p => p + 1)}
                        className="gap-1"
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Detalhes de Lotes */}
      <LoteDetailsModal
        isOpen={isDetailsModalOpenLotes}
        onClose={() => {
          setIsDetailsModalOpenLotes(false);
          setSelectedLoteId(null);
        }}
        loteId={selectedLoteId}
        onReprocessar={handleReprocessarLote}
        isReprocessando={reprocessandoIdLotes === selectedLoteId}
      />

      {/* Modal de Detalhes de Depósitos Normais */}
      <DepositoNormalDetailsModal
        isOpen={isDetailsModalOpenDepositos}
        onClose={() => {
          setIsDetailsModalOpenDepositos(false);
          setSelectedDepositoId(null);
        }}
        depositoId={selectedDepositoId}
        onReprocessar={handleReprocessarDeposito}
        isReprocessando={reprocessandoIdDepositos === selectedDepositoId}
      />
    </div>
  );
}
