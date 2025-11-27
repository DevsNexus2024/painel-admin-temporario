import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  Loader2, Search, FileSearch, CheckCircle, XCircle, AlertCircle, Clock, 
  Copy, ChevronDown, ChevronUp, Info, FileText, RefreshCw, Filter,
  AlertTriangle, Zap, CalendarIcon, RotateCcw, Eye, ChevronLeft, ChevronRight,
  Ban, Repeat, TrendingDown, Activity
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { verificarDepositos, type ResultadoAuditoria, type AuditoriaDepositoResponse } from "@/services/auditoria-depositos";
import { 
  pixAuditService, 
  type PixFailure, 
  type PixFailureDetails,
  type ListFailuresParams,
  formatCurrency,
  formatDate,
  getOperationTypeLabel,
  getStatusLabel,
  getRetryErrorMessage
} from "@/services/pix-audit.service";

// ===================================
// COMPONENTE: Estatísticas de Falhas
// ===================================
function FailureStats({ 
  total, 
  retryable, 
  blocked, 
  loading 
}: { 
  total: number; 
  retryable: number; 
  blocked: number;
  loading: boolean;
}) {
  const statCards = [
    {
      label: "Total de Falhas",
      value: total,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30"
    },
    {
      label: "Retentáveis",
      value: retryable,
      icon: RefreshCw,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30"
    },
    {
      label: "Bloqueados",
      value: blocked,
      icon: Ban,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30"
    },
    {
      label: "Taxa de Falha",
      value: total > 0 ? `${((blocked / total) * 100).toFixed(1)}%` : "0%",
      icon: TrendingDown,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/30"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          {/* Decorative gradient */}
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
// COMPONENTE: Linha da Lista de Falhas
// ===================================
function FailureListItem({ 
  failure, 
  onViewDetails, 
  onRetry,
  isRetrying
}: { 
  failure: PixFailure;
  onViewDetails: (id: string) => void;
  onRetry: (id: string) => void;
  isRetrying: boolean;
}) {
  const canRetry = failure._retryInfo?.canRetry;
  const isBlocked = failure._retryInfo?.isBlocked;
  
  const getStatusBadge = () => {
    if (isBlocked) {
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 gap-1 text-xs">
          <Ban className="h-3 w-3" />
          Bloqueado
        </Badge>
      );
    }
    if (canRetry) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 gap-1 text-xs">
          <CheckCircle className="h-3 w-3" />
          Retentável
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 gap-1 text-xs">
        <XCircle className="h-3 w-3" />
        Falhou
      </Badge>
    );
  };

  const getStatusIcon = () => {
    if (isBlocked) {
      return <Ban className="h-4 w-4 text-amber-400" />;
    }
    if (canRetry) {
      return <RefreshCw className="h-4 w-4 text-emerald-400" />;
    }
    return <AlertTriangle className="h-4 w-4 text-red-400" />;
  };

  return (
    <tr 
      className={cn(
        "group border-b border-border/50 bg-card/30 hover:bg-card/50 transition-colors",
        "cursor-pointer",
        isBlocked ? "hover:bg-amber-500/5" : canRetry ? "hover:bg-emerald-500/5" : "hover:bg-red-500/5"
      )}
      onClick={() => onViewDetails(failure.id)}
    >
      {/* Status Icon */}
      <td className="p-4 w-12">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg",
          isBlocked ? "bg-amber-500/10" : canRetry ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          {getStatusIcon()}
        </div>
      </td>

      {/* ID e Tipo */}
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">#{failure.id}</span>
            {getStatusBadge()}
          </div>
          <span className="text-xs text-muted-foreground">
            {getOperationTypeLabel(failure.operationType)}
          </span>
        </div>
      </td>

      {/* Valor */}
      <td className="p-4">
        <div className="font-semibold text-foreground">
          {formatCurrency(failure.pixValue)}
        </div>
      </td>

      {/* Destino */}
      <td className="p-4">
        <div className="flex items-center gap-2 max-w-[200px]">
          <span className="font-mono text-sm truncate">
            {failure.pixKey || failure.referenceId || 'N/A'}
          </span>
          {failure.pixKeyType && (
            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
              {failure.pixKeyType}
            </Badge>
          )}
        </div>
      </td>

      {/* Erro */}
      <td className="p-4">
        <div className="max-w-[250px]">
          <span className="text-sm text-red-400 line-clamp-1" title={failure.errorMessage || failure.errorCode || 'Erro desconhecido'}>
            {failure.errorMessage || failure.errorCode || 'Erro desconhecido'}
          </span>
        </div>
      </td>

      {/* Retries */}
      <td className="p-4">
        {failure._retryInfo ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i < (3 - (failure._retryInfo?.retriesRemaining || 0))
                      ? "bg-red-400"
                      : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {failure._retryInfo.retriesRemaining}/3
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>

      {/* Data */}
      <td className="p-4">
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(failure.createdAt)}
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
              onViewDetails(failure.id);
            }}
            className="h-8 w-8 p-0"
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canRetry && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(failure.id);
              }}
              disabled={isRetrying}
              className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700"
              title="Refazer operação"
            >
              {isRetrying ? (
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
function FailureDetailsModal({
  isOpen,
  onClose,
  failure,
  onRetry,
  isRetrying
}: {
  isOpen: boolean;
  onClose: () => void;
  failure: PixFailureDetails | null;
  onRetry: (id: string) => void;
  isRetrying: boolean;
}) {
  const [qrCode, setQrCode] = useState('');
  
  if (!failure) return null;

  const needsQrCode = failure.tags?.flow === 'brasilcash_pay_qrcode';
  const canRetry = failure.retryInfo?.canRetry;

  const handleRetry = () => {
    if (needsQrCode && !qrCode.trim()) {
      toast.error('QR Code é necessário para refazer esta operação');
      return;
    }
    onRetry(failure.id);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              failure.retryInfo?.isBlocked ? "bg-amber-500/10" : canRetry ? "bg-emerald-500/10" : "bg-red-500/10"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                failure.retryInfo?.isBlocked ? "text-amber-400" : canRetry ? "text-emerald-400" : "text-red-400"
              )} />
            </div>
            <div>
              <DialogTitle className="text-left">
                PIX Falhado #{failure.id}
              </DialogTitle>
              <DialogDescription className="text-left">
                {getOperationTypeLabel(failure.operationType)} • {formatDate(failure.createdAt)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações Principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor</Label>
              <p className="text-lg font-bold">{formatCurrency(failure.pixValue)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Badge className={cn(
                failure.retryInfo?.isBlocked 
                  ? "bg-amber-500/20 text-amber-300" 
                  : canRetry 
                    ? "bg-emerald-500/20 text-emerald-300" 
                    : "bg-red-500/20 text-red-300"
              )}>
                {getStatusLabel(failure.operationStatus)}
              </Badge>
            </div>
          </div>

          {/* Destino */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Destino</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <span className="font-mono text-sm flex-1 truncate">
                {failure.pixKey || failure.referenceId || 'N/A'}
              </span>
              {failure.pixKeyType && (
                <Badge variant="outline" className="text-xs">
                  {failure.pixKeyType}
                </Badge>
              )}
              {failure.pixKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(failure.pixKey!, 'Chave PIX')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* End-to-End ID */}
          {failure.endToEndId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">End-to-End ID</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <span className="font-mono text-xs flex-1 truncate">
                  {failure.endToEndId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(failure.endToEndId!, 'End-to-End ID')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Informações de Retry */}
          <div className="p-4 rounded-lg border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Informações de Retry</Label>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                {canRetry ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span>{canRetry ? 'Pode ser retentado' : 'Não pode ser retentado'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tentativas restantes: </span>
                <span className="font-semibold">{failure.retryInfo?.retriesRemaining || 0}</span>
              </div>
              {failure.retryInfo?.retriedAt && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Último retry: </span>
                  <span>{formatDate(failure.retryInfo.retriedAt)}</span>
                </div>
              )}
            </div>
            {failure.retryInfo?.blockReason && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-xs text-amber-300">{failure.retryInfo.blockReason}</span>
              </div>
            )}
            {failure.retryInfo?.reason && !failure.retryInfo?.blockReason && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs">{failure.retryInfo.reason}</span>
              </div>
            )}
          </div>

          {/* Erro */}
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <Label className="text-sm font-semibold text-red-400">Erro</Label>
            </div>
            {failure.errorCode && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {failure.errorCode}
                </Badge>
              </div>
            )}
            <p className="text-sm">{failure.errorMessage || 'Erro desconhecido'}</p>
          </div>

          {/* Payloads */}
          {(failure.requestPayload || failure.responsePayload) && (
            <div className="space-y-3">
              {failure.requestPayload && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                    <ChevronDown className="h-4 w-4" />
                    Payload da Requisição
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 p-3 rounded-lg bg-muted/50 border text-xs overflow-x-auto">
                      {JSON.stringify(failure.requestPayload, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {failure.responsePayload && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
                    <ChevronDown className="h-4 w-4" />
                    Resposta do Provider
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 p-3 rounded-lg bg-muted/50 border text-xs overflow-x-auto">
                      {JSON.stringify(failure.responsePayload, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* QR Code Input (se necessário) */}
          {needsQrCode && canRetry && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">QR Code PIX *</Label>
              <Textarea
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Cole o QR Code aqui para refazer a operação..."
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Este tipo de operação requer o QR Code original para ser retentada.
              </p>
            </div>
          )}

          {/* User Info */}
          {failure.user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {failure.user.name?.charAt(0) || failure.user.email?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{failure.user.name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">{failure.user.email}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {canRetry && (
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying || (needsQrCode && !qrCode.trim())}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Refazer Operação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================
// COMPONENTE: Modal de Confirmação de Retry
// ===================================
function RetryConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  failure,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  failure: PixFailure | null;
  isLoading: boolean;
}) {
  if (!failure) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <DialogTitle>Confirmar Retry</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Você está prestes a refazer esta operação PIX
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-bold">{formatCurrency(failure.pixValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Destino:</span>
              <span className="font-mono text-sm truncate max-w-[200px]">
                {failure.pixKey || failure.referenceId || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tentativas restantes:</span>
              <span className="font-semibold">
                {(failure._retryInfo?.retriesRemaining || 0) - 1}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              Esta operação será executada novamente com os mesmos parâmetros originais.
              Certifique-se de que há saldo suficiente antes de prosseguir.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Confirmar e Refazer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================
// COMPONENTE PRINCIPAL
// ===================================
export default function AuditoriaDepositosPage() {
  // Estados para PIX Falhados
  const [failures, setFailures] = useState<PixFailure[]>([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [failuresError, setFailuresError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [onlyRetryable, setOnlyRetryable] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('');
  
  // Estados para modais
  const [selectedFailure, setSelectedFailure] = useState<PixFailureDetails | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [failureToRetry, setFailureToRetry] = useState<PixFailure | null>(null);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Estados para Auditoria por EndToEnd (mantidos do original)
  const [endToEnd, setEndToEnd] = useState("");
  const [endToEnds, setEndToEnds] = useState("");
  const [incluirDetalhes, setIncluirDetalhes] = useState(true);
  const [incluirLogs, setIncluirLogs] = useState(false);
  const [salvarAuditoria, setSalvarAuditoria] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoAuditoria[]>([]);
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [expandedEtapas, setExpandedEtapas] = useState<Record<number, Record<string, boolean>>>({});

  // Calcular estatísticas
  const stats = {
    total: pagination?.total || failures.length,
    retryable: failures.filter(f => f._retryInfo?.canRetry).length,
    blocked: failures.filter(f => f._retryInfo?.isBlocked).length
  };

  // Buscar falhas
  const fetchFailures = useCallback(async () => {
    setFailuresLoading(true);
    setFailuresError(null);

    try {
      const params: ListFailuresParams = {
        limit: 20,
        offset: (currentPage - 1) * 20,
        onlyRetryable: onlyRetryable || undefined,
      };

      if (startDate) {
        params.startDate = startDate.toISOString();
      }
      if (endDate) {
        params.endDate = endDate.toISOString();
      }
      if (operationTypeFilter) {
        params.operationType = operationTypeFilter;
      }

      const response = await pixAuditService.listFailures(params);
      
      if (response.success) {
        setFailures(response.data);
        setPagination(response.pagination);
      } else {
        throw new Error('Erro ao carregar falhas');
      }
    } catch (error: any) {
      console.error('[AUDITORIA] Erro ao buscar falhas:', error);
      setFailuresError(error.message || 'Erro ao carregar falhas de PIX');
      toast.error('Erro ao carregar falhas', {
        description: error.message
      });
    } finally {
      setFailuresLoading(false);
    }
  }, [currentPage, onlyRetryable, startDate, endDate, operationTypeFilter]);

  // Buscar detalhes de uma falha
  const handleViewDetails = async (id: string) => {
    try {
      const response = await pixAuditService.getFailureDetails(id);
      setSelectedFailure(response.data);
      setIsDetailsModalOpen(true);
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes', {
        description: error.message
      });
    }
  };

  // Iniciar processo de retry
  const handleRetryClick = (id: string) => {
    const failure = failures.find(f => f.id === id);
    if (failure) {
      setFailureToRetry(failure);
      setIsRetryModalOpen(true);
    }
  };

  // Confirmar retry
  const handleRetryConfirm = async () => {
    if (!failureToRetry) return;

    setIsRetrying(true);
    setRetryingId(failureToRetry.id);

    try {
      const result = await pixAuditService.retryFailure(failureToRetry.id);
      
      if (result.success) {
        toast.success('Operação refeita com sucesso!', {
          description: `Nova transação criada: ${result.new_result?.pix_id || 'N/A'}`
        });
        setIsRetryModalOpen(false);
        setIsDetailsModalOpen(false);
        fetchFailures();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error('Erro ao refazer operação', {
        description: getRetryErrorMessage(error)
      });
    } finally {
      setIsRetrying(false);
      setRetryingId(null);
      setFailureToRetry(null);
    }
  };

  // Retry direto do modal de detalhes
  const handleRetryFromDetails = async (id: string) => {
    setRetryingId(id);
    setIsRetrying(true);

    try {
      const result = await pixAuditService.retryFailure(id);
      
      if (result.success) {
        toast.success('Operação refeita com sucesso!', {
          description: `Nova transação criada: ${result.new_result?.pix_id || 'N/A'}`
        });
        setIsDetailsModalOpen(false);
        fetchFailures();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error('Erro ao refazer operação', {
        description: getRetryErrorMessage(error)
      });
    } finally {
      setIsRetrying(false);
      setRetryingId(null);
    }
  };

  // Efeito para buscar falhas ao mudar filtros
  useEffect(() => {
    fetchFailures();
  }, [fetchFailures]);

  // Handler para verificar depósitos (auditoria por endToEnd)
  const handleVerificar = async () => {
    if (!endToEnd.trim() && !endToEnds.trim()) {
      toast.error("Informe pelo menos um endToEnd");
      return;
    }

    setLoading(true);
    setResultados([]);
    setEstatisticas(null);

    try {
      const request: any = {
        incluir_detalhes: incluirDetalhes,
        incluir_logs: incluirLogs,
        salvar_auditoria: salvarAuditoria,
      };

      if (endToEnds.trim()) {
        const endToEndsArray = endToEnds
          .split(/[,\n]/)
          .map(e => e.trim())
          .filter(e => e.length > 0);
        
        if (endToEndsArray.length > 100) {
          toast.error("Máximo de 100 endToEnds por requisição");
          setLoading(false);
          return;
        }
        
        request.endToEnds = endToEndsArray;
      } else if (endToEnd.trim()) {
        request.endToEnd = endToEnd.trim();
      }

      const response: AuditoriaDepositoResponse = await verificarDepositos(request);

      if (response.sucesso) {
        setResultados(response.resultados || []);
        setEstatisticas(response.estatisticas);
        toast.success(response.mensagem || "Verificação concluída com sucesso!");
      } else {
        throw new Error(response.mensagem || "Erro ao verificar depósitos");
      }
    } catch (error: any) {
      console.error("Erro ao verificar depósitos:", error);
      toast.error("Erro ao verificar depósitos", {
        description: error.message || "Não foi possível verificar os depósitos"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finalizado':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Finalizado</Badge>;
      case 'pendente':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Pendente</Badge>;
      case 'erro':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Erro</Badge>;
      case 'nao_encontrado':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Não Encontrado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEtapaStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">Concluído</Badge>;
      case 'pendente':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 text-xs">Pendente</Badge>;
      case 'erro':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/50 text-xs">Erro</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-red-500/30">
              <Activity className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Auditoria de PIX
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitore falhas e gerencie operações PIX
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="failures" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger 
              value="failures" 
              className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <AlertTriangle className="h-4 w-4" />
              PIX Falhados
            </TabsTrigger>
            <TabsTrigger 
              value="audit" 
              className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <FileSearch className="h-4 w-4" />
              Auditoria por EndToEnd
            </TabsTrigger>
          </TabsList>

          {/* Tab: PIX Falhados */}
          <TabsContent value="failures" className="space-y-6 mt-0">
            {/* Estatísticas */}
            <FailureStats 
              total={stats.total} 
              retryable={stats.retryable} 
              blocked={stats.blocked}
              loading={failuresLoading}
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
                  {/* Data Inicial */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Data Final */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data Final</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Tipo de Operação */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Tipo de Operação</Label>
                    <Select 
                      value={operationTypeFilter || undefined} 
                      onValueChange={(value) => setOperationTypeFilter(value || '')}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFER_CREATE">Transferência</SelectItem>
                        <SelectItem value="CONFIRM">Confirmação</SelectItem>
                        <SelectItem value="QR_CODE">QR Code</SelectItem>
                        <SelectItem value="SEND">Envio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Apenas Retentáveis */}
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="onlyRetryable"
                      checked={onlyRetryable}
                      onCheckedChange={(checked) => {
                        setOnlyRetryable(checked as boolean);
                        setCurrentPage(1);
                      }}
                    />
                    <Label htmlFor="onlyRetryable" className="text-sm cursor-pointer">
                      Apenas retentáveis
                    </Label>
                  </div>

                  {/* Botão Atualizar */}
                  <Button
                    onClick={fetchFailures}
                    disabled={failuresLoading}
                    variant="outline"
                    className="gap-2"
                  >
                    {failuresLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar
                  </Button>

                  {/* Limpar Filtros */}
                  {(startDate || endDate || operationTypeFilter || onlyRetryable) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                        setOperationTypeFilter('');
                        setOnlyRetryable(false);
                        setCurrentPage(1);
                      }}
                      className="text-muted-foreground"
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Falhas */}
            {failuresLoading && failures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Carregando falhas...</p>
              </div>
            ) : failuresError ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <p className="mt-4 text-sm text-red-400">{failuresError}</p>
                <Button variant="outline" onClick={fetchFailures} className="mt-4 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            ) : failures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Nenhuma falha encontrada com os filtros selecionados
                </p>
              </div>
            ) : (
              <>
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12"></th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            ID / Tipo
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Valor
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Destino
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Erro
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Retries
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Data/Hora
                          </th>
                          <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {failures.map((failure) => (
                          <FailureListItem
                            key={failure.id}
                            failure={failure}
                            onViewDetails={handleViewDetails}
                            onRetry={handleRetryClick}
                            isRetrying={retryingId === failure.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Paginação */}
                {pagination && pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, pagination.total)} de {pagination.total} falhas
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
                          Página {pagination.current_page} de {pagination.total_pages}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!pagination.has_more}
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
          </TabsContent>

          {/* Tab: Auditoria por EndToEnd */}
          <TabsContent value="audit" className="space-y-6 mt-0">
            {/* Formulário de Busca */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Verificar Depósito(s)</CardTitle>
                <CardDescription>
                  Informe um ou múltiplos endToEnd IDs para verificar o status dos depósitos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endToEnd">End-to-End ID (Único)</Label>
                    <Input
                      id="endToEnd"
                      placeholder="E12345678901234567890123456789012"
                      value={endToEnd}
                      onChange={(e) => setEndToEnd(e.target.value)}
                      disabled={loading || !!endToEnds}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endToEnds">End-to-End IDs (Múltiplos)</Label>
                    <Textarea
                      id="endToEnds"
                      placeholder="E12345678901234567890123456789012&#10;E98765432109876543210987654321098"
                      value={endToEnds}
                      onChange={(e) => setEndToEnds(e.target.value)}
                      disabled={loading || !!endToEnd}
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo de 100 endToEnds por requisição (um por linha ou separados por vírgula)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="incluirDetalhes"
                      checked={incluirDetalhes}
                      onCheckedChange={(checked) => setIncluirDetalhes(checked as boolean)}
                    />
                    <Label htmlFor="incluirDetalhes" className="cursor-pointer text-sm">
                      Incluir Detalhes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="incluirLogs"
                      checked={incluirLogs}
                      onCheckedChange={(checked) => setIncluirLogs(checked as boolean)}
                    />
                    <Label htmlFor="incluirLogs" className="cursor-pointer text-sm">
                      Incluir Logs
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="salvarAuditoria"
                      checked={salvarAuditoria}
                      onCheckedChange={(checked) => setSalvarAuditoria(checked as boolean)}
                    />
                    <Label htmlFor="salvarAuditoria" className="cursor-pointer text-sm">
                      Salvar Auditoria
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={handleVerificar}
                  disabled={loading || (!endToEnd.trim() && !endToEnds.trim())}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Verificar Depósito(s)
                </Button>
              </CardContent>
            </Card>

            {/* Estatísticas da Auditoria */}
            {estatisticas && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{estatisticas.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                      <div className="text-2xl font-bold text-emerald-400">{estatisticas.finalizados}</div>
                      <div className="text-xs text-muted-foreground">Finalizados</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-500/10">
                      <div className="text-2xl font-bold text-amber-400">{estatisticas.pendentes}</div>
                      <div className="text-xs text-muted-foreground">Pendentes</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-red-500/10">
                      <div className="text-2xl font-bold text-red-400">{estatisticas.com_erro}</div>
                      <div className="text-xs text-muted-foreground">Com Erro</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gray-500/10">
                      <div className="text-2xl font-bold text-gray-400">{estatisticas.nao_encontrados}</div>
                      <div className="text-xs text-muted-foreground">Não Encontrados</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resultados da Auditoria */}
            {resultados.length > 0 && (
              <div className="space-y-4">
                {resultados.map((resultado, index) => (
                  <Card key={index} className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="bg-muted/30 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base font-mono">
                            {resultado.endToEnd}
                          </CardTitle>
                          {getStatusBadge(resultado.status_geral)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(resultado.endToEnd)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* Dados do Depósito */}
                      {resultado.dados_deposito && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm">Dados do Depósito</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">ID Depósito</div>
                              <div className="font-mono">{resultado.dados_deposito.id_deposito}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">ID Usuário</div>
                              <div className="font-mono">{resultado.dados_deposito.id_usuario}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Quantia</div>
                              <div className="font-semibold">R$ {(resultado.dados_deposito.quantia / 100).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Status</div>
                              <div>{resultado.dados_deposito.status_deposito}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Etapa Atual</div>
                              <div className="font-mono text-xs">{resultado.dados_deposito.step}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Criado em</div>
                              <div className="text-xs">{new Date(resultado.dados_deposito.created_at).toLocaleString('pt-BR')}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Etapas */}
                      {resultado.etapas && Object.keys(resultado.etapas).length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            Etapas de Processamento
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(resultado.etapas).map(([etapa, dados]) => {
                              const hasDetalhes = dados.detalhes && Object.keys(dados.detalhes).length > 0;
                              const hasLogs = dados.logs && dados.logs.length > 0;
                              const isExpanded = expandedEtapas[index]?.[etapa] || false;
                              const toggleExpanded = () => {
                                setExpandedEtapas(prev => ({
                                  ...prev,
                                  [index]: {
                                    ...prev[index],
                                    [etapa]: !isExpanded
                                  }
                                }));
                              };

                              return (
                                <div key={etapa} className="border rounded-lg bg-muted/20 overflow-hidden">
                                  <Collapsible
                                    open={isExpanded}
                                    onOpenChange={toggleExpanded}
                                  >
                                    <CollapsibleTrigger className="w-full" disabled={!hasDetalhes && !hasLogs && !dados.erro}>
                                      <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3">
                                          {hasDetalhes || hasLogs || dados.erro ? (
                                            isExpanded ? (
                                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )
                                          ) : <div className="w-4" />}
                                          <div className="font-mono text-xs font-semibold">{etapa}</div>
                                          {getEtapaStatusBadge(dados.status)}
                                        </div>
                                        {dados.timestamp && (
                                          <div className="text-[10px] text-muted-foreground">
                                            {new Date(dados.timestamp).toLocaleString('pt-BR')}
                                          </div>
                                        )}
                                      </div>
                                    </CollapsibleTrigger>
                                    
                                    {(hasDetalhes || hasLogs || dados.erro) && (
                                      <CollapsibleContent>
                                        <div className="px-3 pb-3 space-y-3 border-t bg-muted/10">
                                          {hasDetalhes && (
                                            <div className="pt-3">
                                              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-blue-400">
                                                <Info className="h-3 w-3" />
                                                Detalhes
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-background/50 rounded p-2">
                                                {Object.entries(dados.detalhes).map(([key, value]) => (
                                                  <div key={key} className="flex gap-2">
                                                    <span className="text-muted-foreground font-medium capitalize">
                                                      {key.replace(/_/g, ' ')}:
                                                    </span>
                                                    <span className="font-mono text-[10px]">
                                                      {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {hasLogs && (
                                            <div>
                                              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-violet-400">
                                                <FileText className="h-3 w-3" />
                                                Logs ({dados.logs.length})
                                              </div>
                                              <div className="space-y-1 max-h-60 overflow-y-auto">
                                                {dados.logs.map((log, logIdx) => (
                                                  <div key={logIdx} className="text-xs bg-background/50 rounded p-2 border border-border/50">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                      <div className="font-mono text-[10px] text-muted-foreground">
                                                        ID: {log.id}
                                                      </div>
                                                      <div className="text-[10px] text-muted-foreground">
                                                        {new Date(log.created_at).toLocaleString('pt-BR')}
                                                      </div>
                                                    </div>
                                                    <div className="text-xs font-medium">{log.descricao_log}</div>
                                                    {log.quantia && (
                                                      <div className="text-[10px] text-muted-foreground mt-1">
                                                        Quantia: R$ {parseFloat(log.quantia).toFixed(2)}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {dados.erro && (
                                            <div className="pt-3">
                                              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/50 rounded p-2">
                                                <strong>Erro:</strong> {dados.erro}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    )}
                                  </Collapsible>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Resumo */}
                      {resultado.resumo && (
                        <div>
                          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <Info className="h-4 w-4" />
                            Resumo
                          </h3>
                          <div className="border rounded-lg p-4 bg-muted/20">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                {resultado.resumo.todas_etapas_concluidas ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-xs">Todas Etapas Concluídas</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {resultado.resumo.credito_finalizado ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-xs">Crédito Finalizado</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {resultado.resumo.disponivel_para_usuario ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-xs">Disponível para Usuário</span>
                              </div>
                              {resultado.resumo.metodo_finalizacao && (
                                <div>
                                  <span className="text-xs text-muted-foreground">Método: </span>
                                  <Badge variant="outline" className="text-[10px]">{resultado.resumo.metodo_finalizacao}</Badge>
                                </div>
                              )}
                              {resultado.resumo.tempo_processamento_minutos !== undefined && (
                                <div>
                                  <span className="text-xs text-muted-foreground">Tempo: </span>
                                  <span className="text-xs font-semibold">{resultado.resumo.tempo_processamento_minutos} min</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Erros */}
                      {resultado.erros && resultado.erros.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm text-red-400">Erros</h3>
                          <div className="space-y-2">
                            {resultado.erros.map((erro, idx) => (
                              <div key={idx} className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
                                <div className="font-semibold text-red-400 text-sm">{erro.codigo}</div>
                                <div className="text-xs">{erro.mensagem}</div>
                                {erro.acao_sugerida && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Sugestão: {erro.acao_sugerida}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Avisos */}
                      {resultado.avisos && resultado.avisos.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3 text-sm text-amber-400">Avisos</h3>
                          <div className="space-y-2">
                            {resultado.avisos.map((aviso, idx) => (
                              <div key={idx} className="border border-amber-500/50 rounded-lg p-3 bg-amber-500/10">
                                <div className="font-semibold text-amber-400 text-sm">{aviso.codigo}</div>
                                <div className="text-xs">{aviso.mensagem}</div>
                                {aviso.acao_sugerida && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Sugestão: {aviso.acao_sugerida}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <FailureDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedFailure(null);
        }}
        failure={selectedFailure}
        onRetry={handleRetryFromDetails}
        isRetrying={isRetrying}
      />

      <RetryConfirmModal
        isOpen={isRetryModalOpen}
        onClose={() => {
          setIsRetryModalOpen(false);
          setFailureToRetry(null);
        }}
        onConfirm={handleRetryConfirm}
        failure={failureToRetry}
        isLoading={isRetrying}
      />
    </div>
  );
}
