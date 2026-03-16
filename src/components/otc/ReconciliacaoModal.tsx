import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Check,
  AlertTriangle,
  X,
  FileCheck,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { otcService } from '@/services/otc';
import {
  OTCClient,
  ReconciliacaoResponse,
  DepositoReconciliacao,
  ReconciliacaoCreditarResponse,
} from '@/types/otc';

type Step = 'step1' | 'loading' | 'step2' | 'confirming' | 'crediting' | 'result' | 'error';

interface ReconciliacaoModalProps {
  isOpen: boolean;
  onClose: (wasSuccessful?: boolean) => void;
  client: OTCClient | null;
}

const formatCurrency = (value: number) =>
  otcService.formatCurrency(value);

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

/** Exibe texto truncado com tooltip para valor completo */
const TruncatedWithTooltip: React.FC<{
  text: string;
  maxLen?: number;
  className?: string;
}> = ({ text, maxLen = 32, className = '' }) => {
  const truncated = text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  const needsTooltip = text.length > maxLen;
  const content = (
    <span className={`font-mono text-sm break-all ${className}`} title={needsTooltip ? text : undefined}>
      {truncated}
    </span>
  );
  if (needsTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-left w-full min-w-0 hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md break-all font-mono text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
};

/** Card de depósito - layout limpo sem overflow */
const DepositoCard: React.FC<{
  d: DepositoReconciliacao;
  isSelected: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  status: 'nao_creditado' | 'creditado';
}> = ({ d, isSelected, onToggle, isExpanded, onToggleExpand, status }) => {
  const isNaoCreditado = status === 'nao_creditado';
  return (
    <div
      className={`
        rounded-lg border transition-colors
        ${isNaoCreditado ? 'border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20' : 'border-muted bg-muted/20'}
      `}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
        onClick={onToggleExpand}
      >
        {isNaoCreditado && (
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5 shrink-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              aria-label={`Selecionar ${d.endToEnd}`}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <span className="text-lg font-semibold text-foreground">
              {formatCurrency(d.valor)}
            </span>
            <Badge variant="outline" className="text-xs font-normal shrink-0">
              {d.provedor || '—'}
            </Badge>
            {isNaoCreditado ? (
              <span className="text-amber-600 dark:text-amber-500 text-sm font-medium">Não creditado</span>
            ) : (
              <span className="text-green-600 dark:text-green-500 text-sm font-medium">Já creditado</span>
            )}
          </div>
          <p className="text-sm text-foreground mt-1 truncate" title={d.pagadorNome || undefined}>
            {d.pagadorNome || '—'}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            <TruncatedWithTooltip text={d.endToEnd} maxLen={36} />
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-md bg-muted/40 dark:bg-muted/20 p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">End-to-End</span>
              <p className="font-mono text-xs break-all mt-0.5">{d.endToEnd}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Valor</span>
              <p className="font-medium mt-0.5">{formatCurrency(d.valor)}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Data/Hora</span>
              <p className="mt-0.5">{formatDateTime(d.dataHora)}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Pagador</span>
              <p className="mt-0.5">{d.pagadorNome || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Documento</span>
              <p className="font-mono text-xs mt-0.5">{d.pagadorDocumento || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Banco</span>
              <p className="mt-0.5">{d.pagadorBanco || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Provedor</span>
              <p className="mt-0.5">{d.provedor || '—'}</p>
            </div>
            {'credito_info' in d && d.credito_info && (
              <>
                <div>
                  <span className="text-muted-foreground block text-xs">Tipo crédito</span>
                  <p className="mt-0.5">{d.credito_info.tipo || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Transaction ID</span>
                  <p className="font-mono text-xs mt-0.5 break-all">{d.credito_info.transaction_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Creditado em</span>
                  <p className="mt-0.5">{formatDateTime(d.credito_info.created_at)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ReconciliacaoModal: React.FC<ReconciliacaoModalProps> = ({
  isOpen,
  onClose,
  client,
}) => {
  const [step, setStep] = useState<Step>('step1');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [resultado, setResultado] = useState<ReconciliacaoResponse | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [creditarResult, setCreditarResult] = useState<ReconciliacaoCreditarResponse | null>(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [creditadosOpen, setCreditadosOpen] = useState(false);

  const clienteId = client?.id ?? 0;
  const clienteNome = client?.name ?? '';

  const resetState = () => {
    setStep('step1');
    setDataInicio('');
    setDataFim('');
    setError(null);
    setResultado(null);
    setSelecionados(new Set());
    setCreditarResult(null);
    setShowDetalhes(false);
    setExpandedRow(null);
    setCreditadosOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 7);
      setDataFim(hoje.toISOString().split('T')[0]);
      setDataInicio(seteDiasAtras.toISOString().split('T')[0]);
    }
  }, [isOpen, clienteId]);

  const handleClose = (wasSuccessful?: boolean) => {
    resetState();
    onClose(wasSuccessful);
  };

  const validatePeriod = (): string | null => {
    if (!dataInicio || !dataFim) return 'Preencha as datas de início e fim.';
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    if (d1 > d2) return 'Data início deve ser menor ou igual à data fim.';
    return null;
  };

  const handleVerificar = async () => {
    const err = validatePeriod();
    if (err) {
      setError({ message: err });
      return;
    }
    setError(null);
    setStep('loading');

    try {
      const res = await otcService.getReconciliacao(clienteId, dataInicio, dataFim);
      setResultado(res);
      const defaultSelected = new Set(res.nao_creditados.map((d) => d.endToEnd));
      setSelecionados(defaultSelected);
      setStep('step2');
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data ?? {};
      if (status === 422 && data.error === 'ESTRATEGIA_NAO_DISPONIVEL') {
        setError({
          message:
            'Reconciliação BelmontX ainda não implementada. Use a exportação CSV do provider.',
          code: 'ESTRATEGIA_NAO_DISPONIVEL',
        });
      } else if (status === 403) {
        setError({ message: 'Sem permissão para reconciliar.' });
      } else if (status === 400) {
        setError({ message: data?.message || 'Datas inválidas.' });
      } else if (e?.name === 'AbortError' || e?.message?.includes('timeout')) {
        setError({ message: 'A consulta demorou muito. Tente um período menor.' });
      } else {
        setError({
          message: data?.message || 'Erro ao consultar reconciliação. Tente novamente.',
        });
      }
      setStep('error');
    }
  };

  const handleToggleDeposito = (endToEnd: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(endToEnd)) next.delete(endToEnd);
      else next.add(endToEnd);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!resultado) return;
    const all = new Set(resultado.nao_creditados.map((d) => d.endToEnd));
    setSelecionados(all);
  };

  const handleCreditar = () => {
    setStep('confirming');
  };

  const handleConfirmarCredito = async () => {
    if (!resultado) return;
    const toCredit = resultado.nao_creditados.filter((d) => selecionados.has(d.endToEnd));
    if (toCredit.length === 0) return;

    setStep('crediting');

    try {
      const res = await otcService.creditarDepositos(clienteId, toCredit);
      setCreditarResult(res);
      setStep('result');
    } catch (e: any) {
      const data = e?.response?.data ?? {};
      setError({
        message: data?.message || 'Erro ao creditar. Tente novamente.',
      });
      setStep('error');
    }
  };

  const totalSelecionado = resultado
    ? resultado.nao_creditados
        .filter((d) => selecionados.has(d.endToEnd))
        .reduce((s, d) => s + d.valor, 0)
    : 0;

  const estrategiaLabel = resultado?.cliente
    ? resultado.cliente.estrategia === 'account_id'
      ? `Por Account ID (accountId=${resultado.cliente.account_id ?? '—'})`
      : `Por PIX Key (${resultado.cliente.pix_key})`
    : '—';

  if (!client) return null;

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="max-w-3xl sm:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        >
          {/* Header fixo - pr-14 para o botão fechar */}
          <div className="shrink-0 px-6 pt-6 pb-4 pr-14 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileCheck className="h-5 w-5 text-primary" />
                {step === 'step1' ? 'Reconciliar depósitos' : 'Reconciliação'} — {clienteNome}
              </DialogTitle>
              <DialogDescription>
                {step === 'step1'
                  ? `Selecione o período para consultar depósitos no banco externo.`
                  : `Período: ${dataInicio} a ${dataFim} · ${estrategiaLabel}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body scrollável */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* Step 1 */}
            {step === 'step1' && (
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataFim">Data fim</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <div className="py-16 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="h-12 w-12 animate-spin text-primary" />
                <p className="font-medium">Consultando banco externo...</p>
                <p className="text-sm text-muted-foreground">
                  Buscando transações. Isso pode levar alguns segundos.
                </p>
              </div>
            )}

            {/* Step 2 - Lista em cards */}
            {step === 'step2' && resultado && (
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                )}

                {/* Resumo */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{resultado.resumo.nao_creditados}</strong> não creditados
                    {selecionados.size > 0 && (
                      <> · Total selecionado: <strong className="text-foreground">{formatCurrency(totalSelecionado)}</strong></>
                    )}
                  </span>
                </div>

                {/* Lista de não creditados */}
                <div className="space-y-3">
                  {resultado.nao_creditados.map((d) => (
                    <DepositoCard
                      key={d.endToEnd}
                      d={d}
                      isSelected={selecionados.has(d.endToEnd)}
                      onToggle={() => handleToggleDeposito(d.endToEnd)}
                      isExpanded={expandedRow === d.endToEnd}
                      onToggleExpand={() => setExpandedRow(expandedRow === d.endToEnd ? null : d.endToEnd)}
                      status="nao_creditado"
                    />
                  ))}
                </div>

                {/* Creditados: collapsible */}
                {resultado.creditados.length > 0 && (
                  <Collapsible open={creditadosOpen} onOpenChange={setCreditadosOpen} className="mt-6">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span>Ver {resultado.creditados.length} depósito(s) já creditado(s)</span>
                        {creditadosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 mt-3">
                        {resultado.creditados.map((d) => (
                          <DepositoCard
                            key={d.endToEnd}
                            d={d}
                            isSelected={false}
                            onToggle={() => {}}
                            isExpanded={expandedRow === d.endToEnd}
                            onToggleExpand={() => setExpandedRow(expandedRow === d.endToEnd ? null : d.endToEnd)}
                            status="creditado"
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}

            {/* Confirming */}
            {step === 'confirming' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Confirmar crédito</h3>
                <p className="text-muted-foreground">
                  Cliente: <strong className="text-foreground">{clienteNome}</strong> · {selecionados.size} depósitos ·{' '}
                  <strong className="text-foreground">{formatCurrency(totalSelecionado)}</strong>
                </p>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Esta ação não pode ser desfeita.</AlertDescription>
                </Alert>
              </div>
            )}

            {/* Crediting */}
            {step === 'crediting' && (
              <div className="py-16 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="h-12 w-12 animate-spin text-primary" />
                <p className="font-medium">Creditando depósitos...</p>
              </div>
            )}

            {/* Result */}
            {step === 'result' && creditarResult && (
              <div className="space-y-4">
                {creditarResult.failed === 0 && creditarResult.duplicates === 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                      <Check className="h-6 w-6" />
                      <span className="font-semibold">
                        {creditarResult.success} creditados · {formatCurrency(creditarResult.total_creditado)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">0 falhas · 0 duplicatas ignoradas</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-6 w-6" />
                      <span className="font-semibold">
                        {creditarResult.success} creditados · {creditarResult.failed} falhas ·{' '}
                        {creditarResult.duplicates} duplicatas
                      </span>
                    </div>
                    <p className="text-sm">Total creditado: {formatCurrency(creditarResult.total_creditado)}</p>
                    {creditarResult.detalhes?.length > 0 && (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDetalhes(!showDetalhes)}
                        >
                          {showDetalhes ? 'Ocultar detalhes' : 'Ver detalhes'}
                        </Button>
                        {showDetalhes && (
                          <div className="mt-2 rounded-lg border p-4 text-sm max-h-48 overflow-y-auto space-y-2">
                            {creditarResult.detalhes.map((d, i) => (
                              <div key={i} className="flex justify-between items-center gap-4 py-2 border-b last:border-0">
                                <span className="font-mono text-xs break-all">{d.reference_code}</span>
                                <span
                                  className={`shrink-0 font-medium ${
                                    d.status === 'success'
                                      ? 'text-green-600'
                                      : d.status === 'duplicate'
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {d.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {step === 'error' && error && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <X className="h-6 w-6" />
                  <span className="font-semibold">Erro</span>
                </div>
                <p>{error.message}</p>
              </div>
            )}
          </div>

          {/* Footer fixo com ações */}
          <div className="shrink-0 px-6 py-4 border-t bg-muted/30 flex flex-wrap items-center justify-end gap-2">
            {step === 'step1' && (
              <>
                <Button variant="outline" onClick={() => handleClose()}>
                  Cancelar
                </Button>
                <Button onClick={handleVerificar}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Verificar
                </Button>
              </>
            )}
            {step === 'step2' && resultado && (
              <>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Selecionar todos
                </Button>
                <Button
                  onClick={handleCreditar}
                  disabled={selecionados.size === 0}
                >
                  Creditar Selecionados ({selecionados.size})
                </Button>
              </>
            )}
            {step === 'confirming' && (
              <>
                <Button variant="outline" onClick={() => setStep('step2')}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarCredito}>Confirmar crédito</Button>
              </>
            )}
            {step === 'result' && (
              <Button onClick={() => handleClose(true)}>Fechar</Button>
            )}
            {step === 'error' && (
              <Button onClick={() => handleClose()}>Fechar</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default ReconciliacaoModal;
