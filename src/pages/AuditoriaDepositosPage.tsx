import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Loader2, Search, CheckCircle, XCircle, AlertCircle, 
  Copy, ChevronDown, ChevronUp, Info, FileText, RefreshCw, Filter,
  AlertTriangle, CalendarIcon, RotateCcw, Eye, ChevronLeft, ChevronRight,
  Package, TrendingUp, Activity, Clock
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
  formatCurrency,
  formatDate,
  getStatusDepositoLabel,
  getStatusProgressoLabel,
  getStatusColor
} from "@/services/lotes.service";

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
            {formatCurrency(lote.total_amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            Confirmado: {formatCurrency(lote.items_confirmed_amount)}
          </div>
          {lote.diferenca > 0 && (
            <div className="text-xs text-amber-400">
              Pendente: {formatCurrency(lote.diferenca)}
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
          {formatDate(lote.criado_em)}
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
                <p className="text-lg font-bold">{formatCurrency(detalhes.total_amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor Confirmado</Label>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(detalhes.items_confirmed_amount)}</p>
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
                          <span className="font-semibold">{formatCurrency(item.value)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.confirmedAt)}
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
                        <span className="text-xs">{formatDate(movimentacao.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Atualizado em: </span>
                        <span className="text-xs">{formatDate(movimentacao.updated_at)}</span>
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
                            <span className="font-semibold">{formatCurrency(transacao.quantia_bruta)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quantia Líquida: </span>
                            <span className="font-semibold">{formatCurrency(transacao.quantia_liquida)}</span>
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
// COMPONENTE PRINCIPAL
// ===================================
export default function AuditoriaDepositosPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);
  
  // Filtros
  const [idUsuarioFilter, setIdUsuarioFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [progressoFilter, setProgressoFilter] = useState<string>('');
  const [stepFilter, setStepFilter] = useState<string>('');
  
  // Modais
  const [selectedLoteId, setSelectedLoteId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [reprocessandoId, setReprocessandoId] = useState<number | null>(null);

  // Calcular estatísticas
  const stats = {
    total: total,
    processando: lotes.filter(l => l.status_deposito === 'processing').length,
    finalizados: lotes.filter(l => l.status_deposito === 'finished').length,
    erros: lotes.filter(l => l.status_deposito === 'error').length,
    pendentes: lotes.filter(l => l.status_progresso === 'pendente').length,
    emAndamento: lotes.filter(l => l.status_progresso === 'em_andamento').length,
    completos: lotes.filter(l => l.status_progresso === 'completo').length,
  };

  // Buscar lotes
  const fetchLotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: ListaLotesParams = {
        limit,
        offset: (currentPage - 1) * limit,
      };

      if (idUsuarioFilter.trim()) {
        const id = parseInt(idUsuarioFilter.trim());
        if (!isNaN(id)) {
          params.id_usuario = id;
        }
      }
      if (statusFilter) {
        params.status = statusFilter as 'processing' | 'finished' | 'error';
      }
      if (progressoFilter) {
        params.progresso = progressoFilter as 'pendente' | 'em_andamento' | 'completo';
      }
      if (stepFilter.trim()) {
        params.step = stepFilter.trim();
      }

      const response = await lotesService.listarLotes(params);
      
      if (response.success) {
        setLotes(response.lotes);
        setTotal(response.total);
      } else {
        throw new Error('Erro ao carregar lotes');
      }
    } catch (error: any) {
      console.error('[LOTES] Erro ao buscar lotes:', error);
      setError(error.message || 'Erro ao carregar lotes');
      toast.error('Erro ao carregar lotes', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, idUsuarioFilter, statusFilter, progressoFilter, stepFilter]);

  // Ver detalhes
  const handleViewDetails = (id: number) => {
    setSelectedLoteId(id);
    setIsDetailsModalOpen(true);
  };

  // Reprocessar lote
  const handleReprocessar = async (id: number) => {
    setReprocessandoId(id);

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
        setIsDetailsModalOpen(false);
        fetchLotes();
      } else {
        throw new Error(result.mensagem);
      }
    } catch (error: any) {
      toast.error('Erro ao reprocessar lote', {
        description: error.message
      });
    } finally {
      setReprocessandoId(null);
    }
  };

  // Efeito para buscar lotes
  useEffect(() => {
    fetchLotes();
  }, [fetchLotes]);

  const limparFiltros = () => {
    setIdUsuarioFilter('');
    setStatusFilter('');
    setProgressoFilter('');
    setStepFilter('');
    setCurrentPage(1);
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
                Monitoramento de Lotes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie e monitore depósitos processados em lote
              </p>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <LotesStats 
          total={stats.total} 
          processando={stats.processando} 
          finalizados={stats.finalizados}
          erros={stats.erros}
          pendentes={stats.pendentes}
          emAndamento={stats.emAndamento}
          completos={stats.completos}
          loading={loading}
        />

        {/* Filtros */}
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
                  value={idUsuarioFilter}
                  onChange={(e) => setIdUsuarioFilter(e.target.value)}
                  className="w-[150px]"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select 
                  value={statusFilter || "all"} 
                  onValueChange={(value) => setStatusFilter(value === "all" ? '' : value)}
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
                  value={progressoFilter || "all"} 
                  onValueChange={(value) => setProgressoFilter(value === "all" ? '' : value)}
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
                  value={stepFilter}
                  onChange={(e) => setStepFilter(e.target.value)}
                  className="w-[200px] font-mono text-xs"
                />
              </div>

              {/* Botão Atualizar */}
              <Button
                onClick={fetchLotes}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </Button>

              {/* Limpar Filtros */}
              {(idUsuarioFilter || statusFilter || progressoFilter || stepFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltros}
                  className="text-muted-foreground"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Lotes */}
        {loading && lotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Carregando lotes...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="mt-4 text-sm text-red-400">{error}</p>
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
                        onViewDetails={handleViewDetails}
                        onReprocessar={handleReprocessar}
                        isReprocessando={reprocessandoId === lote.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Paginação */}
            {total > limit && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, total)} de {total} lotes
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1 px-4">
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {Math.ceil(total / limit)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage * limit >= total}
                    onClick={() => setCurrentPage(p => p + 1)}
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
      </div>

      {/* Modal de Detalhes */}
      <LoteDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedLoteId(null);
        }}
        loteId={selectedLoteId}
        onReprocessar={handleReprocessar}
        isReprocessando={reprocessandoId === selectedLoteId}
      />
    </div>
  );
}
